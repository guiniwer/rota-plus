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
import Comprovante from '../../components/entregas/Comprovante'
import ImportarCsv from '../../components/entregas/ImportarCsv'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { OPCOES_CIDADES } from '../../data/cidades'
import { EntregasApi } from '../../services/api'
import { brl } from '../../utils/format'
import { STATUS_ENTREGA } from '../../utils/status'
import { dataHora, previsaoTexto } from '../../utils/tempo'

const POR_PAGINA = 50
const ABAS = {
  todas: () => true,
  pendentes: (e) => ['confirmado', 'coletado'].includes(e.status),
  rota: (e) => ['transito', 'saiu', 'tentativa'].includes(e.status),
  atrasadas: (e) => e.atrasada,
  concluidas: (e) => e.status === 'entregue',
}
const NOVA = { cliente: '', destino: '', cidade: 'recife-pe', tipoCarga: 'Caixa', janela: '', telefone: '', email: '', valor: '', valorNF: '', instrucoes: '', entregadorId: '' }

/** Janelas de 2 h a partir da próxima hora cheia, até o fim do expediente. */
function janelasDoDia(fim = '22:00') {
  const limite = Number(fim.split(':')[0])
  const h0 = new Date().getHours() + 1
  return Array.from({ length: Math.max(0, limite - h0 - 1) }, (_, i) => {
    const h = h0 + i
    return `${String(h).padStart(2, '0')}:00–${String(h + 2).padStart(2, '0')}:00`
  })
}

function Avisar({ entrega, onFechar }) {
  const { executar, toast } = useApp()
  const [canal, setCanal] = useState(entrega.telefoneDestinatario ? 'whatsapp' : 'email')
  const [msg, setMsg] = useState(`Olá! Sua entrega ${entrega.id} está ${STATUS_ENTREGA[entrega.status].label.toLowerCase()}. Previsão: ${previsaoTexto(entrega)}.`)
  const enviar = async (e) => {
    e.preventDefault()
    const r = await executar(() => EntregasApi.avisar(entrega.id, canal, msg))
    if (!r) return
    if (r.status === 'link') window.open(r.link, '_blank', 'noopener')
    toast(r.status === 'link' ? 'WhatsApp aberto com a mensagem pronta.' : r.status === 'enviado' ? `E-mail enviado para ${r.para}.` : `Mensagem registrada na caixa de saída (e-mail não configurado no servidor).`)
    onFechar()
  }
  return (
    <form className="stack-sm" style={{ gap: 16 }} onSubmit={enviar}>
      <Segmented
        value={canal}
        onChange={setCanal}
        options={[
          { value: 'whatsapp', label: 'WhatsApp' },
          { value: 'email', label: 'E-mail' },
        ]}
      />
      <span className="small muted">Para: {canal === 'whatsapp' ? entrega.telefoneDestinatario ?? 'telefone do cliente cadastrado' : entrega.emailDestinatario ?? 'e-mail do cliente cadastrado'}</span>
      <Field label="Mensagem" as="textarea" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} />
      <Button type="submit" block icon="send">
        {canal === 'whatsapp' ? 'Abrir no WhatsApp' : 'Enviar e-mail'}
      </Button>
    </form>
  )
}

export default function Entregas() {
  const { entregas, entregadores, empresa, atribuirEntrega, atualizarStatusEntrega, criarPedido, toast } = useApp()
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState('todas')
  const [busca, setBusca] = useState(params.get('q') ?? '')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [modal, setModal] = useState(() => (params.get('importar') ? 'importar' : null)) // 'nova' | 'importar' | 'aviso' | 'comprovante'
  const [nova, setNova] = useState(NOVA)
  const opcoesEntregador = [{ value: '', label: 'Não atribuído' }, ...entregadores.map((p) => ({ value: String(p.id), label: p.nome }))]
  const selecionadaId = params.get('q')
  const selecionada = entregas.find((e) => e.id === selecionadaId)
  const janelas = janelasDoDia(empresa?.turnoFim)

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase()
    return entregas
      .filter((e) => ABAS[aba](e) && (!q || `${e.id} ${e.cliente} ${e.destino} ${e.responsavel ?? ''}`.toLowerCase().includes(q)))
      .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))
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
    const id = await criarPedido({
      cliente: nova.cliente,
      destinatario: nova.cliente,
      destino: nova.destino,
      destinoCidade: nova.cidade,
      tipoCarga: nova.tipoCarga,
      janela: nova.janela || undefined,
      telefoneDestinatario: nova.telefone || undefined,
      emailDestinatario: nova.email || undefined,
      valor: Number(nova.valor) || 0,
      valorNF: Number(nova.valorNF) || 0,
      instrucoes: nova.instrucoes || undefined,
      entregadorId: nova.entregadorId || null,
    })
    if (!id) return
    const quem = entregadores.find((p) => String(p.id) === nova.entregadorId)?.nome
    setModal(null)
    setNova(NOVA)
    setParams({ q: id })
    toast(quem ? `Entrega ${id} criada e atribuída a ${quem}.` : `Entrega ${id} criada. Atribua um entregador.`)
  }
  const set = (k) => (e) => setNova({ ...nova, [k]: e.target.value })

  return (
    <Page
      title="Entregas"
      subtitle="Gerencie, atribua e acompanhe todas as entregas da empresa"
      actions={
        <>
          <Button variant="secondary" icon="upload" onClick={() => setModal('importar')}>
            Importar CSV
          </Button>
          <Button icon="plus" onClick={() => setModal('nova')}>
            Nova entrega
          </Button>
        </>
      }
    >
      <Segmented options={opcoesAbas} value={aba} onChange={(a) => (setAba(a), setLimite(POR_PAGINA))} />
      <div className={selecionada ? 'grid-aside' : ''}>
        <Card>
          <SearchInput value={busca} onChange={(v) => (setBusca(v), setLimite(POR_PAGINA))} placeholder="Buscar por código, cliente, destino ou entregador…" />
          {filtradas.length ? (
            <DataTable
              rows={filtradas.slice(0, limite)}
              selectedKey={selecionadaId}
              onRowClick={(e) => setParams({ q: e.id })}
              columns={[
                { key: 'id', label: 'Código', render: (e) => (<span><strong>{e.id}</strong><span className="cell-sub">{dataHora(e.criadoEm)}</span></span>) },
                { key: 'cliente', label: 'Cliente / destino', render: (e) => (<span><strong>{e.cliente}</strong><span className="cell-sub">{e.destino}</span></span>) },
                { key: 'resp', label: 'Entregador', render: (e) => (e.responsavel ? <Person name={e.responsavel} /> : <span className="amber small">Não atribuído</span>) },
                { key: 'prazo', label: 'Prazo', render: (e) => <span className={e.atrasada ? 'red' : undefined}>{previsaoTexto(e)}</span> },
                { key: 'rastreio', label: 'Rastreio', render: (e) => (e.rastreio === 'gps' ? 'GPS' : 'CD') },
                { key: 'status', label: 'Status', render: (e) => <EntregaBadge status={e.status} /> },
              ]}
            />
          ) : (
            <EmptyState title="Nenhuma entrega neste filtro" />
          )}
          {filtradas.length > limite && (
            <Button variant="secondary" onClick={() => setLimite((l) => l + POR_PAGINA)}>
              Mostrar mais ({filtradas.length - limite} restantes)
            </Button>
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
            <KeyValue label="Prazo" value={`${previsaoTexto(selecionada)}${selecionada.janela ? ` · janela ${selecionada.janela}` : ''}`} />
            <KeyValue label="Contato" value={[selecionada.telefoneDestinatario, selecionada.emailDestinatario].filter(Boolean).join(' · ') || '—'} />
            <KeyValue label="Frete" value={brl(selecionada.valor)} />
            {selecionada.instrucoes && <KeyValue label="Instruções" value={selecionada.instrucoes} />}
            {selecionada.geoFonte === 'cidade' && <span className="small amber">Endereço localizado só pela cidade — a rota usa o centro da cidade.</span>}
            {selecionada.avaliacao && <KeyValue label="Avaliação do cliente" value={`${'★'.repeat(selecionada.avaliacao.nota)} ${selecionada.avaliacao.comentario ?? ''}`} />}
            {!['entregue', 'cancelado'].includes(selecionada.status) && (
              <>
                <Field
                  label="Entregador"
                  as="select"
                  value={selecionada.entregadorId ? String(selecionada.entregadorId) : ''}
                  onChange={async (e) => (await atribuirEntrega(selecionada.id, e.target.value)) && toast('Entregador atualizado — a entrega já aparece no app dele.')}
                  options={opcoesEntregador}
                />
                <Field
                  label="Atualizar status"
                  as="select"
                  value={selecionada.status}
                  onChange={async (e) => (await atualizarStatusEntrega(selecionada.id, e.target.value, 'Atualizado pela central')) && toast('Status atualizado e cliente notificado.')}
                  options={Object.entries(STATUS_ENTREGA).map(([value, s]) => ({ value, label: s.label }))}
                />
              </>
            )}
            <div className="row wrap">
              <Button variant="secondary" icon="send" onClick={() => setModal('aviso')}>
                Avisar cliente
              </Button>
              {selecionada.comprovante && (
                <Button variant="secondary" icon="check" onClick={() => setModal('comprovante')}>
                  Ver comprovante
                </Button>
              )}
            </div>
            <Timeline items={selecionada.eventos} />
          </Card>
        )}
      </div>

      <Modal title="Importar entregas de planilha (CSV)" open={modal === 'importar'} onClose={() => setModal(null)} wide>
        {modal === 'importar' && <ImportarCsv />}
      </Modal>
      <Modal title="Nova entrega" open={modal === 'nova'} onClose={() => setModal(null)}>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={criar}>
          <Field label="Cliente / destinatário" value={nova.cliente} onChange={set('cliente')} required />
          <div className="grid-form">
            <Field label="Endereço de destino" value={nova.destino} onChange={set('destino')} placeholder="Rua, número, bairro" required />
            <Field label="Cidade" as="select" value={nova.cidade} onChange={set('cidade')} options={OPCOES_CIDADES} />
            <Field label="Telefone (WhatsApp)" type="tel" value={nova.telefone} onChange={set('telefone')} />
            <Field label="E-mail do destinatário" type="email" value={nova.email} onChange={set('email')} />
            <Field label="Tipo de carga" as="select" value={nova.tipoCarga} onChange={set('tipoCarga')} options={['Caixa', 'Documentos', 'Palete', 'Contêiner', 'Volumes']} />
            <Field label="Janela de hoje" as="select" value={nova.janela} onChange={set('janela')} options={[{ value: '', label: 'Próximo dia útil, até 18:00' }, ...janelas]} />
            <Field label="Frete (R$)" type="number" min="0" step="0.01" value={nova.valor} onChange={set('valor')} />
            <Field label="Valor da NF (R$)" type="number" min="0" step="0.01" value={nova.valorNF} onChange={set('valorNF')} />
          </div>
          <Field label="Instruções de entrega" value={nova.instrucoes} onChange={set('instrucoes')} placeholder="Ex.: portaria, falar com Sr. João" />
          <Field label="Entregador" as="select" value={nova.entregadorId} onChange={set('entregadorId')} options={opcoesEntregador} />
          <p className="small muted">O endereço é localizado no mapa (OpenStreetMap) para a rota e o ETA. Com telefone ou e-mail, o destinatário recebe os avisos.</p>
          <Button type="submit" block>
            Criar entrega
          </Button>
        </form>
      </Modal>
      <Modal title={selecionada ? `Avisar cliente · ${selecionada.id}` : ''} open={modal === 'aviso' && Boolean(selecionada)} onClose={() => setModal(null)}>
        {selecionada && <Avisar entrega={selecionada} onFechar={() => setModal(null)} />}
      </Modal>
      <Modal title={selecionada ? `Comprovante · ${selecionada.id}` : ''} open={modal === 'comprovante' && Boolean(selecionada)} onClose={() => setModal(null)}>
        {selecionada && <Comprovante entregaId={selecionada.id} />}
      </Modal>
    </Page>
  )
}
