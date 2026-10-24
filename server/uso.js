// Utilização de ativos a partir dos check-outs/check-ins registrados.
import { db } from './db.js'
import { DIA, HORA, localParaUtc, partesLocais } from './tempo.js'

/** Intervalos [inicio, fim] (ms) em que o ativo esteve retirado, dentro de [de, ate]. */
export function intervalosDeUso(ativoId, de, ate) {
  const movs = db.prepare('SELECT tipo, criado_em FROM ativo_movimentacoes WHERE ativo_id = ? AND criado_em <= ? ORDER BY criado_em, id').all(ativoId, new Date(ate).toISOString())
  const intervalos = []
  let inicio = null
  for (const m of movs) {
    const t = Date.parse(m.criado_em)
    if (m.tipo === 'checkout' && inicio == null) inicio = t
    else if (m.tipo === 'checkin' && inicio != null) {
      intervalos.push([inicio, t])
      inicio = null
    }
  }
  if (inicio != null) intervalos.push([inicio, ate]) // ainda está retirado
  return intervalos.map(([a, b]) => [Math.max(a, de), Math.min(b, ate)]).filter(([a, b]) => b > a)
}

/** Horas de uso em cada um dos últimos `dias` dias (dia local da empresa), do mais antigo ao de hoje. */
export function horasPorDia(ativoId, fuso, dias = 14) {
  const hoje = partesLocais(Date.now(), fuso)
  const inicioHoje = localParaUtc({ ...hoje, hora: 0, minuto: 0 }, fuso).getTime()
  const de = inicioHoje - (dias - 1) * DIA
  const intervalos = intervalosDeUso(ativoId, de, Date.now())
  return Array.from({ length: dias }, (_, i) => {
    const a = de + i * DIA
    const b = a + DIA
    const ms = intervalos.reduce((s, [x, y]) => s + Math.max(0, Math.min(y, b) - Math.max(x, a)), 0)
    return Math.round((ms / HORA) * 10) / 10
  })
}
