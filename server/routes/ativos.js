import crypto from 'node:crypto'
import { Router } from 'express'
import { abrirAlerta, resolverPorChave } from '../alertasServico.js'
import { autenticar, exigirFuncao } from '../auth.js'
import { registrarHistorico } from '../cargas.js'
import { db, transaction } from '../db.js'
import { enderecoReverso } from '../geocode.js'
import { ativoToJson } from '../mappers.js'
import { agora, dentroDoTurno, horaLocal, partesLocais } from '../tempo.js'
import { publicar } from '../tempoReal.js'
import { horasPorDia } from '../uso.js'

const router = Router()
router.use(autenticar, exigirFuncao('admin'))

const fusoDa = (empresaId) => db.prepare('SELECT fuso FROM empresas WHERE id = ?').get(empresaId).fuso

export function buscarAtivo(id) {
  const a = db.prepare('SELECT * FROM ativos WHERE id = ?').get(id)
  if (!a) return null
  const hist = db.prepare('SELECT * FROM ativo_historico WHERE ativo_id = ? ORDER BY criado_em DESC, id DESC').all(id)
  return ativoToJson(a, hist, a.tipo === 'Carga' ? null : horasPorDia(id, fusoDa(a.empresa_id)))
}

const avisar = (empresaId) => publicar({ empresaId, recursos: ['ativos'] })

/** Garante que o ativo existe e é da empresa do usuário. */
function carregar(req, res, next) {
  req.ativo = db.prepare('SELECT * FROM ativos WHERE id = ? AND empresa_id = ?').get(req.params.id, req.usuario.empresaId)
  return req.ativo ? next() : res.status(404).json({ erro: 'Ativo não encontrado.' })
}

/** Colaborador da mesma empresa (administrador ou entregador). */
const colaborador = (id, empresaId) => (id ? db.prepare('SELECT id, nome FROM usuarios WHERE id = ? AND empresa_id = ?').get(Number(id), empresaId) : null)

// GET /api/ativos
router.get('/', (req, res) => {
  const fuso = fusoDa(req.usuario.empresaId)
  const linhas = db.prepare('SELECT * FROM ativos WHERE empresa_id = ? ORDER BY criado_em DESC').all(req.usuario.empresaId)
  const hist = db.prepare('SELECT * FROM ativo_historico WHERE ativo_id IN (SELECT id FROM ativos WHERE empresa_id = ?) ORDER BY criado_em DESC, id DESC').all(req.usuario.empresaId)
  const porAtivo = Map.groupBy(hist, (h) => h.ativo_id)
  res.json(linhas.map((a) => ativoToJson(a, porAtivo.get(a.id) ?? [], a.tipo === 'Carga' ? null : horasPorDia(a.id, fuso))))
})

// GET /api/ativos/:id
router.get('/:id', carregar, (req, res) => res.json(buscarAtivo(req.ativo.id)))

// POST /api/ativos  { nome (tipo de ativo genérico), tipo (categoria), identificacao, local, valor }
// Cargas não são cadastradas aqui: entram automaticamente ao criar uma entrega.
const PREFIXO = { Veículo: 'VEI', Equipamento: 'EQP', Ferramenta: 'FER' }
router.post('/', (req, res) => {
  const { nome = '', tipo, identificacao, valor = 0 } = req.body
  if (!nome.trim()) return res.status(400).json({ erro: 'Informe o tipo de ativo.' })
  if (!PREFIXO[tipo]) return res.status(400).json({ erro: 'Categoria inválida. Cargas entram automaticamente pelas entregas.' })
  if (!['QR', 'RFID', 'GPS'].includes(identificacao)) return res.status(400).json({ erro: 'Identificação inválida.' })
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(req.usuario.empresaId)
  const local = String(req.body.local ?? '').trim() || empresa.endereco || 'Base da empresa'
  let id
  do id = `${PREFIXO[tipo]}-${Math.floor(1000 + Math.random() * 8999)}`
  while (db.prepare('SELECT 1 FROM ativos WHERE id = ?').get(id))
  const quando = agora()
  transaction(() => {
    db.prepare(`INSERT INTO ativos (id, empresa_id, nome, tipo, identificacao, local, lat, lng, ultima_leitura_em, status, valor, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'disponivel', ?, ?)`).run(id, empresa.id, nome.trim(), tipo, identificacao, local, empresa.base_lat, empresa.base_lng, quando, Number(valor) || 0, quando)
    registrarHistorico(db, id, 'Ativo cadastrado', `Etiqueta ${identificacao} · por ${req.usuario.nome}`, 'var(--green)', quando)
  })
  avisar(empresa.id)
  res.status(201).json(buscarAtivo(id))
})

// POST /api/ativos/:id/movimentacao  { tipo: 'checkout' | 'checkin', responsavelId?, local?, lat?, lng?, leitura? }
router.post('/:id/movimentacao', carregar, async (req, res) => {
  const a = req.ativo
  const u = req.usuario
  const { tipo, leitura = 'manual' } = req.body
  if (!['checkout', 'checkin'].includes(tipo)) return res.status(400).json({ erro: 'Movimentação inválida.' })
  if (a.tipo === 'Carga') return res.status(400).json({ erro: 'Cargas são movimentadas pelo status da entrega.' })
  const lat = Number.isFinite(Number(req.body.lat)) && req.body.lat !== null ? Number(req.body.lat) : null
  const lng = lat != null ? Number(req.body.lng) : null
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(u.empresaId)
  const quando = agora()
  const leituraValida = ['qr', 'rfid'].includes(leitura) ? leitura : 'manual'
  const via = { qr: 'leitura do QR Code', rfid: 'leitor RFID', manual: 'registro manual' }[leituraValida]

  if (tipo === 'checkout') {
    const resp = colaborador(req.body.responsavelId, u.empresaId) ?? { id: u.id, nome: u.nome }
    transaction(() => {
      db.prepare("UPDATE ativos SET responsavel = ?, responsavel_id = ?, status = 'em_uso', ultima_leitura_em = ?, lat = COALESCE(?, lat), lng = COALESCE(?, lng) WHERE id = ?").run(resp.nome, resp.id, quando, lat, lng, a.id)
      db.prepare('INSERT INTO ativo_movimentacoes (ativo_id, tipo, responsavel, responsavel_id, local, lat, lng, via, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(a.id, 'checkout', resp.nome, resp.id, a.local, lat, lng, leituraValida, quando)
      registrarHistorico(db, a.id, `Check-out para ${resp.nome}`, `Retirado em ${a.local} · ${via} por ${u.nome}`, 'var(--pink)', quando)
    })
    if (!dentroDoTurno(quando, empresa)) {
      const p = partesLocais(quando, empresa.fuso)
      abrirAlerta({
        empresaId: empresa.id, tipo: 'uso_indevido', severidade: 'baixo', chave: `uso:${a.id}:${p.ano}-${p.mes}-${p.dia}`, referencia: a.id,
        titulo: `Retirada fora do turno — ${a.id}`, entidade: `${a.nome} · ${horaLocal(quando, empresa.fuso)}`,
        descricao: `${a.nome} retirado por ${resp.nome} fora do expediente (${empresa.turno_inicio}–${empresa.turno_fim}).`,
      })
    }
  } else {
    // local: o informado, ou o nome do lugar da leitura GPS
    const local = String(req.body.local ?? '').trim() || (lat != null ? await enderecoReverso(lat, lng) : null) || empresa.endereco || 'Base da empresa'
    transaction(() => {
      db.prepare("UPDATE ativos SET local = ?, status = 'disponivel', responsavel = NULL, responsavel_id = NULL, ultima_leitura_em = ?, lat = COALESCE(?, lat), lng = COALESCE(?, lng) WHERE id = ?").run(local, quando, lat, lng, a.id)
      db.prepare('INSERT INTO ativo_movimentacoes (ativo_id, tipo, responsavel, responsavel_id, local, lat, lng, via, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(a.id, 'checkin', u.nome, u.id, local, lat, lng, leituraValida, quando)
      registrarHistorico(db, a.id, `Check-in em ${local}`, `Devolvido · ${via} por ${u.nome}${lat != null ? ' (com GPS)' : ''}`, 'var(--green)', quando)
    })
    resolverPorChave(empresa.id, `extraviado:${a.id}`)
  }
  resolverPorChave(empresa.id, `inatividade:${a.id}`)
  avisar(empresa.id)
  res.json(buscarAtivo(a.id))
})

// PATCH /api/ativos/:id/responsavel  { responsavelId }
router.patch('/:id/responsavel', carregar, (req, res) => {
  const resp = colaborador(req.body.responsavelId, req.usuario.empresaId)
  if (!resp) return res.status(400).json({ erro: 'Colaborador não encontrado.' })
  transaction(() => {
    db.prepare('UPDATE ativos SET responsavel = ?, responsavel_id = ? WHERE id = ?').run(resp.nome, resp.id, req.ativo.id)
    registrarHistorico(db, req.ativo.id, `Transferido para ${resp.nome}`, `Por ${req.usuario.nome}`)
  })
  avisar(req.usuario.empresaId)
  res.json(buscarAtivo(req.ativo.id))
})

// POST /api/ativos/:id/extraviado
router.post('/:id/extraviado', carregar, (req, res) => {
  const a = req.ativo
  transaction(() => {
    db.prepare("UPDATE ativos SET status = 'extraviado' WHERE id = ?").run(a.id)
    registrarHistorico(db, a.id, 'Marcado como extraviado', `Por ${req.usuario.nome}`, 'var(--red)')
  })
  abrirAlerta({
    empresaId: a.empresa_id, tipo: 'inatividade', severidade: 'alto', chave: `extraviado:${a.id}`, referencia: a.id,
    titulo: `Extraviado — ${a.id}`, entidade: `${a.nome} · último local: ${a.local ?? '—'}`, descricao: `${req.usuario.nome} marcou ${a.nome} como extraviado. Faça o check-in quando for encontrado.`,
  })
  avisar(a.empresa_id)
  res.json(buscarAtivo(a.id))
})

// POST /api/ativos/:id/rastreador — gera o token do rastreador GPS (mostrado uma única vez)
router.post('/:id/rastreador', carregar, (req, res) => {
  const token = `trk_${crypto.randomBytes(24).toString('hex')}`
  db.prepare('UPDATE ativos SET dispositivo_token = ? WHERE id = ?').run(token, req.ativo.id)
  registrarHistorico(db, req.ativo.id, 'Rastreador GPS vinculado', `Por ${req.usuario.nome}`)
  avisar(req.usuario.empresaId)
  res.json({ token, ativo: buscarAtivo(req.ativo.id) })
})
router.delete('/:id/rastreador', carregar, (req, res) => {
  db.prepare('UPDATE ativos SET dispositivo_token = NULL, bateria = NULL WHERE id = ?').run(req.ativo.id)
  registrarHistorico(db, req.ativo.id, 'Rastreador GPS desvinculado', `Por ${req.usuario.nome}`)
  avisar(req.usuario.empresaId)
  res.json(buscarAtivo(req.ativo.id))
})

// GET /api/ativos/:id/posicoes?horas=24 — trilha do rastreador
router.get('/:id/posicoes', carregar, (req, res) => {
  const horas = Math.min(168, Number(req.query.horas) || 24)
  const desde = new Date(Date.now() - horas * 3600_000).toISOString()
  res.json(db.prepare('SELECT lat, lng, velocidade, criado_em AS em FROM posicoes WHERE ativo_id = ? AND criado_em >= ? ORDER BY criado_em').all(req.ativo.id, desde))
})

export default router
