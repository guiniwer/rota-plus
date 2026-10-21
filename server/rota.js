// Otimização da rota do entregador.
// 1º tenta a API pública do OSRM (serviço "trip", sobre o OpenStreetMap), que devolve a ordem
// das paradas e o trajeto real pelas ruas. Sem internet, usa uma heurística local
// (vizinho mais próximo + 2-opt) com distâncias de Haversine × fator de estrada.
import { FATOR_ESTRADA, haversineKm } from '../src/utils/frete.js'

const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org'
const VELOCIDADE_URBANA = 30 // km/h, para estimar o tempo na heurística local

/** Bases de saída das rotas; usamos a mais próxima das paradas. */
export const BASES = [
  { nome: 'CD Recife', lat: -8.089, lng: -34.933 },
  { nome: 'CD Pinheiros (SP)', lat: -23.567, lng: -46.692 },
]

const km = (a, b) => haversineKm(a, b) * FATOR_ESTRADA

/** Distância total de um caminho aberto que começa na base. */
export const distanciaDoCaminho = (base, paradas) => paradas.reduce((s, p, i) => s + km(i ? paradas[i - 1] : base, p), 0)

function baseMaisProxima(paradas) {
  const centro = {
    lat: paradas.reduce((s, p) => s + p.lat, 0) / paradas.length,
    lng: paradas.reduce((s, p) => s + p.lng, 0) / paradas.length,
  }
  return BASES.reduce((melhor, b) => (km(b, centro) < km(melhor, centro) ? b : melhor))
}

/** Heurística local: vizinho mais próximo seguido de melhorias 2-opt. */
export function otimizarLocal(base, paradas) {
  const restantes = [...paradas]
  const rota = []
  let atual = base
  while (restantes.length) {
    let i = 0
    restantes.forEach((p, j) => {
      if (km(atual, p) < km(atual, restantes[i])) i = j
    })
    atual = restantes.splice(i, 1)[0]
    rota.push(atual)
  }
  // 2-opt: inverte trechos enquanto isso encurtar o caminho
  let melhorou = true
  while (melhorou) {
    melhorou = false
    for (let i = 0; i < rota.length - 1; i++) {
      for (let j = i + 1; j < rota.length; j++) {
        const nova = [...rota.slice(0, i), ...rota.slice(i, j + 1).reverse(), ...rota.slice(j + 1)]
        if (distanciaDoCaminho(base, nova) + 1e-9 < distanciaDoCaminho(base, rota)) {
          rota.splice(0, rota.length, ...nova)
          melhorou = true
        }
      }
    }
  }
  const trechos = rota.map((p, i) => km(i ? rota[i - 1] : base, p))
  const total = trechos.reduce((s, t) => s + t, 0)
  return {
    fonte: 'local',
    paradas: rota.map((p, i) => ({ ...p, trechoKm: trechos[i] })),
    distanciaKm: total,
    duracaoMin: (total / VELOCIDADE_URBANA) * 60,
    trajeto: [base, ...rota].map((p) => [p.lat, p.lng]),
  }
}

/** Chama o serviço "trip" do OSRM. Lança erro se a API não responder. */
async function otimizarOsrm(base, paradas) {
  const pontos = [base, ...paradas].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${OSRM_URL}/trip/v1/driving/${pontos}?source=first&roundtrip=false&destination=any&overview=full&geometries=geojson`
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  const data = await res.json()
  if (data.code !== 'Ok') throw new Error(data.message ?? data.code)
  const viagem = data.trips[0]
  // waypoint_index = posição de cada ponto (na ordem enviada) dentro da rota otimizada
  const ordenadas = paradas
    .map((p, i) => ({ ...p, pos: data.waypoints[i + 1].waypoint_index }))
    .sort((a, b) => a.pos - b.pos)
    .map(({ pos: _pos, ...p }, i) => ({ ...p, trechoKm: viagem.legs[i].distance / 1000 }))
  return {
    fonte: 'osrm',
    paradas: ordenadas,
    distanciaKm: viagem.distance / 1000,
    duracaoMin: viagem.duration / 60,
    trajeto: viagem.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  }
}

/** Calcula a melhor ordem de visita das paradas ({ id, lat, lng, ... }). */
export async function otimizarRota(paradas) {
  if (!paradas.length) return { fonte: 'local', base: BASES[0], paradas: [], distanciaKm: 0, duracaoMin: 0, economiaKm: 0, trajeto: [] }
  const base = baseMaisProxima(paradas)
  let resultado
  try {
    resultado = await otimizarOsrm(base, paradas)
  } catch (err) {
    console.warn('[rota] OSRM indisponível, usando otimização local:', err.message)
    resultado = otimizarLocal(base, paradas)
  }
  // comparação com a ordem original (mesma métrica para as duas ordens)
  const economiaKm = Math.max(0, distanciaDoCaminho(base, paradas) - distanciaDoCaminho(base, resultado.paradas))
  const [ultima, ...meio] = [...resultado.paradas].reverse()
  const mapsUrl =
    'https://www.google.com/maps/dir/?api=1&travelmode=driving' +
    `&origin=${base.lat},${base.lng}&destination=${ultima.lat},${ultima.lng}` +
    (meio.length ? `&waypoints=${meio.reverse().map((p) => `${p.lat},${p.lng}`).join('|')}` : '')
  return { ...resultado, base, economiaKm, mapsUrl }
}
