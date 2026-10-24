// Dados de demonstração: a empresa LogiSuape com 30 dias de operação e o cliente Jhonata.
// Tudo é gerado com datas relativas ao momento da criação, para que relatórios, alertas
// e indicadores sejam calculados do mesmo jeito que com dados reais.
import crypto from 'node:crypto'
import { MODELOS } from './alertasServico.js'
import { hashSenha } from './auth.js'
import { criarAtivoDaEntrega, registrarHistorico } from './cargas.js'
import { ATIVOS, CARGAS, DESTINOS, EMPRESA, ENTREGADORES, FOTO_DEMO, JANELAS, RECEBEDORES } from './seedData.js'
import { DIA, HORA, MIN, dentroDoTurno, localParaUtc, partesLocais } from './tempo.js'
import { CLIENTE_DEMO, EMPRESA_DEMO, SENHA_DEMO } from '../src/data/contasDemo.js'
import { STATUS_ENTREGA } from '../src/utils/status.js'

const FUSO = 'America/Recife'
const digitos = (s = '') => s.replace(/\D/g, '')

/** Gerador pseudoaleatório com semente fixa: o histórico é o mesmo a cada restauração. */
function prng(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Assinatura rabiscada (SVG) para os comprovantes do histórico. */
function assinaturaDemo(rand) {
  let x = 20
  let d = `M${x} ${60 + rand() * 20}`
  while (x < 260) {
    x += 18 + rand() * 22
    d += ` Q${x - 10} ${20 + rand() * 70} ${x} ${40 + rand() * 40}`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="110" viewBox="0 0 300 110"><rect width="300" height="110" fill="#fff"/><path d="${d}" fill="none" stroke="#1A0D31" stroke-width="3" stroke-linecap="round"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const hhmm = (t) => {
  const p = partesLocais(t, FUSO)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

/** Remove a empresa e o cliente de demonstração (o resto do banco fica intacto). */
export function removerDemo(db) {
  db.prepare('DELETE FROM empresas WHERE demo = 1').run()
  db.prepare('DELETE FROM usuarios WHERE email = ?').run(CLIENTE_DEMO.email)
}

export function seed(db) {
  const rand = prng(20261021)
  const entre = (a, b) => a + rand() * (b - a)
  const escolher = (xs) => xs[Math.floor(rand() * xs.length)]
  const agoraMs = Date.now()
  const iso = (t) => new Date(t).toISOString()
  // instante local: dia relativo a hoje + hora:minuto
  const hoje = partesLocais(agoraMs, FUSO)
  const meioDiaHoje = localParaUtc({ ...hoje, hora: 12 }, FUSO).getTime()
  const emDia = (offset, h, m = 0) => {
    const p = partesLocais(meioDiaHoje + offset * DIA, FUSO)
    return localParaUtc({ ...p, hora: h, minuto: m }, FUSO).getTime()
  }

  // ---------- empresa, administrador, entregadores e cliente ----------
  const empresaId = Number(
    db.prepare(`INSERT INTO empresas (cnpj, razao_social, fantasia, segmento, email, telefone, endereco, base_lat, base_lng, turno_inicio, turno_fim, fuso, privacidade, demo, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).run(
      EMPRESA.cnpj, EMPRESA.razaoSocial, EMPRESA.fantasia, EMPRESA.segmento, EMPRESA.email, EMPRESA.telefone, EMPRESA.endereco, EMPRESA.lat, EMPRESA.lng,
      EMPRESA.turnoInicio, EMPRESA.turnoFim, FUSO, JSON.stringify({ soExpediente: true, termoCiencia: true, anonimizar90: true, compartilharEta: true }), iso(agoraMs - 120 * DIA),
    ).lastInsertRowid,
  )
  const senha = hashSenha(SENHA_DEMO)
  const insUser = db.prepare(`INSERT INTO usuarios (perfil, funcao, empresa_id, nome, email, senha_hash, documento, telefone, veiculo, base_nome, base_lat, base_lng, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const adminId = Number(insUser.run('empresa', 'admin', empresaId, EMPRESA_DEMO.nome, EMPRESA_DEMO.email, senha, null, '(81) 3512-4000', null, null, null, null, iso(agoraMs - 120 * DIA)).lastInsertRowid)
  const ent = {}
  for (const e of ENTREGADORES) {
    const id = Number(insUser.run('empresa', 'entregador', empresaId, e.nome, e.email, senha, null, e.telefone, e.veiculo, e.base?.nome ?? null, e.base?.lat ?? null, e.base?.lng ?? null, iso(agoraMs - 90 * DIA)).lastInsertRowid)
    ent[e.nome] = { ...e, id }
  }
  const cliente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(CLIENTE_DEMO.email)
  const clienteId = cliente?.id ?? Number(insUser.run('cliente', null, null, CLIENTE_DEMO.nome, CLIENTE_DEMO.email, senha, digitos(CLIENTE_DEMO.documento), '(81) 99876-5432', null, null, null, null, iso(agoraMs - 60 * DIA)).lastInsertRowid)
  db.prepare("INSERT OR IGNORE INTO configuracoes (usuario_id, chave, valor) VALUES (?, 'preferencias', ?)").run(clienteId, JSON.stringify({ push: true, email: true, saiu: true, atraso: true, comprovante: true }))

  // ---------- inserção de entregas ----------
  const insEntrega = db.prepare(`INSERT INTO entregas
    (id, empresa_id, usuario_id, cliente, documento, remetente, destinatario, telefone_destinatario, origem, destino, destino_cidade, tipo_carga, peso_taxado, modalidade, rastreio,
     valor, valor_nf, status, criado_em, prazo_limite, janela, entregue_em, responsavel, entregador_id, origem_lat, origem_lng, lat, lng, geo_fonte,
     avaliacao_nota, avaliacao_estado, avaliacao_comentario, avaliado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'endereco', ?, ?, ?, ?)`)
  const insEvento = db.prepare('INSERT INTO entrega_eventos (entrega_id, status, titulo, descricao, lat, lng, autor_id, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const insComp = db.prepare(`INSERT INTO comprovantes (entrega_id, resultado, recebedor, documento, foto, assinatura, lat, lng, precisao, volumes_conferidos, entregador_id, criado_em)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?)`)
  const insAlerta = db.prepare(`INSERT INTO alertas (empresa_id, tipo, severidade, titulo, descricao, entidade, referencia, chave, aberto_em, sla_min, responsavel, status, resolvido_em, resolucao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'resolvido', ?, ?)`)
  const insPasso = db.prepare('INSERT INTO alerta_passos (alerta_id, ordem, texto, feito) VALUES (?, ?, ?, ?)')
  const insNotif = db.prepare('INSERT INTO notificacoes (usuario_id, icon, cor, titulo, texto, link, criado_em, lida) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const usados = new Set(db.prepare('SELECT id FROM entregas').all().map((r) => r.id))
  const novoId = () => {
    let id
    do id = `RT-${Math.floor(10000 + rand() * 89999)}-BR`
    while (usados.has(id))
    usados.add(id)
    return id
  }

  const alertaResolvido = (a) => {
    const id = Number(insAlerta.run(empresaId, a.tipo, a.severidade, a.titulo, a.descricao, a.entidade, a.referencia, a.chave, iso(a.aberto), MODELOS[a.tipo].sla, a.responsavel ?? null, iso(a.resolvido), a.resolucao).lastInsertRowid)
    MODELOS[a.tipo].passos.forEach((t, i) => insPasso.run(id, i, t, 1))
  }

  /**
   * Grava uma entrega com a sequência de eventos [status, instante, descrição?].
   * O último status da lista é o atual.
   */
  function gravar(e, eventos) {
    const final = eventos.at(-1)
    const entregue = final[0] === 'entregue' ? final[1] : null
    const entregador = e.entregador ? ent[e.entregador] : null
    const origem = e.origemPos ?? (entregador?.base ?? { lat: EMPRESA.lat, lng: EMPRESA.lng })
    insEntrega.run(
      e.id, empresaId, e.clienteId ?? null, e.cliente, e.documento, e.remetente ?? EMPRESA.fantasia, e.destinatario ?? 'Recebimento', e.telefone ?? null,
      e.origem ?? (entregador?.base?.nome ?? 'CD Recife'), e.destino, e.cidade, e.tipoCarga, e.peso ?? Math.round(entre(1, 40) * 10) / 10, e.modalidade ?? 'normal', e.rastreio ?? 'gps',
      e.valor ?? Math.round(entre(35, 260) * 100) / 100, e.valorNF ?? 0, final[0], iso(eventos[0][1]), iso(e.prazo), e.janela, entregue ? iso(entregue) : null,
      entregador?.nome ?? null, entregador?.id ?? null, origem.lat, origem.lng, e.lat, e.lng,
      e.avaliacao?.nota ?? null, e.avaliacao?.estado ?? null, e.avaliacao?.comentario ?? null, e.avaliacao ? iso((entregue ?? agoraMs) + 2 * HORA) : null,
    )
    for (const [status, t, desc] of eventos) {
      const doEntregador = entregador && !['confirmado', 'cancelado'].includes(status)
      const descricao = desc ?? { confirmado: 'Aguardando coleta na origem', coletado: 'Coleta na origem', transito: 'Carga em trânsito', saiu: 'A caminho do destinatário', cancelado: 'Cancelado a pedido do cliente' }[status]
      const pos = status === 'entregue' ? { lat: e.lat, lng: e.lng } : { lat: null, lng: null }
      insEvento.run(e.id, status, STATUS_ENTREGA[status].label, doEntregador ? `${descricao} · por ${entregador.nome}` : descricao, pos.lat, pos.lng, doEntregador ? entregador.id : null, iso(t))
    }
    if (entregue && e.comprovante !== false) {
      const c = e.comprovante ?? {}
      insComp.run(e.id, 'entregue', c.recebedor ?? escolher(RECEBEDORES), c.semFoto ? null : FOTO_DEMO, assinaturaDemo(rand),
        c.semGps ? null : e.lat + entre(-0.0003, 0.0003), c.semGps ? null : e.lng + entre(-0.0003, 0.0003), c.semGps ? null : Math.round(entre(4, 25)), entregador?.id ?? null, iso(entregue))
    }
    // toda entrega é também um ativo "Carga", com o histórico acompanhando os eventos
    const row = db.prepare('SELECT * FROM entregas WHERE id = ?').get(e.id)
    const ativoId = criarAtivoDaEntrega(db, row, iso(eventos[0][1]))
    for (const [status, t] of eventos.slice(1)) registrarHistorico(db, ativoId, STATUS_ENTREGA[status].label, status === 'entregue' ? e.destino : null, status === 'entregue' ? 'var(--green)' : null, iso(t))
    if (entregue) db.prepare('UPDATE ativos SET lat = ?, lng = ?, ultima_leitura_em = ? WHERE id = ?').run(e.lat, e.lng, iso(entregue), ativoId)
    else db.prepare('UPDATE ativos SET ultima_leitura_em = ? WHERE id = ?').run(iso(final[1]), ativoId)
    // atraso: o monitor abriu o alerta no vencimento e resolveu na entrega
    if (entregue && entregue > e.prazo) {
      const min = Math.round((entregue - e.prazo) / MIN)
      alertaResolvido({
        tipo: 'atraso', severidade: min > 60 ? 'critico' : 'alto', titulo: `Atraso — ${e.id}`, entidade: `+${min} min · ${e.cliente}`, referencia: e.id, chave: `atraso:${e.id}`,
        descricao: `Prazo era ${hhmm(e.prazo)} (janela ${e.janela}). Entregador: ${entregador?.nome ?? '—'}.`, aberto: e.prazo, resolvido: entregue, resolucao: 'automatica',
      })
    }
    return row
  }

  // ---------- histórico: últimos 30 dias ----------
  const pedidosDoCliente = []
  for (let offset = -30; offset <= -1; offset++) {
    const dow = partesLocais(emDia(offset, 12), FUSO).diaSemana
    if (dow === 0) continue // domingo sem operação
    for (const e of ENTREGADORES) {
      if (e.nome === 'Jonas Ferreira' && rand() < 0.45) continue
      const quantas = dow === 6 ? 1 : 2 + (rand() < 0.4 ? 1 : 0)
      const slots = [...JANELAS].sort(() => rand() - 0.5).slice(0, quantas).sort()
      for (const janela of slots) {
        const destino = escolher(DESTINOS[e.regiao])
        const [hi, hf] = janela.split('–').map((x) => Number(x.split(':')[0]))
        const ini = emDia(offset, hi)
        const prazo = emDia(offset, hf)
        const criado = Math.min(emDia(offset, 6, Math.floor(entre(0, 50))), ini - 90 * MIN)
        const coletado = Math.max(criado + 15 * MIN, ini - entre(110, 170) * MIN)
        const transito = coletado + entre(15, 40) * MIN
        const saiu = Math.max(transito + 10 * MIN, ini - entre(15, 45) * MIN)
        const doCliente = rand() < 0.07
        const base = {
          id: novoId(), entregador: e.nome, janela, prazo, tipoCarga: escolher(CARGAS), ...destino, rastreio: rand() < 0.8 ? 'gps' : 'cd',
          ...(doCliente && { clienteId, cliente: CLIENTE_DEMO.nome, documento: digitos(CLIENTE_DEMO.documento), remetente: CLIENTE_DEMO.nome, destinatario: destino.cliente }),
        }
        const r = rand()
        const atrasoProb = e.nome === 'Jonas Ferreira' ? 0.2 : 0.06
        let eventos
        if (r < 0.02) eventos = [['confirmado', criado], ['cancelado', criado + entre(20, 90) * MIN]]
        else if (r < 0.05) {
          const tentativa = prazo - entre(5, 30) * MIN
          eventos = [['confirmado', criado], ['coletado', coletado], ['transito', transito], ['saiu', saiu], ['tentativa', tentativa, 'Destinatário ausente'], ['saiu', tentativa + 60 * MIN, 'Nova tentativa de entrega'], ['entregue', tentativa + entre(90, 150) * MIN]]
        } else {
          const entregue = rand() < atrasoProb ? prazo + entre(8, 75) * MIN : Math.max(saiu + 8 * MIN, ini + entre(0, 55) * MIN)
          eventos = [['confirmado', criado], ['coletado', coletado], ['transito', transito], ['saiu', saiu], ['entregue', Math.min(entregue, emDia(offset, 21, 50))]]
        }
        const jonas = e.nome === 'Jonas Ferreira'
        const avaliacao = doCliente && eventos.at(-1)[0] === 'entregue' && rand() < 0.7 ? { nota: rand() < 0.75 ? 5 : 4, estado: 'Perfeito estado', comentario: rand() < 0.5 ? 'Entrega no horário combinado.' : '' } : null
        gravar({ ...base, avaliacao, comprovante: { semFoto: jonas && rand() < 0.15, semGps: rand() < (jonas ? 0.3 : 0.04) } }, eventos)
        if (doCliente) pedidosDoCliente.push({ id: base.id, eventos })
      }
    }
  }

  // ---------- hoje: entregas em andamento (prazos relativos ao horário atual) ----------
  const em = (min) => agoraMs + min * MIN
  const janelaAte = (t) => `${hhmm(t - HORA)}–${hhmm(t)}`
  const D = Object.fromEntries(Object.values(DESTINOS).flat().map((x) => [x.cliente, x]))
  const hojeLista = [
    { id: 'RT-90911', entregador: 'Thiago Rodrigues', ...D['Hospital da Restauração'], tipoCarga: '2 volumes · insumos hospitalares', modalidade: 'expressa', prazo: em(-38),
      eventos: [['confirmado', em(-300)], ['coletado', em(-240)], ['transito', em(-200)], ['saiu', em(-110)]] },
    { id: 'RT-90902', entregador: 'Thiago Rodrigues', ...D['Clínica Imip — Almoxarifado'], tipoCarga: 'Medicamentos', modalidade: 'expressa', prazo: em(-160),
      eventos: [['confirmado', em(-330)], ['coletado', em(-290)], ['transito', em(-260)], ['saiu', em(-230)], ['entregue', em(-185)]], comprovante: { recebedor: 'Almoxarifado — Sra. Lúcia' } },
    { id: 'RT-90940', entregador: 'Thiago Rodrigues', ...D['Clínica Sorriso — Piedade'], tipoCarga: 'Documentos', modalidade: 'expressa', prazo: em(90),
      eventos: [['confirmado', em(-280)], ['coletado', em(-200)], ['transito', em(-30)]] },
    { id: 'RT-90934', entregador: 'Thiago Rodrigues', ...D['Farmácia Pague Menos — Casa Forte'], tipoCarga: '3 caixas · produtos de higiene', prazo: em(180),
      eventos: [['confirmado', em(-270)], ['coletado', em(-90)]] },
    { id: 'RT-90937', entregador: 'Thiago Rodrigues', ...D['Livraria Jaqueira — Olinda'], tipoCarga: 'Caixa · livros', rastreio: 'cd', prazo: em(270),
      eventos: [['confirmado', em(-200)]] },
    { id: 'RT-90915', entregador: 'Carla Menezes', ...D['Construtora Alfa — Obra Lote 3'], tipoCarga: 'Ferramentas', prazo: em(50),
      eventos: [['confirmado', em(-260)], ['coletado', em(-180)], ['transito', em(-120)], ['saiu', em(-40)]] },
    { id: 'RT-90920', entregador: 'Rafael Toscano', ...D['Atacadão Imbiribeira'], tipoCarga: '6 caixas', origem: 'Porto de Suape', origemPos: { lat: -8.395, lng: -34.97 }, prazo: em(120),
      eventos: [['confirmado', em(-240)], ['coletado', em(-150)], ['transito', em(-70)]] },
    { id: 'RT-90926', entregador: 'Ana Paula Lima', ...D['Shopping RioMar — Doca 2'], tipoCarga: '1 palete', rastreio: 'cd', prazo: em(180),
      eventos: [['confirmado', em(-250)], ['coletado', em(-60)]] },
    { id: 'RT-90931', entregador: null, ...D['Porto de Suape — Pátio B'], tipoCarga: 'Contêiner 20 pés', peso: 1800, prazo: em(240),
      eventos: [['confirmado', em(-180)]] },
    { id: 'RT-90827-BR', entregador: 'Bruno Carvalho', clienteId, cliente: CLIENTE_DEMO.nome, documento: digitos(CLIENTE_DEMO.documento), remetente: 'Lojas Americanas S.A.', destinatario: 'Maria Silva',
      telefone: '(11) 98765-4321', origem: 'Rua da Aurora, 100 — Recife/PE', origemPos: { lat: -8.0597, lng: -34.8798 }, destino: 'Av. Paulista, 1000 — São Paulo/SP', cidade: 'saopaulo-sp',
      lat: -23.5614, lng: -46.6559, tipoCarga: 'Caixa · eletrônico', peso: 3.15, modalidade: 'expressa', valor: 140.77, valorNF: 4500, prazo: em(150), janela: null,
      eventos: [['confirmado', em(-2 * 1440)], ['coletado', em(-2 * 1440 + 200)], ['transito', em(-1440)], ['saiu', em(-60)]] },
  ]
  for (const h of hojeLista) {
    usados.add(h.id)
    const row = gravar({ documento: '00000000000000', janela: janelaAte(h.prazo), ...h, ...(h.janela === null && { janela: `até ${hhmm(h.prazo)}` }) }, h.eventos)
    if (h.clienteId) pedidosDoCliente.push({ id: row.id, eventos: h.eventos })
  }
  // RT-90827-BR guarda o documento do cliente (usado no rastreio público de exemplo)

  // ---------- GPS recente dos entregadores em rota (como se o app estivesse aberto) ----------
  // só dentro do expediente: fora dele o servidor não aceitaria posições (LGPD)
  const empresaRow = db.prepare('SELECT * FROM empresas WHERE id = ?').get(empresaId)
  if (dentroDoTurno(iso(agoraMs), empresaRow)) {
    const insPos = db.prepare('INSERT INTO posicoes (empresa_id, usuario_id, lat, lng, precisao, velocidade, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    const comGps = new Set()
    for (const h of hojeLista) {
      const status = h.eventos.at(-1)[0]
      if (!h.entregador || comGps.has(h.entregador) || !['saiu', 'transito'].includes(status)) continue
      comGps.add(h.entregador)
      const u = ent[h.entregador]
      const o = u.base ?? h.origemPos ?? { lat: EMPRESA.lat, lng: EMPRESA.lng }
      const alvo = status === 'saiu' ? 0.6 : 0.3 // fração do caminho já percorrida
      let ultimo
      for (let i = 0; i <= 10; i++) {
        const f = (alvo * i) / 10
        ultimo = { lat: o.lat + (h.lat - o.lat) * f, lng: o.lng + (h.lng - o.lng) * f, em: iso(agoraMs - (2 + (10 - i) * 2) * MIN) }
        insPos.run(empresaId, u.id, ultimo.lat, ultimo.lng, 12, i ? 28 : 0, ultimo.em)
      }
      db.prepare('UPDATE usuarios SET ultima_lat = ?, ultima_lng = ?, ultima_precisao = 12, ultima_posicao_em = ? WHERE id = ?').run(ultimo.lat, ultimo.lng, ultimo.em, u.id)
    }
  }

  // ---------- notificações do cliente (a partir dos eventos dos pedidos dele) ----------
  const textos = { confirmado: 'foi registrado', coletado: 'foi coletado', saiu: 'saiu para entrega', entregue: 'foi entregue. Avalie a entrega!', cancelado: 'foi cancelado' }
  insNotif.run(clienteId, 'star', 'var(--pink)', 'Bem-vindo(a) à Rota+!', 'Faça seu primeiro pedido e acompanhe tudo em tempo real.', '/cliente/novo-pedido', iso(agoraMs - 60 * DIA), 1)
  for (const p of pedidosDoCliente) {
    for (const [status, t] of p.eventos) {
      if (!textos[status]) continue
      insNotif.run(clienteId, status === 'entregue' ? 'box' : status === 'cancelado' ? 'alert' : 'truck', status === 'entregue' ? 'var(--green)' : 'var(--pink)',
        STATUS_ENTREGA[status].label, `Seu pedido ${p.id} ${textos[status]}.`, `/cliente/status/${p.id}`, iso(t), agoraMs - t > 2 * HORA ? 1 : 0)
    }
  }

  // ---------- ativos da empresa e suas movimentações ----------
  const insAtivo = db.prepare(`INSERT INTO ativos (id, empresa_id, nome, tipo, identificacao, dispositivo_token, bateria, responsavel, responsavel_id, local, lat, lng, ultima_leitura_em, status, valor, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insMov = db.prepare('INSERT INTO ativo_movimentacoes (ativo_id, tipo, responsavel, responsavel_id, local, lat, lng, via, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const BASE_SP = ENTREGADORES.find((e) => e.base).base
  for (const a of ATIVOS) {
    const dono = a.de ? ent[a.de] : null
    const base = a.base === 'sp' ? { nome: BASE_SP.nome, ...BASE_SP } : { nome: 'CD Recife', lat: EMPRESA.lat, lng: EMPRESA.lng }
    const via = a.identificacao === 'RFID' ? 'rfid' : 'qr'
    const movs = [] // [tipo, t, responsavel, local, pos]
    const periodo = (ini, fim, resp, local, pos) => {
      movs.push(['checkout', ini, resp, base.nome, base])
      if (fim) movs.push(['checkin', fim, resp, local ?? base.nome, pos ?? base])
    }
    if (a.tipo === 'Veículo') {
      for (let offset = -30; offset <= 0; offset++) {
        const dow = partesLocais(emDia(offset, 12), FUSO).diaSemana
        if (dow === 0) continue
        const saida = emDia(offset, 6, Math.floor(entre(30, 59)))
        if (saida > agoraMs) break
        const volta = offset === 0 ? null : emDia(offset, dow === 6 ? 13 : 18, Math.floor(entre(0, 50)))
        periodo(saida, volta, dono)
      }
    } else if (a.uso === 'eventual') {
      for (const [i, f] of [[-27, -25], [-19, -18], [-12, -9], [-6, -5]]) periodo(emDia(i, 8), emDia(f, 17, 30), ent[escolher(['Carla Menezes', 'Jonas Ferreira'])])
      if (a.id === 'ATV-00412') periodo(emDia(-2, 8), null, ent['Carla Menezes']) // está na obra há 2 dias
    } else if (a.uso === 'locado') periodo(emDia(-9, 8), null, ent['Rafael Toscano'])
    else if (a.uso === 'diario-curto') {
      for (let offset = -30; offset <= -1; offset++) {
        if (partesLocais(emDia(offset, 12), FUSO).diaSemana === 0) continue
        const ini = emDia(offset, 7 + Math.floor(entre(0, 6)))
        periodo(ini, ini + entre(1.5, 4) * HORA, { nome: EMPRESA_DEMO.nome, id: adminId })
      }
    } else if (a.uso === 'rastreador') periodo(emDia(-5, 7), null, ent['Thiago Rodrigues'])
    else if (a.uso === 'extraviado') periodo(emDia(-20, 8), null, ent['Carla Menezes'])

    const ultimo = movs.at(-1)
    const fora = ultimo?.[0] === 'checkout'
    const resp = fora ? ultimo[2] : null
    let status = fora ? 'em_uso' : 'disponivel'
    let local = fora ? (a.id === 'ATV-00412' ? 'Obra Boa Viagem' : a.id === 'EQP-2203' ? 'Locação — Classic Hall, Olinda' : `Com ${resp.nome}`) : base.nome
    let pos = a.id === 'ATV-00412' ? { lat: -8.1197, lng: -34.9003 } : a.id === 'EQP-2203' ? { lat: -7.9925, lng: -34.8397 } : base
    let leitura = ultimo ? ultimo[1] : agoraMs - 30 * DIA
    let token = null
    let bateria = null
    if (a.uso === 'rastreador') {
      token = `trk_${crypto.randomBytes(24).toString('hex')}`
      bateria = 9
      leitura = agoraMs - 31 * MIN
      pos = { lat: -8.172, lng: -34.963 }
      local = 'BR-101 Sul, km 72'
    }
    if (a.uso === 'extraviado') {
      status = 'extraviado'
      leitura = emDia(-16, 15)
      local = 'Último registro: obra em Boa Viagem'
      pos = { lat: -8.1197, lng: -34.9003 }
    }
    insAtivo.run(a.id, empresaId, a.nome, a.tipo, a.identificacao, token, bateria, resp?.nome ?? null, resp?.id ?? null, local, pos.lat, pos.lng, iso(leitura), status, a.valor, iso(agoraMs - 100 * DIA))
    registrarHistorico(db, a.id, 'Ativo cadastrado', `Etiqueta ${a.identificacao}`, 'var(--green)', iso(agoraMs - 100 * DIA))
    for (const [tipo, t, r, l, p] of movs) {
      insMov.run(a.id, tipo, r.nome, r.id, l, p.lat, p.lng, via, iso(t))
      registrarHistorico(db, a.id, tipo === 'checkout' ? `Check-out para ${r.nome}` : `Check-in em ${l}`, tipo === 'checkout' ? `Retirado em ${l} · leitura ${via.toUpperCase()}` : `Devolvido · leitura ${via.toUpperCase()}`, tipo === 'checkout' ? 'var(--pink)' : 'var(--green)', iso(t))
    }
    if (a.uso === 'rastreador') registrarHistorico(db, a.id, 'Rastreador GPS vinculado', 'Envia posição a cada 5 min', null, iso(emDia(-5, 7, 5)))
    if (a.uso === 'extraviado') {
      registrarHistorico(db, a.id, 'Marcado como extraviado', `Sem leitura desde ${new Date(leitura).toLocaleDateString('pt-BR', { timeZone: FUSO })}`, 'var(--red)', iso(emDia(-14, 9)))
      alertaResolvido({
        tipo: 'inatividade', severidade: 'alto', titulo: `Extraviado — ${a.id}`, entidade: `${a.nome} · ${local}`, referencia: a.id, chave: `extraviado:${a.id}`,
        descricao: `${EMPRESA_DEMO.nome} marcou ${a.nome} como extraviado. Busca encerrada sem localizar o item.`, aberto: emDia(-14, 9), resolvido: emDia(-13, 16), resolucao: 'manual', responsavel: EMPRESA_DEMO.nome,
      })
    }
  }

  // ---------- outros alertas já tratados no período (sinal e desvio) ----------
  for (let i = 0; i < 9; i++) {
    const offset = -Math.floor(entre(1, 29))
    const quem = ent[escolher(ENTREGADORES).nome]
    const aberto = emDia(offset, 9 + Math.floor(entre(0, 8)), Math.floor(entre(0, 59)))
    const desvio = rand() < 0.45
    const km = entre(1.2, 4).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    alertaResolvido(
      desvio
        ? { tipo: 'desvio', severidade: 'alto', titulo: `Desvio de rota — ${quem.nome}`, entidade: `${km} km fora do trajeto`, referencia: String(quem.id), chave: `desvio:u${quem.id}`,
            descricao: `${quem.nome} esteve a ${km} km do trajeto planejado.`, aberto, resolvido: aberto + entre(6, 35) * MIN, resolucao: rand() < 0.6 ? 'automatica' : 'manual', responsavel: EMPRESA_DEMO.nome }
        : { tipo: 'sinal', severidade: 'alto', titulo: `Sem sinal — ${quem.nome}`, entidade: `Último sinal há ${Math.floor(entre(11, 40))} min`, referencia: String(quem.id), chave: `sinal:u${quem.id}`,
            descricao: `${quem.nome} ficou sem enviar posição com entregas em rota.`, aberto, resolvido: aberto + entre(4, 50) * MIN, resolucao: rand() < 0.7 ? 'automatica' : 'manual', responsavel: EMPRESA_DEMO.nome },
    )
  }
}
