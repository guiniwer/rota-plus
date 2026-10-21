// Toda entrega também é um ativo (categoria "Carga"), rastreado na tabela de ativos.
// O ativo guarda só o TIPO genérico da carga (Caixa, Palete…), nunca o conteúdo enviado.
import { nowLabel } from '../src/utils/format.js'
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
      return { status: 'em_uso', local: `Retorno ao CD · ${e.destino}` }
    default: // transito, saiu, atrasado
      return { status: 'em_uso', local: `Em rota → ${e.destino}` }
  }
}

const historico = (db, id, titulo, descricao, cor = null, data = nowLabel()) =>
  db.prepare('INSERT INTO ativo_historico (ativo_id, titulo, descricao, data, cor) VALUES (?, ?, ?, ?, ?)').run(id, titulo, descricao, data, cor)

/** Cria o ativo "Carga" de uma entrega recém-cadastrada (linha da tabela entregas). */
export function criarAtivoDaEntrega(db, e, valor = 0) {
  const numero = e.id.replace(/\D/g, '')
  let id = `CRG-${numero}`
  while (db.prepare('SELECT 1 FROM ativos WHERE id = ?').get(id)) id = `CRG-${numero}-${Math.floor(Math.random() * 90 + 10)}`
  const gps = e.rastreio === 'gps'
  const { status, local } = situacao(e)
  const ordem = (db.prepare('SELECT MAX(ordem) AS m FROM ativos').get().m ?? 0) + 1
  db.prepare(`INSERT INTO ativos (id, nome, tipo, entrega_id, identificacao, bateria, responsavel, local, ultima_leitura, status, valor, x, y, uso, ordem)
    VALUES (?, ?, 'Carga', ?, ?, ?, ?, ?, 'agora', ?, ?, ?, ?, ?, ?)`).run(
    id, tipoAtivoDaCarga(e.tipo_carga), e.id, gps ? 'GPS' : 'QR', gps ? 100 : null, e.responsavel ?? null, local, status, Number(valor) || 0,
    150 + Math.random() * 700, 80 + Math.random() * 380, JSON.stringify(Array(14).fill(0)), ordem,
  )
  historico(db, id, 'Carga registrada', `Vinculada à entrega ${e.id} · etiqueta ${gps ? 'GPS' : 'QR'}`, 'var(--green)')
  return id
}

/** Atualiza o ativo da entrega depois de uma mudança de status ou de entregador. */
export function sincronizarAtivo(db, entregaId, { titulo, descricao, cor } = {}) {
  const e = db.prepare('SELECT * FROM entregas WHERE id = ?').get(entregaId)
  const ativo = db.prepare('SELECT id FROM ativos WHERE entrega_id = ?').get(entregaId)
  if (!e || !ativo) return
  const { status, local } = situacao(e)
  db.prepare("UPDATE ativos SET status = ?, local = ?, responsavel = ?, ultima_leitura = 'agora' WHERE id = ?").run(status, local, e.responsavel, ativo.id)
  historico(db, ativo.id, titulo ?? STATUS_ENTREGA[e.status]?.label ?? e.status, descricao ?? local, cor ?? null)
}
