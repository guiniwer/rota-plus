import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import SearchInput from '../../components/ui/SearchInput'
import Segmented from '../../components/ui/Segmented'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useEntregasDoCliente } from '../../context/AppContext'
import { brl } from '../../utils/format'
import { data } from '../../utils/tempo'

const FILTROS = [
  { value: 'andamento', label: 'Em andamento' },
  { value: 'entregue', label: 'Entregues' },
  { value: 'todos', label: 'Todos' },
]
const POR_PAGINA = 10
const emAndamento = (e) => !['entregue', 'cancelado'].includes(e.status)

/** Lista de pedidos do cliente; cada linha abre a página do pedido. */
export default function Pedidos() {
  const entregas = useEntregasDoCliente()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState(() => (entregas.some(emAndamento) ? 'andamento' : 'todos'))
  const [pagina, setPagina] = useState(1)

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return entregas.filter((e) => {
      const passaBusca = !q || [e.id, e.origem, e.destino].some((t) => t.toLowerCase().includes(q))
      const passaFiltro = filtro === 'todos' || (filtro === 'andamento' ? emAndamento(e) : e.status === filtro)
      return passaBusca && passaFiltro
    })
  }, [entregas, busca, filtro])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const filtrar = (f) => {
    setFiltro(f)
    setPagina(1)
  }

  return (
    <Page title="Meus pedidos" actions={<Button icon="plus" onClick={() => navigate('/cliente/novo-pedido')}>Novo pedido</Button>}>
      <Card>
        <div className="row wrap">
          <SearchInput
            className="grow"
            value={busca}
            onChange={(v) => {
              setBusca(v)
              setPagina(1)
            }}
            placeholder="Buscar pelo código ou endereço…"
          />
          <Segmented options={FILTROS} value={filtro} onChange={filtrar} />
        </div>
        {visiveis.length ? (
          <DataTable
            rows={visiveis}
            onRowClick={(e) => navigate(`/cliente/pedidos/${e.id}`)}
            columns={[
              { key: 'id', label: 'Código', render: (e) => <strong>{e.id}</strong> },
              { key: 'rota', label: 'Origem → destino', render: (e) => `${e.origem} → ${e.destino}` },
              { key: 'criadoEm', label: 'Data', render: (e) => data(e.criadoEm) },
              { key: 'valor', label: 'Frete', render: (e) => brl(e.valor) },
              { key: 'status', label: 'Status', render: (e) => <EntregaBadge status={e.status} /> },
            ]}
          />
        ) : (
          <EmptyState icon="box" title={entregas.length ? 'Nenhum pedido encontrado' : 'Você ainda não fez pedidos'}>
            {entregas.length ? 'Ajuste a busca ou o filtro.' : <Button onClick={() => navigate('/cliente/novo-pedido')}>Fazer um pedido</Button>}
          </EmptyState>
        )}
        {totalPaginas > 1 && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
              <button key={n} className={`btn btn-sm ${n === pagina ? 'btn-violet' : 'btn-secondary'}`} onClick={() => setPagina(n)} aria-current={n === pagina}>
                {n}
              </button>
            ))}
          </div>
        )}
      </Card>
    </Page>
  )
}
