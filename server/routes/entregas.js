import { Router } from 'express'
import { autenticar, exigirPerfil } from '../auth.js'
import { db, transaction } from '../db.js'
import { entregaToJson } from '../mappers.js'
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

function listar(usuario) {
  const rows =
    usuario.perfil === 'empresa'
      ? db.prepare('SELECT id FROM entregas ORDER BY ordem DESC').all()
      : db.prepare('SELECT id FROM entregas WHERE usuario_id = ? ORDER BY ordem DESC').all(usuario.id)
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

// POST /api/entregas  (novo pedido do cliente ou nova entrega da empresa)
router.post('/', (req, res) => {
  const d = req.body
  if (!d.destino || !d.origem) return res.status(400).json({ erro: 'Origem e destino são obrigatórios.' })
  const u = req.usuario
  const cliente = u.perfil === 'cliente'
  let id
  do id = `RT-${Math.floor(10000 + Math.random() * 89999)}-BR`
  while (db.prepare('SELECT 1 FROM entregas WHERE id = ?').get(id))

  const ordem = (db.prepare('SELECT MAX(ordem) AS m FROM entregas').get().m ?? 0) + 1
  const criadoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')

  transaction(() => {
    db.prepare(`INSERT INTO entregas
      (id, usuario_id, cliente, documento, remetente, destinatario, origem, destino, tipo_carga, peso_taxado, modalidade, rastreio, valor, status, criado_em, previsao, janela, responsavel, progresso, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', ?, ?, ?, ?, 0, ?)`).run(
      id, cliente ? u.id : null, cliente ? u.nome : d.cliente, cliente ? u.documento : digitos(d.documento), d.remetente ?? u.nome, d.destinatario ?? '', d.origem, d.destino,
      d.tipoCarga ?? '', Number(d.pesoTaxado) || 0, d.modalidade === 'expressa' ? 'expressa' : 'normal', d.rastreio === 'gps' ? 'gps' : 'cd', Number(d.valor) || 0,
      cliente ? criadoEm : 'Hoje', d.prazoTexto ?? '', d.janela ?? '—', d.responsavel ?? null, ordem,
    )
    db.prepare('INSERT INTO entrega_eventos (entrega_id, titulo, descricao, data) VALUES (?, ?, ?, ?)').run(id, 'Pedido confirmado', 'Aguardando coleta na origem', nowLabel())
    if (cliente) notificar(u.id, { icon: 'check', cor: 'var(--green)', titulo: 'Pedido confirmado', texto: `Seu pedido ${id} foi registrado. Acompanhe pelo código.` })
  })
  res.status(201).json(buscarEntrega(id))
})

// PATCH /api/entregas/:id/status  { status, descricao }  — empresa / app de campo
router.patch('/:id/status', exigirPerfil('empresa'), (req, res) => {
  const { status, descricao = '' } = req.body
  if (!STATUS_ENTREGA[status]) return res.status(400).json({ erro: 'Status inválido.' })
  const e = db.prepare('SELECT * FROM entregas WHERE id = ?').get(req.params.id)
  if (!e) return res.status(404).json({ erro: 'Entrega não encontrada.' })
  transaction(() => {
    db.prepare('UPDATE entregas SET status = ?, progresso = CASE WHEN ? = \'entregue\' THEN 1 ELSE progresso END WHERE id = ?').run(status, status, e.id)
    db.prepare('INSERT INTO entrega_eventos (entrega_id, titulo, descricao, data) VALUES (?, ?, ?, ?)').run(e.id, STATUS_ENTREGA[status].label, descricao, nowLabel())
    notificar(e.usuario_id, { icon: status === 'entregue' ? 'box' : 'truck', cor: status === 'entregue' ? 'var(--green)' : 'var(--pink)', titulo: STATUS_ENTREGA[status].label, texto: `Pedido ${e.id}: ${descricao || STATUS_ENTREGA[status].label}.` })
  })
  res.json(buscarEntrega(e.id))
})

// PATCH /api/entregas/:id/responsavel  { responsavel }
router.patch('/:id/responsavel', exigirPerfil('empresa'), (req, res) => {
  const r = db.prepare('UPDATE entregas SET responsavel = ? WHERE id = ?').run(req.body.responsavel || null, req.params.id)
  if (!r.changes) return res.status(404).json({ erro: 'Entrega não encontrada.' })
  res.json(buscarEntrega(req.params.id))
})

// POST /api/entregas/:id/avaliacao  { nota, estado, comentario }
router.post('/:id/avaliacao', (req, res) => {
  const acesso = podeAcessar(req.usuario, req.params.id)
  if (acesso === 'nao_existe') return res.status(404).json({ erro: 'Entrega não encontrada.' })
  if (!acesso) return res.status(403).json({ erro: 'Esta entrega não é sua.' })
  const { nota, estado, comentario = '' } = req.body
  if (!(nota >= 1 && nota <= 5)) return res.status(400).json({ erro: 'A nota deve ser de 1 a 5.' })
  db.prepare("UPDATE entregas SET avaliacao_nota = ?, avaliacao_estado = ?, avaliacao_comentario = ?, status = 'entregue', progresso = 1 WHERE id = ?").run(nota, estado, comentario, req.params.id)
  res.json(buscarEntrega(req.params.id))
})

export default router
