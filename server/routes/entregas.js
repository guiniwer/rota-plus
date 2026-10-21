import { Router } from 'express'
import { autenticar, exigirFuncao, exigirPerfil } from '../auth.js'
import { criarAtivoDaEntrega, sincronizarAtivo } from '../cargas.js'
import { db, transaction } from '../db.js'
import { entregaToJson } from '../mappers.js'
import { cidadePorId } from '../../src/data/cidades.js'
import { nowLabel } from '../../src/utils/format.js'
import { STATUS_ENTREGA } from '../../src/utils/status.js'

const router = Router()
const digitos = (s = '') => String(s).replace(/\D/g, '')

/** Busca uma entrega com seus eventos (mais recente primeiro). */
export function buscarEntrega(id) {
  const e = db.prepare('SELECT * FROM entregas WHERE id = ?').get(id)
  if (!e) return null
  const eventos = db.prepare('SELECT * FROM entrega_eventos WHERE entrega_id = ? ORDER BY id DESC').all(id)
  return entregaToJson(e, eventos)
}

/** Admin vê todas; entregador só as atribuídas a ele; cliente só as próprias. */
function listar(u) {
  const rows =
    u.perfil === 'cliente'
      ? db.prepare('SELECT id FROM entregas WHERE usuario_id = ? ORDER BY ordem DESC').all(u.id)
      : u.funcao === 'entregador'
        ? db.prepare('SELECT id FROM entregas WHERE entregador_id = ? ORDER BY ordem DESC').all(u.id)
        : db.prepare('SELECT id FROM entregas ORDER BY ordem DESC').all()
  return rows.map((r) => buscarEntrega(r.id))
}

/** Cliente só pode mexer nas próprias entregas; empresa em todas. */
function podeAcessar(usuario, id) {
  const e = db.prepare('SELECT usuario_id FROM entregas WHERE id = ?').get(id)
  if (!e) return 'nao_existe'
  return usuario.perfil === 'empresa' || e.usuario_id === usuario.id
}

function notificar(usuarioId, n) {
  if (!usuarioId) return
  db.prepare('INSERT INTO notificacoes (usuario_id, icon, cor, titulo, texto, quando) VALUES (?, ?, ?, ?, ?, ?)').run(usuarioId, n.icon, n.cor, n.titulo, n.texto, 'agora')
}

/**
 * Coordenada aproximada do destino: centro da cidade escolhida + deslocamento estável
 * (derivado do endereço) de até ~4 km, para que endereços diferentes não caiam no mesmo ponto.
 */
function coordenadasDoDestino(cidadeId, endereco = '') {
  const c = cidadePorId(cidadeId)
  if (!c) return { lat: null, lng: null }
  let h = 0
  for (const ch of endereco) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const ang = ((h % 360) * Math.PI) / 180
  const raio = 0.008 + ((h >>> 9) % 1000) / 1000 * 0.028
  return { lat: c.lat + raio * Math.sin(ang), lng: c.lng + raio * Math.cos(ang) }
}

/** Entregador da empresa (usuário com função "entregador"), ou null. */
const entregadorPorId = (id) => (id ? db.prepare("SELECT id, nome FROM usuarios WHERE id = ? AND funcao = 'entregador'").get(Number(id)) : null)

// GET /api/rastreio?codigo=RT-...&documento=123...  (público, sem login)
export function rastreioPublico(req, res) {
  const { codigo = '', documento = '' } = req.query
  const e = db.prepare('SELECT id FROM entregas WHERE UPPER(id) = UPPER(?) AND documento = ?').get(codigo.trim(), digitos(documento))
  if (!e) return res.status(404).json({ erro: 'Encomenda não encontrada.' })
  res.json(buscarEntrega(e.id))
}

router.use(autenticar)

// GET /api/entregas
router.get('/', (req, res) => res.json(listar(req.usuario)))

// POST /api/entregas  (novo pedido do cliente ou nova entrega criada pelo administrador)
router.post('/', (req, res) => {
  const d = req.body
  const u = req.usuario
  if (u.funcao === 'entregador') return res.status(403).json({ erro: 'Entregadores não criam entregas.' })
  if (!d.destino || !d.origem) return res.status(400).json({ erro: 'Origem e destino são obrigatórios.' })
  const cliente = u.perfil === 'cliente'
  const entregador = cliente ? null : entregadorPorId(d.entregadorId)
  let id
  do id = `RT-${Math.floor(10000 + Math.random() * 89999)}-BR`
  while (db.prepare('SELECT 1 FROM entregas WHERE id = ?').get(id))

  const ordem = (db.prepare('SELECT MAX(ordem) AS m FROM entregas').get().m ?? 0) + 1
  const criadoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
  const { lat, lng } = coordenadasDoDestino(d.destinoCidade, d.destino)

  transaction(() => {
    db.prepare(`INSERT INTO entregas
      (id, usuario_id, cliente, documento, remetente, destinatario, origem, destino, tipo_carga, peso_taxado, modalidade, rastreio, valor, status, criado_em, previsao, janela, responsavel, entregador_id, lat, lng, progresso, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run(
      id, cliente ? u.id : null, cliente ? u.nome : d.cliente, cliente ? u.documento : digitos(d.documento), d.remetente ?? u.nome, d.destinatario ?? '', d.origem, d.destino,
      d.tipoCarga ?? '', Number(d.pesoTaxado) || 0, d.modalidade === 'expressa' ? 'expressa' : 'normal', d.rastreio === 'gps' ? 'gps' : 'cd', Number(d.valor) || 0,
      cliente ? criadoEm : 'Hoje', d.prazoTexto ?? '', d.janela ?? '—', entregador?.nome ?? null, entregador?.id ?? null, lat, lng, ordem,
    )
    db.prepare('INSERT INTO entrega_eventos (entrega_id, titulo, descricao, data) VALUES (?, ?, ?, ?)').run(id, 'Pedido confirmado', 'Aguardando coleta na origem', nowLabel())
    // toda entrega também vira um ativo (categoria "Carga")
    criarAtivoDaEntrega(db, db.prepare('SELECT * FROM entregas WHERE id = ?').get(id), d.valorNF)
    if (cliente) notificar(u.id, { icon: 'check', cor: 'var(--green)', titulo: 'Pedido confirmado', texto: `Seu pedido ${id} foi registrado. Acompanhe pelo código.` })
  })
  res.status(201).json(buscarEntrega(id))
})

// PATCH /api/entregas/:id/status  { status, descricao }  — administrador ou o entregador designado
router.patch('/:id/status', exigirFuncao('admin', 'entregador'), (req, res) => {
  const { status, descricao = '' } = req.body
  const u = req.usuario
  if (!STATUS_ENTREGA[status]) return res.status(400).json({ erro: 'Status inválido.' })
  const e = db.prepare('SELECT * FROM entregas WHERE id = ?').get(req.params.id)
  if (!e) return res.status(404).json({ erro: 'Entrega não encontrada.' })
  if (u.funcao === 'entregador' && e.entregador_id !== u.id) return res.status(403).json({ erro: 'Esta entrega não está atribuída a você.' })
  // o histórico registra quem fez a atualização (aparece na visão operacional)
  const texto = u.funcao === 'entregador' ? `${descricao || 'Status atualizado'} · por ${u.nome}` : descricao || 'Atualizado pela central'
  transaction(() => {
    db.prepare(`UPDATE entregas SET status = ?,
      progresso = CASE ? WHEN 'entregue' THEN 1 WHEN 'coletado' THEN MAX(progresso, 0.2) WHEN 'transito' THEN MAX(progresso, 0.4) WHEN 'saiu' THEN MAX(progresso, 0.7) ELSE progresso END,
      previsao = CASE WHEN ? = 'entregue' THEN ? ELSE previsao END
      WHERE id = ?`).run(status, status, status, `Entregue ${nowLabel()}`, e.id)
    db.prepare('INSERT INTO entrega_eventos (entrega_id, titulo, descricao, data) VALUES (?, ?, ?, ?)').run(e.id, STATUS_ENTREGA[status].label, texto, nowLabel())
    sincronizarAtivo(db, e.id, { descricao: texto, cor: status === 'entregue' ? 'var(--green)' : status === 'atrasado' || status === 'tentativa' ? 'var(--amber)' : null })
    notificar(e.usuario_id, { icon: status === 'entregue' ? 'box' : 'truck', cor: status === 'entregue' ? 'var(--green)' : 'var(--pink)', titulo: STATUS_ENTREGA[status].label, texto: `Pedido ${e.id}: ${descricao || STATUS_ENTREGA[status].label}.` })
  })
  res.json(buscarEntrega(e.id))
})

// PATCH /api/entregas/:id/responsavel  { entregadorId }  — só administrador
router.patch('/:id/responsavel', exigirFuncao('admin'), (req, res) => {
  const { entregadorId } = req.body
  const entregador = entregadorPorId(entregadorId)
  if (entregadorId && !entregador) return res.status(400).json({ erro: 'Entregador não encontrado.' })
  const r = db.prepare('UPDATE entregas SET responsavel = ?, entregador_id = ? WHERE id = ?').run(entregador?.nome ?? null, entregador?.id ?? null, req.params.id)
  if (!r.changes) return res.status(404).json({ erro: 'Entrega não encontrada.' })
  sincronizarAtivo(db, req.params.id, { titulo: entregador ? `Atribuída a ${entregador.nome}` : 'Entregador removido', descricao: 'Responsabilidade atualizada pela central' })
  res.json(buscarEntrega(req.params.id))
})

// POST /api/entregas/:id/avaliacao  { nota, estado, comentario }
router.post('/:id/avaliacao', exigirPerfil('cliente'), (req, res) => {
  const acesso = podeAcessar(req.usuario, req.params.id)
  if (acesso === 'nao_existe') return res.status(404).json({ erro: 'Entrega não encontrada.' })
  if (!acesso) return res.status(403).json({ erro: 'Esta entrega não é sua.' })
  const { nota, estado, comentario = '' } = req.body
  if (!(nota >= 1 && nota <= 5)) return res.status(400).json({ erro: 'A nota deve ser de 1 a 5.' })
  transaction(() => {
    db.prepare("UPDATE entregas SET avaliacao_nota = ?, avaliacao_estado = ?, avaliacao_comentario = ?, status = 'entregue', progresso = 1 WHERE id = ?").run(nota, estado, comentario, req.params.id)
    sincronizarAtivo(db, req.params.id, { titulo: 'Recebimento confirmado pelo cliente', descricao: `Avaliação ${nota}/5 · ${estado}` })
  })
  res.json(buscarEntrega(req.params.id))
})

export default router
