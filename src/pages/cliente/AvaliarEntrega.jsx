import { useState } from 'react'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import Modal from '../../components/ui/Modal'
import Segmented from '../../components/ui/Segmented'
import { ReportarProblema } from '../../components/entregas/AcoesCliente'
import Comprovante from '../../components/entregas/Comprovante'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'
import { dataHora } from '../../utils/tempo'

const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Muito bom', 'Excelente']
const ESTADOS = ['Perfeito estado', 'Danificado', 'Incompleto']
const avaliavel = (e) => e.status === 'entregue' || e.status === 'saiu'

export default function AvaliarEntrega() {
  const { entrega, lista } = useEntregaSelecionada(avaliavel)
  const { avaliarEntrega, toast } = useApp()
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [estado, setEstado] = useState(ESTADOS[0])
  const [comentario, setComentario] = useState('')
  const [problema, setProblema] = useState(false)

  if (!entrega) {
    return (
      <Page title="Confirmar entrega">
        <Card>
          <EmptyState icon="star" title="Nenhuma entrega para avaliar ainda" />
        </Card>
      </Page>
    )
  }

  const jaAvaliada = entrega.avaliacao
  const confirmar = async () => {
    if (!nota) {
      toast('Escolha de 1 a 5 estrelas.')
      return
    }
    const ok = await avaliarEntrega(entrega.id, { nota, estado, comentario })
    if (ok && estado !== 'Perfeito estado') toast('Registramos a ocorrência com a transportadora. A equipe entrará em contato.')
  }

  return (
    <Page title="Confirmar entrega" subtitle="Avalie como foi sua experiência" actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/avaliar" />}>
      <div className="grid-aside">
        <Card title="Comprovante de recebimento" action={<EntregaBadge status={entrega.status} />}>
          {entrega.comprovante ? (
            <Comprovante entregaId={entrega.id} />
          ) : (
            <>
              <p className="muted">O entregador ainda não registrou o comprovante. Ao confirmar, você declara que recebeu a encomenda.</p>
              <KeyValue label="Pedido" value={entrega.id} />
              <KeyValue label="Saiu para entrega" value={dataHora(entrega.eventos.find((e) => e.status === 'saiu')?.data)} />
              <KeyValue label="Entregador" value={entrega.responsavel ?? '—'} />
            </>
          )}
        </Card>

        {jaAvaliada ? (
          <Card title="Sua avaliação">
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon key={n} name="star" size={32} color={n <= jaAvaliada.nota ? 'var(--amber)' : 'var(--line)'} />
              ))}
            </div>
            <KeyValue label="Estado da encomenda" value={jaAvaliada.estado} />
            {jaAvaliada.comentario && <p className="muted">“{jaAvaliada.comentario}”</p>}
            <p className="small green">Obrigado por avaliar!</p>
          </Card>
        ) : (
          <div className="stack">
            <Card style={{ alignItems: 'center' }}>
              <strong style={{ fontSize: 17 }}>Como foi o serviço do entregador?</strong>
              <div className="stars" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setNota(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} estrela${n > 1 ? 's' : ''}`}>
                    <Icon name="star" size={36} color={n <= (hover || nota) ? 'var(--pink)' : 'var(--purple)'} />
                  </button>
                ))}
              </div>
              <span className="pink" style={{ fontWeight: 600, minHeight: 20 }}>
                {ROTULOS[hover || nota]}
              </span>
            </Card>
            <Card title="Estado da encomenda">
              <Segmented options={ESTADOS} value={estado} onChange={setEstado} />
            </Card>
            <Card>
              <Field label="Deixe um comentário (opcional)" as="textarea" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Muito rápido e educado!" />
            </Card>
            <div className="grid-2" style={{ gap: 12 }}>
              <Button variant="outline" onClick={() => setProblema(true)}>
                Reportar problema
              </Button>
              <Button onClick={confirmar}>Confirmar recebimento</Button>
            </div>
          </div>
        )}
      </div>
      <Modal title="Reportar problema" open={problema} onClose={() => setProblema(false)}>
        {problema && <ReportarProblema entrega={entrega} onFechar={() => setProblema(false)} />}
      </Modal>
    </Page>
  )
}
