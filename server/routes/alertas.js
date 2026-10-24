import { Router } from 'express'
import { autenticar, exigirFuncao } from '../auth.js'
import { db, transaction } from '../db.js'
import { alertaToJson } from '../mappers.js'
import { DIA, agora } from '../tempo.js'
import { publicar } from '../tempoReal.js'

const router = Router()
router.use(autenticar, exigirFuncao('admin'))

function buscarAlerta(id) {
  const a = db.prepare('SELECT * FROM alertas WHERE id = ?').get(id)
  return a ? alertaToJson(a, db.prepare('SELECT * FROM alerta_passos WHERE alerta_id = ? ORDER BY ordem').all(id)) : null
}

function carregar(req, res, next) {
  req.alerta = db.prepare('SELECT * FROM alertas WHERE id = ? AND empresa_id = ?').get(Number(req.params.id), req.usuario.empresaId)
  return req.alerta ? next() : res.status(404).json({ erro: 'Alerta não encontrado.' })
}

const responder = (req, res) => {
  publicar({ empresaId: req.usuario.empresaId, recursos: ['alertas'] })
  res.json(buscarAlerta(req.alerta.id))
}

// GET /api/alertas — abertos + resolvidos nos últimos 30 dias
router.get('/', (req, res) => {
  const desde = new Date(Date.now() - 30 * DIA).toISOString()
  const linhas = db.prepare("SELECT * FROM alertas WHERE empresa_id = ? AND (status <> 'resolvido' OR resolvido_em >= ?) ORDER BY aberto_em DESC").all(req.usuario.empresaId, desde)
  const passos = db.prepare('SELECT * FROM alerta_passos WHERE alerta_id IN (SELECT value FROM json_each(?)) ORDER BY ordem').all(JSON.stringify(linhas.map((a) => a.id)))
  const porAlerta = Map.groupBy(passos, (p) => p.alerta_id)
  res.json(linhas.map((a) => alertaToJson(a, porAlerta.get(a.id) ?? [])))
})

// POST /api/alertas/:id/assumir
router.post('/:id/assumir', carregar, (req, res, next) => {
  db.prepare("UPDATE alertas SET status = 'tratamento', responsavel = ? WHERE id = ? AND status <> 'resolvido'").run(req.usuario.nome, req.alerta.id)
  next()
}, responder)

// POST /api/alertas/:id/resolver  — conclui todos os passos do fluxo
router.post('/:id/resolver', carregar, (req, res, next) => {
  transaction(() => {
    db.prepare("UPDATE alertas SET status = 'resolvido', resolvido_em = ?, resolucao = 'manual', responsavel = COALESCE(responsavel, ?) WHERE id = ? AND status <> 'resolvido'").run(agora(), req.usuario.nome, req.alerta.id)
    db.prepare('UPDATE alerta_passos SET feito = 1 WHERE alerta_id = ?').run(req.alerta.id)
  })
  next()
}, responder)

// PATCH /api/alertas/:id/passos/:ordem  — marca/desmarca um passo do fluxo de resposta
router.patch('/:id/passos/:ordem', carregar, (req, res, next) => {
  db.prepare('UPDATE alerta_passos SET feito = 1 - feito WHERE alerta_id = ? AND ordem = ?').run(req.alerta.id, Number(req.params.ordem))
  next()
}, responder)

export default router
