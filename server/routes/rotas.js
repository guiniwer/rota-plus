import { Router } from 'express'
import { autenticar, exigirFuncao } from '../auth.js'
import { db } from '../db.js'
import { otimizarRota } from '../rota.js'

const router = Router()
router.use(autenticar, exigirFuncao('admin', 'entregador'))

// GET /api/rotas/otimizada?entregadorId=  — o entregador vê a própria rota; o admin escolhe o entregador
router.get('/otimizada', async (req, res, next) => {
  const u = req.usuario
  const entregadorId = u.funcao === 'entregador' ? u.id : Number(req.query.entregadorId)
  if (!entregadorId) return res.status(400).json({ erro: 'Informe o entregador.' })
  // paradas pendentes, na ordem em que foram atribuídas (base da comparação de economia)
  const paradas = db
    .prepare(`SELECT id, cliente, destino, janela, status, lat, lng FROM entregas
      WHERE entregador_id = ? AND status NOT IN ('entregue', 'cancelado') AND lat IS NOT NULL ORDER BY ordem`)
    .all(entregadorId)
  try {
    res.json(await otimizarRota(paradas))
  } catch (err) {
    next(err)
  }
})

export default router
