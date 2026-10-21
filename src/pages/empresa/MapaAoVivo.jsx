import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import ListItem from '../../components/ui/ListItem'
import MapView, { MapChip } from '../../components/ui/MapView'
import Toggle from '../../components/ui/Toggle'
import { AtivoBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import useSimulatedProgress from '../../hooks/useSimulatedProgress'
import { COR_STATUS_ATIVO, toMarkers } from '../../utils/ativos'
import { TIPO_ATIVO_ICON } from '../../utils/status'

const CAMADAS = ['Veículo', 'Equipamento', 'Ferramenta', 'Carga']

export default function MapaAoVivo() {
  const { ativos } = useApp()
  const navigate = useNavigate()
  const [camadas, setCamadas] = useState({ Veículo: true, Equipamento: true, Ferramenta: false, Carga: true, rota: true })
  const [selecionadoId, setSelecionadoId] = useState('VEI-0002')
  const progresso = useSimulatedProgress(0.3, { step: 0.005, max: 0.95 })

  // cargas só aparecem enquanto estão em rota
  const noMapa = ativos.filter((a) => a.tipo !== 'Carga' || a.status === 'em_uso')
  const visiveis = noMapa.filter((a) => camadas[a.tipo])
  const selecionado = ativos.find((a) => a.id === selecionadoId)
  const alternar = (k) => (v) => setCamadas((c) => ({ ...c, [k]: v }))

  return (
    <Page title="Mapa ao vivo" subtitle={`${visiveis.length} ativos visíveis · atualização contínua`}>
      <div className="grid-aside" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <Card compact>
          <MapView progress={progresso} showRoute={camadas.rota} markers={toMarkers(visiveis)} selectedId={selecionadoId} onMarkerClick={(m) => setSelecionadoId(m.id)} height={620}>
            <MapChip style={{ top: 16, left: 16 }}>
              <Icon name="refresh" size={16} color="var(--green)" /> Ao vivo
            </MapChip>
            <MapChip style={{ bottom: 16, left: 16 }}>
              <span className="green">● Em uso</span> <span style={{ color: 'var(--purple)' }}>● Disponível</span> <span className="amber">● Parado/desvio</span> <span className="red">● Sem sinal</span>
            </MapChip>
          </MapView>
        </Card>
        <div className="stack">
          <Card title="Camadas" compact>
            {CAMADAS.map((c) => (
              <Toggle key={c} title={`${c === 'Carga' ? 'Cargas em rota' : `${c}s`} (${noMapa.filter((a) => a.tipo === c).length})`} checked={camadas[c]} onChange={alternar(c)} />
            ))}
            <Toggle title="Rota da entrega RT-90911" checked={camadas.rota} onChange={alternar('rota')} />
          </Card>
          {selecionado && (
            <Card title={selecionado.nome} compact action={<AtivoBadge status={selecionado.status} />}>
              <KeyValue label="Responsável" value={selecionado.responsavel ?? '—'} />
              <KeyValue label="Local" value={selecionado.local} />
              <KeyValue label="Última leitura" value={selecionado.ultimaLeitura} />
              <Button variant="secondary" size="sm" onClick={() => navigate(`/empresa/ativos/${selecionado.id}`)}>
                Ver detalhes
              </Button>
            </Card>
          )}
          <Card title="Unidades" compact>
            {visiveis.slice(0, 6).map((a) => (
              <ListItem key={a.id} icon={TIPO_ATIVO_ICON[a.tipo] ?? 'box'} color={COR_STATUS_ATIVO[a.status]} title={a.nome} subtitle={a.local} onClick={() => setSelecionadoId(a.id)} />
            ))}
          </Card>
        </div>
      </div>
    </Page>
  )
}
