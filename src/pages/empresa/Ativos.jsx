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
import QrCode from '../../components/ui/QrCode'
import SearchInput from '../../components/ui/SearchInput'
import Segmented from '../../components/ui/Segmented'
import { AtivoBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { CATEGORIAS_ATIVO, COR_STATUS_ATIVO, SUGESTOES_TIPO_ATIVO } from '../../utils/ativos'
import { STATUS_ATIVO, TIPO_ATIVO_ICON } from '../../utils/status'
import { relativo } from '../../utils/tempo'

const POR_PAGINA = 100

const FILTROS = ['Todos', ...CATEGORIAS_ATIVO]
// cargas entram sozinhas (cada entrega vira um ativo); aqui só se cadastram os bens da empresa
const CATEGORIAS_CADASTRO = CATEGORIAS_ATIVO.filter((c) => c !== 'Carga')
const NOVO = { nome: '', tipo: 'Equipamento', identificacao: 'QR', local: '', valor: '' }

export default function Ativos() {
  const { ativos, cadastrarAtivo, toast } = useApp()
  const navigate = useNavigate()
  const [tipo, setTipo] = useState('Todos')
  const [status, setStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [novo, setNovo] = useState(NOVO)
  const [limite, setLimite] = useState(POR_PAGINA)
  const [etiquetas, setEtiquetas] = useState(false)

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase()
    return ativos.filter(
      (a) =>
        (tipo === 'Todos' || a.tipo === tipo) &&
        (status === 'todos' || a.status === status) &&
        (!q || `${a.id} ${a.nome} ${a.tipo} ${a.entregaId ?? ''} ${a.responsavel ?? ''} ${a.local}`.toLowerCase().includes(q)),
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
  const cargas = ativos.filter((a) => a.tipo === 'Carga')
  // etiquetas: os itens filtrados (sem as cargas, que usam a etiqueta da entrega)
  const paraEtiquetar = filtrados.filter((a) => a.tipo !== 'Carga')

  return (
    <Page
      title="Ativos"
      subtitle="Veículos, equipamentos, ferramentas e todas as cargas das entregas"
      actions={
        <>
          <Button variant="secondary" icon="qr" onClick={() => setEtiquetas(true)}>
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
        <KpiCard label="Cargas em entrega" value={cargas.filter((a) => a.status === 'em_uso').length} delta={`${cargas.length} cargas registradas`} deltaColor="var(--muted)" />
        <KpiCard label="Disponíveis" value={ativos.filter((a) => a.status === 'disponivel').length} delta="prontos para alocação" deltaColor="var(--muted)" />
        <KpiCard label="Extraviados / sem sinal" value={perdidos} delta="exigem ação" deltaColor={perdidos ? 'var(--red)' : 'var(--green)'} />
      </div>
      <Card>
        <div className="row wrap">
          <Segmented options={FILTROS} value={tipo} onChange={setTipo} />
          <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
            <option value="todos">Status: todos</option>
            {Object.entries(STATUS_ATIVO).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
          <SearchInput className="grow" value={busca} onChange={setBusca} placeholder="Buscar por tipo, ID, entrega, responsável ou local…" />
        </div>
        {filtrados.length ? (
          <DataTable
            rows={filtrados.slice(0, limite)}
            onRowClick={(a) => navigate(`/empresa/ativos/${a.id}`)}
            columns={[
              {
                key: 'nome',
                label: 'Tipo de ativo',
                render: (a) => (
                  <span className="row" style={{ gap: 10 }}>
                    <span className="icon-chip" style={{ width: 32, height: 32, background: `${COR_STATUS_ATIVO[a.status]}29` }}>
                      <Icon name={TIPO_ATIVO_ICON[a.tipo] ?? 'box'} size={16} color={COR_STATUS_ATIVO[a.status]} />
                    </span>
                    <span>
                      <strong>{a.nome}</strong>
                      <span className="cell-sub">{a.entregaId ? `${a.id} · entrega ${a.entregaId}` : a.id}</span>
                    </span>
                  </span>
                ),
              },
              { key: 'tipo', label: 'Categoria' },
              { key: 'identificacao', label: 'ID / sinal', render: (a) => (a.bateria != null ? `${a.identificacao} · ${a.bateria}%` : a.identificacao) },
              { key: 'resp', label: 'Responsável', render: (a) => <Person name={a.responsavel} /> },
              { key: 'local', label: 'Localização' },
              { key: 'ultimaLeitura', label: 'Última leitura', render: (a) => relativo(a.ultimaLeituraEm) },
              { key: 'status', label: 'Status', render: (a) => <AtivoBadge status={a.status} /> },
            ]}
          />
        ) : (
          <EmptyState title="Nenhum ativo encontrado" />
        )}
        {filtrados.length > limite && (
          <Button variant="secondary" onClick={() => setLimite((l) => l + POR_PAGINA)}>
            Mostrar mais ({filtrados.length - limite} restantes)
          </Button>
        )}
      </Card>

      <Modal title={`Etiquetas QR · ${paraEtiquetar.length} ativo(s)`} wide open={etiquetas} onClose={() => setEtiquetas(false)}>
        <p className="small muted">Os itens seguem os filtros da lista. Imprima em papel adesivo; a tela Escanear lê estes códigos pela câmera.</p>
        <div className="etiquetas">
          {paraEtiquetar.map((a) => (
            <div key={a.id} className="etiqueta">
              <QrCode value={a.id} size={96} />
              <div>
                <strong>{a.id}</strong>
                <span>{a.nome}</span>
              </div>
            </div>
          ))}
        </div>
        <Button icon="download" onClick={() => window.print()} disabled={!paraEtiquetar.length}>
          Imprimir
        </Button>
      </Modal>

      <Modal title="Cadastrar ativo" open={modal} onClose={() => setModal(false)}>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={cadastrar}>
          <div className="grid-form">
            <Field label="Categoria" as="select" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value, nome: '' })} options={CATEGORIAS_CADASTRO} />
            <Field label="Tipo de ativo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} list="sugestoes-tipo" placeholder={`Ex.: ${SUGESTOES_TIPO_ATIVO[novo.tipo][0]}`} required />
            <datalist id="sugestoes-tipo">
              {SUGESTOES_TIPO_ATIVO[novo.tipo].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Field label="Identificação" as="select" value={novo.identificacao} onChange={(e) => setNovo({ ...novo, identificacao: e.target.value })} options={['QR', 'RFID', 'GPS']} />
            <Field label="Local inicial" value={novo.local} onChange={(e) => setNovo({ ...novo, local: e.target.value })} placeholder="Vazio = base da empresa" />
            <Field label="Valor (R$)" type="number" min="0" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} />
          </div>
          <p className="small muted">
            Cadastre pelo tipo genérico (ex.: “Gerador de energia”), sem marca ou modelo. As cargas das entregas entram automaticamente. Para GPS, gere o token do rastreador na ficha do ativo
            depois de cadastrar.
          </p>
          <Button type="submit" block>
            Cadastrar
          </Button>
        </form>
      </Modal>
    </Page>
  )
}
