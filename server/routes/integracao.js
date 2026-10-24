// API de integração (ERP, WMS, e-commerce). Autenticação pelo cabeçalho X-Api-Key da empresa.
import { Router } from 'express'
import { autenticarApiKey } from '../auth.js'
import { db } from '../db.js'
import { buscarEntrega, criarEntrega, listarEntregas, mudarStatus } from '../entregasServico.js'
import { ativoToJson } from '../mappers.js'

const router = Router()
router.use(autenticarApiKey)

const tratar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erro: err.message })
    next(err)
  }
}

// GET /api/v1/entregas?status=saiu
router.get('/entregas', (req, res) => {
  const { status } = req.query
  res.json(status ? listarEntregas('e.empresa_id = ? AND e.status = ?', [req.empresa.id, String(status)]) : listarEntregas('e.empresa_id = ?', [req.empresa.id]))
})

// GET /api/v1/entregas/:id
router.get('/entregas/:id', (req, res) => {
  const e = db.prepare('SELECT id FROM entregas WHERE id = ? AND empresa_id = ?').get(req.params.id, req.empresa.id)
  if (!e) return res.status(404).json({ erro: 'Entrega não encontrada.' })
  res.json(buscarEntrega(e.id))
})

// POST /api/v1/entregas  { cliente, documento?, destinatario?, telefoneDestinatario?, emailDestinatario?, destino, destinoCidade?, tipoCarga?, janela? | prazoLimite?, valorNF?, entregadorId? }
router.post('/entregas', tratar(async (req, res) => res.status(201).json(await criarEntrega(req.empresa, req.body))))

// PATCH /api/v1/entregas/:id/status  { status, descricao? }
router.patch('/entregas/:id/status', tratar((req, res) => {
  const e = db.prepare('SELECT * FROM entregas WHERE id = ? AND empresa_id = ?').get(req.params.id, req.empresa.id)
  if (!e) return res.status(404).json({ erro: 'Entrega não encontrada.' })
  res.json(mudarStatus(e, req.body.status, { descricao: req.body.descricao ?? '' }))
}))

// GET /api/v1/ativos
router.get('/ativos', (req, res) => res.json(db.prepare('SELECT * FROM ativos WHERE empresa_id = ? ORDER BY criado_em DESC').all(req.empresa.id).map((a) => ativoToJson(a))))

export default router
