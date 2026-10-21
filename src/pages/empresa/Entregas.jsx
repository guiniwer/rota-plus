import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import KeyValue from '../../components/ui/KeyValue'
import Modal from '../../components/ui/Modal'
import Person from '../../components/ui/Person'
import SearchInput from '../../components/ui/SearchInput'
import Segmented from '../../components/ui/Segmented'
import Timeline from '../../components/ui/Timeline'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { RESPONSAVEIS } from '../../utils/ativos'
import { brl } from '../../utils/format'
import { STATUS_ENTREGA } from '../../utils/status'

const ABAS = {
  todas: () => true,
  pendentes: (e) => ['confirmado', 'coletado'].includes(e.status),
  rota: (e) => ['transito', 'saiu'].includes(e.status),
  atrasadas: (e) => e.status === 'atrasado',
  concluidas: (e) => e.status === 'entregue',
}

export default function Entregas() {
  const { entregas, atribuirEntrega, atualizarStatusEntrega, criarPedido, toast } = useApp()
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState('todas')
  const [busca, setBusca] = useState(params.get('q') ?? '')
  const [novaAberta, setNovaAberta] = useState(false)
  const [nova, setNova] = useState({ cliente: '', destino: '', janela: '14:00–15:00', responsavel: RESPONSAVEIS[0] })
  const selecionadaId = params.get('q')
  const selecionada = entregas.find((e) => e.id === selecionadaId)

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return entregas.filter((e) => ABAS[aba](e) && (!q || `${e.id} ${e.cliente} ${e.destino} ${e.responsavel ?? ''}`.toLowerCase().includes(q)))
  }, [entregas, aba, busca])

  const contar = (k) => entregas.filter(ABAS[k]).length
  const opcoesAbas = [
    { value: 'todas', label: `Todas ${contar('todas')}` },
    { value: 'pendentes', label: `Pendentes ${contar('pendentes')}` },
    { value: 'rota', label: `Em rota ${contar('rota')}` },
    { value: 'atrasadas', label: `Atrasadas ${contar('atrasadas')}` },
    { value: 'concluidas', label: `Concluídas ${contar('concluidas')}` },
  ]

  const criar = async (e) => {
    e.preventDefault()
    const id = await criarPedido({ cliente: nova.cliente, remetente: 'LogiSuape', destinatario: nova.cliente, origem: 'CD Recife', destino: nova.destino, tipoCarga: 'Volumes', pesoTaxado: 10, modalidade: 'normal', rastreio: 'gps', valor: 90, prazoTexto: `Hoje, ${nova.janela}`, janela: nova.janela, responsavel: nova.responsavel, criadoEm: 'Hoje' })
    if (!id) return
    setNovaAberta(false)
    setNova({ cliente: '', destino: '', janela: '14:00–15:00', responsavel: RESPONSAVEIS[0] })
    toast(`Entrega ${id} criada e atribuída a ${nova.responsavel}.`)
  }

  return (
    <Page
      title="Entregas"
      subtitle="Gerencie, atribua e acompanhe todas as entregas"
      actions={
        <>
          <Button variant="secondary" icon="upload" onClick={() => toast('Importação via CSV/ERP: envie a planilha em Configurações › Integrações.')}>
            Importar
          </Button>
          <Button icon="plus" onClick={() => setNovaAberta(true)}>
            Nova entrega
          </Button>
        </>
      }
    >
      <Segmented options={opcoesAbas} value={aba} onChange={setAba} />
      <div className={selecionada ? 'grid-aside' : ''}>
        <Card>
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por código, cliente, destino ou responsável…" />
          {filtradas.length ? (
            <DataTable
              rows={filtradas}
              selectedKey={selecionadaId}
              onRowClick={(e) => setParams({ q: e.id })}
              columns={[
                { key: 'id', label: 'Código', render: (e) => <strong>{e.id}</strong> },
                {
                  key: 'cliente',
                  label: 'Cliente / destino',
                  render: (e) => (
                    <span>
                      <strong>{e.cliente}</strong>
                      <span className="cell-sub">{e.destino}</span>
                    </span>
                  ),
                },
                { key: 'resp', label: 'Responsável', render: (e) => <Person name={e.responsavel} /> },
                { key: 'janela', label: 'Janela' },
                { key: 'rastreio', label: 'Rastreio', render: (e) => (e.rastreio === 'gps' ? 'GPS' : 'CD') },
                { key: 'status', label: 'Status', render: (e) => <EntregaBadge status={e.status} /> },
              ]}
            />
          ) : (
            <EmptyState title="Nenhuma entrega neste filtro" />
          )}
        </Card>

        {selecionada && (
          <Card
            title={selecionada.id}
            action={
              <button className="icon-button" onClick={() => setParams({})} aria-label="Fechar detalhe">
                ✕
              </button>
            }
          >
            <EntregaBadge status={selecionada.status} />
            <KeyValue label="Cliente" value={selecionada.cliente} />
            <KeyValue label="Destino" value={selecionada.destino} />
            <KeyValue label="Janela" value={selecionada.janela} />
            <KeyValue label="Valor" value={brl(selecionada.valor)} />
            <Field label="Responsável" as="select" value={selecionada.responsavel ?? ''} onChange={(e) => (atribuirEntrega(selecionada.id, e.target.value), toast('Responsável atualizado.'))} options={[{ value: '', label: 'Não atribuído' }, ...RESPONSAVEIS]} />
            <Field
              label="Atualizar status"
              as="select"
              value={selecionada.status}
              onChange={(e) => (atualizarStatusEntrega(selecionada.id, e.target.value, 'Atualizado pela central'), toast('Status atualizado e cliente notificado.'))}
              options={Object.entries(STATUS_ENTREGA).map(([value, s]) => ({ value, label: s.label }))}
            />
            <Button variant="secondary" icon="send" onClick={() => toast(`Cliente avisado por WhatsApp e e-mail sobre ${selecionada.id}.`)}>
              Avisar cliente
            </Button>
            <Timeline items={selecionada.eventos} />
          </Card>
        )}
      </div>

      <Modal title="Nova entrega" open={novaAberta} onClose={() => setNovaAberta(false)}>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={criar}>
          <Field label="Cliente" value={nova.cliente} onChange={(e) => setNova({ ...nova, cliente: e.target.value })} required />
          <Field label="Endereço de destino" value={nova.destino} onChange={(e) => setNova({ ...nova, destino: e.target.value })} required />
          <div className="grid-form">
            <Field label="Janela" as="select" value={nova.janela} onChange={(e) => setNova({ ...nova, janela: e.target.value })} options={['08:00–09:00', '10:00–11:00', '14:00–15:00', '16:00–17:00']} />
            <Field label="Responsável" as="select" value={nova.responsavel} onChange={(e) => setNova({ ...nova, responsavel: e.target.value })} options={RESPONSAVEIS} />
          </div>
          <Button type="submit" block>
            Criar entrega
          </Button>
        </form>
      </Modal>
    </Page>
  )
}
