// Limite de tentativas por IP (memória do processo) para rotas públicas sensíveis:
// login, cadastro e rastreio por documento não podem ser testados por força bruta.
const janelas = new Map() // chave → { inicio, total }

export function limitar({ max, janelaMs, nome }) {
  return (req, res, next) => {
    const chave = `${nome}:${req.ip}`
    const agora = Date.now()
    const j = janelas.get(chave)
    if (!j || agora - j.inicio > janelaMs) {
      janelas.set(chave, { inicio: agora, total: 1 })
      return next()
    }
    j.total++
    if (j.total > max) {
      res.set('Retry-After', String(Math.ceil((j.inicio + janelaMs - agora) / 1000)))
      return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' })
    }
    next()
  }
}

// limpa janelas vencidas a cada 10 min
setInterval(() => {
  const agora = Date.now()
  for (const [k, j] of janelas) if (agora - j.inicio > 60 * 60_000) janelas.delete(k)
}, 10 * 60_000).unref()
