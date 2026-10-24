import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DB_PATH } from './db.js'
import { limitar } from './limite.js'
import { iniciarMonitor } from './monitor.js'
import alertasRoutes from './routes/alertas.js'
import ativosRoutes from './routes/ativos.js'
import authRoutes from './routes/auth.js'
import entregasRoutes, { acompanhamentoPublico, inscreverAvisos, rastreioPublico } from './routes/entregas.js'
import geralRoutes from './routes/geral.js'
import integracaoRoutes from './routes/integracao.js'
import localizacaoRoutes from './routes/localizacao.js'
import rotasRoutes from './routes/rotas.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.disable('x-powered-by')
// atrás de proxy (Nginx, Render, Railway…), o IP real vem do X-Forwarded-For
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY)
app.use(express.json({ limit: '12mb' })) // comprovantes trazem foto e assinatura

// ---------- API REST ----------
app.get('/api/health', (req, res) => res.json({ ok: true }))
const MIN15 = 15 * 60_000
app.use(['/api/auth/login', '/api/auth/cadastro'], limitar({ nome: 'auth', max: 20, janelaMs: MIN15 }))
app.use('/api/auth', authRoutes)
app.use('/api/rastreio', limitar({ nome: 'rastreio', max: 60, janelaMs: MIN15 }))
app.get('/api/rastreio', rastreioPublico)
app.get('/api/rastreio/acompanhamento', acompanhamentoPublico)
app.post('/api/rastreio/avisos', inscreverAvisos)
app.use('/api/entregas', entregasRoutes)
app.use('/api/ativos', ativosRoutes)
app.use('/api/alertas', alertasRoutes)
app.use('/api/rotas', rotasRoutes)
app.use('/api/v1', integracaoRoutes)
app.use('/api', localizacaoRoutes)
app.use('/api', geralRoutes)
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }))

// ---------- front-end compilado (npm start) ----------
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (fs.existsSync(dist)) app.use(express.static(dist))

// erros inesperados viram JSON
app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Arquivo grande demais.' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' })
  console.error(err)
  res.status(500).json({ erro: 'Erro interno no servidor.' })
})

app.listen(PORT, () => {
  console.log(`[api] Rota+ rodando em http://localhost:${PORT}`)
  console.log(`[db]  banco SQLite: ${DB_PATH}`)
  iniciarMonitor()
})
