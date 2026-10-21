import { hashSenha } from './auth.js'
import { criarAtivoDaEntrega } from './cargas.js'
import { ALERTAS, ATIVOS, CLIENTE_DEMO, EMPRESA_DEMO, ENTREGAS, EQUIPE, NOTIFICACOES, PREFERENCIAS, PRIVACIDADE } from './seedData.js'
import { SENHA_DEMO } from '../src/data/contasDemo.js'

const digitos = (s = '') => s.replace(/\D/g, '')

/** Insere os dados de demonstração (mesmos usados no protótipo do Figma). */
export function seed(db) {
  const insUser = db.prepare(
    'INSERT INTO usuarios (perfil, funcao, nome, email, senha_hash, documento, empresa, cargo, cnpj, telefone, veiculo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const senha = hashSenha(SENHA_DEMO)
  const cnpj = digitos(EMPRESA_DEMO.cnpj)
  const cliente = insUser.run('cliente', null, CLIENTE_DEMO.nome, CLIENTE_DEMO.email, senha, digitos(CLIENTE_DEMO.documento), null, null, null, '(81) 99876-5432', null)
  const empresa = insUser.run('empresa', 'admin', EMPRESA_DEMO.nome, EMPRESA_DEMO.email, senha, null, EMPRESA_DEMO.empresa, EMPRESA_DEMO.cargo, cnpj, '(81) 3512-4000', null)
  const clienteId = Number(cliente.lastInsertRowid)
  const empresaId = Number(empresa.lastInsertRowid)

  // equipe de campo: quem tem e-mail vira usuário com função "entregador"
  const entregadorId = {}
  const insEquipe = db.prepare('INSERT INTO equipe (usuario_id, nome, funcao, base, veiculo, hoje, prazo, adesao, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const p of EQUIPE) {
    let uid = null
    if (p.email) {
      uid = Number(insUser.run('empresa', 'entregador', p.nome, p.email, senha, null, EMPRESA_DEMO.empresa, null, cnpj, p.telefone, p.veiculo).lastInsertRowid)
      entregadorId[p.nome] = uid
    }
    insEquipe.run(uid, p.nome, p.funcao, p.base, p.veiculo, p.hoje, p.prazo, p.adesao, p.status)
  }

  const insEntrega = db.prepare(`INSERT INTO entregas
    (id, usuario_id, cliente, documento, remetente, destinatario, origem, destino, tipo_carga, peso_taxado, modalidade, rastreio, valor, status,
     criado_em, previsao, janela, responsavel, entregador_id, lat, lng, progresso, avaliacao_nota, avaliacao_estado, avaliacao_comentario, ordem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insEvento = db.prepare('INSERT INTO entrega_eventos (entrega_id, titulo, descricao, data) VALUES (?, ?, ?, ?)')
  const insHist = db.prepare('INSERT INTO ativo_historico (ativo_id, titulo, descricao, data, cor) VALUES (?, ?, ?, ?, ?)')
  ENTREGAS.forEach((e, i) => {
    insEntrega.run(
      e.id, e.cliente === CLIENTE_DEMO.nome ? clienteId : null, e.cliente, e.documento, e.remetente, e.destinatario, e.origem, e.destino,
      e.tipoCarga, e.pesoTaxado, e.modalidade, e.rastreio, e.valor, e.status, e.criadoEm, e.previsao, e.janela, e.responsavel,
      entregadorId[e.responsavel] ?? null, e.lat ?? null, e.lng ?? null, e.progresso,
      e.avaliacao?.nota ?? null, e.avaliacao?.estado ?? null, e.avaliacao?.comentario ?? null, ENTREGAS.length - i,
    )
    // eventos são guardados do mais antigo para o mais novo
    ;[...e.eventos].reverse().forEach((ev) => insEvento.run(e.id, ev.titulo, ev.descricao, ev.data))

    // toda entrega também entra na tabela de ativos (categoria "Carga")
    const ativoId = criarAtivoDaEntrega(db, db.prepare('SELECT * FROM entregas WHERE id = ?').get(e.id))
    db.prepare('UPDATE ativo_historico SET data = ? WHERE ativo_id = ?').run(e.criadoEm, ativoId)
    if (e.eventos[0]) insHist.run(ativoId, e.eventos[0].titulo, e.eventos[0].descricao, e.eventos[0].data, null)
  })

  const insAtivo = db.prepare(`INSERT INTO ativos (id, nome, tipo, identificacao, bateria, responsavel, local, ultima_leitura, status, valor, x, y, uso, ordem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const ordemBase = db.prepare('SELECT MAX(ordem) AS m FROM ativos').get().m ?? 0
  ATIVOS.forEach((a, i) => {
    insAtivo.run(a.id, a.nome, a.tipo, a.identificacao, a.bateria, a.responsavel, a.local, a.ultimaLeitura, a.status, a.valor, a.x, a.y, JSON.stringify(a.uso), ordemBase + ATIVOS.length - i)
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

  const insCfg = db.prepare('INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, ?, ?)')
  insCfg.run(clienteId, 'preferencias', JSON.stringify(PREFERENCIAS))
  insCfg.run(empresaId, 'privacidade', JSON.stringify(PRIVACIDADE))
}
