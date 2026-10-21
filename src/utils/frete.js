// Regras de cálculo do frete (baseadas nas anotações do Figma).

export const REGIOES = [
  { value: 'cidade', label: 'Mesma cidade', km: 20, dias: [1, 1] },
  { value: 'estado', label: 'Mesmo estado', km: 150, dias: [1, 2] },
  { value: 'nordeste', label: 'Região Nordeste', km: 800, dias: [2, 4] },
  { value: 'nacional', label: 'Outras regiões do Brasil', km: 2660, dias: [3, 5] },
]

export const FATOR_CUBAGEM = 300 // rodoviário: kg por m³
export const TAXA_GPS = 50
export const TAXA_EXPRESSA = 15
export const PESO_DOCUMENTO = 0.3

/**
 * Calcula o frete.
 * O peso cobrado é o maior entre o peso real e o peso cubado (C × L × A em m³ × 300).
 */
export function calcularFrete({ tipoCarga, comprimento, largura, altura, peso, valorNF, regiao, modalidade, rastreio }) {
  const reg = REGIOES.find((r) => r.value === regiao) ?? REGIOES[0]
  const isCaixa = tipoCarga === 'caixa'

  const pesoReal = isCaixa ? Number(peso) || 0 : PESO_DOCUMENTO
  const volumeM3 = isCaixa ? ((Number(comprimento) || 0) * (Number(largura) || 0) * (Number(altura) || 0)) / 1_000_000 : 0
  const pesoCubado = volumeM3 * FATOR_CUBAGEM
  const pesoTaxado = Math.max(pesoReal, pesoCubado)

  const nf = Number(valorNF) || 0
  const itens = [
    { label: `Frete peso / distância (${reg.km.toLocaleString('pt-BR')} km)`, valor: 8 + pesoTaxado * 1.9 + reg.km * 0.0075 },
    { label: 'Ad valorem (0,3% da NF)', valor: nf * 0.003 },
    { label: 'GRIS (0,2%)', valor: nf * 0.002 },
    { label: 'Pedágios', valor: reg.km * 0.0016 },
  ]
  if (modalidade === 'expressa') itens.push({ label: 'Entrega mais rápida', valor: TAXA_EXPRESSA })
  if (rastreio === 'gps') itens.push({ label: 'Rastreamento por GPS', valor: TAXA_GPS })

  const subtotal = itens.reduce((s, i) => s + i.valor, 0)
  const icms = subtotal * 0.12
  const total = subtotal + icms

  const [min, max] = reg.dias
  const prazo = modalidade === 'expressa' ? [Math.max(1, min - 1), Math.max(1, max - 2)] : [min + 1, max + 1]

  return {
    pesoReal,
    pesoCubado,
    pesoTaxado,
    itens: [...itens, { label: 'ICMS (12%)', valor: icms }],
    total,
    prazoTexto: prazo[0] === prazo[1] ? `${prazo[0]} dia útil` : `${prazo[0]} a ${prazo[1]} dias úteis`,
  }
}
