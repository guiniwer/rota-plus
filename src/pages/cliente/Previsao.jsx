import { useEffect, useState } from 'react'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KpiCard from '../../components/ui/KpiCard'
import ListItem from '../../components/ui/ListItem'
import MapView, { MapChip } from '../../components/ui/MapView'
import Modal from '../../components/ui/Modal'
import ProgressBar from '../../components/ui/ProgressBar'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import { useApp } from '../../context/AppContext'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'

const ativa = (e) => !['entregue', 'cancelado'].includes(e.status)
const JANELAS = ['Amanhã, 08:00–12:00', 'Amanhã, 13:00–18:00', 'Sábado, 08:00–12:00']

export default function Previsao() {
  const { entrega, lista } = useEntregaSelecionada(ativa)
  const { toast } = useApp()
  const [segundos, setSegundos] = useState(25 * 60)
  const [reagendar, setReagendar] = useState(false)
  const [janela, setJanela] = useState(JANELAS[0])

  // contagem regressiva da previsão
  useEffect(() => {
    const id = setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  if (!entrega) {
    return (
      <Page title="Previsão de chegada">
        <Card>
          <EmptyState icon="clock" title="Nenhuma entrega em andamento" />
        </Card>
      </Page>
    )
  }

  const minutos = Math.ceil(segundos / 60)
  const pct = 100 - (segundos / (25 * 60)) * 28 // começa em 72% do trajeto
  const km = ((segundos / (25 * 60)) * 4.2).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

  return (
    <Page title="Previsão de chegada" subtitle="Acompanhe o tempo estimado" actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/previsao" />}>
      <div className="grid-aside">
        <Card style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="label">Tempo estimado</span>
          <div>
            <span className="eta-number">{minutos}</span> <strong className="pink" style={{ fontSize: 28 }}>min</strong>
          </div>
          <p className="muted">Entrega prevista: {entrega.previsao}</p>
          <ProgressBar value={pct} height={10} />
          <div className="row-between small grey" style={{ width: '100%' }}>
            <span>Coletado</span>
            <span>Você está a 2 paradas</span>
          </div>
        </Card>
        <div className="stack">
          <KpiCard label="Distância restante" value={`${km} km`} delta="Atualizado agora" deltaColor="var(--muted)" />
          <KpiCard label="Status do trânsito" value="Moderado" delta="+4 min por congestionamento" deltaColor="var(--amber)" />
        </div>
      </div>
      <div className="grid-aside">
        <Card compact>
          <MapView progress={pct / 100} height={320}>
            <MapChip style={{ top: 12, left: 12 }}>
              <Icon name="pin" size={16} color="var(--pink)" /> Av. Rebouças
            </MapChip>
          </MapView>
        </Card>
        <Card title="Atualizações recentes">
          <ListItem icon="truck" title="O entregador está na Av. Rebouças" subtitle="Próxima parada: você" />
          <ListItem icon="box" color="var(--purple)" title="Pacote passou pela triagem final" subtitle="CD Pinheiros" />
          <ListItem icon="bell" color="var(--green)" title="Avisaremos 10 min antes" subtitle="Por push e WhatsApp" />
          <strong>Não vai estar em casa?</strong>
          <div className="grid-2" style={{ gap: 12 }}>
            <Button variant="secondary" onClick={() => setReagendar(true)}>
              Reagendar
            </Button>
            <Button variant="secondary" onClick={() => toast('Entregador avisado: deixar com o vizinho do nº 1002.')}>
              Deixar com vizinho
            </Button>
          </div>
        </Card>
      </div>

      <Modal title="Reagendar entrega" open={reagendar} onClose={() => setReagendar(false)}>
        <Field label="Nova janela" as="select" value={janela} onChange={(e) => setJanela(e.target.value)} options={JANELAS} />
        <Button
          block
          onClick={() => {
            setReagendar(false)
            toast(`Entrega reagendada para ${janela}.`)
          }}
        >
          Confirmar
        </Button>
      </Modal>
    </Page>
  )
}
