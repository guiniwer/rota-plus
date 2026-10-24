import { Link, useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ListItem from '../../components/ui/ListItem'
import Stepper from '../../components/ui/Stepper'
import MapaEntrega from '../../components/entregas/MapaEntrega'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp, useEntregasDoCliente } from '../../context/AppContext'
import { ETAPAS, STATUS_ENTREGA } from '../../utils/status'
import { previsaoTexto, relativo } from '../../utils/tempo'

const emAndamento = (e) => !['entregue', 'cancelado'].includes(e.status)

/** Início do cliente: o que está a caminho agora e o que pede atenção. */
export default function ClienteInicio() {
  const { usuario, notificacoes } = useApp()
  const entregas = useEntregasDoCliente()
  const navigate = useNavigate()
  const [principal, ...outras] = entregas.filter(emAndamento)
  const paraAvaliar = entregas.filter((e) => e.status === 'entregue' && !e.avaliacao).slice(0, 2)
  const novidades = notificacoes.filter((n) => !n.lida).slice(0, 3)
  const abrir = (e) => navigate(`/cliente/pedidos/${e.id}`)

  return (
    <Page title={`Olá, ${usuario.nome.split(' ')[0]}!`} actions={<Button icon="plus" onClick={() => navigate('/cliente/novo-pedido')}>Novo pedido</Button>}>
      <div className="grid-aside">
        <Card title={principal ? principal.id : 'Nenhuma entrega a caminho'} action={principal && <EntregaBadge status={principal.status} />}>
          {principal ? (
            <>
              <div className="row wrap small">
                <strong>{principal.destino}</strong>
                <span className="muted">· {previsaoTexto(principal)}</span>
              </div>
              <MapaEntrega entrega={principal} height={260} />
              <Stepper steps={ETAPAS} current={STATUS_ENTREGA[principal.status].etapa} />
              <Button onClick={() => abrir(principal)}>Acompanhar pedido</Button>
            </>
          ) : (
            <EmptyState icon="box" title="Tudo entregue por aqui">
              <Button onClick={() => navigate('/cliente/novo-pedido')}>Fazer um pedido</Button>
            </EmptyState>
          )}
        </Card>

        <div className="stack">
          {outras.length > 0 && (
            <Card title="Também a caminho">
              {outras.map((e) => (
                <ListItem key={e.id} icon="truck" title={e.id} subtitle={previsaoTexto(e)} meta={STATUS_ENTREGA[e.status].label} onClick={() => abrir(e)} />
              ))}
            </Card>
          )}
          {paraAvaliar.length > 0 && (
            <Card title="Avalie suas entregas">
              {paraAvaliar.map((e) => (
                <ListItem key={e.id} icon="star" color="var(--amber)" title={e.id} subtitle={`Entregue por ${e.responsavel ?? e.transportadora}`} onClick={() => navigate(`/cliente/pedidos/${e.id}?avaliar=1`)} />
              ))}
            </Card>
          )}
          <Card title="Novidades" action={<Link className="link" to="/cliente/notificacoes">Ver todas</Link>}>
            {novidades.length === 0 && <p className="small muted">Nenhuma novidade.</p>}
            {novidades.map((n) => (
              <ListItem key={n.id} icon={n.icon} color={n.cor} title={n.titulo} subtitle={n.texto} meta={relativo(n.criadoEm)} onClick={n.link ? () => navigate(n.link) : undefined} />
            ))}
          </Card>
        </div>
      </div>
    </Page>
  )
}
