import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Icon from '../ui/Icon'
import { EntregaBadge } from './StatusBadge'

// o Leaflet só é baixado quando o mapa aparece
const MapaRota = lazy(() => import('./MapaRota'))

const km = (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
const minutos = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`)

/**
 * Rota otimizada das entregas pendentes (API /api/rotas/otimizada).
 * props:
 *  - entregadorId: obrigatório para o administrador; o entregador usa a própria rota
 *  - chave: muda quando as paradas mudam (refaz o cálculo)
 *  - onRota(rota): avisa a ordem calculada (ex.: para ordenar a lista de paradas)
 *  - compacto: esconde a lista de paradas (só mapa e resumo)
 */
export default function RotaOtimizada({ entregadorId, chave, onRota, compacto = false }) {
  const { otimizarRota } = useApp()
  const [rota, setRota] = useState(null)
  const [calculando, setCalculando] = useState(false)

  const calcular = useCallback(async () => {
    setCalculando(true)
    const r = await otimizarRota(entregadorId)
    setCalculando(false)
    if (!r) return
    setRota(r)
    onRota?.(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregadorId])

  useEffect(() => {
    calcular()
  }, [calcular, chave])

  return (
    <Card
      title="Rota otimizada"
      action={
        <Button variant="secondary" size="sm" icon="refresh" onClick={calcular} disabled={calculando}>
          {calculando ? 'Calculando…' : 'Recalcular'}
        </Button>
      }
    >
      {!rota ? (
        <p className="muted">{calculando ? 'Calculando a melhor ordem de visita…' : 'Não foi possível calcular a rota.'}</p>
      ) : rota.paradas.length === 0 ? (
        <p className="muted">Nenhuma entrega pendente com endereço localizado.</p>
      ) : (
        <>
          <div className="rota-kpis">
            <div>
              <span className="label">Distância</span>
              <strong>{km(rota.distanciaKm)}</strong>
            </div>
            <div>
              <span className="label">Tempo estimado</span>
              <strong>{minutos(rota.duracaoMin)}</strong>
            </div>
            <div>
              <span className="label">Economia</span>
              <strong className="green">{rota.economiaKm >= 0.1 ? `− ${km(rota.economiaKm)}` : '—'}</strong>
            </div>
          </div>
          <Suspense fallback={<div className="mapa-rota" style={{ height: compacto ? 260 : 300 }} />}>
            <MapaRota base={rota.base} paradas={rota.paradas} trajeto={rota.trajeto} height={compacto ? 260 : 300} />
          </Suspense>
          <div className="row-between wrap small">
            <span className="muted">
              Saída: {rota.base.nome} ·{' '}
              {rota.fonte === 'osrm' ? 'trajeto real pelas ruas (API OSRM / OpenStreetMap)' : 'estimativa offline (vizinho mais próximo + 2-opt)'}
            </span>
            <Badge tone={rota.fonte === 'osrm' ? 'success' : 'warning'}>{rota.fonte === 'osrm' ? 'OSRM' : 'Offline'}</Badge>
          </div>
          {!compacto && (
            <ol className="rota-lista">
              {rota.paradas.map((p, i) => (
                <li key={p.id}>
                  <span className="rota-num">{i + 1}</span>
                  <div className="grow">
                    <strong>{p.cliente}</strong>
                    <span className="cell-sub">
                      {p.destino} · {km(p.trechoKm)} do ponto anterior
                    </span>
                  </div>
                  <EntregaBadge status={p.status} />
                </li>
              ))}
            </ol>
          )}
          <a className="btn btn-primary" href={rota.mapsUrl} target="_blank" rel="noreferrer">
            <Icon name="send" size={18} /> Abrir rota no Google Maps
          </a>
        </>
      )}
    </Card>
  )
}
