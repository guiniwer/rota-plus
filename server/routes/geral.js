import { Router } from 'express'
import { autenticar, exigirPerfil } from '../auth.js'
import { db, resetDatabase } from '../db.js'
import { notificacaoToJson } from '../mappers.js'

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
router.get('/equipe', exigirPerfil('empresa'), (req, res) => res.json(db.prepare('SELECT * FROM equipe ORDER BY id').all()))

// ---------- restaurar dados de demonstração ----------
router.post('/demo/reset', exigirPerfil('empresa'), (req, res) => {
  resetDatabase()
  res.json({ ok: true, mensagem: 'Banco restaurado. Faça login novamente.' })
})

export default router
