import { Navigate, useParams } from 'react-router-dom'

/** Leva os endereços antigos (/cliente/status/:id, /acompanhar, /previsao, /avaliar, /historico) para a página do pedido. */
export default function RedirecionarPedido({ avaliar }) {
  const { id } = useParams()
  if (!id) return <Navigate to="/cliente/pedidos" replace />
  return <Navigate to={`/cliente/pedidos/${id}${avaliar ? '?avaliar=1' : ''}`} replace />
}
