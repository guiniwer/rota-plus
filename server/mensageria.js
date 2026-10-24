// Envio de avisos: notificação no app, push do navegador, e-mail (SMTP), links de WhatsApp e webhooks.
// Tudo o que sai fica registrado na tabela "mensagens" (caixa de saída visível em Configurações).
import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import webpush from 'web-push'
import { db } from './db.js'
import { agora } from './tempo.js'
import { publicar } from './tempoReal.js'

// ---------- e-mail ----------
const transporte = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null
const REMETENTE = process.env.SMTP_FROM ?? 'Rota+ <nao-responda@rotaplus.app>'
export const emailConfigurado = () => Boolean(transporte)

/** Confere a conexão com o servidor SMTP ao subir a API (só registra no log; nunca derruba o servidor). */
export function verificarEmail() {
  if (!transporte) return console.log('[email] SMTP não configurado: as mensagens ficam só na caixa de saída.')
  transporte
    .verify()
    .then(() => console.log(`[email] SMTP pronto (${process.env.SMTP_HOST}).`))
    .catch((err) => console.warn('[email] SMTP configurado, mas a conexão falhou:', err.message))
}
// endereço público do app nos links de e-mail (o Render informa o seu em RENDER_EXTERNAL_URL)
export const URL_APP = process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173'

const registrar = (m) =>
  Number(
    db.prepare('INSERT INTO mensagens (empresa_id, entrega_id, canal, destino, assunto, corpo, status, erro, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(m.empresaId ?? null, m.entregaId ?? null, m.canal, m.destino, m.assunto ?? null, m.corpo ?? null, m.status, m.erro ?? null, agora()).lastInsertRowid,
  )
const atualizar = (id, status, erro = null) => db.prepare('UPDATE mensagens SET status = ?, erro = ? WHERE id = ?').run(status, erro, id)

/** Envia (ou, sem SMTP configurado, apenas registra) um e-mail. Nunca lança erro. */
export async function enviarEmail({ empresaId, entregaId, para, assunto, texto }) {
  if (!para || !String(para).includes('@')) return null
  const id = registrar({ empresaId, entregaId, canal: 'email', destino: para, assunto, corpo: texto, status: transporte ? 'enviando' : 'nao_configurado' })
  if (!transporte) return { id, status: 'nao_configurado' }
  try {
    await transporte.sendMail({ from: REMETENTE, to: para, subject: assunto, text: texto })
    atualizar(id, 'enviado')
    return { id, status: 'enviado' }
  } catch (err) {
    atualizar(id, 'falhou', err.message)
    console.warn('[email] falha ao enviar:', err.message)
    return { id, status: 'falhou', erro: err.message }
  }
}

// ---------- WhatsApp (link wa.me com a mensagem pronta) ----------
export function linkWhatsApp(telefone, texto) {
  let n = String(telefone ?? '').replace(/\D/g, '')
  if (!n) return null
  if (n.length <= 11) n = `55${n}`
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`
}

// ---------- Web Push ----------
function chavesVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
  const salvo = db.prepare("SELECT valor FROM sistema WHERE chave = 'vapid'").get()
  if (salvo) return JSON.parse(salvo.valor)
  const novas = webpush.generateVAPIDKeys()
  db.prepare("INSERT INTO sistema (chave, valor) VALUES ('vapid', ?)").run(JSON.stringify(novas))
  return novas
}
let vapid = null
function prepararPush() {
  if (vapid) return vapid
  vapid = chavesVapid()
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:contato@rotaplus.app', vapid.publicKey, vapid.privateKey)
  return vapid
}
export const chavePublicaPush = () => prepararPush().publicKey

export async function enviarPush(usuarioId, { titulo, texto, link }) {
  const inscricoes = db.prepare('SELECT * FROM push_inscricoes WHERE usuario_id = ?').all(usuarioId)
  if (!inscricoes.length) return
  prepararPush()
  const corpo = JSON.stringify({ titulo, texto, link })
  await Promise.all(
    inscricoes.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, corpo, { TTL: 3600 }).catch((err) => {
        // inscrição expirada ou revogada no navegador
        if ([404, 410].includes(err.statusCode)) db.prepare('DELETE FROM push_inscricoes WHERE endpoint = ?').run(s.endpoint)
        else console.warn('[push] falha:', err.statusCode ?? err.message)
      }),
    ),
  )
}

/** Notificação dentro do app (+ push do navegador, se o usuário permitiu). */
export function notificar(usuarioId, { icon = 'bell', cor = 'var(--pink)', titulo, texto, link = null }, { push = true } = {}) {
  if (!usuarioId) return
  db.prepare('INSERT INTO notificacoes (usuario_id, icon, cor, titulo, texto, link, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(usuarioId, icon, cor, titulo, texto, link, agora())
  publicar({ usuarios: [usuarioId], recursos: ['notificacoes'] })
  if (push) enviarPush(usuarioId, { titulo, texto, link }).catch(() => {})
}

// ---------- webhooks da empresa ----------
/** POST assinado (HMAC-SHA256 no cabeçalho X-RotaPlus-Assinatura). Nunca lança erro. */
export async function dispararWebhook(empresa, evento, dados) {
  if (!empresa?.webhook_url) return null
  const corpo = JSON.stringify({ evento, criadoEm: agora(), dados })
  const assinatura = crypto.createHmac('sha256', empresa.webhook_segredo ?? '').update(corpo).digest('hex')
  const id = registrar({ empresaId: empresa.id, entregaId: dados?.id ?? null, canal: 'webhook', destino: empresa.webhook_url, assunto: evento, corpo, status: 'enviando' })
  try {
    const res = await fetch(empresa.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'RotaPlus-Webhook/1.0', 'X-RotaPlus-Evento': evento, 'X-RotaPlus-Assinatura': `sha256=${assinatura}` },
      body: corpo,
      signal: AbortSignal.timeout(6000),
    })
    atualizar(id, res.ok ? 'enviado' : 'falhou', res.ok ? null : `HTTP ${res.status}`)
    return { id, status: res.ok ? 'enviado' : 'falhou', http: res.status }
  } catch (err) {
    atualizar(id, 'falhou', err.message)
    return { id, status: 'falhou', erro: err.message }
  }
}

export function registrarWhatsApp({ empresaId, entregaId, telefone, texto }) {
  const link = linkWhatsApp(telefone, texto)
  if (!link) return null
  registrar({ empresaId, entregaId, canal: 'whatsapp', destino: telefone, corpo: texto, status: 'link' })
  return link
}
