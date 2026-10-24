// Notificações push do navegador (Web Push + service worker em public/sw.js).
import { EmpresaApi, GeralApi } from '../services/api'

export const pushSuportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const chaveParaBytes = (base64) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const bin = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function registro() {
  return navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
}

/** 'ativo' | 'inativo' | 'bloqueado' | 'indisponivel' */
export async function estadoPush() {
  if (!pushSuportado()) return 'indisponivel'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'ativo' : 'inativo'
}

/** Pede permissão e inscreve este navegador para receber os avisos da conta. */
export async function ativarPush() {
  if (!pushSuportado()) throw new Error('Este navegador não suporta notificações push.')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão de notificação negada no navegador.')
  const reg = await registro()
  await navigator.serviceWorker.ready
  const { pushChavePublica } = await EmpresaApi.sistema()
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(pushChavePublica) }))
  await GeralApi.inscreverPush(sub.toJSON())
  return 'ativo'
}

export async function desativarPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await GeralApi.cancelarPush(sub.endpoint).catch(() => {})
    await sub.unsubscribe()
  }
  return 'inativo'
}
