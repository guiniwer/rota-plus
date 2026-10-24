import { Router } from 'express'
import { autenticar, exigirFuncao } from '../auth.js'
import { db } from '../db.js'
import { otimizarRota } from '../rota.js'
import { MIN, agora } from '../tempo.js'

const router = Router()
router.use(autenticar, exigirFuncao('admin', 'entregador'))

/** Ponto de partida: posição atual do entregador (GPS recente) → base dele → base da empresa. */
export function baseDoEntregador(ent, empresa, paradas) {
  if (ent.ultima_posicao_em && Date.now() - Date.parse(ent.ultima_posicao_em) < 15 * MIN) return { nome: 'Posição atual', lat: ent.ultima_lat, lng: ent.ultima_lng, atual: true }
  if (ent.base_lat != null) return { nome: ent.base_nome ?? 'Base', lat: ent.base_lat, lng: ent.base_lng }
  if (empresa.base_lat != null) return { nome: empresa.fantasia || 'Base da empresa', lat: empresa.base_lat, lng: empresa.base_lng }
  return { nome: 'Primeira parada', lat: paradas[0].lat, lng: paradas[0].lng }
}

// GET /api/rotas/otimizada?entregadorId=  — o entregador vê a própria rota; o admin escolhe o entregador
router.get('/otimizada', async (req, res, next) => {
  const u = req.usuario
  const entregadorId = u.funcao === 'entregador' ? u.id : Number(req.query.entregadorId)
  const ent = db.prepare("SELECT * FROM usuarios WHERE id = ? AND empresa_id = ? AND funcao = 'entregador'").get(entregadorId, u.empresaId)
  if (!ent) return res.status(404).json({ erro: 'Entregador não encontrado.' })
  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(u.empresaId)
  // paradas pendentes, na ordem em que foram criadas (base da comparação de economia)
  const paradas = db
    .prepare(`SELECT id, cliente, destino, janela, status, lat, lng, prazo_limite AS prazoLimite FROM entregas
      WHERE entregador_id = ? AND status NOT IN ('entregue', 'cancelado') AND lat IS NOT NULL ORDER BY criado_em`)
    .all(entregadorId)
  try {
    const base = paradas.length ? baseDoEntregador(ent, empresa, paradas) : null
    const rota = await otimizarRota(paradas, base)
    // guarda o plano: usado no ETA do cliente e na detecção de desvio de rota
    if (paradas.length) {
      db.prepare(`INSERT INTO rotas_planejadas (entregador_id, paradas, trajeto, fonte, distancia_km, duracao_min, calculada_em) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (entregador_id) DO UPDATE SET paradas = excluded.paradas, trajeto = excluded.trajeto, fonte = excluded.fonte,
          distancia_km = excluded.distancia_km, duracao_min = excluded.duracao_min, calculada_em = excluded.calculada_em`).run(
        entregadorId, JSON.stringify(rota.paradas.map((p) => p.id)), JSON.stringify(rota.trajeto), rota.fonte, rota.distanciaKm, rota.duracaoMin, agora(),
      )
    } else db.prepare('DELETE FROM rotas_planejadas WHERE entregador_id = ?').run(entregadorId)
    res.json(rota)
  } catch (err) {
    next(err)
  }
})

export default router
