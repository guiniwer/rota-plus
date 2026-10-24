import Card from '../ui/Card'
import Stepper from '../ui/Stepper'
import Timeline from '../ui/Timeline'
import { ETAPAS, STATUS_ENTREGA } from '../../utils/status'
import { previsaoTexto } from '../../utils/tempo'
import MapaEntrega from './MapaEntrega'
import { EntregaBadge } from './StatusBadge'

/** Resultado do rastreio público (código + documento). */
export default function RastreioResultado({ entrega, documento, aside }) {
  const etapa = STATUS_ENTREGA[entrega.status]?.etapa ?? 0
  return (
    <div className="grid-aside">
      <Card title={entrega.id} action={<EntregaBadge status={entrega.status} />}>
        <div className="row wrap" style={{ gap: 32 }}>
          <div>
            <p className="label">{entrega.status === 'entregue' ? 'Entrega' : 'Prazo'}</p>
            <strong style={{ fontSize: 22, fontWeight: 800, color: 'var(--pink)' }}>{previsaoTexto(entrega)}</strong>
          </div>
          <div>
            <p className="label">Destino</p>
            <strong style={{ fontSize: 16 }}>{entrega.destino}</strong>
          </div>
          <div>
            <p className="label">Transportadora</p>
            <strong style={{ fontSize: 16 }}>{entrega.transportadora}</strong>
          </div>
        </div>
        {etapa >= 0 && <Stepper steps={ETAPAS} current={etapa} />}
        <MapaEntrega entrega={entrega} documento={documento} height={300} />
        <p className="small grey">Por privacidade, a posição do entregador só aparece enquanto ele está a caminho do seu endereço.</p>
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
