import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import KpiCard from '../../components/ui/KpiCard'
import SearchInput from '../../components/ui/SearchInput'
import Segmented from '../../components/ui/Segmented'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp, useEntregasDoCliente } from '../../context/AppContext'
import { brl } from '../../utils/format'

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'entregue', label: 'Entregues' },
  { value: 'andamento', label: 'Em andamento' },
  { value: 'cancelado', label: 'Cancelados' },
]
const POR_PAGINA = 5

export default function Historico() {
  const entregas = useEntregasDoCliente()
  const { toast } = useApp()
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [pagina, setPagina] = useState(1)

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return entregas.filter((e) => {
      const passaBusca = !q || e.id.toLowerCase().includes(q) || e.destino.toLowerCase().includes(q) || e.origem.toLowerCase().includes(q)
      const passaFiltro =
        filtro === 'todos' || (filtro === 'andamento' ? !['entregue', 'cancelado'].includes(e.status) : e.status === filtro)
      return passaBusca && passaFiltro
    })
  }, [entregas, busca, filtro])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const entregues = entregas.filter((e) => e.status === 'entregue').length
  const gasto = entregas.filter((e) => e.status !== 'cancelado').reduce((s, e) => s + e.valor, 0)
  const avaliacoes = entregas.filter((e) => e.avaliacao)
  const media = avaliacoes.length ? avaliacoes.reduce((s, e) => s + e.avaliacao.nota, 0) / avaliacoes.length : 0

  const mudarFiltro = (f) => {
    setFiltro(f)
    setPagina(1)
  }

  const exportar = () => {
    const linhas = [['Código', 'Origem', 'Destino', 'Data', 'Valor', 'Status'], ...filtradas.map((e) => [e.id, e.origem, e.destino, e.criadoEm, e.valor.toFixed(2), e.status])]
    const csv = linhas.map((l) => l.map((c) => `"${c}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'historico-rota-plus.csv' })
    a.click()
    URL.revokeObjectURL(url)
    toast('Histórico exportado em CSV.')
  }

  return (
    <Page title="Histórico" subtitle="Acompanhe suas entregas anteriores">
      <div className="grid-4">
        <KpiCard label="Envios" value={entregas.length} delta="desde a criação da conta" deltaColor="var(--muted)" />
        <KpiCard label="Entregues" value={entregues} delta={`${Math.round((entregues / Math.max(1, entregas.length)) * 100)}% do total`} />
        <KpiCard label="Total gasto" value={brl(gasto)} delta="fretes não cancelados" deltaColor="var(--muted)" />
        <KpiCard label="Avaliação média dada" value={media ? `${media.toFixed(1)} ★` : '—'} delta={`${avaliacoes.length} avaliações`} deltaColor="var(--muted)" />
      </div>
      <Card>
        <div className="row wrap">
          <SearchInput className="grow" value={busca} onChange={(v) => (setBusca(v), setPagina(1))} placeholder="Buscar pelo código ou destino…" />
          <Segmented options={FILTROS} value={filtro} onChange={mudarFiltro} />
          <Button variant="secondary" icon="download" onClick={exportar}>
            Exportar
          </Button>
        </div>
        {visiveis.length ? (
          <DataTable
            rows={visiveis}
            onRowClick={(e) => navigate(`/cliente/status/${e.id}`)}
            columns={[
              { key: 'id', label: 'Código', render: (e) => <strong>{e.id}</strong> },
              { key: 'rota', label: 'Origem → destino', render: (e) => `${e.origem} → ${e.destino}` },
              { key: 'criadoEm', label: 'Data' },
              { key: 'mod', label: 'Modalidade', render: (e) => `${e.modalidade === 'expressa' ? 'Expressa' : 'Normal'} · ${e.rastreio === 'gps' ? 'GPS' : 'CD'}` },
              { key: 'valor', label: 'Valor', render: (e) => brl(e.valor) },
              { key: 'status', label: 'Status', render: (e) => <EntregaBadge status={e.status} /> },
            ]}
          />
        ) : (
          <EmptyState title="Nenhuma entrega encontrada">Ajuste a busca ou o filtro.</EmptyState>
        )}
        <div className="row-between wrap">
          <span className="small muted">
            Mostrando {visiveis.length} de {filtradas.length} envios
          </span>
          <div className="row">
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
              <button key={n} className={`btn btn-sm ${n === pagina ? 'btn-violet' : 'btn-secondary'}`} onClick={() => setPagina(n)} aria-current={n === pagina}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </Page>
  )
}
