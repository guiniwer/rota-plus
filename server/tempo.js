// Datas e horários. No banco tudo é ISO 8601 (UTC); expediente e janelas usam o fuso da empresa.

export const agora = () => new Date().toISOString()
export const MIN = 60_000
export const HORA = 60 * MIN
export const DIA = 24 * HORA

/** Diferença (ms) entre o horário local do fuso e o UTC naquele instante. */
function deslocamento(ts, fuso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ts))
      .map((x) => [x.type, x.value]),
  )
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000
}

/** Partes da data no fuso: { ano, mes, dia, hora, minuto, diaSemana (0 = domingo) }. */
export function partesLocais(data, fuso) {
  const ts = new Date(data).getTime()
  const d = new Date(ts + deslocamento(ts, fuso))
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), hora: d.getUTCHours(), minuto: d.getUTCMinutes(), diaSemana: d.getUTCDay() }
}

/** Converte um horário local (no fuso) para Date em UTC. */
export function localParaUtc({ ano, mes, dia, hora = 0, minuto = 0 }, fuso) {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto)
  return new Date(palpite - deslocamento(palpite, fuso))
}

/** "HH:MM" no fuso. */
export const horaLocal = (data, fuso) => {
  const p = partesLocais(data, fuso)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

const minutosDe = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Está dentro do expediente da empresa? (aceita turno que vira a noite, ex.: 22:00–06:00) */
export function dentroDoTurno(data, empresa) {
  const p = partesLocais(data, empresa.fuso)
  const m = p.hora * 60 + p.minuto
  const ini = minutosDe(empresa.turno_inicio)
  const fim = minutosDe(empresa.turno_fim)
  return ini <= fim ? m >= ini && m < fim : m >= ini || m < fim
}

/** Data local do dia seguinte útil + n dias úteis, às 18:00 (prazo de pedidos interestaduais). */
export function prazoEmDiasUteis(inicio, dias, fuso, hora = 18) {
  let p = partesLocais(inicio, fuso)
  let cursor = localParaUtc({ ...p, hora: 12, minuto: 0 }, fuso).getTime()
  let restantes = dias
  while (restantes > 0) {
    cursor += DIA
    const dow = partesLocais(cursor, fuso).diaSemana
    if (dow !== 0 && dow !== 6) restantes--
  }
  p = partesLocais(cursor, fuso)
  return localParaUtc({ ...p, hora, minuto: 0 }, fuso)
}

/** Converte "HH:MM–HH:MM" (janela de hoje, no fuso) em { inicio, fim } UTC. Se já passou, usa o dia seguinte. */
export function janelaParaDatas(janela, fuso, base = new Date()) {
  const [a, b] = String(janela).split(/[–-]/).map((s) => s.trim())
  if (!/^\d{1,2}:\d{2}$/.test(a ?? '') || !/^\d{1,2}:\d{2}$/.test(b ?? '')) return null
  const p = partesLocais(base, fuso)
  const [ha, ma] = a.split(':').map(Number)
  const [hb, mb] = b.split(':').map(Number)
  let fim = localParaUtc({ ...p, hora: hb, minuto: mb }, fuso)
  let inicio = localParaUtc({ ...p, hora: ha, minuto: ma }, fuso)
  if (fim.getTime() < base.getTime()) {
    fim = new Date(fim.getTime() + DIA)
    inicio = new Date(inicio.getTime() + DIA)
  }
  return { inicio, fim }
}
