import { Router } from 'express'
import { autenticar, exigirPerfil } from '../auth.js'
import { db, transaction } from '../db.js'
import { alertaToJson } from '../mappers.js'

const router = Router()
router.use(autenticar, exigirPerfil('empresa'))

function buscarAlerta(id) {
  const a = db.prepare('SELECT * FROM alertas WHERE id = ?').get(id)
  return a ? alertaToJson(a, db.prepare('SELECT * FROM alerta_passos WHERE alerta_id = ? ORDER BY ordem').all(id)) : null
}

function carregar(req, res, next) {
  return db.prepare('SELECT 1 FROM alertas WHERE id = ?').get(req.params.id) ? next() : res.status(404).json({ erro: 'Alerta não encontrado.' })
}

// GET /api/alertas
router.get('/', (req, res) => res.json(db.prepare('SELECT id FROM alertas ORDER BY id').all().map((r) => buscarAlerta(r.id))))

// POST /api/alertas/:id/assumir
router.post('/:id/assumir', carregar, (req, res) => {
  db.prepare("UPDATE alertas SET status = 'tratamento', responsavel = ? WHERE id = ?").run(req.usuario.nome, req.params.id)
  res.json(buscarAlerta(req.params.id))
})

// POST /api/alertas/:id/resolver  — conclui todos os passos do fluxo
router.post('/:id/resolver', carregar, (req, res) => {
  transaction(() => {
    db.prepare("UPDATE alertas SET status = 'resolvido' WHERE id = ?").run(req.params.id)
    db.prepare('UPDATE alerta_passos SET feito = 1 WHERE alerta_id = ?').run(req.params.id)
  })
  res.json(buscarAlerta(req.params.id))
})

// PATCH /api/alertas/:id/passos/:ordem  — marca/desmarca um passo do fluxo de resposta
router.patch('/:id/passos/:ordem', carregar, (req, res) => {
  db.prepare('UPDATE alerta_passos SET feito = 1 - feito WHERE alerta_id = ? AND ordem = ?').run(req.params.id, Number(req.params.ordem))
  res.json(buscarAlerta(req.params.id))
})

export default router
