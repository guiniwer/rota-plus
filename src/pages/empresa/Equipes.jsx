import { useState } from 'react'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Field from '../../components/ui/Field'
import KpiCard from '../../components/ui/KpiCard'
import LabeledBar from '../../components/ui/LabeledBar'
import Modal from '../../components/ui/Modal'
import Person from '../../components/ui/Person'
import ProgressBar from '../../components/ui/ProgressBar'
import SearchInput from '../../components/ui/SearchInput'
import Toggle from '../../components/ui/Toggle'
import { useApp } from '../../context/AppContext'
import { EQUIPE } from '../../data/mockData'

const TOM = { 'Em rota': 'pink', Disponível: 'success', Offline: 'warning', 'Fora do turno': 'neutral' }

export default function Equipes() {
  const { privacidade, setPrivacidade, toast } = useApp()
  const [busca, setBusca] = useState('')
  const [convite, setConvite] = useState(false)
  const [email, setEmail] = useState('')
  const lista = EQUIPE.filter((p) => `${p.nome} ${p.base} ${p.veiculo}`.toLowerCase().includes(busca.toLowerCase()))
  const alternar = (k) => (v) => setPrivacidade((p) => ({ ...p, [k]: v }))
  const cor = (n) => (n >= 90 ? 'var(--green)' : n >= 75 ? 'var(--amber)' : 'var(--red)')

  return (
    <Page
      title="Equipes de campo"
      subtitle="Colaboradores, veículos e adesão ao registro no app"
      actions={
        <Button icon="plus" onClick={() => setConvite(true)}>
          Convidar colaborador
        </Button>
      }
    >
      <div className="grid-4">
        <KpiCard label="Colaboradores" value={EQUIPE.length} delta="3 bases" deltaColor="var(--muted)" />
        <KpiCard label="Em rota agora" value={EQUIPE.filter((p) => p.status === 'Em rota').length} delta="com entregas atribuídas" />
        <KpiCard label="Disponíveis" value={EQUIPE.filter((p) => p.status === 'Disponível').length} delta="prontos para nova rota" deltaColor="var(--muted)" />
        <KpiCard label="App sem sincronizar" value={EQUIPE.filter((p) => p.status === 'Offline').length} delta="offline > 30 min" deltaColor="var(--amber)" />
      </div>
      <Card>
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar colaborador, base ou veículo…" />
        <DataTable
          rowKey="nome"
          rows={lista}
          columns={[
            { key: 'nome', label: 'Colaborador', render: (p) => (<span><Person name={p.nome} /><span className="cell-sub">{p.funcao}</span></span>) },
            { key: 'base', label: 'Equipe / base' },
            { key: 'veiculo', label: 'Veículo' },
            { key: 'hoje', label: 'Hoje' },
            { key: 'prazo', label: 'No prazo' },
            { key: 'adesao', label: 'Adesão ao app', render: (p) => (<span style={{ display: 'block', minWidth: 110 }}><ProgressBar value={p.adesao} color={cor(p.adesao)} height={6} /><span className="cell-sub">{p.adesao}% registros completos</span></span>) },
            { key: 'status', label: 'Status', render: (p) => <Badge tone={TOM[p.status]}>{p.status}</Badge> },
          ]}
        />
      </Card>
      <div className="grid-2">
        <Card title="Privacidade dos colaboradores (LGPD)">
          <p className="small muted">Rastreamento de pessoas apenas com finalidade operacional, no expediente e com transparência para o colaborador.</p>
          <Toggle title="Rastrear apenas durante o turno" description="Fora do turno o app para de enviar localização" checked={privacidade.soExpediente} onChange={alternar('soExpediente')} />
          <Toggle title="Termo de ciência no primeiro acesso" description="Colaborador vê o que é coletado e por quê" checked={privacidade.termoCiencia} onChange={alternar('termoCiencia')} />
          <Toggle title="Anonimizar localização após 90 dias" description="Mantém apenas dados agregados" checked={privacidade.anonimizar90} onChange={alternar('anonimizar90')} />
        </Card>
        <Card title="Adesão ao registro no app">
          <p className="small muted">Registros corretos reduzem retrabalho e melhoram a precisão dos dados.</p>
          <LabeledBar label="Check-in/out com QR" value="93%" percent={93} color="var(--green)" />
          <LabeledBar label="Comprovante com foto" value="97%" percent={97} color="var(--green)" />
          <LabeledBar label="Status atualizado na hora" value="78%" percent={78} color="var(--amber)" />
          <Button variant="secondary" onClick={() => toast('Lembrete enviado para 6 colaboradores.')}>
            Enviar lembrete às equipes
          </Button>
        </Card>
      </div>

      <Modal title="Convidar colaborador" open={convite} onClose={() => setConvite(false)}>
        <form
          className="stack-sm"
          style={{ gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault()
            setConvite(false)
            toast(`Convite do app de campo enviado para ${email}.`)
            setEmail('')
          }}
        >
          <Field label="E-mail ou celular" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <p className="small muted">O colaborador recebe o link do app e o termo de ciência sobre o rastreamento.</p>
          <Button type="submit" block>
            Enviar convite
          </Button>
        </form>
      </Modal>
    </Page>
  )
}
