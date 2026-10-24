import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Icon from '../ui/Icon'
import KeyValue from '../ui/KeyValue'
import Segmented from '../ui/Segmented'

const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Muito bom', 'Excelente']
const ESTADOS = ['Perfeito estado', 'Danificado', 'Incompleto']

/** Avaliação já enviada: estrelas, estado e comentário. */
export function AvaliacaoFeita({ avaliacao }) {
  return (
    <div className="stack-sm">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon key={n} name="star" size={28} color={n <= avaliacao.nota ? 'var(--amber)' : 'var(--line)'} />
        ))}
      </div>
      <KeyValue label="Estado da encomenda" value={avaliacao.estado} />
      {avaliacao.comentario && <p className="muted">“{avaliacao.comentario}”</p>}
    </div>
  )
}

/** Confirmação de recebimento + nota de 1 a 5 para o entregador. */
export default function Avaliacao({ entrega, onFechar }) {
  const { avaliarEntrega, toast } = useApp()
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [estado, setEstado] = useState(ESTADOS[0])
  const [comentario, setComentario] = useState('')

  const confirmar = async () => {
    if (!nota) {
      toast('Escolha de 1 a 5 estrelas.')
      return
    }
    const ok = await avaliarEntrega(entrega.id, { nota, estado, comentario })
    if (!ok) return
    if (estado !== 'Perfeito estado') toast('Registramos a ocorrência com a transportadora. A equipe entrará em contato.')
    onFechar?.()
  }

  return (
    <div className="stack">
      <div className="stack-sm" style={{ alignItems: 'center' }}>
        <strong>Como foi o serviço do entregador?</strong>
        <div className="stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setNota(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} estrela${n > 1 ? 's' : ''}`}>
              <Icon name="star" size={34} color={n <= (hover || nota) ? 'var(--pink)' : 'var(--purple)'} />
            </button>
          ))}
        </div>
        <span className="pink" style={{ fontWeight: 600, minHeight: 20 }}>
          {ROTULOS[hover || nota]}
        </span>
      </div>
      <Segmented options={ESTADOS} value={estado} onChange={setEstado} />
      <Field label="Comentário (opcional)" as="textarea" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Muito rápido e educado!" />
      <Button block onClick={confirmar}>
        Confirmar recebimento
      </Button>
    </div>
  )
}
