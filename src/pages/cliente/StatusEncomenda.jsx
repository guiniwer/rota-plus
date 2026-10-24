import { useState } from 'react'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import KeyValue from '../../components/ui/KeyValue'
import Modal from '../../components/ui/Modal'
import Timeline from '../../components/ui/Timeline'
import { Etiqueta, Instrucoes, ReportarProblema } from '../../components/entregas/AcoesCliente'
import Comprovante from '../../components/entregas/Comprovante'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import MapaEntrega from '../../components/entregas/MapaEntrega'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'
import { brl, num } from '../../utils/format'
import { previsaoTexto } from '../../utils/tempo'

const TITULOS = { etiqueta: 'Etiqueta de envio', comprovante: 'Comprovante de entrega', problema: 'Reportar problema', instrucoes: 'Instruções de entrega' }

export default function StatusEncomenda() {
  const { entrega, lista } = useEntregaSelecionada()
  const [modal, setModal] = useState(null)

  if (!entrega) {
    return (
      <Page title="Status da encomenda">
        <Card>
          <EmptyState title="Você ainda não tem encomendas" />
        </Card>
      </Page>
    )
  }
  const aberta = !['entregue', 'cancelado'].includes(entrega.status)

  return (
    <Page title="Status da encomenda" subtitle="Detalhamento completo do envio" actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/status" />}>
      <div className="grid-aside">
        <div className="stack">
          <Card title={entrega.id} action={<EntregaBadge status={entrega.status} />}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="stack-sm">
                <KeyValue label="Transportadora" value={entrega.transportadora} />
                <KeyValue label="Remetente" value={entrega.remetente} />
                <KeyValue label="Destinatário" value={entrega.destinatario || entrega.cliente} />
                <KeyValue label="Tipo de carga" value={entrega.tipoCarga} />
                <KeyValue label="Peso taxado" value={`${num(entrega.pesoTaxado)} kg`} />
              </div>
              <div className="stack-sm">
                <KeyValue label={entrega.status === 'entregue' ? 'Entrega' : 'Prazo'} value={previsaoTexto(entrega)} valueColor="var(--pink)" />
                <KeyValue label="Modalidade" value={entrega.modalidade === 'expressa' ? 'Mais rápida' : 'Normal'} />
                <KeyValue label="Rastreamento" value={entrega.rastreio === 'gps' ? 'GPS em tempo real' : 'Centro de distribuição'} />
                <KeyValue label="Valor do frete" value={brl(entrega.valor)} />
                {entrega.instrucoes && <KeyValue label="Instruções" value={entrega.instrucoes} />}
              </div>
            </div>
          </Card>
          <Card compact>
            <MapaEntrega entrega={entrega} height={240} />
          </Card>
          <Card title="Documentos e ações">
            <div className="grid-3" style={{ gap: 12 }}>
              <Button variant="secondary" icon="qr" onClick={() => setModal('etiqueta')}>
                Etiqueta
              </Button>
              <Button variant="secondary" icon="check" onClick={() => setModal('comprovante')} disabled={!entrega.comprovante}>
                Comprovante
              </Button>
              {aberta && (
                <Button variant="secondary" icon="edit" onClick={() => setModal('instrucoes')}>
                  Instruções
                </Button>
              )}
            </div>
          </Card>
        </div>
        <Card title="Histórico de atualizações">
          <Timeline items={entrega.eventos} />
          <Button variant="outline" block onClick={() => setModal('problema')}>
            Reportar problema
          </Button>
        </Card>
      </div>

      <Modal title={TITULOS[modal] ?? ''} open={Boolean(modal)} onClose={() => setModal(null)}>
        {modal === 'etiqueta' && <Etiqueta entrega={entrega} />}
        {modal === 'comprovante' && <Comprovante entregaId={entrega.id} />}
        {modal === 'problema' && <ReportarProblema entrega={entrega} onFechar={() => setModal(null)} />}
        {modal === 'instrucoes' && <Instrucoes entrega={entrega} onFechar={() => setModal(null)} />}
      </Modal>
    </Page>
  )
}
