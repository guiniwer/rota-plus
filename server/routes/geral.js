import { Router } from 'express'
import { autenticar, exigirFuncao } from '../auth.js'
import { db, resetDatabase } from '../db.js'
import { equipeToJson, notificacaoToJson } from '../mappers.js'

// Notificações, configurações, equipe e utilidades
const router = Router()
router.use(['/notificacoes', '/configuracoes', '/equipe', '/demo'], autenticar)

// ---------- notificações do usuário logado ----------
router.get('/notificacoes', (req, res) => {
  res.json(db.prepare('SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY id DESC').all(req.usuario.id).map(notificacaoToJson))
})
router.post('/notificacoes/lidas', (req, res) => {
  db.prepare('UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?').run(req.usuario.id)
  res.status(204).end()
})
router.post('/notificacoes/:id/lida', (req, res) => {
  db.prepare('UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?').run(Number(req.params.id), req.usuario.id)
  res.status(204).end()
})

// ---------- configurações (chave/valor por usuário) ----------
const CHAVES = ['preferencias', 'privacidade']
router.get('/configuracoes/:chave', (req, res) => {
  if (!CHAVES.includes(req.params.chave)) return res.status(404).json({ erro: 'Configuração desconhecida.' })
  const row = db.prepare('SELECT valor FROM configuracoes WHERE usuario_id = ? AND chave = ?').get(req.usuario.id, req.params.chave)
  res.json(row ? JSON.parse(row.valor) : {})
})
router.put('/configuracoes/:chave', (req, res) => {
  if (!CHAVES.includes(req.params.chave)) return res.status(404).json({ erro: 'Configuração desconhecida.' })
  db.prepare(
    'INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, ?, ?) ON CONFLICT (usuario_id, chave) DO UPDATE SET valor = excluded.valor',
  ).run(req.usuario.id, req.params.chave, JSON.stringify(req.body))
  res.json(req.body)
})

// ---------- equipe de campo ----------
// Para quem tem login de entregador, "hoje" e o status vêm das entregas atribuídas a ele.
router.get('/equipe', exigirFuncao('admin'), (req, res) => {
  const stats = db.prepare(`SELECT COUNT(*) AS total,
      SUM(status = 'entregue') AS entregues,
      SUM(status IN ('transito', 'saiu', 'atrasado')) AS em_rota
    FROM entregas WHERE entregador_id = ? AND status <> 'cancelado'`)
  const lista = db.prepare('SELECT * FROM equipe ORDER BY id').all().map((p) => {
    if (!p.usuario_id) return equipeToJson(p)
    const s = stats.get(p.usuario_id)
    return equipeToJson({
      ...p,
      hoje: s.total ? `${s.entregues} / ${s.total}` : '—',
      status: s.em_rota ? 'Em rota' : p.status === 'Em rota' ? 'Disponível' : p.status,
    })
  })
  res.json(lista)
})

// ---------- restaurar dados de demonstração ----------
router.post('/demo/reset', exigirFuncao('admin'), (req, res) => {
  resetDatabase()
  res.json({ ok: true, mensagem: 'Banco restaurado. Faça login novamente.' })
})

export default router
