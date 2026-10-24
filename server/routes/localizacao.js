// Posições GPS: app do entregador (navegador) e rastreadores dos ativos (dispositivos).
import { Router } from 'express'
import { abrirAlerta, resolverPorChave } from '../alertasServico.js'
import { autenticar, exigirFuncao } from '../auth.js'
import { db, transaction } from '../db.js'
import { verificarDesvio } from '../monitor.js'
import { agora, dentroDoTurno, horaLocal, partesLocais } from '../tempo.js'
import { publicar } from '../tempoReal.js'

const router = Router()

function lerPosicao(body) {
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null
  const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
  return { lat, lng, precisao: num(body.precisao), velocidade: num(body.velocidade), bateria: num(body.bateria) }
}

// POST /api/localizacao  { lat, lng, precisao?, velocidade? (km/h) } — app do entregador
router.post('/localizacao', autenticar, exigirFuncao('entregador'), (req, res) => {
  const u = req.usuario
  const p = lerPosicao(req.body)
  if (!p) return res.status(400).json({ erro: 'Coordenadas inválidas.' })
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(u.empresaId)
  const priv = JSON.parse(empresa.privacidade || '{}')
  const quando = agora()
  // LGPD: fora do expediente a posição de pessoas não é registrada
  if (priv.soExpediente !== false && !dentroDoTurno(quando, empresa)) return res.status(202).json({ registrada: false, motivo: 'fora_do_turno' })

  const emRota = db.prepare("SELECT id, usuario_id FROM entregas WHERE entregador_id = ? AND status IN ('coletado', 'transito', 'saiu', 'atrasado', 'tentativa')").all(u.id)
  transaction(() => {
    db.prepare('INSERT INTO posicoes (empresa_id, usuario_id, lat, lng, precisao, velocidade, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(u.empresaId, u.id, p.lat, p.lng, p.precisao, p.velocidade, quando)
    db.prepare('UPDATE usuarios SET ultima_lat = ?, ultima_lng = ?, ultima_precisao = ?, ultima_posicao_em = ? WHERE id = ?').run(p.lat, p.lng, p.precisao, quando, u.id)
    // as cargas que ele leva e os veículos retirados por ele (sem rastreador próprio) andam junto
    db.prepare(`UPDATE ativos SET lat = ?, lng = ?, ultima_leitura_em = ? WHERE empresa_id = ? AND (
        entrega_id IN (SELECT value FROM json_each(?)) OR (responsavel_id = ? AND status = 'em_uso' AND tipo = 'Veículo' AND dispositivo_token IS NULL))`)
      .run(p.lat, p.lng, quando, u.empresaId, JSON.stringify(emRota.map((e) => e.id)), u.id)
  })
  resolverPorChave(u.empresaId, `sinal:u${u.id}`)
  verificarDesvio(empresa, db.prepare('SELECT * FROM usuarios WHERE id = ?').get(u.id))
  publicar({ empresaId: u.empresaId, usuarios: emRota.map((e) => e.usuario_id).filter(Boolean), recursos: ['posicoes'] })
  res.json({ registrada: true })
})

// GET /api/posicoes — posição atual da equipe (mapa ao vivo do administrador)
router.get('/posicoes', autenticar, exigirFuncao('admin'), (req, res) => {
  const lista = db.prepare(`SELECT u.id, u.nome, u.veiculo, u.telefone, u.ultima_lat AS lat, u.ultima_lng AS lng, u.ultima_precisao AS precisao, u.ultima_posicao_em AS atualizadoEm,
      (SELECT COUNT(*) FROM entregas e WHERE e.entregador_id = u.id AND e.status IN ('coletado', 'transito', 'saiu', 'atrasado', 'tentativa')) AS emRota
    FROM usuarios u WHERE u.empresa_id = ? AND u.funcao = 'entregador' AND u.ultima_lat IS NOT NULL`).all(req.usuario.empresaId)
  const rotas = db.prepare('SELECT entregador_id, trajeto FROM rotas_planejadas WHERE entregador_id IN (SELECT id FROM usuarios WHERE empresa_id = ?)').all(req.usuario.empresaId)
  res.json({ entregadores: lista, rotas: Object.fromEntries(rotas.map((r) => [r.entregador_id, JSON.parse(r.trajeto)])) })
})

// POST /api/dispositivos/posicao  { lat, lng, velocidade?, bateria? }  + cabeçalho X-Dispositivo-Token
// Para rastreadores GPS (ou um celular dedicado) vinculados a um ativo.
router.post('/dispositivos/posicao', (req, res) => {
  const token = req.get('x-dispositivo-token')
  const a = token ? db.prepare('SELECT * FROM ativos WHERE dispositivo_token = ?').get(token) : null
  if (!a) return res.status(401).json({ erro: 'Token do dispositivo inválido.' })
  const p = lerPosicao(req.body)
  if (!p) return res.status(400).json({ erro: 'Coordenadas inválidas.' })
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(a.empresa_id)
  const quando = agora()
  const anterior = db.prepare('SELECT lat, lng FROM posicoes WHERE ativo_id = ? ORDER BY id DESC LIMIT 1').get(a.id)
  transaction(() => {
    db.prepare('INSERT INTO posicoes (empresa_id, ativo_id, lat, lng, precisao, velocidade, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(a.empresa_id, a.id, p.lat, p.lng, p.precisao, p.velocidade, quando)
    db.prepare(`UPDATE ativos SET lat = ?, lng = ?, ultima_leitura_em = ?, bateria = COALESCE(?, bateria),
      status = CASE WHEN status IN ('sem_sinal', 'inativo') THEN CASE WHEN responsavel_id IS NULL THEN 'disponivel' ELSE 'em_uso' END ELSE status END WHERE id = ?`)
      .run(p.lat, p.lng, quando, p.bateria, a.id)
  })
  resolverPorChave(a.empresa_id, `sinal:${a.id}`)
  resolverPorChave(a.empresa_id, `inatividade:${a.id}`)
  // movimento fora do expediente = possível uso indevido
  const moveu = (p.velocidade ?? 0) > 5 || (anterior && Math.hypot(anterior.lat - p.lat, anterior.lng - p.lng) > 0.003)
  if (moveu && !dentroDoTurno(quando, empresa)) {
    const d = partesLocais(quando, empresa.fuso)
    abrirAlerta({
      empresaId: a.empresa_id, tipo: 'uso_indevido', severidade: 'medio', chave: `uso:${a.id}:${d.ano}-${d.mes}-${d.dia}`, referencia: a.id,
      titulo: `Uso fora do turno — ${a.id}`, entidade: `${a.nome} · ${horaLocal(quando, empresa.fuso)}`,
      descricao: `${a.nome} em movimento fora do expediente (${empresa.turno_inicio}–${empresa.turno_fim}). Responsável: ${a.responsavel ?? 'ninguém'}.`,
    })
  }
  if (p.bateria != null && p.bateria <= 15) {
    abrirAlerta({
      empresaId: a.empresa_id, tipo: 'sinal', severidade: 'medio', chave: `bateria:${a.id}`, referencia: a.id,
      titulo: `Bateria baixa — ${a.id}`, entidade: `${a.nome} · ${p.bateria}%`, descricao: `O rastreador de ${a.nome} está com ${p.bateria}% de bateria.`,
    })
  } else if (p.bateria != null) resolverPorChave(a.empresa_id, `bateria:${a.id}`)
  publicar({ empresaId: a.empresa_id, recursos: ['ativos', 'posicoes'] })
  res.json({ registrada: true })
})

export default router
