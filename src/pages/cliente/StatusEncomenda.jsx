import { useState } from 'react'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import MapView from '../../components/ui/MapView'
import Modal from '../../components/ui/Modal'
import Timeline from '../../components/ui/Timeline'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'
import { brl, num } from '../../utils/format'

const MOTIVOS = ['Atraso na entrega', 'Encomenda danificada', 'Item faltando', 'Endereço incorreto', 'Outro']

export default function StatusEncomenda() {
  const { entrega, lista } = useEntregaSelecionada()
  const { toast } = useApp()
  const [problema, setProblema] = useState(false)
  const [motivo, setMotivo] = useState(MOTIVOS[0])

  if (!entrega) {
    return (
      <Page title="Status da encomenda">
        <Card>
          <EmptyState title="Você ainda não tem encomendas" />
        </Card>
      </Page>
    )
  }

  const baixar = (doc) => toast(`${doc} de ${entrega.id} baixado.`)

  return (
    <Page title="Status da encomenda" subtitle="Detalhamento completo do envio" actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/status" />}>
      <div className="grid-aside">
        <div className="stack">
          <Card title={entrega.id} action={<EntregaBadge status={entrega.status} />}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="stack-sm">
                <KeyValue label="Remetente" value={entrega.remetente} />
                <KeyValue label="Destinatário" value={entrega.destinatario} />
                <KeyValue label="Tipo de carga" value={entrega.tipoCarga} />
                <KeyValue label="Peso taxado" value={`${num(entrega.pesoTaxado)} kg`} />
              </div>
              <div className="stack-sm">
                <KeyValue label="Previsão" value={entrega.previsao} valueColor="var(--pink)" />
                <KeyValue label="Modalidade" value={entrega.modalidade === 'expressa' ? 'Mais rápida' : 'Normal'} />
                <KeyValue label="Rastreamento" value={entrega.rastreio === 'gps' ? 'GPS em tempo real' : 'Centro de distribuição'} />
                <KeyValue label="Valor do frete" value={brl(entrega.valor)} />
              </div>
            </div>
          </Card>
          <Card compact>
            <div className="row">
              <span className="icon-chip" style={{ background: 'rgba(232,86,166,.16)' }}>
                <Icon name="pin" color="var(--pink)" />
              </span>
              <div className="grow">
                <span className="small muted">Última localização</span>
                <strong style={{ display: 'block', fontSize: 16 }}>{entrega.eventos[0]?.descricao}</strong>
              </div>
              <span className="small grey">{entrega.eventos[0]?.data}</span>
            </div>
            <MapView progress={entrega.progresso} height={220} />
          </Card>
          <Card title="Documentos do envio">
            <div className="grid-3" style={{ gap: 12 }}>
              {['Nota fiscal', 'Etiqueta', 'Comprovante'].map((d) => (
                <Button key={d} variant="secondary" icon="download" onClick={() => baixar(d)}>
                  {d}
                </Button>
              ))}
            </div>
          </Card>
        </div>
        <Card title="Histórico de atualizações">
          <Timeline items={entrega.eventos} />
          <Button variant="outline" block onClick={() => setProblema(true)}>
            Reportar problema
          </Button>
        </Card>
      </div>

      <Modal title="Reportar problema" open={problema} onClose={() => setProblema(false)}>
        <form
          className="stack-sm"
          style={{ gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault()
            setProblema(false)
            toast(`Chamado aberto: ${motivo}. Responderemos em até 2 h.`)
          }}
        >
          <Field label="Motivo" as="select" value={motivo} onChange={(e) => setMotivo(e.target.value)} options={MOTIVOS} />
          <Field label="Detalhes" as="textarea" placeholder="Conte o que aconteceu" />
          <Button type="submit" block>
            Enviar
          </Button>
        </form>
      </Modal>
    </Page>
  )
}
