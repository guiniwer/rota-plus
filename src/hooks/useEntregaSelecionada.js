import { useParams } from 'react-router-dom'
import { useEntregasDoCliente } from '../context/AppContext'

/** Lê o :id da URL; sem id, usa a primeira entrega do cliente que passa no filtro. */
export default function useEntregaSelecionada(filtro = () => true) {
  const { id } = useParams()
  const lista = useEntregasDoCliente().filter(filtro)
  const entrega = lista.find((e) => e.id === id) ?? lista[0] ?? null
  return { entrega, lista }
}
