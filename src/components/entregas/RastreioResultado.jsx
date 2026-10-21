import Card from '../ui/Card'
import Icon from '../ui/Icon'
import MapView, { MapChip } from '../ui/MapView'
import Stepper from '../ui/Stepper'
import Timeline from '../ui/Timeline'
import useSimulatedProgress from '../../hooks/useSimulatedProgress'
import { ETAPAS, STATUS_ENTREGA } from '../../utils/status'
import { EntregaBadge } from './StatusBadge'

/** Resultado de rastreio reutilizado no site público e na área do cliente. */
export default function RastreioResultado({ entrega, aside }) {
  const etapa = STATUS_ENTREGA[entrega.status]?.etapa ?? 0
  const emRota = ['transito', 'saiu', 'atrasado'].includes(entrega.status)
  const progresso = useSimulatedProgress(entrega.progresso, { step: emRota ? 0.004 : 0 })

  return (
    <div className="grid-aside">
      <Card title={entrega.id} action={<EntregaBadge status={entrega.status} />}>
        <div className="row wrap" style={{ gap: 32 }}>
          <div>
            <p className="label">Previsão</p>
            <strong style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)' }}>{entrega.previsao}</strong>
          </div>
          <div>
            <p className="label">Destino</p>
            <strong style={{ fontSize: 16 }}>{entrega.destino}</strong>
          </div>
          <div>
            <p className="label">Remetente</p>
            <strong style={{ fontSize: 16 }}>{entrega.remetente}</strong>
          </div>
        </div>
        {etapa >= 0 && <Stepper steps={ETAPAS} current={etapa} />}
        {entrega.rastreio === 'gps' && etapa >= 0 && etapa < 4 ? (
          <MapView progress={progresso} height={300}>
            {emRota && (
              <MapChip style={{ top: 16, left: 16 }}>
                <Icon name="truck" size={16} color="var(--pink)" /> Entregador a caminho · atualiza a cada 1,5 s
              </MapChip>
            )}
          </MapView>
        ) : (
          <p className="small muted">
            {entrega.rastreio === 'cd'
              ? 'Rastreamento por centro de distribuição: atualizamos a cada etapa (coleta, triagem, saída e entrega).'
              : 'Mapa disponível apenas enquanto a entrega estiver em rota.'}
          </p>
        )}
        <p className="small grey">Por privacidade, mostramos a posição do entregador apenas quando ele está na sua rota.</p>
      </Card>
      <div className="stack">
        <Card title="Histórico">
          <Timeline items={entrega.eventos} />
        </Card>
        {aside}
      </div>
    </div>
  )
}
