import { useCallback, useEffect, useState } from 'react'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import KpiCard from '../../components/ui/KpiCard'
import LabeledBar from '../../components/ui/LabeledBar'
import Modal from '../../components/ui/Modal'
import Person from '../../components/ui/Person'
import ProgressBar from '../../components/ui/ProgressBar'
import SearchInput from '../../components/ui/SearchInput'
import Toggle from '../../components/ui/Toggle'
import RotaOtimizada from '../../components/entregas/RotaOtimizada'
import { useApp, useEventos } from '../../context/AppContext'
import { EquipeApi } from '../../services/api'
import { maskDocumento, pct } from '../../utils/format'
import { relativo } from '../../utils/tempo'

const TOM = { 'Em rota': 'pink', Disponível: 'success', 'Sem sinal': 'warning', 'Fora do turno': 'neutral' }
const VEICULOS = ['Moto', 'Carro', 'Van', 'Caminhão', 'Bicicleta']
const cor = (n) => (n == null ? 'var(--line)' : n >= 90 ? 'var(--green)' : n >= 75 ? 'var(--amber)' : 'var(--red)')

function Convites({ onFechar }) {
  const { usuario, executar, toast } = useApp()
  const [email, setEmail] = useState('')
  const [lista, setLista] = useState([])
  const [link, setLink] = useState(null)
  const carregar = useCallback(() => EquipeApi.convites().then(setLista).catch(() => {}), [])
  useEffect(() => {
    carregar()
  }, [carregar])

  const convidar = async (e) => {
    e.preventDefault()
    const r = await executar(() => EquipeApi.convidar(email))
    if (!r) return
    setLink(r.link)
    setEmail('')
    carregar()
    toast(r.email === 'enviado' ? 'Convite enviado por e-mail.' : 'Convite criado. Copie o link e envie ao colaborador.')
  }
  const cancelar = async (token) => {
    await executar(() => EquipeApi.cancelarConvite(token))
    carregar()
  }

  return (
    <div className="stack-sm" style={{ gap: 16 }}>
      <form className="stack-sm" onSubmit={convidar}>
        <Field label="E-mail do colaborador (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="Sem e-mail, o convite gera só o link para você enviar por WhatsApp." />
        <Button type="submit" block>
          Gerar convite
        </Button>
      </form>
      {link && (
        <div className="stack-sm">
          <span className="label">Link de cadastro (válido até ser usado)</span>
          <code className="codigo">{link}</code>
          <div className="row">
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(link).then(() => toast('Link copiado.'))}>
              Copiar link
            </Button>
            <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`Crie seu acesso de entregador no Rota+: ${link}`)}`} target="_blank" rel="noreferrer">
              Enviar por WhatsApp
            </a>
          </div>
        </div>
      )}
      <p className="small muted">
        O colaborador também pode se cadastrar escolhendo <strong>Empresa › Entregador</strong> e informando o CNPJ {usuario?.cnpj ? maskDocumento(usuario.cnpj) : 'da empresa'}.
      </p>
      {lista.length > 0 && (
        <>
          <span className="label">Convites pendentes</span>
          {lista.map((c) => (
            <div key={c.token} className="row-between small">
              <span>
                {c.email ?? 'Link sem e-mail'} <span className="grey">· {relativo(c.criadoEm)}</span>
              </span>
              <button className="link" onClick={() => cancelar(c.token)}>
                Cancelar
              </button>
            </div>
          ))}
        </>
      )}
      <Button variant="secondary" onClick={onFechar}>
        Fechar
      </Button>
    </div>
  )
}

function EditarEntregador({ pessoa, onFechar }) {
  const { executar, toast } = useApp()
  const [base, setBase] = useState(pessoa.baseEndereco ?? '')
  const [veiculo, setVeiculo] = useState(pessoa.veiculo ?? VEICULOS[0])
  const salvar = async (e) => {
    e.preventDefault()
    const ok = await executar(() => EquipeApi.definirBase(pessoa.id, { base, veiculo }))
    if (!ok) return
    toast('Dados do entregador atualizados.')
    onFechar()
  }
  return (
    <form className="stack-sm" style={{ gap: 16 }} onSubmit={salvar}>
      <Field label="Base de saída (endereço)" value={base} onChange={(e) => setBase(e.target.value)} hint="Vazio = base da empresa. Com GPS recente, a rota parte da posição atual." />
      <Field label="Veículo" as="select" value={veiculo} onChange={(e) => setVeiculo(e.target.value)} options={VEICULOS} />
      <Button type="submit" block>
        Salvar
      </Button>
    </form>
  )
}

export default function Equipes() {
  const { equipe, privacidade, setPrivacidade, executar, toast } = useApp()
  const [rotaDe, setRotaDe] = useState(null)
  const [editando, setEditando] = useState(null)
  const [busca, setBusca] = useState('')
  const [convite, setConvite] = useState(false)
  const [adesao, setAdesao] = useState(null)
  const carregarAdesao = useCallback(() => EquipeApi.adesao().then(setAdesao).catch(() => {}), [])
  useEffect(() => {
    carregarAdesao()
  }, [carregarAdesao])
  useEventos(['entregas', 'ativos'], carregarAdesao)

  const lista = equipe.filter((p) => `${p.nome} ${p.base} ${p.veiculo}`.toLowerCase().includes(busca.toLowerCase()))
  const bases = new Set(equipe.map((p) => p.base)).size
  const alternar = (k) => (v) => setPrivacidade((p) => ({ ...p, [k]: v }))
  const lembrete = async () => {
    const r = await executar(() => EquipeApi.lembrete())
    if (r) toast(`Lembrete enviado para ${r.enviados} colaborador(es).`)
  }

  return (
    <Page
      title="Equipes de campo"
      subtitle="Entregadores cadastrados, desempenho nos últimos 30 dias e adesão ao registro no app"
      actions={
        <Button icon="plus" onClick={() => setConvite(true)}>
          Convidar colaborador
        </Button>
      }
    >
      <div className="grid-4">
        <KpiCard label="Entregadores" value={equipe.length} delta={`${bases} base(s)`} deltaColor="var(--muted)" />
        <KpiCard label="Em rota agora" value={equipe.filter((p) => p.status === 'Em rota').length} delta="com GPS ativo" />
        <KpiCard label="Disponíveis" value={equipe.filter((p) => p.status === 'Disponível').length} delta="sem entregas em rota" deltaColor="var(--muted)" />
        <KpiCard label="Em rota sem sinal" value={equipe.filter((p) => p.status === 'Sem sinal').length} delta="sem GPS há mais de 10 min" deltaColor="var(--amber)" />
      </div>
      <Card>
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar entregador, base ou veículo…" />
        {equipe.length === 0 ? (
          <EmptyState icon="users" title="Nenhum entregador ainda">Convide sua equipe: cada entregador cria o próprio acesso e passa a receber entregas.</EmptyState>
        ) : (
          <DataTable
            rows={lista}
            onRowClick={setRotaDe}
            columns={[
              { key: 'nome', label: 'Entregador', render: (p) => (<span><Person name={p.nome} /><span className="cell-sub">{p.telefone ?? p.email}</span></span>) },
              { key: 'base', label: 'Base', render: (p) => (<span>{p.base}<span className="cell-sub">{p.veiculo ?? '—'}</span></span>) },
              { key: 'hoje', label: 'Hoje', render: (p) => `${p.hoje.entregues}/${p.hoje.total}` },
              { key: 'prazo', label: 'No prazo (30d)', render: (p) => (<span>{pct(p.noPrazoPct)}<span className="cell-sub">{p.entregues30d} entregas</span></span>) },
              { key: 'adesao', label: 'Comprovante completo', render: (p) => (<span style={{ display: 'block', minWidth: 110 }}><ProgressBar value={p.adesaoPct ?? 0} color={cor(p.adesaoPct)} height={6} /><span className="cell-sub">{pct(p.adesaoPct)} foto + assinatura + GPS</span></span>) },
              { key: 'status', label: 'Status', render: (p) => (<span><Badge tone={TOM[p.status]}>{p.status}</Badge>{p.ultimaPosicaoEm && <span className="cell-sub">GPS {relativo(p.ultimaPosicaoEm)}</span>}</span>) },
              {
                key: 'acoes',
                label: '',
                render: (p) => (
                  <span className="row" style={{ gap: 6 }}>
                    <Button size="sm" variant="secondary" icon="route" onClick={(e) => (e.stopPropagation(), setRotaDe(p))}>
                      Rota
                    </Button>
                    <Button size="sm" variant="secondary" icon="edit" onClick={(e) => (e.stopPropagation(), setEditando(p))} aria-label={`Editar ${p.nome}`} />
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>
      <div className="grid-2">
        <Card title="Privacidade dos colaboradores (LGPD)">
          <p className="small muted">Rastreamento de pessoas apenas com finalidade operacional, no expediente e com transparência para o colaborador.</p>
          <Toggle title="Rastrear apenas durante o turno" description="Fora do turno o servidor recusa posições do app" checked={privacidade.soExpediente} onChange={alternar('soExpediente')} />
          <Toggle title="Termo de ciência no app" description="O entregador vê o que é coletado e por quê antes de ativar o GPS" checked={privacidade.termoCiencia} onChange={alternar('termoCiencia')} />
          <Toggle title="Apagar localização de pessoas após 90 dias" checked={privacidade.anonimizar90} onChange={alternar('anonimizar90')} />
        </Card>
        <Card title="Adesão ao registro no app · 30 dias">
          {!adesao ? (
            <p className="muted">Calculando…</p>
          ) : (
            <>
              <p className="small muted">{adesao.entregas} entregas concluídas e {adesao.movimentacoes} movimentações de ativos no período.</p>
              <LabeledBar label="Comprovante com foto" value={pct(adesao.fotoPct)} percent={adesao.fotoPct ?? 0} color={cor(adesao.fotoPct)} />
              <LabeledBar label="Comprovante com assinatura" value={pct(adesao.assinaturaPct)} percent={adesao.assinaturaPct ?? 0} color={cor(adesao.assinaturaPct)} />
              <LabeledBar label="Comprovante com GPS do local" value={pct(adesao.gpsPct)} percent={adesao.gpsPct ?? 0} color={cor(adesao.gpsPct)} />
              <LabeledBar label="Check-in/out por leitura QR/RFID" value={pct(adesao.leituraPct)} percent={adesao.leituraPct ?? 0} color={cor(adesao.leituraPct)} />
            </>
          )}
          <Button variant="secondary" onClick={lembrete} disabled={!equipe.length}>
            Enviar lembrete às equipes
          </Button>
        </Card>
      </div>

      <Modal title={rotaDe ? `Rota de ${rotaDe.nome}` : ''} wide open={Boolean(rotaDe)} onClose={() => setRotaDe(null)}>
        {rotaDe && <RotaOtimizada entregadorId={rotaDe.id} />}
      </Modal>
      <Modal title={editando ? `Editar ${editando.nome}` : ''} open={Boolean(editando)} onClose={() => setEditando(null)}>
        {editando && <EditarEntregador pessoa={editando} onFechar={() => setEditando(null)} />}
      </Modal>
      <Modal title="Convidar colaborador" open={convite} onClose={() => setConvite(false)}>
        {convite && <Convites onFechar={() => setConvite(false)} />}
      </Modal>
    </Page>
  )
}
