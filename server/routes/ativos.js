import { Router } from 'express'
import { autenticar, exigirFuncao } from '../auth.js'
import { db, transaction } from '../db.js'
import { ativoToJson } from '../mappers.js'
import { nowLabel } from '../../src/utils/format.js'

const router = Router()
router.use(autenticar, exigirFuncao('admin'))

function buscarAtivo(id) {
  const a = db.prepare('SELECT * FROM ativos WHERE id = ?').get(id)
  if (!a) return null
  const hist = db.prepare('SELECT * FROM ativo_historico WHERE ativo_id = ? ORDER BY id DESC').all(id)
  return ativoToJson(a, hist)
}

const registrar = (id, titulo, descricao, cor = null) =>
  db.prepare('INSERT INTO ativo_historico (ativo_id, titulo, descricao, data, cor) VALUES (?, ?, ?, ?, ?)').run(id, titulo, descricao, nowLabel(), cor)

/** Garante que o ativo existe antes de seguir. */
function carregar(req, res, next) {
  req.ativo = db.prepare('SELECT * FROM ativos WHERE id = ?').get(req.params.id)
  return req.ativo ? next() : res.status(404).json({ erro: 'Ativo não encontrado.' })
}

// GET /api/ativos
router.get('/', (req, res) => res.json(db.prepare('SELECT id FROM ativos ORDER BY ordem DESC').all().map((r) => buscarAtivo(r.id))))

// POST /api/ativos  { nome (tipo de ativo genérico), tipo (categoria), identificacao, local, valor }
// Cargas não são cadastradas aqui: entram automaticamente ao criar uma entrega.
const PREFIXO = { Veículo: 'VEI', Equipamento: 'EQP', Ferramenta: 'FER' }
router.post('/', (req, res) => {
  const { nome = '', tipo, identificacao, local = 'Almoxarifado CD', valor = 0 } = req.body
  if (!nome.trim()) return res.status(400).json({ erro: 'Informe o tipo de ativo.' })
  if (!PREFIXO[tipo]) return res.status(400).json({ erro: 'Categoria inválida. Cargas entram automaticamente pelas entregas.' })
  if (!['QR', 'RFID', 'GPS'].includes(identificacao)) return res.status(400).json({ erro: 'Identificação inválida.' })
  const prefixo = PREFIXO[tipo]
  let id
  do id = `${prefixo}-${Math.floor(1000 + Math.random() * 8999)}`
  while (db.prepare('SELECT 1 FROM ativos WHERE id = ?').get(id))
  const ordem = (db.prepare('SELECT MAX(ordem) AS m FROM ativos').get().m ?? 0) + 1
  transaction(() => {
    db.prepare(`INSERT INTO ativos (id, nome, tipo, identificacao, bateria, responsavel, local, ultima_leitura, status, valor, x, y, uso, ordem)
      VALUES (?, ?, ?, ?, ?, NULL, ?, 'agora', 'disponivel', ?, ?, ?, ?, ?)`).run(
      id, nome.trim(), tipo, identificacao, identificacao === 'GPS' ? 100 : null, local, Number(valor) || 0,
      150 + Math.random() * 700, 80 + Math.random() * 380, JSON.stringify(Array(14).fill(0)), ordem,
    )
    registrar(id, 'Ativo cadastrado', `Etiqueta ${identificacao} vinculada`, 'var(--green)')
  })
  res.status(201).json(buscarAtivo(id))
})

// POST /api/ativos/:id/movimentacao  { tipo: 'checkin' | 'checkout', responsavel, local }
router.post('/:id/movimentacao', carregar, (req, res) => {
  const { tipo, responsavel, local } = req.body
  const a = req.ativo
  transaction(() => {
    if (tipo === 'checkout') {
      db.prepare("UPDATE ativos SET responsavel = ?, status = 'em_uso', ultima_leitura = 'agora' WHERE id = ?").run(responsavel, a.id)
      registrar(a.id, `Check-out para ${responsavel}`, `Retirado em ${a.local}`, 'var(--pink)')
    } else {
      db.prepare("UPDATE ativos SET local = ?, status = 'disponivel', ultima_leitura = 'agora' WHERE id = ?").run(local, a.id)
      registrar(a.id, `Check-in em ${local}`, `Registrado por ${responsavel} via QR Code`, 'var(--green)')
    }
  })
  res.json(buscarAtivo(a.id))
})

// PATCH /api/ativos/:id/responsavel  { responsavel }
router.patch('/:id/responsavel', carregar, (req, res) => {
  transaction(() => {
    db.prepare('UPDATE ativos SET responsavel = ? WHERE id = ?').run(req.body.responsavel, req.ativo.id)
    registrar(req.ativo.id, `Transferido para ${req.body.responsavel}`, 'Responsabilidade atualizada')
  })
  res.json(buscarAtivo(req.ativo.id))
})

// POST /api/ativos/:id/extraviado
router.post('/:id/extraviado', carregar, (req, res) => {
  transaction(() => {
    db.prepare("UPDATE ativos SET status = 'extraviado' WHERE id = ?").run(req.ativo.id)
    registrar(req.ativo.id, 'Marcado como extraviado', 'Equipe notificada para busca', 'var(--red)')
  })
  res.json(buscarAtivo(req.ativo.id))
})

export default router
