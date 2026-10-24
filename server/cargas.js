// Toda entrega também é um ativo (categoria "Carga"), rastreado na tabela de ativos.
// O ativo guarda só o TIPO genérico da carga (Caixa, Palete…), nunca o conteúdo enviado.
import { agora } from './tempo.js'
import { STATUS_ENTREGA } from '../src/utils/status.js'

/** Classifica a carga em um tipo genérico de ativo. */
export function tipoAtivoDaCarga(tipoCarga = '') {
  const t = tipoCarga.toLowerCase()
  if (/document|envelope/.test(t)) return 'Envelope / documentos'
  if (/palete|pallet/.test(t)) return 'Palete'
  if (/contêiner|conteiner|container/.test(t)) return 'Contêiner'
  if (/caixa/.test(t)) return 'Caixa'
  return 'Volume'
}

/** Situação e local do ativo conforme o status da entrega. */
function situacao(e) {
  switch (e.status) {
    case 'confirmado':
      return { status: 'disponivel', local: `Aguardando coleta · ${e.origem}` }
    case 'coletado':
      return { status: 'em_uso', local: `Coletado · ${e.origem}` }
    case 'entregue':
      return { status: 'entregue', local: e.destino }
    case 'cancelado':
      return { status: 'inativo', local: 'Pedido cancelado' }
    case 'tentativa':
      return { status: 'em_uso', local: `Retorno à base · ${e.destino}` }
    default: // transito, saiu, atrasado
      return { status: 'em_uso', local: `Em rota → ${e.destino}` }
  }
}

export const registrarHistorico = (db, ativoId, titulo, descricao, cor = null, quando = agora()) =>
  db.prepare('INSERT INTO ativo_historico (ativo_id, titulo, descricao, cor, criado_em) VALUES (?, ?, ?, ?, ?)').run(ativoId, titulo, descricao, cor, quando)

/** Cria o ativo "Carga" de uma entrega recém-cadastrada (linha da tabela entregas). */
export function criarAtivoDaEntrega(db, e, quando = e.criado_em) {
  const numero = e.id.replace(/\D/g, '')
  let id = `CRG-${numero}`
  while (db.prepare('SELECT 1 FROM ativos WHERE id = ?').get(id)) id = `CRG-${numero}-${Math.floor(Math.random() * 90 + 10)}`
  const gps = e.rastreio === 'gps'
  const { status, local } = situacao(e)
  db.prepare(`INSERT INTO ativos (id, empresa_id, nome, tipo, entrega_id, identificacao, responsavel, responsavel_id, local, lat, lng, ultima_leitura_em, status, valor, criado_em)
    VALUES (?, ?, ?, 'Carga', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, e.empresa_id, tipoAtivoDaCarga(e.tipo_carga), e.id, gps ? 'GPS' : 'QR', e.responsavel ?? null, e.entregador_id ?? null, local,
    e.origem_lat ?? null, e.origem_lng ?? null, quando, status, Number(e.valor_nf) || 0, quando,
  )
  registrarHistorico(db, id, 'Carga registrada', `Vinculada à entrega ${e.id} · etiqueta ${gps ? 'QR + GPS do entregador' : 'QR'}`, 'var(--green)', quando)
  return id
}

/** Atualiza o ativo da entrega depois de uma mudança de status ou de entregador. */
export function sincronizarAtivo(db, entregaId, { titulo, descricao, cor, quando = agora(), lat, lng } = {}) {
  const e = db.prepare('SELECT * FROM entregas WHERE id = ?').get(entregaId)
  const ativo = db.prepare('SELECT id, lat, lng FROM ativos WHERE entrega_id = ?').get(entregaId)
  if (!e || !ativo) return
  const { status, local } = situacao(e)
  // posição: a informada (GPS do entregador); entregue → endereço de destino
  const pos = lat != null ? { lat, lng } : e.status === 'entregue' ? { lat: e.lat, lng: e.lng } : { lat: ativo.lat, lng: ativo.lng }
  db.prepare('UPDATE ativos SET status = ?, local = ?, responsavel = ?, responsavel_id = ?, lat = ?, lng = ?, ultima_leitura_em = ? WHERE id = ?').run(
    status, local, e.responsavel, e.entregador_id, pos.lat ?? null, pos.lng ?? null, quando, ativo.id,
  )
  registrarHistorico(db, ativo.id, titulo ?? STATUS_ENTREGA[e.status]?.label ?? e.status, descricao ?? local, cor ?? null, quando)
}
