import crypto from 'node:crypto'
import { db } from './db.js'
import { userToJson } from './mappers.js'

/** Gera o hash da senha com scrypt + salt aleatório (nunca guardamos a senha em texto). */
export function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function conferirSenha(senha, armazenado) {
  const [salt, hash] = armazenado.split(':')
  const teste = crypto.scryptSync(senha, salt, 64)
  return crypto.timingSafeEqual(teste, Buffer.from(hash, 'hex'))
}

export function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessoes (token, usuario_id) VALUES (?, ?)').run(token, usuarioId)
  return token
}

/** Middleware: exige o cabeçalho "Authorization: Bearer <token>" válido. */
export function autenticar(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  const row = token
    ? db.prepare('SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ?').get(token)
    : null
  if (!row) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' })
  req.usuario = userToJson(row)
  req.token = token
  next()
}

/** Middleware: restringe a rota a um perfil (ex.: só empresa). */
export const exigirPerfil = (perfil) => (req, res, next) =>
  req.usuario.perfil === perfil ? next() : res.status(403).json({ erro: 'Acesso permitido apenas para o perfil ' + perfil + '.' })

/** Middleware: restringe a rota a uma função da empresa ('admin' ou 'entregador'). */
export const exigirFuncao = (...funcoes) => (req, res, next) =>
  req.usuario.perfil === 'empresa' && funcoes.includes(req.usuario.funcao)
    ? next()
    : res.status(403).json({ erro: funcoes.includes('admin') ? 'Acesso permitido apenas para administradores.' : 'Acesso permitido apenas para entregadores.' })
