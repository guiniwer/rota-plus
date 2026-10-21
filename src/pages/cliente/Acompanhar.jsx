import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import MapView, { MapChip } from '../../components/ui/MapView'
import Modal from '../../components/ui/Modal'
import Stepper from '../../components/ui/Stepper'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import { useApp } from '../../context/AppContext'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'
import useSimulatedProgress from '../../hooks/useSimulatedProgress'
import { ETAPAS, STATUS_ENTREGA } from '../../utils/status'

const ativa = (e) => !['entregue', 'cancelado'].includes(e.status)

export default function Acompanhar() {
  const { entrega, lista } = useEntregaSelecionada(ativa)
  const { toast } = useApp()
  const navigate = useNavigate()
  const [msgAberta, setMsgAberta] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const progresso = useSimulatedProgress(entrega?.progresso ?? 0, { step: entrega?.rastreio === 'gps' ? 0.004 : 0 })

  if (!entrega) {
    return (
      <Page title="Acompanhar entrega" subtitle="Rastreie seu pacote em tempo real">
        <Card>
          <EmptyState icon="truck" title="Nenhuma entrega em andamento">
            <Button onClick={() => navigate('/cliente/novo-pedido')}>Fazer um pedido</Button>
          </EmptyState>
        </Card>
      </Page>
    )
  }

  const etapa = STATUS_ENTREGA[entrega.status].etapa
  const minutos = Math.max(1, Math.round((1 - progresso) * 60))

  const compartilhar = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/rastreio`
    try {
      await navigator.clipboard.writeText(`${link} — código ${entrega.id}`)
      toast('Link de rastreio copiado!')
    } catch {
      toast(`Compartilhe: ${link} — código ${entrega.id}`)
    }
  }

  const enviarMensagem = (e) => {
    e.preventDefault()
    setMsgAberta(false)
    setMensagem('')
    toast(`Mensagem enviada para ${entrega.responsavel ?? 'a central'}.`)
  }

  return (
    <Page
      title="Acompanhar entrega"
      subtitle="Rastreie seu pacote em tempo real"
      actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/acompanhar" />}
    >
      <div className="grid-aside">
        <Card compact>
          {entrega.rastreio === 'gps' ? (
            <MapView progress={progresso} height={520}>
              <MapChip style={{ top: 16, left: 16 }}>
                <Icon name="truck" size={16} color="var(--pink)" /> {STATUS_ENTREGA[entrega.status].label}
              </MapChip>
              <div className="map-overlay" style={{ top: 16, right: 16 }}>
                <div className="map-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', borderRadius: 14, padding: 14 }}>
                  <span className="label">Chegada estimada</span>
                  <strong style={{ fontSize: 26, color: 'var(--pink)' }}>~{minutos} min</strong>
                </div>
              </div>
              <MapChip style={{ bottom: 16, left: 16 }}>
                <Icon name="refresh" size={16} color="var(--green)" /> Atualização ao vivo
              </MapChip>
            </MapView>
          ) : (
            <EmptyState icon="building" title="Rastreamento por centro de distribuição">
              Esta entrega é atualizada a cada etapa. Contrate o rastreamento por GPS no próximo pedido para ver o entregador no mapa.
            </EmptyState>
          )}
          <div className="row wrap">
            <Button variant="secondary" icon="link" onClick={compartilhar}>
              Compartilhar link de rastreio
            </Button>
            <Button variant="outline" onClick={() => navigate(`/cliente/status/${entrega.id}`)}>
              Ver status completo
            </Button>
          </div>
        </Card>

        <div className="stack">
          <Card compact>
            <KeyValue label="Código de rastreamento" value={entrega.id} valueColor="var(--pink)" />
            <KeyValue label="Rastreamento" value={entrega.rastreio === 'gps' ? 'GPS em tempo real' : 'Por centro de distribuição'} />
          </Card>
          <Card title="Progresso da entrega">
            <Stepper steps={ETAPAS} current={etapa} vertical />
          </Card>
          {entrega.responsavel && (
            <Card compact>
              <div className="row">
                <Avatar name={entrega.responsavel} size={52} />
                <div className="grow">
                  <strong style={{ fontSize: 16 }}>{entrega.responsavel}</strong>
                  <p className="small muted">Moto Honda CG 160 · ABC-1234</p>
                  <p className="small muted">
                    <Icon name="star" size={12} color="var(--amber)" /> 4,9 · 1.240 entregas
                  </p>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <Button variant="secondary" onClick={() => setMsgAberta(true)}>
                  Mensagem
                </Button>
                <a className="btn btn-violet" href="tel:+5581999999999">
                  <Icon name="phone" size={18} /> Ligar
                </a>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal title={`Mensagem para ${entrega.responsavel}`} open={msgAberta} onClose={() => setMsgAberta(false)}>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={enviarMensagem}>
          <Field label="Mensagem" as="textarea" value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: Pode deixar na portaria, por favor." required />
          <Button type="submit" block>
            Enviar
          </Button>
        </form>
      </Modal>
    </Page>
  )
}
