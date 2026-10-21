import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DB_PATH } from './db.js'
import alertasRoutes from './routes/alertas.js'
import ativosRoutes from './routes/ativos.js'
import authRoutes from './routes/auth.js'
import entregasRoutes, { rastreioPublico } from './routes/entregas.js'
import geralRoutes from './routes/geral.js'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(express.json())

// ---------- API REST ----------
app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)
app.get('/api/rastreio', rastreioPublico)
app.use('/api/entregas', entregasRoutes)
app.use('/api/ativos', ativosRoutes)
app.use('/api/alertas', alertasRoutes)
app.use('/api', geralRoutes)
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }))

// ---------- front-end compilado (npm start) ----------
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (fs.existsSync(dist)) app.use(express.static(dist))

// erros inesperados viram JSON
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ erro: 'Erro interno no servidor.' })
})

app.listen(PORT, () => {
  console.log(`[api] Rota+ rodando em http://localhost:${PORT}`)
  console.log(`[db]  banco SQLite: ${DB_PATH}`)
})
