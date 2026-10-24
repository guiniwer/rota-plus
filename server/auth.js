import crypto from 'node:crypto'
import { db } from './db.js'
import { userToJson } from './mappers.js'
import { DIA, agora } from './tempo.js'

const SESSAO_DIAS = Number(process.env.SESSAO_DIAS ?? 30)

/** Usuário com os dados da empresa (nome, CNPJ) — todo acesso ao usuário passa por aqui. */
export const SQL_USUARIO = `SELECT u.*, e.razao_social AS empresa_razao, e.fantasia AS empresa_fantasia, e.cnpj AS cnpj
  FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id`
export const buscarUsuario = (id) => db.prepare(`${SQL_USUARIO} WHERE u.id = ?`).get(id)

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

const expiracao = () => new Date(Date.now() + SESSAO_DIAS * DIA).toISOString()

export function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessoes (token, usuario_id, expira_em) VALUES (?, ?, ?)').run(token, usuarioId, expiracao())
  return token
}

/**
 * Middleware: exige "Authorization: Bearer <token>" válido e não expirado.
 * Também aceita ?token= (EventSource e downloads não conseguem enviar cabeçalhos).
 */
export function autenticar(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.query.token
  const sessao = token ? db.prepare('SELECT * FROM sessoes WHERE token = ?').get(String(token)) : null
  if (!sessao || sessao.expira_em < agora()) {
    if (sessao) db.prepare('DELETE FROM sessoes WHERE token = ?').run(sessao.token)
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' })
  }
  // sessão deslizante: quem usa o sistema não é desconectado
  if (new Date(sessao.expira_em).getTime() - Date.now() < (SESSAO_DIAS / 2) * DIA) {
    db.prepare('UPDATE sessoes SET expira_em = ? WHERE token = ?').run(expiracao(), sessao.token)
  }
  req.usuario = userToJson(buscarUsuario(sessao.usuario_id))
  req.token = sessao.token
  next()
}

/** Middleware: restringe a rota a um perfil (ex.: só cliente). */
export const exigirPerfil = (perfil) => (req, res, next) =>
  req.usuario.perfil === perfil ? next() : res.status(403).json({ erro: 'Acesso permitido apenas para o perfil ' + perfil + '.' })

/** Middleware: restringe a rota a uma função da empresa ('admin' ou 'entregador'). */
export const exigirFuncao = (...funcoes) => (req, res, next) =>
  req.usuario.perfil === 'empresa' && funcoes.includes(req.usuario.funcao)
    ? next()
    : res.status(403).json({ erro: funcoes.includes('admin') ? 'Acesso permitido apenas para administradores.' : 'Acesso permitido apenas para entregadores.' })

/** Middleware da API de integração: cabeçalho "X-Api-Key" da empresa. */
export function autenticarApiKey(req, res, next) {
  const chave = req.get('x-api-key')
  const empresa = chave ? db.prepare('SELECT * FROM empresas WHERE api_key = ?').get(chave) : null
  if (!empresa) return res.status(401).json({ erro: 'Chave de API inválida. Gere uma em Configurações › Integrações.' })
  req.empresa = empresa
  next()
}

/** Remove sessões vencidas (rodado pelo monitor). */
export const limparSessoes = () => db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(agora())
