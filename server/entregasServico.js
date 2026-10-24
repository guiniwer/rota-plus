// Regras de negócio das entregas, usadas pela API do app, pela API de integração (ERP) e pelo importador CSV.
import { abrirAlerta, resolverPorChave } from './alertasServico.js'
import { criarAtivoDaEntrega, sincronizarAtivo } from './cargas.js'
import { db, transaction } from './db.js'
import { aproximarPorCidade, cidadeDoTexto, localizarEndereco } from './geocode.js'
import { entregaToJson } from './mappers.js'
import { URL_APP, dispararWebhook, enviarEmail, notificar } from './mensageria.js'
import { agora, dentroDoTurno, horaLocal, janelaParaDatas, partesLocais, prazoEmDiasUteis } from './tempo.js'
import { publicar } from './tempoReal.js'
import { calcularFrete } from '../src/utils/frete.js'
import { cidadePorId } from '../src/data/cidades.js'
import { STATUS_ENTREGA } from '../src/utils/status.js'

export const EM_ROTA = ['coletado', 'transito', 'saiu', 'atrasado', 'tentativa']
export const FINALIZADA = ['entregue', 'cancelado']
export const PREFERENCIAS_PADRAO = { push: true, email: true, saiu: true, atraso: true, comprovante: true }
const digitos = (s = '') => String(s ?? '').replace(/\D/g, '')

// entrega + nome da transportadora + último comprovante (sem as imagens)
const SQL_ENTREGA = `SELECT e.*, COALESCE(emp.fantasia, emp.razao_social) AS empresa_nome,
    c.id AS comp_id, c.resultado AS comp_resultado, c.recebedor AS comp_recebedor, c.foto IS NOT NULL AS comp_foto,
    c.assinatura IS NOT NULL AS comp_assinatura, c.lat AS comp_lat, c.lng AS comp_lng, c.criado_em AS comp_criado_em
  FROM entregas e
  JOIN empresas emp ON emp.id = e.empresa_id
  LEFT JOIN comprovantes c ON c.id = (SELECT MAX(id) FROM comprovantes WHERE entrega_id = e.id)`

/** Busca uma entrega com seus eventos (mais recente primeiro). */
export function buscarEntrega(id) {
  const e = db.prepare(`${SQL_ENTREGA} WHERE e.id = ?`).get(id)
  if (!e) return null
  return entregaToJson(e, db.prepare('SELECT * FROM entrega_eventos WHERE entrega_id = ? ORDER BY criado_em DESC, id DESC').all(id))
}

/** Lista entregas filtradas (where usa o alias "e"), já com os eventos. */
export function listarEntregas(where, params = [], { limite = 2000 } = {}) {
  const linhas = db.prepare(`${SQL_ENTREGA} WHERE ${where} ORDER BY e.criado_em DESC LIMIT ${Number(limite)}`).all(...params)
  if (!linhas.length) return []
  const ids = linhas.map((l) => l.id)
  const eventos = db
    .prepare(`SELECT * FROM entrega_eventos WHERE entrega_id IN (SELECT value FROM json_each(?)) ORDER BY criado_em DESC, id DESC`)
    .all(JSON.stringify(ids))
  const porEntrega = Map.groupBy(eventos, (ev) => ev.entrega_id)
  return linhas.map((l) => entregaToJson(l, porEntrega.get(l.id) ?? []))
}

export function registrarEvento(entregaId, { status = null, titulo, descricao = null, lat = null, lng = null, autorId = null, quando = agora() }) {
  db.prepare('INSERT INTO entrega_eventos (entrega_id, status, titulo, descricao, lat, lng, autor_id, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    entregaId, status, titulo, descricao, lat, lng, autorId, quando,
  )
}

const empresaPorId = (id) => db.prepare('SELECT * FROM empresas WHERE id = ?').get(id)

export function lerPreferencias(usuarioId) {
  const row = db.prepare("SELECT valor FROM configuracoes WHERE usuario_id = ? AND chave = 'preferencias'").get(usuarioId)
  return { ...PREFERENCIAS_PADRAO, ...(row ? JSON.parse(row.valor) : {}) }
}

/** Avisa o cliente (app, push, e-mail) e os e-mails cadastrados no rastreio público. */
export function avisarCliente(e, tipo, { titulo, texto, icon = 'truck', cor = 'var(--pink)' }) {
  const preferencia = { saiu: 'saiu', atrasado: 'atraso', tentativa: 'atraso', entregue: 'comprovante' }[tipo]
  const link = `${URL_APP}/#/rastreio?codigo=${encodeURIComponent(e.id)}`
  if (e.usuario_id) {
    const prefs = lerPreferencias(e.usuario_id)
    const quer = !preferencia || prefs[preferencia] !== false
    notificar(e.usuario_id, { icon, cor, titulo, texto, link: `/cliente/status/${e.id}` }, { push: quer && prefs.push !== false })
    if (quer && prefs.email) {
      const u = db.prepare('SELECT email FROM usuarios WHERE id = ?').get(e.usuario_id)
      enviarEmail({ empresaId: e.empresa_id, entregaId: e.id, para: u?.email, assunto: `${titulo} · ${e.id}`, texto: `${texto}\n\nAcompanhe: ${link}` })
    }
  }
  if (preferencia) {
    const emails = new Set(db.prepare('SELECT email FROM entrega_contatos WHERE entrega_id = ?').all(e.id).map((c) => c.email.toLowerCase()))
    if (e.email_destinatario) emails.add(e.email_destinatario.toLowerCase())
    for (const para of emails) enviarEmail({ empresaId: e.empresa_id, entregaId: e.id, para, assunto: `${titulo} · ${e.id}`, texto: `${texto}\n\nAcompanhe: ${link}` })
  }
}

/** Publica a mudança para quem enxerga a entrega (admins da empresa, cliente e entregador). */
export function avisarMudanca(e, recursos = ['entregas']) {
  publicar({ empresaId: e.empresa_id, usuarios: [e.usuario_id, e.entregador_id].filter(Boolean), recursos: [...recursos, 'ativos'] })
}

/**
 * Muda o status de uma entrega: registra o evento, sincroniza o ativo "Carga",
 * avisa o cliente, dispara o webhook e confere regras de alerta.
 */
export function mudarStatus(row, status, { descricao = '', autor = null, lat = null, lng = null, quando = agora() } = {}) {
  if (!STATUS_ENTREGA[status]) throw Object.assign(new Error('Status inválido.'), { status: 400 })
  const empresa = empresaPorId(row.empresa_id)
  const entregador = autor?.funcao === 'entregador'
  const texto = entregador ? `${descricao || 'Status atualizado'} · por ${autor.nome}` : descricao || (autor ? `Atualizado por ${autor.nome}` : 'Atualizado via integração')
  transaction(() => {
    db.prepare('UPDATE entregas SET status = ?, entregue_em = CASE WHEN ? = \'entregue\' THEN ? ELSE entregue_em END WHERE id = ?').run(status, status, quando, row.id)
    registrarEvento(row.id, { status, titulo: STATUS_ENTREGA[status].label, descricao: texto, lat, lng, autorId: autor?.id ?? null, quando })
    sincronizarAtivo(db, row.id, { descricao: texto, quando, lat, lng, cor: status === 'entregue' ? 'var(--green)' : ['atrasado', 'tentativa'].includes(status) ? 'var(--amber)' : null })
  })
  const e = { ...row, status }

  // alertas: atraso informado abre na hora; entrega concluída resolve o de atraso
  if (status === 'atrasado') {
    abrirAlerta({
      empresaId: e.empresa_id, tipo: 'atraso', severidade: 'alto', chave: `atraso:${e.id}`, referencia: e.id,
      titulo: `Atraso — ${e.id}`, entidade: e.cliente, descricao: `${descricao || 'Atraso informado'}${entregador ? ` pelo entregador ${autor.nome}` : ''}. Janela ${e.janela ?? '—'}.`,
    })
  }
  if (FINALIZADA.includes(status)) resolverPorChave(e.empresa_id, `atraso:${e.id}`)
  // uso indevido: atualização feita pelo entregador fora do expediente cadastrado
  if (entregador && !dentroDoTurno(quando, empresa)) {
    const p = partesLocais(quando, empresa.fuso)
    abrirAlerta({
      empresaId: e.empresa_id, tipo: 'uso_indevido', severidade: 'baixo', chave: `uso:u${autor.id}:${p.ano}-${p.mes}-${p.dia}`, referencia: String(autor.id),
      titulo: `Atividade fora do turno — ${autor.nome}`, entidade: `${horaLocal(quando, empresa.fuso)} · expediente ${empresa.turno_inicio}–${empresa.turno_fim}`,
      descricao: `${autor.nome} atualizou a entrega ${e.id} fora do expediente cadastrado.`,
    })
  }

  const label = STATUS_ENTREGA[status].label
  avisarCliente(e, status, {
    titulo: label,
    texto: `Pedido ${e.id}: ${descricao || label}.`,
    icon: status === 'entregue' ? 'box' : ['atrasado', 'tentativa'].includes(status) ? 'alert' : 'truck',
    cor: status === 'entregue' ? 'var(--green)' : ['atrasado', 'tentativa', 'cancelado'].includes(status) ? 'var(--amber)' : 'var(--pink)',
  })
  const json = buscarEntrega(e.id)
  dispararWebhook(empresa, 'entrega.status', json).catch(() => {})
  avisarMudanca(e)
  return json
}

function novoCodigo() {
  let id
  do id = `RT-${Math.floor(10000 + Math.random() * 89999)}-BR`
  while (db.prepare('SELECT 1 FROM entregas WHERE id = ?').get(id))
  return id
}

/**
 * Cria uma entrega para a empresa.
 *  - cliente (usuário logado) → frete e prazo recalculados aqui, com as cidades escolhidas
 *  - admin / integração → prazo pela janela "HH:MM–HH:MM" (ou prazoLimite ISO)
 */
export async function criarEntrega(empresa, d, { cliente = null, autor = null, geocodificar = true } = {}) {
  if (!String(d.destino ?? '').trim()) throw Object.assign(new Error('Informe o endereço de destino.'), { status: 400 })
  const quando = agora()
  let valor = Number(d.valor) || 0
  let prazo
  let janela = d.janela ?? null
  let pesoTaxado = Number(d.pesoTaxado) || 0
  if (cliente) {
    const frete = calcularFrete({ ...d, tipoCarga: d.formato, origem: d.origemCidade, destino: d.destinoCidade })
    valor = frete.total
    pesoTaxado = frete.pesoTaxado
    prazo = prazoEmDiasUteis(quando, frete.prazoDias, empresa.fuso)
    janela = 'até 18:00'
  } else if (d.prazoLimite && !Number.isNaN(Date.parse(d.prazoLimite))) {
    prazo = new Date(d.prazoLimite)
  } else {
    const j = janela && janelaParaDatas(janela, empresa.fuso)
    prazo = j ? j.fim : prazoEmDiasUteis(quando, 1, empresa.fuso)
    if (!j) janela = 'até 18:00'
  }

  // importação em lote: posição aproximada agora, endereço exato em segundo plano
  const destino = geocodificar ? await localizarEndereco(d.destino, d.destinoCidade) : posicaoAproximada(d.destino, d.destinoCidade)
  const origem = cliente && d.origem ? await localizarEndereco(d.origem, d.origemCidade) : { lat: empresa.base_lat, lng: empresa.base_lng }
  const entregador = !cliente && d.entregadorId
    ? db.prepare("SELECT id, nome FROM usuarios WHERE id = ? AND funcao = 'entregador' AND empresa_id = ?").get(Number(d.entregadorId), empresa.id)
    : null
  if (!cliente && d.entregadorId && !entregador) throw Object.assign(new Error('Entregador não encontrado nesta empresa.'), { status: 400 })

  const id = novoCodigo()
  transaction(() => {
    db.prepare(`INSERT INTO entregas
      (id, empresa_id, usuario_id, cliente, documento, remetente, destinatario, telefone_destinatario, email_destinatario, origem, destino, destino_cidade,
       tipo_carga, peso_taxado, modalidade, rastreio, valor, valor_nf, status, criado_em, prazo_limite, janela, responsavel, entregador_id,
       origem_lat, origem_lng, lat, lng, geo_fonte, instrucoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, empresa.id, cliente?.id ?? null, cliente ? cliente.nome : String(d.cliente ?? '').trim() || 'Cliente', cliente ? cliente.documento : digitos(d.documento),
      d.remetente ?? cliente?.nome ?? (empresa.fantasia || empresa.razao_social), d.destinatario ?? '', d.telefoneDestinatario ?? null, d.emailDestinatario ?? null,
      d.origem ?? empresa.endereco ?? 'Base', d.destino, destino.cidade ?? d.destinoCidade ?? null,
      d.tipoCarga ?? '', pesoTaxado, d.modalidade === 'expressa' ? 'expressa' : 'normal', d.rastreio === 'cd' ? 'cd' : 'gps', valor, Number(d.valorNF) || 0,
      quando, prazo.toISOString(), janela, entregador?.nome ?? null, entregador?.id ?? null,
      origem.lat ?? null, origem.lng ?? null, destino.lat, destino.lng, destino.fonte, d.instrucoes ?? null,
    )
    registrarEvento(id, { status: 'confirmado', titulo: 'Pedido confirmado', descricao: cliente ? 'Aguardando coleta na origem' : `Criado por ${autor?.nome ?? 'integração'}`, autorId: autor?.id ?? null, quando })
    // toda entrega também vira um ativo (categoria "Carga")
    criarAtivoDaEntrega(db, db.prepare('SELECT * FROM entregas WHERE id = ?').get(id), quando)
  })
  const row = db.prepare('SELECT * FROM entregas WHERE id = ?').get(id)
  if (cliente) notificar(cliente.id, { icon: 'check', cor: 'var(--green)', titulo: 'Pedido confirmado', texto: `Seu pedido ${id} foi registrado com ${empresa.fantasia || empresa.razao_social}.`, link: `/cliente/status/${id}` })
  if (entregador) notificar(entregador.id, { icon: 'route', titulo: 'Nova entrega na sua rota', texto: `${row.cliente} — ${row.destino}`, link: '/entregador' })
  const json = buscarEntrega(id)
  dispararWebhook(empresa, 'entrega.criada', json).catch(() => {})
  avisarMudanca(row)
  return json
}

function posicaoAproximada(endereco, cidadeId) {
  const cidade = cidadePorId(cidadeId) ?? cidadeDoTexto(endereco)
  return cidade ? { ...aproximarPorCidade(cidade, endereco), fonte: 'cidade', cidade: cidade.id } : { lat: null, lng: null, fonte: null, cidade: null }
}

/** Geocodifica, uma a uma (limite do Nominatim), entregas criadas com posição aproximada. */
export async function refinarEmSegundoPlano(ids) {
  for (const id of ids) {
    const e = db.prepare('SELECT * FROM entregas WHERE id = ?').get(id)
    if (!e || e.geo_fonte === 'endereco') continue
    const r = await localizarEndereco(e.destino, e.destino_cidade)
    if (r.fonte === 'endereco') {
      db.prepare("UPDATE entregas SET lat = ?, lng = ?, geo_fonte = 'endereco' WHERE id = ?").run(r.lat, r.lng, id)
      avisarMudanca(e)
    }
  }
}
