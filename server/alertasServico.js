// Abertura e resolução de alertas (usado pelo monitor automático e pelas rotas da API).
import { db } from './db.js'
import { notificar } from './mensageria.js'
import { agora } from './tempo.js'
import { publicar } from './tempoReal.js'

/** SLA (minutos) e fluxo de resposta de cada tipo de alerta. */
export const MODELOS = {
  atraso: { sla: 30, passos: ['Contatar o entregador', 'Avisar o cliente com a nova previsão', 'Avaliar reatribuição para outro entregador', 'Registrar a causa raiz'] },
  sinal: { sla: 15, passos: ['Ligar para o portador', 'Verificar a última posição conhecida', 'Checar bateria e permissão de localização do aparelho'] },
  desvio: { sla: 30, passos: ['Contatar o entregador', 'Confirmar o motivo (obra, bloqueio, parada)', 'Recalcular a rota'] },
  inatividade: { sla: 240, passos: ['Confirmar com o responsável', 'Realocar ou devolver ao almoxarifado'] },
  uso_indevido: { sla: 720, passos: ['Confirmar a justificativa com o colaborador', 'Registrar a ocorrência'] },
  ocorrencia: { sla: 120, passos: ['Ler o relato do cliente', 'Contatar o cliente', 'Registrar a solução'] },
}
const PESO = { baixo: 0, medio: 1, alto: 2, critico: 3 }

/**
 * Abre um alerta, a menos que já exista um aberto com a mesma chave
 * (nesse caso só atualiza a descrição e, se for o caso, aumenta a severidade).
 */
export function abrirAlerta({ empresaId, tipo, severidade, titulo, descricao, entidade, referencia, chave, abertoEm = agora() }) {
  const existente = db.prepare("SELECT * FROM alertas WHERE empresa_id = ? AND chave = ? AND status <> 'resolvido'").get(empresaId, chave)
  if (existente) {
    const sev = PESO[severidade] > PESO[existente.severidade] ? severidade : existente.severidade
    if (existente.descricao !== descricao || existente.entidade !== entidade || sev !== existente.severidade) {
      db.prepare('UPDATE alertas SET descricao = ?, entidade = ?, severidade = ? WHERE id = ?').run(descricao, entidade, sev, existente.id)
      publicar({ empresaId, recursos: ['alertas'] })
    }
    return { id: existente.id, novo: false }
  }
  const modelo = MODELOS[tipo]
  const id = Number(
    db.prepare('INSERT INTO alertas (empresa_id, tipo, severidade, titulo, descricao, entidade, referencia, chave, aberto_em, sla_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(empresaId, tipo, severidade, titulo, descricao, entidade, referencia, chave, abertoEm, modelo.sla).lastInsertRowid,
  )
  modelo.passos.forEach((texto, i) => db.prepare('INSERT INTO alerta_passos (alerta_id, ordem, texto) VALUES (?, ?, ?)').run(id, i, texto))
  publicar({ empresaId, recursos: ['alertas'] })
  // administradores recebem push nos alertas graves
  if (PESO[severidade] >= PESO.alto) {
    for (const adm of db.prepare("SELECT id FROM usuarios WHERE empresa_id = ? AND funcao = 'admin'").all(empresaId)) {
      notificar(adm.id, { icon: 'alert', cor: 'var(--red)', titulo, texto: descricao, link: `/empresa/alertas?id=${id}` })
    }
  }
  return { id, novo: true }
}

/** Resolve automaticamente o alerta aberto com a chave (a condição deixou de existir). */
export function resolverPorChave(empresaId, chave) {
  const r = db
    .prepare("UPDATE alertas SET status = 'resolvido', resolvido_em = ?, resolucao = 'automatica' WHERE empresa_id = ? AND chave = ? AND status <> 'resolvido'")
    .run(agora(), empresaId, chave)
  if (r.changes) publicar({ empresaId, recursos: ['alertas'] })
  return r.changes > 0
}

/** Chaves dos alertas abertos de um tipo (para resolver os que não se aplicam mais). */
export const chavesAbertas = (empresaId, tipo) =>
  db.prepare("SELECT chave FROM alertas WHERE empresa_id = ? AND tipo = ? AND status <> 'resolvido'").all(empresaId, tipo).map((r) => r.chave)
