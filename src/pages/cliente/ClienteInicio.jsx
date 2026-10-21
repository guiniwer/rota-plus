import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import ListItem from '../../components/ui/ListItem'
import MapView, { MapChip } from '../../components/ui/MapView'
import Stepper from '../../components/ui/Stepper'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp, useEntregasDoCliente } from '../../context/AppContext'
import { ETAPAS, STATUS_ENTREGA } from '../../utils/status'

const ATALHOS = [
  { to: '/cliente/novo-pedido', icon: 'plus', titulo: 'Novo pedido', texto: 'Envie um pacote em poucos passos' },
  { to: '/cliente/acompanhar', icon: 'truck', titulo: 'Minhas entregas', texto: 'Veja suas entregas em andamento' },
  { to: '/cliente/previsao', icon: 'map', titulo: 'Mapa', texto: 'Rotas e localização em tempo real' },
  { to: '/cliente/historico', icon: 'clock', titulo: 'Histórico', texto: 'Suas movimentações registradas' },
]

export default function ClienteInicio() {
  const { usuario, notificacoes, toast } = useApp()
  const entregas = useEntregasDoCliente()
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState('')
  const emAndamento = entregas.find((e) => !['entregue', 'cancelado'].includes(e.status))

  const rastrear = (e) => {
    e.preventDefault()
    const achada = entregas.find((x) => x.id.toUpperCase() === codigo.trim().toUpperCase())
    if (achada) navigate(`/cliente/status/${achada.id}`)
    else toast('Código não encontrado entre as suas entregas.')
  }

  return (
    <Page title={`Olá, ${usuario.nome.split(' ')[0]}!`} subtitle="Acompanhe seus envios e acesse as ações rápidas">
      <div className="grid-4">
        {ATALHOS.map((a) => (
          <Link key={a.to} to={a.to} className="card compact" style={{ color: 'inherit' }}>
            <span className="icon-chip" style={{ background: 'var(--card-2)' }}>
              <Icon name={a.icon} color="var(--pink)" size={22} />
            </span>
            <strong style={{ fontSize: 16 }}>{a.titulo}</strong>
            <span className="small muted">{a.texto}</span>
          </Link>
        ))}
      </div>

      <div className="grid-aside">
        <Card title="Entrega em andamento" action={emAndamento && <EntregaBadge status={emAndamento.status} />}>
          {emAndamento ? (
            <>
              <div className="row wrap">
                <Icon name="box" size={18} color="var(--pink)" />
                <strong className="pink">{emAndamento.id}</strong>
                <span className="muted">· previsão {emAndamento.previsao}</span>
              </div>
              <div className="row wrap">
                <strong>{emAndamento.origem}</strong>
                <Icon name="arrow" size={18} color="var(--muted)" />
                <strong>{emAndamento.destino}</strong>
              </div>
              <MapView progress={emAndamento.progresso} height={240}>
                <MapChip style={{ top: 12, left: 12 }}>
                  <Icon name="truck" size={16} color="var(--pink)" /> {STATUS_ENTREGA[emAndamento.status].label}
                </MapChip>
              </MapView>
              <Stepper steps={ETAPAS} current={STATUS_ENTREGA[emAndamento.status].etapa} />
              <div className="row wrap">
                <Button onClick={() => navigate(`/cliente/acompanhar/${emAndamento.id}`)}>Acompanhar entrega</Button>
                <Button variant="secondary" onClick={() => navigate(`/cliente/status/${emAndamento.id}`)}>
                  Ver detalhes
                </Button>
              </div>
            </>
          ) : (
            <EmptyState icon="box" title="Nenhuma entrega em andamento">
              <Button onClick={() => navigate('/cliente/novo-pedido')}>Fazer um pedido</Button>
            </EmptyState>
          )}
        </Card>

        <div className="stack">
          <Card title="Rastrear encomenda">
            <form className="stack-sm" style={{ gap: 16 }} onSubmit={rastrear}>
              <Field label="Código de rastreio" placeholder="RT-00000-BR" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
              <Button type="submit" variant="violet" block>
                Localizar encomenda
              </Button>
            </form>
          </Card>
          <Card title="Notificações" action={<Link className="link" to="/cliente/notificacoes">Ver todas</Link>}>
            {notificacoes.slice(0, 3).map((n) => (
              <ListItem key={n.id} icon={n.icon} color={n.cor} title={n.titulo} subtitle={n.texto} meta={n.quando} />
            ))}
          </Card>
        </div>
      </div>

      <Card title="Entregas recentes" action={<Button variant="outline" size="sm" onClick={() => navigate('/cliente/historico')}>Ver histórico</Button>}>
        <DataTable
          rows={entregas.slice(0, 5)}
          onRowClick={(e) => navigate(`/cliente/status/${e.id}`)}
          columns={[
            { key: 'id', label: 'Código', render: (e) => <strong>{e.id}</strong> },
            { key: 'rota', label: 'Rota', render: (e) => `${e.origem} → ${e.destino}` },
            { key: 'criadoEm', label: 'Data' },
            { key: 'tipo', label: 'Tipo', render: (e) => `${e.modalidade === 'expressa' ? 'Expressa' : 'Normal'} · ${e.rastreio === 'gps' ? 'GPS' : 'CD'}` },
            { key: 'status', label: 'Status', render: (e) => <EntregaBadge status={e.status} /> },
          ]}
        />
      </Card>
    </Page>
  )
}
