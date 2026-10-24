// Atualizações em tempo real via Server-Sent Events (GET /api/eventos).
// O servidor só avisa QUAL recurso mudou; o navegador busca a versão nova na API.
//
// O EventSource não envia cabeçalhos, então a conexão usa um "ingresso" na URL em vez do token de login:
// o navegador pede o ingresso (POST /api/eventos/ingresso, com o token no cabeçalho), e ele vale uma única
// vez por 60 s. Assim o token da sessão nunca aparece em URLs nem em logs de proxy.
import crypto from 'node:crypto'
import { buscarUsuario } from './auth.js'
import { userToJson } from './mappers.js'

const conexoes = new Set() // { res, usuarioId, empresaId, admin }
const ingressos = new Map() // ingresso -> { usuarioId, expira }
const VALIDADE_INGRESSO_MS = 60_000

/** POST /api/eventos/ingresso (logado): ingresso de uso único para abrir o fluxo de eventos. */
export function emitirIngresso(req, res) {
  const agora = Date.now()
  for (const [k, v] of ingressos) if (v.expira < agora) ingressos.delete(k)
  const ingresso = crypto.randomBytes(24).toString('base64url')
  ingressos.set(ingresso, { usuarioId: req.usuario.id, expira: agora + VALIDADE_INGRESSO_MS })
  res.json({ ingresso, validoPorSegundos: VALIDADE_INGRESSO_MS / 1000 })
}

/** Middleware do GET /api/eventos: troca o ingresso (uma vez só) pelo usuário. */
export function autenticarIngresso(req, res, next) {
  const chave = String(req.query.ingresso ?? '')
  const i = ingressos.get(chave)
  ingressos.delete(chave)
  const u = i && i.expira >= Date.now() ? buscarUsuario(i.usuarioId) : null
  if (!u) return res.status(401).json({ erro: 'Ingresso inválido ou expirado.' })
  req.usuario = userToJson(u)
  next()
}

export function conectar(req, res) {
  const u = req.usuario
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write('retry: 5000\n\n')
  const c = { res, usuarioId: u.id, empresaId: u.empresaId, admin: u.funcao === 'admin' }
  conexoes.add(c)
  const pulso = setInterval(() => res.write(': ping\n\n'), 25_000)
  req.on('close', () => {
    clearInterval(pulso)
    conexoes.delete(c)
  })
}

/**
 * Avisa os interessados de que recursos mudaram.
 *  - empresaId: todos os administradores da empresa
 *  - usuarios: ids específicos (cliente dono, entregador designado…)
 */
export function publicar({ empresaId = null, usuarios = [], recursos, dados }) {
  const msg = `data: ${JSON.stringify({ recursos, ...(dados && { dados }) })}\n\n`
  for (const c of conexoes) {
    if ((empresaId && c.admin && c.empresaId === empresaId) || usuarios.includes(c.usuarioId)) c.res.write(msg)
  }
}

export const totalConexoes = () => conexoes.size
