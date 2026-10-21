import { useState } from 'react'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import Segmented from '../../components/ui/Segmented'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'

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
  const confirmar = () => {
    if (!nota) {
      toast('Escolha de 1 a 5 estrelas.')
      return
    }
    avaliarEntrega(entrega.id, { nota, estado, comentario })
    if (estado !== 'Perfeito estado') toast('Registramos a ocorrência. Nossa equipe entrará em contato.')
  }

  return (
    <Page title="Confirmar entrega" subtitle="Avalie como foi sua experiência" actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/avaliar" />}>
      <div className="grid-aside">
        <Card title="Comprovante de recebimento" action={<EntregaBadge status={entrega.status} />}>
          <div className="photo-drop" style={{ height: 260, cursor: 'default' }}>
            <Icon name="camera" size={48} color="var(--purple)" />
            <span>Foto registrada pelo entregador</span>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="stack-sm">
              <KeyValue label="Pedido" value={entrega.id} />
              <KeyValue label="Recebido por" value={entrega.destinatario} />
            </div>
            <div className="stack-sm">
              <KeyValue label="Data e hora" value={entrega.eventos[0]?.data} />
              <KeyValue label="Entregador" value={entrega.responsavel ?? '—'} />
            </div>
          </div>
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
              <Button variant="outline" onClick={() => toast('Chamado de problema aberto.')}>
                Reportar problema
              </Button>
              <Button onClick={confirmar}>Confirmar recebimento</Button>
            </div>
          </div>
        )}
      </div>
    </Page>
  )
}
