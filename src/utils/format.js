export const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const num = (n, digits = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const onlyDigits = (s = '') => s.replace(/\D/g, '')

export function nowLabel() {
  const d = new Date()
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia} · ${hora}`
}

/** Máscara simples de CPF/CNPJ conforme a quantidade de dígitos. */
export function maskDocumento(value) {
  const d = onlyDigits(value).slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** 93.8 → "93,8%"; null → "—" */
export const pct = (n) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)

/** Diferença em pontos percentuais com seta: "▲ 3,1 p.p." */
export function deltaPp(atual, anterior) {
  if (atual == null || anterior == null) return null
  const d = Math.round((atual - anterior) * 10) / 10
  if (d === 0) return '= período anterior'
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toLocaleString('pt-BR')} p.p. vs. período anterior`
}
