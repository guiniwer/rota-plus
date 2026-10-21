import { useNavigate } from 'react-router-dom'

/** Seletor de entrega usado nas telas de acompanhamento do cliente. */
export default function EntregaSelector({ entregas, selecionada, basePath }) {
  const navigate = useNavigate()
  if (entregas.length < 2) return null
  return (
    <select className="select" style={{ width: 'auto', minWidth: 220 }} value={selecionada?.id} onChange={(e) => navigate(`${basePath}/${e.target.value}`)} aria-label="Escolher entrega">
      {entregas.map((e) => (
        <option key={e.id} value={e.id}>
          {e.id} — {e.destino.split('—')[0].trim()}
        </option>
      ))}
    </select>
  )
}
