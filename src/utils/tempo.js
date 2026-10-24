// Formatação de datas (o banco guarda tudo em ISO/UTC; mostramos no fuso do aparelho).
const MIN = 60_000

const valida = (iso) => iso && !Number.isNaN(Date.parse(iso))

export const hora = (iso) => (valida(iso) ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—')

export function mesmoDia(a, b = new Date()) {
  const x = new Date(a)
  return x.getFullYear() === b.getFullYear() && x.getMonth() === b.getMonth() && x.getDate() === b.getDate()
}

/** "12 out 2026" */
export const data = (iso) => (valida(iso) ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '') : '—')

/** "Hoje · 14:05", "Ontem · 09:10" ou "12 out · 14:05" */
export function dataHora(iso) {
  if (!valida(iso)) return '—'
  const d = new Date(iso)
  const ontem = new Date(Date.now() - 864e5)
  const dia = mesmoDia(d) ? 'Hoje' : mesmoDia(d, ontem) ? 'Ontem' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  return `${dia} · ${hora(iso)}`
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias" (ou "em 10 min" no futuro) */
export function relativo(iso) {
  if (!valida(iso)) return '—'
  const diff = Date.now() - Date.parse(iso)
  const futuro = diff < 0
  const min = Math.round(Math.abs(diff) / MIN)
  const txt = min < 1 ? null : min < 60 ? `${min} min` : min < 48 * 60 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} dias`
  if (!txt) return 'agora'
  return futuro ? `em ${txt}` : `há ${txt}`
}

/** Duração em minutos → "38 min", "2 h 10 min" */
export function duracao(min) {
  if (min == null || Number.isNaN(min)) return '—'
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  if (m < 48 * 60) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
  return `${Math.round(m / 1440)} dias`
}

/** Texto da previsão de uma entrega, a partir do prazo e da data de entrega. */
export function previsaoTexto(e) {
  if (e.status === 'cancelado') return 'Cancelada'
  if (e.status === 'entregue') return `Entregue ${dataHora(e.entregueEm).replace(' · ', ' às ')}`
  if (!e.prazoLimite) return '—'
  const quando = mesmoDia(e.prazoLimite) ? 'Hoje' : dataHora(e.prazoLimite).split(' · ')[0]
  return `${quando}, até ${hora(e.prazoLimite)}${e.atrasada ? ' (atrasada)' : ''}`
}

/** SLA restante de um alerta aberto: { texto, vencido } */
export function slaRestante(alerta) {
  if (alerta.status === 'resolvido') {
    const levou = (Date.parse(alerta.resolvidoEm) - Date.parse(alerta.abertoEm)) / MIN
    return { texto: `${duracao(levou)}`, vencido: levou > alerta.slaMin }
  }
  const resta = alerta.slaMin - (Date.now() - Date.parse(alerta.abertoEm)) / MIN
  return resta <= 0 ? { texto: 'Vencido', vencido: true } : { texto: duracao(resta), vencido: false }
}
