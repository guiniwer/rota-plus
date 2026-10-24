import { Router } from 'express'
import { abrirAlerta } from '../alertasServico.js'
import { autenticar, exigirFuncao, exigirPerfil } from '../auth.js'
import { sincronizarAtivo } from '../cargas.js'
import { db, transaction } from '../db.js'
import {
  EM_ROTA, FINALIZADA, avisarMudanca, buscarEntrega, criarEntrega, listarEntregas, mudarStatus, refinarEmSegundoPlano, registrarEvento,
} from '../entregasServico.js'
import { enviarEmail, notificar, registrarWhatsApp } from '../mensageria.js'
import { rotaEntre } from '../rota.js'
import { MIN, agora, localParaUtc } from '../tempo.js'
import { publicar } from '../tempoReal.js'

const router = Router()
const digitos = (s = '') => String(s ?? '').replace(/\D/g, '')
const TAMANHO_MAX_IMAGEM = 3_000_000 // caracteres do data URL (~2,2 MB)
const imagemValida = (s) => typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(s) && s.length <= TAMANHO_MAX_IMAGEM
const coordenada = (lat, lng) => (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== null && lng !== null ? { lat: Number(lat), lng: Number(lng) } : { lat: null, lng: null })

// ---------- públicas (sem login) ----------

// GET /api/rastreio?codigo=RT-...&documento=123...
export function rastreioPublico(req, res) {
  const { codigo = '', documento = '' } = req.query
  const e = db.prepare('SELECT id FROM entregas WHERE UPPER(id) = UPPER(?) AND documento = ?').get(String(codigo).trim(), digitos(documento))
  if (!e) return res.status(404).json({ erro: 'Encomenda não encontrada.' })
  const { documento: _d, telefoneDestinatario: _t, emailDestinatario: _m, valorNF: _v, ...publico } = buscarEntrega(e.id)
  res.json(publico)
}

// GET /api/rastreio/acompanhamento?codigo=&documento= — mapa e ETA do rastreio público
export async function acompanhamentoPublico(req, res, next) {
  const { codigo = '', documento = '' } = req.query
  const e = db.prepare('SELECT * FROM entregas WHERE UPPER(id) = UPPER(?) AND documento = ?').get(String(codigo).trim(), digitos(documento))
  if (!e) return res.status(404).json({ erro: 'Encomenda não encontrada.' })
  try {
    const { contato: _c, ...r } = await acompanhamentoDe(e, { cliente: true })
    res.json(r)
  } catch (err) {
    next(err)
  }
}

// POST /api/rastreio/avisos  { codigo, documento, email } — avisos por e-mail sem precisar de conta
export function inscreverAvisos(req, res) {
  const { codigo = '', documento = '', email = '' } = req.body
  const e = db.prepare('SELECT id FROM entregas WHERE UPPER(id) = UPPER(?) AND documento = ?').get(String(codigo).trim(), digitos(documento))
  if (!e) return res.status(404).json({ erro: 'Encomenda não encontrada.' })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' })
  db.prepare('INSERT OR IGNORE INTO entrega_contatos (entrega_id, email, criado_em) VALUES (?, ?, ?)').run(e.id, email.trim(), agora())
  res.status(201).json({ ok: true })
}

router.use(autenticar)

/** Admin vê as da empresa; entregador só as atribuídas a ele; cliente só as próprias. */
function listar(u) {
  if (u.perfil === 'cliente') return listarEntregas('e.usuario_id = ?', [u.id])
  if (u.funcao === 'entregador') return listarEntregas('e.entregador_id = ? AND e.empresa_id = ?', [u.id, u.empresaId])
  return listarEntregas('e.empresa_id = ?', [u.empresaId])
}

/** Carrega a entrega em req.entrega se o usuário puder vê-la (senão, 404 — não revela que existe). */
function carregar(req, res, next) {
  const e = db.prepare('SELECT * FROM entregas WHERE id = ?').get(req.params.id)
  const u = req.usuario
  const visivel = e && (u.perfil === 'cliente' ? e.usuario_id === u.id : e.empresa_id === u.empresaId && (u.funcao === 'admin' || e.entregador_id === u.id))
  if (!visivel) return res.status(404).json({ erro: 'Entrega não encontrada.' })
  req.entrega = e
  next()
}

const dono = (req, res, next) => (req.entrega.usuario_id === req.usuario.id ? next() : res.status(403).json({ erro: 'Esta entrega não é sua.' }))

// GET /api/entregas
router.get('/', (req, res) => res.json(listar(req.usuario)))

// POST /api/entregas  (pedido do cliente, com a transportadora escolhida, ou entrega criada pelo administrador)
router.post('/', async (req, res, next) => {
  const u = req.usuario
  if (u.funcao === 'entregador') return res.status(403).json({ erro: 'Entregadores não criam entregas.' })
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(u.perfil === 'cliente' ? Number(req.body.empresaId) : u.empresaId)
  if (!empresa) return res.status(400).json({ erro: 'Escolha a transportadora.' })
  try {
    res.status(201).json(await criarEntrega(empresa, req.body, { cliente: u.perfil === 'cliente' ? { ...u, documento: digitos(u.documento) } : null, autor: u }))
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erro: err.message })
    next(err)
  }
})

// POST /api/entregas/importar  { linhas: [{ cliente, destino, cidade?, janela?, ... }] } — planilha CSV
router.post('/importar', exigirFuncao('admin'), async (req, res, next) => {
  const linhas = Array.isArray(req.body.linhas) ? req.body.linhas.slice(0, 500) : []
  if (!linhas.length) return res.status(400).json({ erro: 'Nenhuma linha para importar.' })
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(req.usuario.empresaId)
  const criadas = []
  const erros = []
  try {
    for (const [i, l] of linhas.entries()) {
      const entregador = l.entregadorEmail ? db.prepare("SELECT id FROM usuarios WHERE email = ? AND empresa_id = ? AND funcao = 'entregador'").get(l.entregadorEmail, empresa.id) : null
      if (!String(l.cliente ?? '').trim() || !String(l.destino ?? '').trim()) {
        erros.push({ linha: i + 2, erro: 'Cliente e destino são obrigatórios.' })
        continue
      }
      try {
        const e = await criarEntrega(empresa, { ...l, entregadorId: entregador?.id ?? null }, { autor: req.usuario, geocodificar: false })
        criadas.push(e.id)
      } catch (err) {
        erros.push({ linha: i + 2, erro: err.message })
      }
    }
  } catch (err) {
    return next(err)
  }
  refinarEmSegundoPlano(criadas).catch(() => {})
  res.status(201).json({ criadas: criadas.length, ids: criadas, erros })
})

// GET /api/entregas/:id
router.get('/:id', carregar, (req, res) => res.json(buscarEntrega(req.entrega.id)))

// PATCH /api/entregas/:id/status  { status, descricao, lat?, lng? }  — administrador ou o entregador designado
router.patch('/:id/status', exigirFuncao('admin', 'entregador'), carregar, (req, res) => {
  const { status, descricao = '' } = req.body
  try {
    res.json(mudarStatus(req.entrega, status, { descricao, autor: req.usuario, ...coordenada(req.body.lat, req.body.lng), quando: req.body.quando && req.body.quando < agora() ? req.body.quando : agora() }))
  } catch (err) {
    res.status(err.status ?? 500).json({ erro: err.message })
  }
})

// POST /api/entregas/:id/comprovante  { resultado, recebedor, documento, foto, assinatura, lat, lng, precisao, conferido, quando? }
router.post('/:id/comprovante', exigirFuncao('admin', 'entregador'), carregar, (req, res) => {
  const e = req.entrega
  const u = req.usuario
  const { resultado, recebedor = '', documento = '', foto = null, assinatura = null, precisao = null, conferido = false } = req.body
  if (!['entregue', 'tentativa', 'avaria'].includes(resultado)) return res.status(400).json({ erro: 'Resultado inválido.' })
  if (FINALIZADA.includes(e.status)) return res.status(409).json({ erro: 'Esta entrega já foi finalizada.' })
  if (resultado !== 'tentativa' && (!imagemValida(foto) || !imagemValida(assinatura) || !recebedor.trim())) {
    return res.status(400).json({ erro: 'Para concluir: foto, assinatura e nome do recebedor.' })
  }
  if ((foto && !imagemValida(foto)) || (assinatura && !imagemValida(assinatura))) return res.status(400).json({ erro: 'Imagem inválida ou maior que 2 MB.' })
  const { lat, lng } = coordenada(req.body.lat, req.body.lng)
  // registros feitos offline chegam depois: vale o horário em que foram feitos
  const quando = req.body.quando && req.body.quando < agora() ? req.body.quando : agora()
  db.prepare(`INSERT INTO comprovantes (entrega_id, resultado, recebedor, documento, foto, assinatura, lat, lng, precisao, volumes_conferidos, entregador_id, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(e.id, resultado, recebedor.trim() || null, documento || null, foto, assinatura, lat, lng, Number(precisao) || null, conferido ? 1 : 0, u.id, quando)
  const gps = lat != null ? ' + GPS' : ''
  const descricao =
    resultado === 'entregue' ? `Recebido por ${recebedor.trim()} · foto + assinatura${gps}`
      : resultado === 'avaria' ? `Entregue com avaria · recebido por ${recebedor.trim()}${gps}`
        : 'Destinatário ausente — nova tentativa necessária'
  if (resultado === 'avaria') {
    abrirAlerta({
      empresaId: e.empresa_id, tipo: 'ocorrencia', severidade: 'alto', chave: `avaria:${e.id}`, referencia: e.id,
      titulo: `Avaria — ${e.id}`, entidade: e.cliente, descricao: `${u.nome} registrou a entrega com avaria. Verifique a foto do comprovante.`,
    })
  }
  res.status(201).json(mudarStatus(e, resultado === 'tentativa' ? 'tentativa' : 'entregue', { descricao, autor: u, lat, lng, quando }))
})

// GET /api/entregas/:id/comprovante  — com as imagens
router.get('/:id/comprovante', carregar, (req, res) => {
  const c = db
    .prepare('SELECT c.*, u.nome AS entregador FROM comprovantes c LEFT JOIN usuarios u ON u.id = c.entregador_id WHERE c.entrega_id = ? ORDER BY c.id DESC LIMIT 1')
    .get(req.entrega.id)
  if (!c) return res.status(404).json({ erro: 'Esta entrega ainda não tem comprovante.' })
  res.json({
    id: c.id, entregaId: c.entrega_id, resultado: c.resultado, recebedor: c.recebedor, documento: c.documento, foto: c.foto, assinatura: c.assinatura,
    lat: c.lat, lng: c.lng, precisao: c.precisao, volumesConferidos: Boolean(c.volumes_conferidos), entregador: c.entregador, criadoEm: c.criado_em,
  })
})

// PATCH /api/entregas/:id/responsavel  { entregadorId }  — só administrador
router.patch('/:id/responsavel', exigirFuncao('admin'), carregar, (req, res) => {
  const e = req.entrega
  const { entregadorId } = req.body
  const entregador = entregadorId
    ? db.prepare("SELECT id, nome FROM usuarios WHERE id = ? AND funcao = 'entregador' AND empresa_id = ?").get(Number(entregadorId), req.usuario.empresaId)
    : null
  if (entregadorId && !entregador) return res.status(400).json({ erro: 'Entregador não encontrado nesta empresa.' })
  transaction(() => {
    db.prepare('UPDATE entregas SET responsavel = ?, entregador_id = ? WHERE id = ?').run(entregador?.nome ?? null, entregador?.id ?? null, e.id)
    registrarEvento(e.id, { titulo: entregador ? `Atribuída a ${entregador.nome}` : 'Entregador removido', descricao: `Por ${req.usuario.nome}`, autorId: req.usuario.id })
    sincronizarAtivo(db, e.id, { titulo: entregador ? `Atribuída a ${entregador.nome}` : 'Entregador removido', descricao: 'Responsabilidade atualizada pela central' })
  })
  if (entregador) notificar(entregador.id, { icon: 'route', titulo: 'Nova entrega na sua rota', texto: `${e.cliente} — ${e.destino}`, link: '/entregador' })
  // o entregador anterior também precisa atualizar a lista dele
  avisarMudanca({ ...e, entregador_id: entregador?.id ?? null })
  if (e.entregador_id && e.entregador_id !== entregador?.id) publicar({ usuarios: [e.entregador_id], recursos: ['entregas'] })
  res.json(buscarEntrega(e.id))
})

// POST /api/entregas/:id/avaliacao  { nota, estado, comentario }
router.post('/:id/avaliacao', exigirPerfil('cliente'), carregar, dono, (req, res) => {
  const e = req.entrega
  const { nota, estado = 'Perfeito estado', comentario = '' } = req.body
  if (!(nota >= 1 && nota <= 5)) return res.status(400).json({ erro: 'A nota deve ser de 1 a 5.' })
  if (!['entregue', 'saiu'].includes(e.status)) return res.status(409).json({ erro: 'Só é possível confirmar o recebimento quando a entrega chega.' })
  if (e.avaliacao_nota) return res.status(409).json({ erro: 'Você já avaliou esta entrega.' })
  db.prepare('UPDATE entregas SET avaliacao_nota = ?, avaliacao_estado = ?, avaliacao_comentario = ?, avaliado_em = ? WHERE id = ?').run(nota, estado, comentario, agora(), e.id)
  if (estado !== 'Perfeito estado') {
    abrirAlerta({
      empresaId: e.empresa_id, tipo: 'ocorrencia', severidade: 'alto', chave: `recebimento:${e.id}`, referencia: e.id,
      titulo: `${estado} — ${e.id}`, entidade: e.cliente, descricao: `O cliente confirmou o recebimento como "${estado}". ${comentario}`.trim(),
    })
  }
  if (e.status === 'saiu') mudarStatus(e, 'entregue', { descricao: 'Recebimento confirmado pelo cliente', autor: req.usuario })
  else {
    sincronizarAtivo(db, e.id, { titulo: 'Recebimento confirmado pelo cliente', descricao: `Avaliação ${nota}/5 · ${estado}` })
    avisarMudanca(e)
  }
  res.json(buscarEntrega(e.id))
})

// POST /api/entregas/:id/ocorrencia  { motivo, detalhes } — "reportar problema"
router.post('/:id/ocorrencia', exigirPerfil('cliente'), carregar, dono, (req, res) => {
  const e = req.entrega
  const { motivo = '', detalhes = '' } = req.body
  if (!motivo.trim()) return res.status(400).json({ erro: 'Informe o motivo.' })
  const id = Number(db.prepare('INSERT INTO ocorrencias (entrega_id, usuario_id, motivo, detalhes, criado_em) VALUES (?, ?, ?, ?, ?)').run(e.id, req.usuario.id, motivo, detalhes, agora()).lastInsertRowid)
  abrirAlerta({
    empresaId: e.empresa_id, tipo: 'ocorrencia', severidade: /danificad|faltando/i.test(motivo) ? 'alto' : 'medio', chave: `ocorrencia:${id}`, referencia: e.id,
    titulo: `${motivo} — ${e.id}`, entidade: `Reportado por ${req.usuario.nome}`, descricao: detalhes || 'Sem detalhes.',
  })
  registrarEvento(e.id, { titulo: 'Problema reportado pelo cliente', descricao: motivo, autorId: req.usuario.id })
  avisarMudanca(e)
  res.status(201).json({ id, prazoRespostaMin: 120 })
})

// PATCH /api/entregas/:id/reagendar  { data: 'AAAA-MM-DD', janela: '08:00–12:00' }
router.patch('/:id/reagendar', exigirPerfil('cliente'), carregar, dono, (req, res) => {
  const e = req.entrega
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(e.empresa_id)
  const [ano, mes, dia] = String(req.body.data ?? '').split('-').map(Number)
  const [ini, fim] = String(req.body.janela ?? '').split(/[–-]/).map((s) => s.trim())
  if (!ano || !/^\d{2}:\d{2}$/.test(ini ?? '') || !/^\d{2}:\d{2}$/.test(fim ?? '')) return res.status(400).json({ erro: 'Escolha a data e a janela.' })
  if (FINALIZADA.includes(e.status)) return res.status(409).json({ erro: 'Esta entrega já foi finalizada.' })
  const [h, m] = fim.split(':').map(Number)
  const prazo = localParaUtc({ ano, mes, dia, hora: h, minuto: m }, empresa.fuso)
  if (prazo.getTime() < Date.now()) return res.status(400).json({ erro: 'Escolha uma data futura.' })
  const texto = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')} ${ini}–${fim}`
  db.prepare('UPDATE entregas SET prazo_limite = ?, janela = ? WHERE id = ?').run(prazo.toISOString(), texto, e.id)
  registrarEvento(e.id, { titulo: 'Entrega reagendada pelo cliente', descricao: `Nova janela: ${texto}`, autorId: req.usuario.id })
  if (e.entregador_id) notificar(e.entregador_id, { icon: 'calendar', titulo: `Entrega reagendada — ${e.id}`, texto: `${e.cliente}: nova janela ${texto}.`, link: '/entregador' })
  avisarMudanca(e)
  res.json(buscarEntrega(e.id))
})

// PATCH /api/entregas/:id/instrucoes  { instrucoes } — ex.: "deixar na portaria"
router.patch('/:id/instrucoes', exigirPerfil('cliente'), carregar, dono, (req, res) => {
  const e = req.entrega
  const instrucoes = String(req.body.instrucoes ?? '').trim().slice(0, 300)
  db.prepare('UPDATE entregas SET instrucoes = ? WHERE id = ?').run(instrucoes || null, e.id)
  registrarEvento(e.id, { titulo: 'Instruções de entrega atualizadas', descricao: instrucoes || 'Instruções removidas', autorId: req.usuario.id })
  if (e.entregador_id && instrucoes) notificar(e.entregador_id, { icon: 'send', titulo: `Recado do cliente — ${e.id}`, texto: instrucoes, link: '/entregador' })
  avisarMudanca(e)
  res.json(buscarEntrega(e.id))
})

// GET /api/entregas/:id/mensagens  e  POST { texto } — conversa da entrega
router.get('/:id/mensagens', carregar, (req, res) => {
  res.json(
    db.prepare('SELECT * FROM entrega_mensagens WHERE entrega_id = ? ORDER BY id').all(req.entrega.id)
      .map((m) => ({ id: m.id, autor: m.autor_nome, papel: m.autor_papel, minha: m.autor_id === req.usuario.id, texto: m.texto, criadoEm: m.criado_em })),
  )
})
router.post('/:id/mensagens', carregar, (req, res) => {
  const e = req.entrega
  const u = req.usuario
  const texto = String(req.body.texto ?? '').trim().slice(0, 1000)
  if (!texto) return res.status(400).json({ erro: 'Escreva a mensagem.' })
  const papel = u.perfil === 'cliente' ? 'cliente' : u.funcao
  db.prepare('INSERT INTO entrega_mensagens (entrega_id, autor_id, autor_nome, autor_papel, texto, criado_em) VALUES (?, ?, ?, ?, ?, ?)').run(e.id, u.id, u.nome, papel, texto, agora())
  // avisa a outra ponta da conversa
  const link = (para) => (para === e.usuario_id ? `/cliente/pedidos/${e.id}` : '/entregador')
  for (const para of [e.usuario_id, e.entregador_id].filter((x) => x && x !== u.id)) notificar(para, { icon: 'send', titulo: `Mensagem de ${u.nome} · ${e.id}`, texto, link: link(para) })
  publicar({ empresaId: e.empresa_id, usuarios: [e.usuario_id, e.entregador_id].filter(Boolean), recursos: [`mensagens:${e.id}`] })
  res.status(201).json({ ok: true })
})

// POST /api/entregas/:id/aviso  { canal: 'email' | 'whatsapp', mensagem } — central avisa o cliente
router.post('/:id/aviso', exigirFuncao('admin'), carregar, async (req, res) => {
  const e = req.entrega
  const mensagem = String(req.body.mensagem ?? '').trim()
  if (!mensagem) return res.status(400).json({ erro: 'Escreva a mensagem.' })
  const cliente = e.usuario_id ? db.prepare('SELECT email, telefone FROM usuarios WHERE id = ?').get(e.usuario_id) : null
  if (req.body.canal === 'whatsapp') {
    const telefone = e.telefone_destinatario || cliente?.telefone
    const link = registrarWhatsApp({ empresaId: e.empresa_id, entregaId: e.id, telefone, texto: mensagem })
    if (!link) return res.status(400).json({ erro: 'Esta entrega não tem telefone do destinatário.' })
    return res.json({ status: 'link', link })
  }
  const para = e.email_destinatario || cliente?.email
  if (!para) return res.status(400).json({ erro: 'Esta entrega não tem e-mail do destinatário.' })
  if (e.usuario_id) notificar(e.usuario_id, { icon: 'send', titulo: `Mensagem da transportadora · ${e.id}`, texto: mensagem, link: `/cliente/pedidos/${e.id}` })
  const r = await enviarEmail({ empresaId: e.empresa_id, entregaId: e.id, para, assunto: `Sua entrega ${e.id}`, texto: mensagem })
  res.json({ status: r.status, para })
})

// GET /api/entregas/:id/acompanhamento — posição do entregador, ETA e trajeto (dados reais do GPS)
const cacheEta = new Map() // entregaId → { chave, valor, em }
router.get('/:id/acompanhamento', carregar, async (req, res) => res.json(await acompanhamentoDe(req.entrega, { cliente: req.usuario.perfil === 'cliente' })))

/** cliente: quem vê é o cliente final (respeita a opção de privacidade da empresa). */
async function acompanhamentoDe(e, { cliente }) {
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(e.empresa_id)
  const priv = JSON.parse(empresa.privacidade || '{}')
  const ent = e.entregador_id ? db.prepare('SELECT * FROM usuarios WHERE id = ?').get(e.entregador_id) : null
  const r = {
    destino: e.lat != null ? { lat: e.lat, lng: e.lng, aproximado: e.geo_fonte !== 'endereco' } : null,
    origem: e.origem_lat != null ? { lat: e.origem_lat, lng: e.origem_lng } : null,
    contato: ent?.telefone || empresa.telefone || null,
    entregador: null,
    eta: null,
    paradasAntes: 0,
    motivo: null,
  }
  if (!ent) r.motivo = 'sem_entregador'
  else if (!EM_ROTA.includes(e.status)) r.motivo = FINALIZADA.includes(e.status) ? 'finalizada' : 'aguardando_coleta'
  else if (e.rastreio !== 'gps') r.motivo = 'por_etapas'
  else if (cliente && priv.compartilharEta === false) r.motivo = 'privacidade'
  else if (!ent.ultima_posicao_em || Date.now() - Date.parse(ent.ultima_posicao_em) > 15 * MIN) {
    r.motivo = 'sem_sinal'
    r.entregador = { nome: ent.nome, atualizadoEm: ent.ultima_posicao_em }
  } else {
    r.entregador = { nome: ent.nome, veiculo: ent.veiculo, lat: ent.ultima_lat, lng: ent.ultima_lng, precisao: ent.ultima_precisao, atualizadoEm: ent.ultima_posicao_em }
    // paradas que vêm antes desta na rota planejada do entregador
    const plano = db.prepare('SELECT paradas FROM rotas_planejadas WHERE entregador_id = ?').get(ent.id)
    const ordem = plano ? JSON.parse(plano.paradas) : []
    const antes = ordem.slice(0, Math.max(0, ordem.indexOf(e.id)))
    const pendentes = antes.length
      ? db.prepare(`SELECT id, lat, lng FROM entregas WHERE id IN (SELECT value FROM json_each(?)) AND status NOT IN ('entregue', 'cancelado') AND lat IS NOT NULL`).all(JSON.stringify(antes))
      : []
    const paradas = antes.map((id) => pendentes.find((p) => p.id === id)).filter(Boolean)
    r.paradasAntes = paradas.length
    if (r.destino) {
      const pos = { lat: ent.ultima_lat, lng: ent.ultima_lng }
      const chave = `${pos.lat.toFixed(4)},${pos.lng.toFixed(4)}|${paradas.map((p) => p.id).join(',')}`
      let rota = cacheEta.get(e.id)
      if (!rota || rota.chave !== chave || Date.now() - rota.em > 2 * MIN) {
        rota = { chave, em: Date.now(), valor: await rotaEntre([pos, ...paradas, r.destino]) }
        cacheEta.set(e.id, rota)
      }
      const minutos = rota.valor.duracaoMin + paradas.length * 5 // ~5 min por parada intermediária
      r.eta = { minutos, distanciaKm: rota.valor.distanciaKm, fonte: rota.valor.fonte, trajeto: rota.valor.trajeto, chegada: new Date(Date.now() + minutos * MIN).toISOString() }
    }
  }
  return r
}

export default router
