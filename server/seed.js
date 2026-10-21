import { hashSenha } from './auth.js'
import { ALERTAS, ATIVOS, CLIENTE_DEMO, EMPRESA_DEMO, ENTREGAS, EQUIPE, NOTIFICACOES, PREFERENCIAS, PRIVACIDADE } from './seedData.js'

const digitos = (s = '') => s.replace(/\D/g, '')
import { SENHA_DEMO } from '../src/data/contasDemo.js'

/** Insere os dados de demonstração (mesmos usados no protótipo do Figma). */
export function seed(db) {
  const insUser = db.prepare(
    'INSERT INTO usuarios (perfil, nome, email, senha_hash, documento, empresa, cargo, cnpj) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const cliente = insUser.run('cliente', CLIENTE_DEMO.nome, CLIENTE_DEMO.email, hashSenha(SENHA_DEMO), digitos(CLIENTE_DEMO.documento), null, null, null)
  const empresa = insUser.run('empresa', EMPRESA_DEMO.nome, EMPRESA_DEMO.email, hashSenha(SENHA_DEMO), null, EMPRESA_DEMO.empresa, EMPRESA_DEMO.cargo, digitos(EMPRESA_DEMO.cnpj))
  const clienteId = Number(cliente.lastInsertRowid)
  const empresaId = Number(empresa.lastInsertRowid)

  const insEntrega = db.prepare(`INSERT INTO entregas
    (id, usuario_id, cliente, documento, remetente, destinatario, origem, destino, tipo_carga, peso_taxado, modalidade, rastreio, valor, status,
     criado_em, previsao, janela, responsavel, progresso, avaliacao_nota, avaliacao_estado, avaliacao_comentario, ordem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insEvento = db.prepare('INSERT INTO entrega_eventos (entrega_id, titulo, descricao, data) VALUES (?, ?, ?, ?)')
  ENTREGAS.forEach((e, i) => {
    insEntrega.run(
      e.id, e.cliente === CLIENTE_DEMO.nome ? clienteId : null, e.cliente, e.documento, e.remetente, e.destinatario, e.origem, e.destino,
      e.tipoCarga, e.pesoTaxado, e.modalidade, e.rastreio, e.valor, e.status, e.criadoEm, e.previsao, e.janela, e.responsavel, e.progresso,
      e.avaliacao?.nota ?? null, e.avaliacao?.estado ?? null, e.avaliacao?.comentario ?? null, ENTREGAS.length - i,
    )
    // eventos são guardados do mais antigo para o mais novo
    ;[...e.eventos].reverse().forEach((ev) => insEvento.run(e.id, ev.titulo, ev.descricao, ev.data))
  })

  const insAtivo = db.prepare(`INSERT INTO ativos (id, nome, tipo, identificacao, bateria, responsavel, local, ultima_leitura, status, valor, x, y, uso, ordem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insHist = db.prepare('INSERT INTO ativo_historico (ativo_id, titulo, descricao, data, cor) VALUES (?, ?, ?, ?, ?)')
  ATIVOS.forEach((a, i) => {
    insAtivo.run(a.id, a.nome, a.tipo, a.identificacao, a.bateria, a.responsavel, a.local, a.ultimaLeitura, a.status, a.valor, a.x, a.y, JSON.stringify(a.uso), ATIVOS.length - i)
    ;[...a.historico].reverse().forEach((h) => insHist.run(a.id, h.titulo, h.descricao, h.data, h.cor ?? null))
  })

  const insAlerta = db.prepare('INSERT INTO alertas (id, tipo, severidade, titulo, descricao, entidade, aberto, sla, responsavel, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insPasso = db.prepare('INSERT INTO alerta_passos (alerta_id, ordem, texto, feito) VALUES (?, ?, ?, ?)')
  for (const a of ALERTAS) {
    insAlerta.run(a.id, a.tipo, a.severidade, a.titulo, a.descricao, a.entidade, a.aberto, a.sla, a.responsavel, a.status)
    a.passos.forEach((p, i) => insPasso.run(a.id, i, p.texto, p.feito ? 1 : 0))
  }

  const insNotif = db.prepare('INSERT INTO notificacoes (usuario_id, icon, cor, titulo, texto, quando, grupo, lida) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  ;[...NOTIFICACOES].reverse().forEach((n) => insNotif.run(clienteId, n.icon, n.cor, n.titulo, n.texto, n.quando, n.grupo, n.lida ? 1 : 0))

  const insEquipe = db.prepare('INSERT INTO equipe (nome, funcao, base, veiculo, hoje, prazo, adesao, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (const p of EQUIPE) insEquipe.run(p.nome, p.funcao, p.base, p.veiculo, p.hoje, p.prazo, p.adesao, p.status)

  const insCfg = db.prepare('INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, ?, ?)')
  insCfg.run(clienteId, 'preferencias', JSON.stringify(PREFERENCIAS))
  insCfg.run(empresaId, 'privacidade', JSON.stringify(PRIVACIDADE))
}
