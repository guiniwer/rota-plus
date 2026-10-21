import { Router } from 'express'
import { autenticar, conferirSenha, criarSessao, hashSenha } from '../auth.js'
import { db } from '../db.js'
import { userToJson } from '../mappers.js'
import { PREFERENCIAS, PRIVACIDADE } from '../seedData.js'

const router = Router()
const digitos = (s = '') => String(s).replace(/\D/g, '')

// POST /api/auth/login  { perfil, email, senha, cnpj? }
router.post('/login', (req, res) => {
  const { perfil, email = '', senha = '', cnpj } = req.body
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.trim())
  if (!u || !conferirSenha(senha, u.senha_hash)) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
  if (u.perfil !== perfil) return res.status(403).json({ erro: `Esta conta é de ${u.perfil === 'empresa' ? 'empresa' : 'usuário'}. Troque a aba acima.` })
  if (perfil === 'empresa' && digitos(cnpj) !== u.cnpj) return res.status(401).json({ erro: 'CNPJ não confere com o cadastro.' })
  res.json({ token: criarSessao(u.id), usuario: userToJson(u) })
})

// POST /api/auth/cadastro  { perfil, nome, email, senha, documento, fantasia?, segmento? }
router.post('/cadastro', (req, res) => {
  const { perfil, nome = '', email = '', senha = '', documento = '', fantasia } = req.body
  if (!['cliente', 'empresa'].includes(perfil)) return res.status(400).json({ erro: 'Perfil inválido.' })
  if (nome.trim().length < 3 || !email.includes('@') || senha.length < 6) return res.status(400).json({ erro: 'Preencha nome, e-mail e senha (mín. 6 caracteres).' })
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email.trim())) return res.status(409).json({ erro: 'Já existe uma conta com este e-mail.' })

  const empresa = perfil === 'empresa'
  const r = db
    .prepare('INSERT INTO usuarios (perfil, nome, email, senha_hash, documento, empresa, cargo, cnpj) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(perfil, empresa ? 'Administrador' : nome.trim(), email.trim(), hashSenha(senha), empresa ? null : digitos(documento), empresa ? nome.trim() : null, empresa ? `Gestor · ${fantasia || nome.trim()}` : null, empresa ? digitos(documento) : null)
  const id = Number(r.lastInsertRowid)
  db.prepare('INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, ?, ?)').run(id, empresa ? 'privacidade' : 'preferencias', JSON.stringify(empresa ? PRIVACIDADE : PREFERENCIAS))
  if (!empresa) {
    db.prepare("INSERT INTO notificacoes (usuario_id, icon, cor, titulo, texto, quando) VALUES (?, 'star', 'var(--pink)', 'Bem-vindo(a) à Rota+!', 'Faça seu primeiro pedido e acompanhe tudo em tempo real.', 'agora')").run(id)
  }
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id)
  res.status(201).json({ token: criarSessao(id), usuario: userToJson(u) })
})

// GET /api/auth/me
router.get('/me', autenticar, (req, res) => res.json({ usuario: req.usuario }))

// POST /api/auth/logout
router.post('/logout', autenticar, (req, res) => {
  db.prepare('DELETE FROM sessoes WHERE token = ?').run(req.token)
  res.status(204).end()
})

export default router
