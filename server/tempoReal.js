// Atualizações em tempo real via Server-Sent Events (GET /api/eventos).
// O servidor só avisa QUAL recurso mudou; o navegador busca a versão nova na API.

const conexoes = new Set() // { res, usuarioId, empresaId, admin }

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
