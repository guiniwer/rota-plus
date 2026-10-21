import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KpiCard from '../../components/ui/KpiCard'
import Modal from '../../components/ui/Modal'
import Person from '../../components/ui/Person'
import SearchInput from '../../components/ui/SearchInput'
import Segmented from '../../components/ui/Segmented'
import { AtivoBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { COR_STATUS_ATIVO } from '../../utils/ativos'
import { STATUS_ATIVO, TIPO_ATIVO_ICON } from '../../utils/status'

const TIPOS = ['Todos', 'Veículo', 'Equipamento', 'Ferramenta', 'Mercadoria']
const NOVO = { nome: '', tipo: 'Equipamento', identificacao: 'QR', local: 'Almoxarifado CD', valor: '' }

export default function Ativos() {
  const { ativos, cadastrarAtivo, toast } = useApp()
  const navigate = useNavigate()
  const [tipo, setTipo] = useState('Todos')
  const [status, setStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [novo, setNovo] = useState(NOVO)

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase()
    return ativos.filter(
      (a) =>
        (tipo === 'Todos' || a.tipo === tipo) &&
        (status === 'todos' || a.status === status) &&
        (!q || `${a.id} ${a.nome} ${a.responsavel ?? ''} ${a.local}`.toLowerCase().includes(q)),
    )
  }, [ativos, tipo, status, busca])

  const cadastrar = async (e) => {
    e.preventDefault()
    const id = await cadastrarAtivo(novo)
    if (!id) return
    setModal(false)
    setNovo(NOVO)
    toast(`Ativo ${id} cadastrado. Etiqueta pronta para impressão.`)
    navigate(`/empresa/ativos/${id}`)
  }

  const perdidos = ativos.filter((a) => ['extraviado', 'sem_sinal'].includes(a.status)).length

  return (
    <Page
      title="Ativos"
      subtitle="Equipamentos, ferramentas, veículos e mercadorias rastreados"
      actions={
        <>
          <Button variant="secondary" icon="qr" onClick={() => window.print()}>
            Imprimir etiquetas
          </Button>
          <Button icon="plus" onClick={() => setModal(true)}>
            Cadastrar ativo
          </Button>
        </>
      }
    >
      <div className="grid-4">
        <KpiCard label="Total de ativos" value={ativos.length} delta={`QR ${ativos.filter((a) => a.identificacao === 'QR').length} · RFID ${ativos.filter((a) => a.identificacao === 'RFID').length} · GPS ${ativos.filter((a) => a.identificacao === 'GPS').length}`} deltaColor="var(--muted)" />
        <KpiCard label="Em uso" value={ativos.filter((a) => a.status === 'em_uso').length} delta="alocados em campo" />
        <KpiCard label="Disponíveis" value={ativos.filter((a) => a.status === 'disponivel').length} delta="prontos para alocação" deltaColor="var(--muted)" />
        <KpiCard label="Extraviados / sem sinal" value={perdidos} delta="exigem ação" deltaColor={perdidos ? 'var(--red)' : 'var(--green)'} />
      </div>
      <Card>
        <div className="row wrap">
          <Segmented options={TIPOS} value={tipo} onChange={setTipo} />
          <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
            <option value="todos">Status: todos</option>
            {Object.entries(STATUS_ATIVO).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
          <SearchInput className="grow" value={busca} onChange={setBusca} placeholder="Buscar por nome, ID, responsável ou local…" />
        </div>
        {filtrados.length ? (
          <DataTable
            rows={filtrados}
            onRowClick={(a) => navigate(`/empresa/ativos/${a.id}`)}
            columns={[
              {
                key: 'nome',
                label: 'Ativo',
                render: (a) => (
                  <span className="row" style={{ gap: 10 }}>
                    <span className="icon-chip" style={{ width: 32, height: 32, background: `${COR_STATUS_ATIVO[a.status]}29` }}>
                      <Icon name={TIPO_ATIVO_ICON[a.tipo] ?? 'box'} size={16} color={COR_STATUS_ATIVO[a.status]} />
                    </span>
                    <span>
                      <strong>{a.nome}</strong>
                      <span className="cell-sub">{a.id}</span>
                    </span>
                  </span>
                ),
              },
              { key: 'tipo', label: 'Tipo' },
              { key: 'identificacao', label: 'ID / sinal', render: (a) => (a.bateria != null ? `${a.identificacao} · ${a.bateria}%` : a.identificacao) },
              { key: 'resp', label: 'Responsável', render: (a) => <Person name={a.responsavel} /> },
              { key: 'local', label: 'Localização' },
              { key: 'ultimaLeitura', label: 'Última leitura' },
              { key: 'status', label: 'Status', render: (a) => <AtivoBadge status={a.status} /> },
            ]}
          />
        ) : (
          <EmptyState title="Nenhum ativo encontrado" />
        )}
      </Card>

      <Modal title="Cadastrar ativo" open={modal} onClose={() => setModal(false)}>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={cadastrar}>
          <Field label="Nome do ativo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Betoneira 400 L" required />
          <div className="grid-form">
            <Field label="Tipo" as="select" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} options={TIPOS.slice(1)} />
            <Field label="Identificação" as="select" value={novo.identificacao} onChange={(e) => setNovo({ ...novo, identificacao: e.target.value })} options={['QR', 'RFID', 'GPS']} />
            <Field label="Local inicial" value={novo.local} onChange={(e) => setNovo({ ...novo, local: e.target.value })} />
            <Field label="Valor (R$)" type="number" min="0" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} />
          </div>
          <p className="small muted">Dica: use QR Code para itens de menor valor e GPS para veículos e equipamentos caros.</p>
          <Button type="submit" block>
            Cadastrar
          </Button>
        </form>
      </Modal>
    </Page>
  )
}
