import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import Modal from '../../components/ui/Modal'
import Stepper from '../../components/ui/Stepper'
import Conversa from '../../components/entregas/Conversa'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import MapaEntrega from '../../components/entregas/MapaEntrega'
import { useApp } from '../../context/AppContext'
import useAcompanhamento from '../../hooks/useAcompanhamento'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'
import { ETAPAS, STATUS_ENTREGA } from '../../utils/status'
import { previsaoTexto, relativo } from '../../utils/tempo'

const ativa = (e) => !['entregue', 'cancelado'].includes(e.status)

export default function Acompanhar() {
  const { entrega, lista } = useEntregaSelecionada(ativa)
  const { toast } = useApp()
  const navigate = useNavigate()
  const [conversa, setConversa] = useState(false)
  const a = useAcompanhamento(entrega?.id)

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

  const compartilhar = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/rastreio?codigo=${entrega.id}`
    try {
      if (navigator.share) await navigator.share({ title: `Rastreio ${entrega.id}`, url: link })
      else {
        await navigator.clipboard.writeText(link)
        toast('Link de rastreio copiado!')
      }
    } catch {
      /* compartilhamento cancelado */
    }
  }

  return (
    <Page title="Acompanhar entrega" subtitle={`${entrega.transportadora} · ${previsaoTexto(entrega)}`} actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/acompanhar" />}>
      <div className="grid-aside">
        <Card compact>
          <MapaEntrega entrega={entrega} acompanhamento={a} height={520} />
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
            <KeyValue label="Prazo" value={previsaoTexto(entrega)} />
          </Card>
          <Card title="Progresso da entrega">
            <Stepper steps={ETAPAS} current={STATUS_ENTREGA[entrega.status].etapa} vertical />
          </Card>
          <Card compact>
            <div className="row">
              <Avatar name={entrega.responsavel ?? entrega.transportadora} size={52} />
              <div className="grow">
                <strong style={{ fontSize: 16 }}>{entrega.responsavel ?? 'Entregador a definir'}</strong>
                <p className="small muted">{a?.entregador?.veiculo ?? entrega.transportadora}</p>
                {a?.entregador?.atualizadoEm && <p className="small muted">GPS {relativo(a.entregador.atualizadoEm)}</p>}
              </div>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <Button variant="secondary" icon="mail" onClick={() => setConversa(true)}>
                Mensagem
              </Button>
              {a?.contato ? (
                <a className="btn btn-violet" href={`tel:${a.contato.replace(/\D/g, '')}`}>
                  <Icon name="phone" size={18} /> Ligar
                </a>
              ) : (
                <Button variant="violet" icon="phone" disabled>
                  Ligar
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal title={`Mensagens · ${entrega.id}`} open={conversa} onClose={() => setConversa(false)}>
        {conversa && <Conversa entregaId={entrega.id} />}
      </Modal>
    </Page>
  )
}
