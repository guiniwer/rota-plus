import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Icon from '../../components/ui/Icon'
import KpiCard from '../../components/ui/KpiCard'
import LabeledBar from '../../components/ui/LabeledBar'
import ListItem from '../../components/ui/ListItem'
import MapView, { MapChip } from '../../components/ui/MapView'
import Person from '../../components/ui/Person'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { toMarkers } from '../../utils/ativos'
import { SEVERIDADE, TIPOS_ALERTA } from '../../utils/status'

const GARGALOS = [
  { label: 'Coleta', value: '12 min', pct: 15, color: 'var(--green)' },
  { label: 'Triagem no CD', value: '46 min', pct: 45, color: 'var(--amber)' },
  { label: 'Transferência', value: '2 h 10 min', pct: 90, color: 'var(--red)' },
  { label: 'Última milha', value: '38 min', pct: 35, color: 'var(--green)' },
]

export default function Painel() {
  const { entregas, ativos, alertas, usuario } = useApp()
  const navigate = useNavigate()

  const pendentes = entregas.filter((e) => !['entregue', 'cancelado'].includes(e.status))
  const emCampo = ativos.filter((a) => ['em_uso', 'desvio', 'inativo'].includes(a.status)).length
  const abertos = alertas.filter((a) => a.status !== 'resolvido').sort((a, b) => SEVERIDADE[b.severidade].peso - SEVERIDADE[a.severidade].peso)
  const criticos = abertos.filter((a) => a.severidade === 'critico').length
  const atrasadas = entregas.filter((e) => e.status === 'atrasado').length
  const concluidas = entregas.filter((e) => e.status === 'entregue').length
  const noPrazo = Math.round((concluidas / Math.max(1, concluidas + atrasadas)) * 1000) / 10

  return (
    <Page title="Painel da operação" subtitle={`${usuario.empresa ?? 'Sua empresa'} · visão em tempo real`}>
      <div className="grid-4">
        <KpiCard label="Entregas pendentes" value={pendentes.length} delta={`${atrasadas} atrasada(s)`} deltaColor={atrasadas ? 'var(--amber)' : 'var(--green)'} />
        <KpiCard label="Entregas no prazo" value={`${noPrazo.toLocaleString('pt-BR')}%`} delta="▲ 3,1 p.p. na semana" />
        <KpiCard label="Ativos em campo" value={`${emCampo} / ${ativos.length}`} delta={`${ativos.filter((a) => a.status === 'disponivel').length} disponíveis`} deltaColor="var(--muted)" />
        <KpiCard label="Alertas abertos" value={abertos.length} delta={`${criticos} crítico(s)`} deltaColor="var(--red)" />
      </div>

      <div className="grid-aside">
        <Card
          title="Mapa ao vivo"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/empresa/mapa')}>
              Tela cheia
            </Button>
          }
        >
          <MapView progress={0.45} markers={toMarkers(ativos)} onMarkerClick={(m) => navigate(`/empresa/ativos/${m.id}`)} height={340}>
            <MapChip style={{ bottom: 12, left: 12 }}>
              <Icon name="map" size={16} color="var(--pink)" /> {ativos.length} ativos rastreados · clique em um ponto
            </MapChip>
          </MapView>
        </Card>
        <Card title="Alertas críticos" action={<Badge tone="danger">{abertos.length} abertos</Badge>}>
          {abertos.slice(0, 4).map((a) => (
            <ListItem
              key={a.id}
              icon={TIPOS_ALERTA[a.tipo].icon}
              color={SEVERIDADE[a.severidade].color}
              title={a.titulo}
              subtitle={a.entidade}
              meta={`há ${a.aberto}`}
              onClick={() => navigate(`/empresa/alertas?id=${a.id}`)}
            />
          ))}
          <Button variant="violet" block onClick={() => navigate('/empresa/alertas')}>
            Abrir central de alertas
          </Button>
        </Card>
      </div>

      <div className="grid-aside">
        <Card title="Entregas pendentes" action={<button className="link" onClick={() => navigate('/empresa/entregas')}>Ver todas →</button>}>
          <DataTable
            rows={pendentes.slice(0, 6)}
            onRowClick={(e) => navigate(`/empresa/entregas?q=${e.id}`)}
            columns={[
              { key: 'id', label: 'Código', render: (e) => <strong>{e.id}</strong> },
              { key: 'cliente', label: 'Destino' },
              { key: 'resp', label: 'Responsável', render: (e) => <Person name={e.responsavel} /> },
              { key: 'janela', label: 'Janela' },
              { key: 'status', label: 'Status', render: (e) => <EntregaBadge status={e.status} /> },
            ]}
          />
        </Card>
        <Card title="Gargalos por etapa">
          {GARGALOS.map((g) => (
            <LabeledBar key={g.label} label={g.label} value={g.value} percent={g.pct} color={g.color} />
          ))}
          <span className="small grey">Tempo médio parado em cada etapa hoje</span>
        </Card>
      </div>
    </Page>
  )
}
