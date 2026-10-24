// Monitor automático: a cada minuto confere as regras de alerta de cada empresa.
// Abre alertas quando a condição aparece e resolve sozinho quando ela deixa de existir.
import { abrirAlerta, chavesAbertas, resolverPorChave } from './alertasServico.js'
import { limparSessoes } from './auth.js'
import { db } from './db.js'
import { distanciaAteTrajetoKm } from './rota.js'
import { DIA, HORA, MIN, agora, dentroDoTurno, horaLocal } from './tempo.js'
import { publicar } from './tempoReal.js'
import { STATUS_ENTREGA } from '../src/utils/status.js'

const INTERVALO_MS = Number(process.env.MONITOR_INTERVALO_MS ?? 60_000)
const SEM_SINAL_ENTREGADOR_MIN = Number(process.env.SEM_SINAL_MIN ?? 10)
const SEM_SINAL_RASTREADOR_MIN = 30
const LIMITE_DESVIO_KM = Number(process.env.LIMITE_DESVIO_KM ?? 1)
const INATIVIDADE_HORAS = Number(process.env.INATIVIDADE_HORAS ?? 48)

const minutosDesde = (iso) => Math.round((Date.now() - Date.parse(iso)) / MIN)
const resolverSobras = (empresaId, tipo, prefixo, mantidas) => {
  for (const chave of chavesAbertas(empresaId, tipo)) if (chave.startsWith(prefixo) && !mantidas.has(chave)) resolverPorChave(empresaId, chave)
}

/** Desvio de rota: posição atual longe do trajeto planejado. */
export function verificarDesvio(empresa, u) {
  const chave = `desvio:u${u.id}`
  const plano = db.prepare('SELECT * FROM rotas_planejadas WHERE entregador_id = ?').get(u.id)
  const emRota = db.prepare("SELECT COUNT(*) AS n FROM entregas WHERE entregador_id = ? AND status IN ('transito', 'saiu', 'atrasado')").get(u.id).n
  const recente = u.ultima_posicao_em && minutosDesde(u.ultima_posicao_em) <= 5
  if (!plano || !emRota || !recente || Date.now() - Date.parse(plano.calculada_em) > 8 * HORA) return resolverPorChave(empresa.id, chave)
  const km = distanciaAteTrajetoKm({ lat: u.ultima_lat, lng: u.ultima_lng }, JSON.parse(plano.trajeto))
  if (km <= LIMITE_DESVIO_KM) return resolverPorChave(empresa.id, chave)
  abrirAlerta({
    empresaId: empresa.id, tipo: 'desvio', severidade: km > 5 ? 'critico' : 'alto', chave, referencia: String(u.id),
    titulo: `Desvio de rota — ${u.nome}`, entidade: `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km fora do trajeto`,
    descricao: `${u.nome} está a ${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km do trajeto planejado (${emRota} entrega(s) em rota). Se o caminho mudou, recalcule a rota.`,
  })
}

export function verificarEmpresa(empresa) {
  const agoraIso = agora()
  const priv = JSON.parse(empresa.privacidade || '{}')
  const noTurno = dentroDoTurno(agoraIso, empresa)
  let mudouAtivo = false

  // 1. atraso: prazo vencido sem entrega concluída (ou atraso informado)
  const atrasadas = db
    .prepare(`SELECT e.*, u.nome AS entregador FROM entregas e LEFT JOIN usuarios u ON u.id = e.entregador_id
      WHERE e.empresa_id = ? AND e.status NOT IN ('entregue', 'cancelado') AND (e.prazo_limite < ? OR e.status = 'atrasado')`)
    .all(empresa.id, agoraIso)
  const atraso = new Set()
  for (const e of atrasadas) {
    const chave = `atraso:${e.id}`
    atraso.add(chave)
    const venceu = e.prazo_limite < agoraIso
    const min = venceu ? minutosDesde(e.prazo_limite) : 0
    abrirAlerta({
      empresaId: empresa.id, tipo: 'atraso', severidade: min > 60 ? 'critico' : 'alto', chave, referencia: e.id,
      titulo: `Atraso — ${e.id}`, entidade: venceu ? `+${min} min · ${e.cliente}` : `Informado · ${e.cliente}`,
      descricao: venceu
        ? `Prazo era ${horaLocal(e.prazo_limite, empresa.fuso)} (janela ${e.janela ?? '—'}). Status: ${STATUS_ENTREGA[e.status]?.label ?? e.status}. Entregador: ${e.entregador ?? 'não atribuído'}.`
        : `Atraso informado pelo entregador ${e.entregador ?? ''}. Janela ${e.janela ?? '—'}.`,
      abertoEm: venceu ? e.prazo_limite : agoraIso,
    })
  }
  resolverSobras(empresa.id, 'atraso', 'atraso:', atraso)

  // 2. perda de sinal do app do entregador com entregas em rota (só no expediente, se a LGPD restringir)
  const sinal = new Set()
  if (noTurno || priv.soExpediente === false) {
    const entregadores = db
      .prepare(`SELECT u.*, COUNT(e.id) AS em_rota FROM usuarios u JOIN entregas e ON e.entregador_id = u.id AND e.status IN ('transito', 'saiu', 'atrasado')
        WHERE u.empresa_id = ? AND u.funcao = 'entregador' GROUP BY u.id`)
      .all(empresa.id)
    for (const u of entregadores) {
      const min = u.ultima_posicao_em ? minutosDesde(u.ultima_posicao_em) : null
      if (min != null && min <= SEM_SINAL_ENTREGADOR_MIN) continue
      const chave = `sinal:u${u.id}`
      sinal.add(chave)
      abrirAlerta({
        empresaId: empresa.id, tipo: 'sinal', severidade: min == null || min > 30 ? 'critico' : 'alto', chave, referencia: String(u.id),
        titulo: `Sem sinal — ${u.nome}`, entidade: min == null ? 'App sem localização ativa' : `Último sinal há ${min} min`,
        descricao: min == null
          ? `${u.nome} tem ${u.em_rota} entrega(s) em rota, mas o app ainda não enviou a localização. Peça para abrir o app e permitir o GPS.`
          : `${u.nome} tem ${u.em_rota} entrega(s) em rota e não envia posição desde ${horaLocal(u.ultima_posicao_em, empresa.fuso)}.`,
        abertoEm: min == null ? agoraIso : new Date(Date.parse(u.ultima_posicao_em) + SEM_SINAL_ENTREGADOR_MIN * MIN).toISOString(),
      })
    }
  }
  resolverSobras(empresa.id, 'sinal', 'sinal:u', sinal)

  // 2b. rastreadores dos ativos sem comunicação
  const semSinal = new Set()
  const limite = new Date(Date.now() - SEM_SINAL_RASTREADOR_MIN * MIN).toISOString()
  for (const a of db
    .prepare(`SELECT * FROM ativos WHERE empresa_id = ? AND dispositivo_token IS NOT NULL AND status NOT IN ('extraviado', 'manutencao', 'entregue')
      AND (ultima_leitura_em IS NULL OR ultima_leitura_em < ?)`)
    .all(empresa.id, limite)) {
    const chave = `sinal:${a.id}`
    semSinal.add(chave)
    if (a.status !== 'sem_sinal') {
      db.prepare("UPDATE ativos SET status = 'sem_sinal' WHERE id = ?").run(a.id)
      mudouAtivo = true
    }
    abrirAlerta({
      empresaId: empresa.id, tipo: 'sinal', severidade: a.valor >= 10000 ? 'critico' : 'alto', chave, referencia: a.id,
      titulo: `Perda de sinal — ${a.id}`, entidade: `${a.nome} · último local: ${a.local ?? '—'}`,
      descricao: `O rastreador de ${a.nome} não se comunica há ${a.ultima_leitura_em ? minutosDesde(a.ultima_leitura_em) : '—'} min.${a.bateria != null ? ` Bateria: ${a.bateria}%.` : ''}`,
    })
  }
  for (const chave of chavesAbertas(empresa.id, 'sinal')) if (/^sinal:(?!u\d)/.test(chave) && !semSinal.has(chave)) resolverPorChave(empresa.id, chave)

  // 3. desvio de rota (entregadores com posição recente)
  for (const u of db.prepare("SELECT * FROM usuarios WHERE empresa_id = ? AND funcao = 'entregador'").all(empresa.id)) verificarDesvio(empresa, u)

  // 4. inatividade: ativo retirado sem nenhuma leitura há muito tempo
  const inativos = new Set()
  const corte = new Date(Date.now() - INATIVIDADE_HORAS * HORA).toISOString()
  for (const a of db
    .prepare("SELECT * FROM ativos WHERE empresa_id = ? AND tipo <> 'Carga' AND status IN ('em_uso', 'inativo') AND ultima_leitura_em < ?")
    .all(empresa.id, corte)) {
    const chave = `inatividade:${a.id}`
    inativos.add(chave)
    if (a.status !== 'inativo') {
      db.prepare("UPDATE ativos SET status = 'inativo' WHERE id = ?").run(a.id)
      mudouAtivo = true
    }
    const horas = Math.round((Date.now() - Date.parse(a.ultima_leitura_em)) / HORA)
    abrirAlerta({
      empresaId: empresa.id, tipo: 'inatividade', severidade: 'medio', chave, referencia: a.id,
      titulo: `Inatividade — ${a.id}`, entidade: `${a.nome} parado há ${horas >= 48 ? `${Math.round(horas / 24)} dias` : `${horas} h`}`,
      descricao: `${a.nome} está com ${a.responsavel ?? 'ninguém'} sem nenhuma leitura ou movimentação há ${horas} h (local: ${a.local ?? '—'}). Avalie realocar ou devolver.`,
    })
  }
  resolverSobras(empresa.id, 'inatividade', 'inatividade:', inativos)

  // LGPD: posições de pessoas com mais de 90 dias são apagadas
  if (priv.anonimizar90 !== false) db.prepare('DELETE FROM posicoes WHERE empresa_id = ? AND usuario_id IS NOT NULL AND criado_em < ?').run(empresa.id, new Date(Date.now() - 90 * DIA).toISOString())
  if (mudouAtivo) publicar({ empresaId: empresa.id, recursos: ['ativos'] })
}

export function verificarTudo() {
  for (const empresa of db.prepare('SELECT * FROM empresas').all()) {
    try {
      verificarEmpresa(empresa)
    } catch (err) {
      console.error(`[monitor] empresa ${empresa.id}:`, err)
    }
  }
  limparSessoes()
}

export function iniciarMonitor() {
  if (process.env.MONITOR === 'off') return
  setTimeout(verificarTudo, 2000)
  setInterval(verificarTudo, INTERVALO_MS)
  console.log(`[monitor] regras de alerta conferidas a cada ${Math.round(INTERVALO_MS / 1000)} s`)
}
