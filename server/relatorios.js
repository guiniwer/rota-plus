// Indicadores calculados a partir dos dados registrados (entregas, eventos, comprovantes, movimentações e alertas).
import { db } from './db.js'
import { DIA, HORA, MIN, localParaUtc, partesLocais } from './tempo.js'
import { intervalosDeUso } from './uso.js'

export const PERIODOS = { '7d': { dias: 7, label: '7 dias', bucket: 1 }, '30d': { dias: 30, label: '30 dias', bucket: 7 }, '90d': { dias: 90, label: '90 dias', bucket: 7 } }
const ETAPAS = [
  { de: 'confirmado', ate: 'coletado', label: 'Coleta' },
  { de: 'coletado', ate: 'transito', label: 'Expedição no CD' },
  { de: 'transito', ate: 'saiu', label: 'Transferência' },
  { de: 'saiu', ate: 'entregue', label: 'Última milha' },
]
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null)
const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
const iso = (t) => new Date(t).toISOString()

function inicioDoDia(ts, fuso) {
  const p = partesLocais(ts, fuso)
  return localParaUtc({ ...p, hora: 0, minuto: 0 }, fuso).getTime()
}

/** Entregas concluídas em [de, ate) e o percentual no prazo. */
function cumprimento(empresaId, de, ate) {
  const r = db
    .prepare(`SELECT COUNT(*) AS total, SUM(entregue_em <= prazo_limite) AS no_prazo FROM entregas
      WHERE empresa_id = ? AND status = 'entregue' AND entregue_em >= ? AND entregue_em < ?`)
    .get(empresaId, iso(de), iso(ate))
  return { total: r.total, noPrazo: r.no_prazo ?? 0, pct: pct(r.no_prazo ?? 0, r.total) }
}

export function gerarRelatorio(empresa, periodo = '30d') {
  const P = PERIODOS[periodo] ?? PERIODOS['30d']
  const fim = Date.now()
  const inicio = inicioDoDia(fim, empresa.fuso) - (P.dias - 1) * DIA
  const anterior = inicio - P.dias * DIA
  const [de, ate] = [iso(inicio), iso(fim)]
  const id = empresa.id

  // ---- cumprimento de prazos (série por dia ou semana) ----
  const serie = []
  for (let t = inicio; t < fim; t += P.bucket * DIA) {
    const c = cumprimento(id, t, Math.min(fim, t + P.bucket * DIA))
    const p = partesLocais(t, empresa.fuso)
    const rotulo = P.bucket === 1 ? new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: empresa.fuso }).format(t).replace('.', '') + ` ${p.dia}` : `${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}`
    serie.push({ rotulo, inicio: iso(t), ...c })
  }
  const atual = cumprimento(id, inicio, fim)
  const antes = cumprimento(id, anterior, inicio)

  // ---- entregas do período ----
  const entregues = db.prepare("SELECT * FROM entregas WHERE empresa_id = ? AND status = 'entregue' AND entregue_em >= ? AND entregue_em < ?").all(id, de, ate)
  const criadas = db.prepare('SELECT * FROM entregas WHERE empresa_id = ? AND criado_em >= ? AND criado_em < ?').all(id, de, ate)
  const tempoMedioH = media(entregues.map((e) => (Date.parse(e.entregue_em) - Date.parse(e.criado_em)) / HORA))
  const atrasoMedioMin = media(entregues.filter((e) => e.entregue_em > e.prazo_limite).map((e) => (Date.parse(e.entregue_em) - Date.parse(e.prazo_limite)) / MIN))

  // tempo médio em cada etapa (gargalos), pelos eventos de status
  const eventos = db
    .prepare(`SELECT entrega_id, status, MIN(criado_em) AS em FROM entrega_eventos WHERE status IS NOT NULL
      AND entrega_id IN (SELECT id FROM entregas WHERE empresa_id = ? AND status = 'entregue' AND entregue_em >= ? AND entregue_em < ?) GROUP BY entrega_id, status`)
    .all(id, de, ate)
  const porEntrega = Map.groupBy(eventos, (e) => e.entrega_id)
  const etapas = ETAPAS.map((et) => {
    const tempos = []
    for (const evs of porEntrega.values()) {
      const a = evs.find((x) => x.status === et.de)
      const b = evs.find((x) => x.status === et.ate)
      if (a && b && b.em >= a.em) tempos.push((Date.parse(b.em) - Date.parse(a.em)) / MIN)
    }
    return { etapa: et.label, mediaMin: media(tempos), amostras: tempos.length }
  })

  // comprovantes completos (foto + assinatura + GPS) das entregas concluídas
  const comp = db
    .prepare(`SELECT COUNT(*) AS total, SUM(c.foto IS NOT NULL) AS foto, SUM(c.assinatura IS NOT NULL) AS assinatura, SUM(c.lat IS NOT NULL) AS gps,
        SUM(c.foto IS NOT NULL AND c.assinatura IS NOT NULL AND c.lat IS NOT NULL) AS completo
      FROM entregas e LEFT JOIN comprovantes c ON c.id = (SELECT MAX(id) FROM comprovantes WHERE entrega_id = e.id AND resultado <> 'tentativa')
      WHERE e.empresa_id = ? AND e.status = 'entregue' AND e.entregue_em >= ? AND e.entregue_em < ?`)
    .get(id, de, ate)
  const tentativas = db.prepare("SELECT COUNT(*) AS n FROM entrega_eventos WHERE status = 'tentativa' AND criado_em >= ? AND criado_em < ? AND entrega_id IN (SELECT id FROM entregas WHERE empresa_id = ?)").get(de, ate, id).n
  const canceladas = db.prepare("SELECT COUNT(*) AS n FROM entrega_eventos WHERE status = 'cancelado' AND criado_em >= ? AND criado_em < ? AND entrega_id IN (SELECT id FROM entregas WHERE empresa_id = ?)").get(de, ate, id).n
  const aval = db.prepare('SELECT AVG(avaliacao_nota) AS media, COUNT(avaliacao_nota) AS n FROM entregas WHERE empresa_id = ? AND avaliado_em >= ? AND avaliado_em < ?').get(id, de, ate)
  const agoraIso = iso(fim)
  const abertas = db.prepare("SELECT COUNT(*) AS n, SUM(prazo_limite < ?) AS atrasadas FROM entregas WHERE empresa_id = ? AND status NOT IN ('entregue', 'cancelado')").get(agoraIso, id)

  // ---- alertas ----
  const alertas = db.prepare('SELECT * FROM alertas WHERE empresa_id = ? AND aberto_em >= ? AND aberto_em < ?').all(id, de, ate)
  const resolvidos = alertas.filter((a) => a.resolvido_em)
  const minutosResolucao = resolvidos.map((a) => (Date.parse(a.resolvido_em) - Date.parse(a.aberto_em)) / MIN)
  const porTipo = Object.entries(Object.groupBy(alertas, (a) => a.tipo)).map(([tipo, xs]) => ({ tipo, total: xs.length, resolvidos: xs.filter((a) => a.resolvido_em).length }))

  // ---- utilização dos ativos: horas retiradas ÷ horas de expediente do período ----
  const [hi, mi] = empresa.turno_inicio.split(':').map(Number)
  const [hf, mf] = empresa.turno_fim.split(':').map(Number)
  let turnoH = (hf * 60 + mf - (hi * 60 + mi)) / 60
  if (turnoH <= 0) turnoH += 24
  const capacidadeH = turnoH * P.dias
  const ativos = db.prepare("SELECT * FROM ativos WHERE empresa_id = ? AND tipo <> 'Carga' AND criado_em < ?").all(id, ate)
  const utilizacao = ['Veículo', 'Equipamento', 'Ferramenta'].map((tipo) => {
    // extraviados entram em "perdas", não na utilização
    const lista = ativos.filter((a) => a.tipo === tipo && a.status !== 'extraviado')
    const horas = lista.reduce((s, a) => s + intervalosDeUso(a.id, inicio, fim).reduce((x, [p, q]) => x + (q - p) / HORA, 0), 0)
    return { tipo, ativos: lista.length, horas: Math.round(horas), pct: lista.length ? Math.min(100, Math.round((horas / (lista.length * capacidadeH)) * 100)) : null }
  })
  const extraviados = ativos.filter((a) => a.status === 'extraviado')
  const leituras = db
    .prepare("SELECT COUNT(*) AS total, SUM(via IN ('qr', 'rfid')) AS lidas FROM ativo_movimentacoes WHERE criado_em >= ? AND criado_em < ? AND ativo_id IN (SELECT id FROM ativos WHERE empresa_id = ?)")
    .get(de, ate, id)

  // ---- por entregador ----
  const porEntregador = db
    .prepare(`SELECT u.id, u.nome, COUNT(e.id) AS entregues, SUM(e.entregue_em <= e.prazo_limite) AS no_prazo, AVG(e.avaliacao_nota) AS nota,
        SUM(EXISTS (SELECT 1 FROM comprovantes c WHERE c.entrega_id = e.id AND c.foto IS NOT NULL AND c.assinatura IS NOT NULL AND c.lat IS NOT NULL)) AS completos
      FROM usuarios u LEFT JOIN entregas e ON e.entregador_id = u.id AND e.status = 'entregue' AND e.entregue_em >= ? AND e.entregue_em < ?
      WHERE u.empresa_id = ? AND u.funcao = 'entregador' GROUP BY u.id ORDER BY entregues DESC`)
    .all(de, ate, id)
    .map((r) => ({ id: r.id, nome: r.nome, entregues: r.entregues, noPrazoPct: pct(r.no_prazo ?? 0, r.entregues), comprovantePct: pct(r.completos ?? 0, r.entregues), nota: r.nota }))

  return {
    periodo,
    label: P.label,
    de,
    ate,
    entregas: {
      concluidas: atual.total,
      noPrazoPct: atual.pct,
      noPrazoPctAnterior: antes.pct,
      serie,
      criadas: criadas.length,
      faturamento: criadas.filter((e) => e.status !== 'cancelado').reduce((s, e) => s + e.valor, 0),
      rastreadasGpsPct: pct(criadas.filter((e) => e.rastreio === 'gps').length, criadas.length),
      tempoMedioHoras: tempoMedioH,
      atrasoMedioMin: atrasoMedioMin,
      tentativas,
      canceladas,
      emAberto: abertas.n,
      atrasadasAgora: abertas.atrasadas ?? 0,
      etapas,
    },
    comprovantes: {
      total: comp.total,
      fotoPct: pct(comp.foto ?? 0, comp.total),
      assinaturaPct: pct(comp.assinatura ?? 0, comp.total),
      gpsPct: pct(comp.gps ?? 0, comp.total),
      completoPct: pct(comp.completo ?? 0, comp.total),
    },
    avaliacao: { media: aval.media, total: aval.n },
    alertas: {
      abertos: alertas.length,
      resolvidos: resolvidos.length,
      automaticos: resolvidos.filter((a) => a.resolucao === 'automatica').length,
      tempoMedioResolucaoMin: media(minutosResolucao),
      dentroSlaPct: pct(resolvidos.filter((a) => (Date.parse(a.resolvido_em) - Date.parse(a.aberto_em)) / MIN <= a.sla_min).length, resolvidos.length),
      porTipo,
    },
    ativos: {
      utilizacao,
      capacidadeHorasPorAtivo: Math.round(capacidadeH),
      extraviados: extraviados.length,
      valorExtraviado: extraviados.reduce((s, a) => s + a.valor, 0),
      leituraPct: pct(leituras.lidas ?? 0, leituras.total),
      movimentacoes: leituras.total,
    },
    porEntregador,
  }
}

const num = (v, casas = 1) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas }))

/** Mesmo relatório em CSV (separador ";" — abre direto no Excel em português). */
export function relatorioCsv(r) {
  const linhas = [
    ['Relatório Rota+', `${r.label} (${r.de.slice(0, 10)} a ${r.ate.slice(0, 10)})`],
    [],
    ['Indicador', 'Valor'],
    ['Entregas concluídas', r.entregas.concluidas],
    ['Entregas no prazo (%)', num(r.entregas.noPrazoPct)],
    ['Entregas no prazo — período anterior (%)', num(r.entregas.noPrazoPctAnterior)],
    ['Tempo médio do pedido à entrega (h)', num(r.entregas.tempoMedioHoras)],
    ['Atraso médio das entregas atrasadas (min)', num(r.entregas.atrasoMedioMin, 0)],
    ['Tentativas sem sucesso', r.entregas.tentativas],
    ['Cancelamentos', r.entregas.canceladas],
    ['Pedidos criados', r.entregas.criadas],
    ['Faturamento de fretes (R$)', num(r.entregas.faturamento, 2)],
    ['Comprovantes completos (%)', num(r.comprovantes.completoPct)],
    ['Avaliação média dos clientes', num(r.avaliacao.media)],
    ['Alertas abertos no período', r.alertas.abertos],
    ['Alertas resolvidos', r.alertas.resolvidos],
    ['Tempo médio de resolução (min)', num(r.alertas.tempoMedioResolucaoMin, 0)],
    ['Resolvidos dentro do SLA (%)', num(r.alertas.dentroSlaPct)],
    ['Ativos extraviados', r.ativos.extraviados],
    ['Valor dos ativos extraviados (R$)', num(r.ativos.valorExtraviado, 2)],
    [],
    ['Período', 'Entregas concluídas', 'No prazo', 'No prazo (%)'],
    ...r.entregas.serie.map((s) => [s.rotulo, s.total, s.noPrazo, num(s.pct)]),
    [],
    ['Etapa', 'Tempo médio (min)', 'Amostras'],
    ...r.entregas.etapas.map((e) => [e.etapa, num(e.mediaMin, 0), e.amostras]),
    [],
    ['Categoria de ativo', 'Ativos', 'Horas em uso', 'Utilização (%)'],
    ...r.ativos.utilizacao.map((u) => [u.tipo, u.ativos, u.horas, num(u.pct)]),
    [],
    ['Entregador', 'Entregas', 'No prazo (%)', 'Comprovante completo (%)', 'Nota média'],
    ...r.porEntregador.map((p) => [p.nome, p.entregues, num(p.noPrazoPct), num(p.comprovantePct), num(p.nota)]),
  ]
  const celula = (c) => {
    const s = String(c ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n')
}
