import crypto from 'node:crypto'
import { Router } from 'express'
import { autenticar, exigirFuncao } from '../auth.js'
import { db, restaurarDemo } from '../db.js'
import { EM_ROTA, PREFERENCIAS_PADRAO, lerPreferencias } from '../entregasServico.js'
import { geocodificar } from '../geocode.js'
import { empresaToJson, notificacaoToJson } from '../mappers.js'
import { URL_APP, chavePublicaPush, dispararWebhook, emailConfigurado, enviarEmail, notificar } from '../mensageria.js'
import { gerarRelatorio, relatorioCsv } from '../relatorios.js'
import { DIA, MIN, agora, dentroDoTurno, localParaUtc, partesLocais } from '../tempo.js'
import { conectar, publicar } from '../tempoReal.js'

// Notificações, preferências, push, equipe, empresa, integrações, relatórios e utilidades
const router = Router()
const admin = [autenticar, exigirFuncao('admin')]
const empresaDo = (req) => db.prepare('SELECT * FROM empresas WHERE id = ?').get(req.usuario.empresaId)
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null)

// ---------- públicas ----------
// transportadoras disponíveis para o cliente escolher no pedido (e no mapa da página inicial)
router.get('/empresas', (req, res) => res.json(db.prepare('SELECT * FROM empresas ORDER BY demo DESC, razao_social').all().map((e) => empresaToJson(e))))
router.get('/sistema', (req, res) => res.json({ emailConfigurado: emailConfigurado(), pushChavePublica: chavePublicaPush() }))

// ---------- tempo real (Server-Sent Events) ----------
router.get('/eventos', autenticar, conectar)

// ---------- notificações do usuário logado ----------
router.get('/notificacoes', autenticar, (req, res) => {
  res.json(db.prepare('SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY criado_em DESC, id DESC LIMIT 200').all(req.usuario.id).map(notificacaoToJson))
})
router.post('/notificacoes/lidas', autenticar, (req, res) => {
  db.prepare('UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?').run(req.usuario.id)
  res.status(204).end()
})
router.post('/notificacoes/:id/lida', autenticar, (req, res) => {
  db.prepare('UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?').run(Number(req.params.id), req.usuario.id)
  res.status(204).end()
})

// ---------- push do navegador ----------
router.post('/push/inscricao', autenticar, (req, res) => {
  const { endpoint, keys } = req.body ?? {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ erro: 'Inscrição inválida.' })
  db.prepare('INSERT OR REPLACE INTO push_inscricoes (endpoint, usuario_id, p256dh, auth, criado_em) VALUES (?, ?, ?, ?, ?)').run(endpoint, req.usuario.id, keys.p256dh, keys.auth, agora())
  res.status(201).json({ ok: true })
})
router.delete('/push/inscricao', autenticar, (req, res) => {
  db.prepare('DELETE FROM push_inscricoes WHERE endpoint = ? AND usuario_id = ?').run(String(req.body?.endpoint ?? ''), req.usuario.id)
  res.status(204).end()
})

// ---------- preferências de aviso (por usuário) ----------
router.get('/configuracoes/preferencias', autenticar, (req, res) => res.json(lerPreferencias(req.usuario.id)))
router.put('/configuracoes/preferencias', autenticar, (req, res) => {
  const valor = Object.fromEntries(Object.keys(PREFERENCIAS_PADRAO).map((k) => [k, req.body?.[k] !== false]))
  db.prepare("INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, 'preferencias', ?) ON CONFLICT (usuario_id, chave) DO UPDATE SET valor = excluded.valor").run(req.usuario.id, JSON.stringify(valor))
  res.json(valor)
})

// ---------- empresa (dados, expediente, LGPD, integrações) ----------
router.get('/empresa', autenticar, exigirFuncao('admin', 'entregador'), (req, res) => {
  const e = empresaDo(req)
  const base = empresaToJson(e, { privado: req.usuario.funcao === 'admin' })
  // o entregador só precisa do expediente e das regras de privacidade (para o app de GPS)
  if (req.usuario.funcao !== 'admin') {
    const termo = db.prepare("SELECT valor FROM configuracoes WHERE usuario_id = ? AND chave = 'termo_gps'").get(req.usuario.id)
    return res.json({ id: e.id, nome: base.nome, turnoInicio: e.turno_inicio, turnoFim: e.turno_fim, fuso: e.fuso, privacidade: JSON.parse(e.privacidade || '{}'), telefone: e.telefone, termoAceitoEm: termo ? JSON.parse(termo.valor) : null })
  }
  const limite = new Date(Date.now() - 30 * MIN).toISOString()
  const dispositivos = {
    rastreadores: db.prepare('SELECT COUNT(*) AS n FROM ativos WHERE empresa_id = ? AND dispositivo_token IS NOT NULL').get(e.id).n,
    rastreadoresAtivos: db.prepare('SELECT COUNT(*) AS n FROM ativos WHERE empresa_id = ? AND dispositivo_token IS NOT NULL AND ultima_leitura_em >= ?').get(e.id, limite).n,
    etiquetasQr: db.prepare("SELECT COUNT(*) AS n FROM ativos WHERE empresa_id = ? AND identificacao = 'QR'").get(e.id).n,
    etiquetasRfid: db.prepare("SELECT COUNT(*) AS n FROM ativos WHERE empresa_id = ? AND identificacao = 'RFID'").get(e.id).n,
    appsAtivos: db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE empresa_id = ? AND funcao = 'entregador' AND ultima_posicao_em >= ?").get(e.id, limite).n,
    entregadores: db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE empresa_id = ? AND funcao = 'entregador'").get(e.id).n,
  }
  res.json({ ...base, emailConfigurado: emailConfigurado(), dispositivos })
})

// POST /api/empresa/termo — o entregador declara ciência da coleta de localização (LGPD)
router.post('/empresa/termo', autenticar, exigirFuncao('entregador'), (req, res) => {
  const quando = agora()
  db.prepare("INSERT INTO configuracoes (usuario_id, chave, valor) VALUES (?, 'termo_gps', ?) ON CONFLICT (usuario_id, chave) DO UPDATE SET valor = excluded.valor").run(req.usuario.id, JSON.stringify(quando))
  res.json({ termoAceitoEm: quando })
})

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
router.patch('/empresa', ...admin, async (req, res) => {
  const e = empresaDo(req)
  const d = req.body
  if (d.razaoSocial !== undefined && String(d.razaoSocial).trim().length < 3) return res.status(400).json({ erro: 'Informe a razão social.' })
  if ((d.turnoInicio && !HHMM.test(d.turnoInicio)) || (d.turnoFim && !HHMM.test(d.turnoFim))) return res.status(400).json({ erro: 'Horário do expediente inválido (use HH:MM).' })
  if (d.fuso) {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: d.fuso })
    } catch {
      return res.status(400).json({ erro: 'Fuso horário inválido.' })
    }
  }
  // endereço novo → localiza a base no mapa
  let base = { lat: e.base_lat, lng: e.base_lng }
  let baseLocalizada = true
  if (d.endereco !== undefined && d.endereco.trim() && d.endereco.trim() !== e.endereco) {
    const r = await geocodificar(d.endereco.trim())
    if (r) base = r
    else baseLocalizada = false
  }
  const v = (campo, atual) => (d[campo] === undefined ? atual : String(d[campo]).trim() || null)
  db.prepare(`UPDATE empresas SET razao_social = ?, fantasia = ?, segmento = ?, email = ?, telefone = ?, endereco = ?, base_lat = ?, base_lng = ?,
    turno_inicio = ?, turno_fim = ?, fuso = ? WHERE id = ?`).run(
    v('razaoSocial', e.razao_social), v('fantasia', e.fantasia), v('segmento', e.segmento), v('email', e.email), v('telefone', e.telefone), v('endereco', e.endereco),
    base.lat, base.lng, d.turnoInicio ?? e.turno_inicio, d.turnoFim ?? e.turno_fim, d.fuso ?? e.fuso, e.id,
  )
  res.json({ empresa: empresaToJson(empresaDo(req), { privado: true }), baseLocalizada })
})

router.put('/empresa/privacidade', ...admin, (req, res) => {
  const chaves = ['soExpediente', 'termoCiencia', 'anonimizar90', 'compartilharEta']
  const valor = Object.fromEntries(chaves.map((k) => [k, Boolean(req.body?.[k])]))
  db.prepare('UPDATE empresas SET privacidade = ? WHERE id = ?').run(JSON.stringify(valor), req.usuario.empresaId)
  res.json(valor)
})

// chave da API de integração (mostrada uma única vez)
router.post('/empresa/api-key', ...admin, (req, res) => {
  const chave = `rp_${crypto.randomBytes(24).toString('hex')}`
  db.prepare('UPDATE empresas SET api_key = ? WHERE id = ?').run(chave, req.usuario.empresaId)
  res.json({ apiKey: chave })
})
router.delete('/empresa/api-key', ...admin, (req, res) => {
  db.prepare('UPDATE empresas SET api_key = NULL WHERE id = ?').run(req.usuario.empresaId)
  res.status(204).end()
})

// webhook: URL que recebe os eventos (entrega.criada, entrega.status)
router.put('/empresa/webhook', ...admin, (req, res) => {
  const url = String(req.body?.url ?? '').trim()
  if (url && !/^https?:\/\/\S+$/.test(url)) return res.status(400).json({ erro: 'URL inválida (use http:// ou https://).' })
  const e = empresaDo(req)
  const segredo = url ? e.webhook_segredo ?? `whsec_${crypto.randomBytes(18).toString('hex')}` : null
  db.prepare('UPDATE empresas SET webhook_url = ?, webhook_segredo = ? WHERE id = ?').run(url || null, segredo, e.id)
  res.json({ webhookUrl: url || null, segredo })
})
router.post('/empresa/webhook/teste', ...admin, async (req, res) => {
  const e = empresaDo(req)
  if (!e.webhook_url) return res.status(400).json({ erro: 'Cadastre a URL do webhook primeiro.' })
  res.json(await dispararWebhook(e, 'teste', { mensagem: 'Webhook do Rota+ configurado com sucesso.', empresa: e.fantasia || e.razao_social }))
})

// caixa de saída (e-mails, WhatsApp, webhooks)
router.get('/mensagens', ...admin, (req, res) => {
  res.json(
    db.prepare('SELECT id, entrega_id AS entregaId, canal, destino, assunto, status, erro, criado_em AS criadoEm FROM mensagens WHERE empresa_id = ? ORDER BY id DESC LIMIT 100').all(req.usuario.empresaId),
  )
})

// ---------- equipe de campo (usuários com função entregador) ----------
router.get('/equipe', ...admin, (req, res) => {
  const e = empresaDo(req)
  const hoje = partesLocais(Date.now(), e.fuso)
  const inicioHoje = localParaUtc({ ...hoje, hora: 0, minuto: 0 }, e.fuso).toISOString()
  const fimHoje = new Date(Date.parse(inicioHoje) + DIA).toISOString()
  const desde30 = new Date(Date.now() - 30 * DIA).toISOString()
  const noTurno = dentroDoTurno(agora(), e)
  const lista = db.prepare("SELECT * FROM usuarios WHERE empresa_id = ? AND funcao = 'entregador' ORDER BY nome").all(e.id).map((u) => {
    const dia = db.prepare(`SELECT COUNT(*) AS total, SUM(status = 'entregue') AS entregues FROM entregas WHERE entregador_id = ? AND status <> 'cancelado'
      AND ((prazo_limite >= ? AND prazo_limite < ?) OR (entregue_em >= ? AND entregue_em < ?) OR status IN ('coletado', 'transito', 'saiu', 'atrasado', 'tentativa'))`).get(u.id, inicioHoje, fimHoje, inicioHoje, fimHoje)
    const mes = db.prepare(`SELECT COUNT(*) AS total, SUM(e.entregue_em <= e.prazo_limite) AS no_prazo,
        SUM(EXISTS (SELECT 1 FROM comprovantes c WHERE c.entrega_id = e.id AND c.foto IS NOT NULL AND c.assinatura IS NOT NULL AND c.lat IS NOT NULL)) AS completos
      FROM entregas e WHERE e.entregador_id = ? AND e.status = 'entregue' AND e.entregue_em >= ?`).get(u.id, desde30)
    const emRota = db.prepare(`SELECT COUNT(*) AS n FROM entregas WHERE entregador_id = ? AND status IN (${EM_ROTA.map(() => '?').join(',')})`).get(u.id, ...EM_ROTA).n
    const sinalRecente = u.ultima_posicao_em && Date.now() - Date.parse(u.ultima_posicao_em) <= 10 * MIN
    const status = emRota ? (sinalRecente ? 'Em rota' : 'Sem sinal') : noTurno ? 'Disponível' : 'Fora do turno'
    return {
      id: u.id, usuarioId: u.id, nome: u.nome, email: u.email, telefone: u.telefone, veiculo: u.veiculo, base: u.base_nome ?? e.fantasia ?? 'Base da empresa', baseEndereco: u.base_nome,
      hoje: { entregues: dia.entregues ?? 0, total: dia.total }, emRota,
      noPrazoPct: pct(mes.no_prazo ?? 0, mes.total), adesaoPct: pct(mes.completos ?? 0, mes.total), entregues30d: mes.total,
      status, ultimaPosicaoEm: u.ultima_posicao_em, criadoEm: u.criado_em,
    }
  })
  res.json(lista)
})

// adesão ao registro no app (últimos 30 dias)
router.get('/equipe/adesao', ...admin, (req, res) => {
  const id = req.usuario.empresaId
  const desde = new Date(Date.now() - 30 * DIA).toISOString()
  const c = db
    .prepare(`SELECT COUNT(*) AS total, SUM(c.foto IS NOT NULL) AS foto, SUM(c.assinatura IS NOT NULL) AS assinatura, SUM(c.lat IS NOT NULL) AS gps
      FROM entregas e LEFT JOIN comprovantes c ON c.id = (SELECT MAX(id) FROM comprovantes WHERE entrega_id = e.id AND resultado <> 'tentativa')
      WHERE e.empresa_id = ? AND e.status = 'entregue' AND e.entregue_em >= ?`)
    .get(id, desde)
  const m = db.prepare("SELECT COUNT(*) AS total, SUM(via IN ('qr', 'rfid')) AS lidas FROM ativo_movimentacoes WHERE criado_em >= ? AND ativo_id IN (SELECT id FROM ativos WHERE empresa_id = ?)").get(desde, id)
  res.json({ entregas: c.total, fotoPct: pct(c.foto ?? 0, c.total), assinaturaPct: pct(c.assinatura ?? 0, c.total), gpsPct: pct(c.gps ?? 0, c.total), movimentacoes: m.total, leituraPct: pct(m.lidas ?? 0, m.total) })
})

// lembrete para quem tem entrega em aberto
router.post('/equipe/lembrete', ...admin, (req, res) => {
  const texto = String(req.body?.texto ?? '').trim() || 'Lembrete da central: registre foto, assinatura e localização em cada entrega e mantenha o app aberto durante a rota.'
  const alvos = db.prepare("SELECT id FROM usuarios WHERE empresa_id = ? AND funcao = 'entregador'").all(req.usuario.empresaId)
  for (const u of alvos) notificar(u.id, { icon: 'bell', titulo: 'Lembrete da central', texto, link: '/entregador' })
  res.json({ enviados: alvos.length })
})

// PATCH /api/equipe/:id  { base (endereço), veiculo } — base de saída própria do entregador
router.patch('/equipe/:id', ...admin, async (req, res) => {
  const u = db.prepare("SELECT * FROM usuarios WHERE id = ? AND empresa_id = ? AND funcao = 'entregador'").get(Number(req.params.id), req.usuario.empresaId)
  if (!u) return res.status(404).json({ erro: 'Entregador não encontrado.' })
  const base = String(req.body.base ?? '').trim()
  let pos = { lat: null, lng: null }
  if (base) {
    pos = (await geocodificar(base)) ?? pos
    if (pos.lat == null) return res.status(400).json({ erro: 'Não encontramos esse endereço no mapa.' })
  }
  db.prepare('UPDATE usuarios SET base_nome = ?, base_lat = ?, base_lng = ?, veiculo = COALESCE(?, veiculo) WHERE id = ?').run(base || null, pos.lat, pos.lng, req.body.veiculo ?? null, u.id)
  publicar({ empresaId: req.usuario.empresaId, recursos: ['equipe'] })
  res.json({ ok: true })
})

// ---------- convites de entregador ----------
router.get('/convites', ...admin, (req, res) => {
  res.json(db.prepare('SELECT token, email, criado_em AS criadoEm FROM convites WHERE empresa_id = ? AND usado_em IS NULL ORDER BY criado_em DESC').all(req.usuario.empresaId))
})
router.post('/convites', ...admin, async (req, res) => {
  const email = String(req.body?.email ?? '').trim()
  const token = crypto.randomBytes(16).toString('hex')
  db.prepare('INSERT INTO convites (token, empresa_id, email, criado_por, criado_em) VALUES (?, ?, ?, ?, ?)').run(token, req.usuario.empresaId, email || null, req.usuario.id, agora())
  const origem = /^https?:\/\//.test(req.get('origin') ?? '') ? req.get('origin') : URL_APP
  const link = `${origem}/#/cadastro?convite=${token}`
  const e = empresaDo(req)
  const envio = email.includes('@')
    ? await enviarEmail({ empresaId: e.id, para: email, assunto: `Convite para a equipe ${e.fantasia || e.razao_social} no Rota+`, texto: `${req.usuario.nome} convidou você para a equipe de entregas.\n\nCrie seu acesso: ${link}` })
    : null
  res.status(201).json({ token, link, email: envio?.status ?? null })
})
router.delete('/convites/:token', ...admin, (req, res) => {
  db.prepare('DELETE FROM convites WHERE token = ? AND empresa_id = ?').run(req.params.token, req.usuario.empresaId)
  res.status(204).end()
})

// ---------- relatórios ----------
router.get('/relatorios', ...admin, (req, res) => res.json(gerarRelatorio(empresaDo(req), req.query.periodo)))
router.get('/relatorios/csv', ...admin, (req, res) => {
  const r = gerarRelatorio(empresaDo(req), req.query.periodo)
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="relatorio-rota-plus-${r.periodo}.csv"` })
  res.send(relatorioCsv(r))
})

// ---------- dados de demonstração: só a empresa demo pode ser restaurada ----------
router.post('/demo/reset', ...admin, (req, res) => {
  if (!empresaDo(req).demo) return res.status(403).json({ erro: 'Somente a empresa de demonstração pode ser restaurada.' })
  restaurarDemo()
  res.json({ ok: true, mensagem: 'Dados de demonstração restaurados. Faça login novamente.' })
})

export default router
