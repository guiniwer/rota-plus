// Regras de cálculo do frete (baseadas nas anotações do Figma).
import { cidadePorId } from '../data/cidades.js'

export const FATOR_CUBAGEM = 300 // rodoviário: kg por m³
export const TAXA_GPS = 50
export const TAXA_EXPRESSA = 15
export const PESO_DOCUMENTO = 0.3
export const FATOR_ESTRADA = 1.25 // a estrada é, em média, 25% mais longa que a linha reta
const KM_URBANO = 15 // entrega dentro da mesma cidade

/** Distância em linha reta entre duas coordenadas (fórmula de Haversine). */
export function haversineKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Distância estimada por estrada entre duas cidades (ids de data/cidades.js). */
export function distanciaKm(origemId, destinoId) {
  const a = cidadePorId(origemId)
  const b = cidadePorId(destinoId)
  if (!a || !b) return KM_URBANO
  if (a.id === b.id) return KM_URBANO
  return Math.round(Math.max(KM_URBANO, haversineKm(a, b) * FATOR_ESTRADA))
}

/** Prazo-base (dias úteis) conforme a distância. */
function prazoBase(km) {
  if (km <= 50) return [1, 1]
  if (km <= 300) return [1, 2]
  if (km <= 1000) return [2, 4]
  if (km <= 2000) return [3, 5]
  return [4, 7]
}

/**
 * Calcula o frete entre duas cidades.
 * O peso cobrado é o maior entre o peso real e o peso cubado (C × L × A em m³ × 300).
 */
export function calcularFrete({ origem, destino, tipoCarga, comprimento, largura, altura, peso, valorNF, modalidade, rastreio }) {
  const km = distanciaKm(origem, destino)
  const isCaixa = tipoCarga === 'caixa'

  const pesoReal = isCaixa ? Number(peso) || 0 : PESO_DOCUMENTO
  const volumeM3 = isCaixa ? ((Number(comprimento) || 0) * (Number(largura) || 0) * (Number(altura) || 0)) / 1_000_000 : 0
  const pesoCubado = volumeM3 * FATOR_CUBAGEM
  const pesoTaxado = Math.max(pesoReal, pesoCubado)

  const nf = Number(valorNF) || 0
  const itens = [
    { label: `Frete peso / distância (${km.toLocaleString('pt-BR')} km)`, valor: 8 + pesoTaxado * 1.9 + km * 0.0075 },
    { label: 'Ad valorem (0,3% da NF)', valor: nf * 0.003 },
    { label: 'GRIS (0,2%)', valor: nf * 0.002 },
    { label: 'Pedágios', valor: km * 0.0016 },
  ]
  if (modalidade === 'expressa') itens.push({ label: 'Entrega mais rápida', valor: TAXA_EXPRESSA })
  if (rastreio === 'gps') itens.push({ label: 'Rastreamento por GPS', valor: TAXA_GPS })

  const subtotal = itens.reduce((s, i) => s + i.valor, 0)
  const icms = subtotal * 0.12
  const total = subtotal + icms

  const [min, max] = prazoBase(km)
  const prazo = modalidade === 'expressa' ? [Math.max(1, min - 1), Math.max(1, max - 2)] : [min + 1, max + 1]

  return {
    km,
    pesoReal,
    pesoCubado,
    pesoTaxado,
    itens: [...itens, { label: 'ICMS (12%)', valor: icms }],
    total,
    prazoDias: prazo[1], // usado para calcular a data-limite do pedido
    prazoTexto: prazo[0] === prazo[1] ? `${prazo[0]} dia${prazo[0] > 1 ? 's' : ''} út${prazo[0] > 1 ? 'eis' : 'il'}` : `${prazo[0]} a ${prazo[1]} dias úteis`,
  }
}
