// Otimização da rota do entregador.
// 1º tenta a API pública do OSRM (serviço "trip", sobre o OpenStreetMap), que devolve a ordem
// das paradas e o trajeto real pelas ruas. Sem internet, usa uma heurística local
// (vizinho mais próximo + 2-opt) com distâncias de Haversine × fator de estrada.
// A base de saída é a posição atual do entregador (GPS) ou a base cadastrada dele / da empresa.
import { FATOR_ESTRADA, haversineKm } from '../src/utils/frete.js'

const OSRM_URL = process.env.OSRM_URL ?? 'https://router.project-osrm.org'
const VELOCIDADE_URBANA = 30 // km/h, para estimar o tempo na heurística local
const ROTEAMENTO_DESLIGADO = process.env.OSRM === 'off'

const km = (a, b) => haversineKm(a, b) * FATOR_ESTRADA

/** Distância total de um caminho aberto que começa na base. */
export const distanciaDoCaminho = (base, paradas) => paradas.reduce((s, p, i) => s + km(i ? paradas[i - 1] : base, p), 0)

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
  if (ROTEAMENTO_DESLIGADO) throw new Error('roteamento desligado (OSRM=off)')
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

/**
 * Calcula a melhor ordem de visita das paradas ({ id, lat, lng, ... }) saindo de "base" ({ nome, lat, lng }).
 */
export async function otimizarRota(paradas, base) {
  if (!paradas.length) return { fonte: 'local', base, paradas: [], distanciaKm: 0, duracaoMin: 0, economiaKm: 0, trajeto: [], mapsUrl: null }
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

/** Trajeto pelas ruas passando pelos pontos na ordem dada (para ETA). */
export async function rotaEntre(pontos) {
  try {
    if (ROTEAMENTO_DESLIGADO) throw new Error('desligado')
    const coords = pontos.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
    const res = await fetch(`${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(6000) })
    const data = await res.json()
    if (data.code !== 'Ok') throw new Error(data.message ?? data.code)
    const r = data.routes[0]
    return { fonte: 'osrm', distanciaKm: r.distance / 1000, duracaoMin: r.duration / 60, trajeto: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]) }
  } catch {
    const distanciaKm = pontos.slice(1).reduce((s, p, i) => s + km(pontos[i], p), 0)
    return { fonte: 'local', distanciaKm, duracaoMin: (distanciaKm / VELOCIDADE_URBANA) * 60, trajeto: pontos.map((p) => [p.lat, p.lng]) }
  }
}

/** Menor distância (km) de um ponto até um trajeto [[lat, lng], ...] (projeção local plana). */
export function distanciaAteTrajetoKm(p, trajeto) {
  if (!trajeto?.length) return Infinity
  const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180)
  const ky = 110.57
  const xy = ([lat, lng]) => [(lng - p.lng) * kx, (lat - p.lat) * ky]
  let melhor = Infinity
  for (let i = 0; i < trajeto.length; i++) {
    const [ax, ay] = xy(trajeto[i])
    if (i === trajeto.length - 1) {
      melhor = Math.min(melhor, Math.hypot(ax, ay))
      break
    }
    const [bx, by] = xy(trajeto[i + 1])
    const dx = bx - ax
    const dy = by - ay
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0
    melhor = Math.min(melhor, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return melhor
}
