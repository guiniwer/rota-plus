// Geocodificação de endereços com o Nominatim (OpenStreetMap).
// Política de uso: no máximo 1 requisição por segundo e User-Agent identificado — por isso há fila e cache.
// Se o endereço não for encontrado (ou sem internet), usamos o centro da cidade como posição aproximada.
import { db } from './db.js'
import { CIDADES, cidadePorId } from '../src/data/cidades.js'
import { agora } from './tempo.js'

const NOMINATIM = process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org'
const USER_AGENT = process.env.GEOCODER_USER_AGENT ?? 'RotaPlus/1.0 (+https://github.com/guiniwer/rota-plus)'
const DESLIGADO = process.env.GEOCODER === 'off'
const INTERVALO_MS = 1100

let fila = Promise.resolve()
let ultima = 0

/** Serializa as chamadas ao Nominatim respeitando o intervalo mínimo. */
function chamar(url) {
  const tarefa = fila.then(async () => {
    const espera = ultima + INTERVALO_MS - Date.now()
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    ultima = Date.now()
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
    return res.json()
  })
  fila = tarefa.catch(() => {})
  return tarefa
}

const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function doCache(chave) {
  const c = db.prepare('SELECT lat, lng FROM geocache WHERE consulta = ?').get(chave)
  return c === undefined ? undefined : c.lat == null ? null : { lat: c.lat, lng: c.lng }
}
const salvarCache = (chave, r) =>
  db.prepare('INSERT OR REPLACE INTO geocache (consulta, lat, lng, criado_em) VALUES (?, ?, ?, ?)').run(chave, r?.lat ?? null, r?.lng ?? null, agora())

/** Coordenadas do endereço (ou null). Usa o cache antes de ir à internet. */
export async function geocodificar(endereco) {
  const chave = normalizar(endereco)
  if (!chave) return null
  const cache = doCache(chave)
  if (cache !== undefined) return cache
  if (DESLIGADO) return null
  try {
    const url = `${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(endereco)}`
    const [r] = await chamar(url)
    const resultado = r ? { lat: Number(r.lat), lng: Number(r.lon) } : null
    salvarCache(chave, resultado)
    return resultado
  } catch (err) {
    console.warn('[geocode] falhou:', err.message)
    return null // não guarda no cache: tenta de novo na próxima vez
  }
}

/** Nome curto do lugar (rua, bairro · cidade) para uma coordenada. */
export async function enderecoReverso(lat, lng) {
  const chave = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`
  const cache = db.prepare('SELECT nome FROM geocache WHERE consulta = ?').get(chave)
  if (cache) return cache.nome
  if (DESLIGADO) return null
  try {
    const r = await chamar(`${NOMINATIM}/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`)
    const a = r.address ?? {}
    const nome = [a.road, a.suburb ?? a.neighbourhood, a.city ?? a.town ?? a.village].filter(Boolean).join(' · ') || r.display_name || null
    db.prepare('INSERT OR REPLACE INTO geocache (consulta, lat, lng, nome, criado_em) VALUES (?, ?, ?, ?, ?)').run(chave, lat, lng, nome, agora())
    return nome
  } catch {
    return null
  }
}

/** Procura no texto o nome de uma cidade atendida (ex.: "... — Recife/PE"). */
export function cidadeDoTexto(texto = '') {
  const t = normalizar(texto)
  return [...CIDADES].sort((a, b) => b.nome.length - a.nome.length).find((c) => t.includes(normalizar(c.nome.split(' (')[0]))) ?? null
}

/**
 * Posição aproximada: centro da cidade + deslocamento estável derivado do endereço (até ~4 km),
 * para que endereços diferentes não caiam no mesmo ponto.
 */
export function aproximarPorCidade(cidade, endereco = '') {
  let h = 0
  for (const ch of endereco) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const ang = ((h % 360) * Math.PI) / 180
  const raio = 0.008 + (((h >>> 9) % 1000) / 1000) * 0.028
  return { lat: cidade.lat + raio * Math.sin(ang), lng: cidade.lng + raio * Math.cos(ang) }
}

/** Localiza um endereço: geocodificação real; se falhar, aproxima pelo centro da cidade. */
export async function localizarEndereco(endereco, cidadeId) {
  const cidade = cidadePorId(cidadeId) ?? cidadeDoTexto(endereco)
  const consulta = cidade && !normalizar(endereco).includes(normalizar(cidade.nome.split(' (')[0])) ? `${endereco}, ${cidade.nome} - ${cidade.uf}` : endereco
  const r = await geocodificar(consulta)
  if (r) return { ...r, fonte: 'endereco', cidade: cidade?.id ?? null }
  if (cidade) return { ...aproximarPorCidade(cidade, endereco), fonte: 'cidade', cidade: cidade.id }
  return { lat: null, lng: null, fonte: null, cidade: null }
}
