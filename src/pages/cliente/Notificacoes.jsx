import Page from '../../components/layout/Page'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ListItem from '../../components/ui/ListItem'
import Toggle from '../../components/ui/Toggle'
import { useApp } from '../../context/AppContext'

const CANAIS = [
  { key: 'push', titulo: 'Notificações push', desc: 'No navegador e no app' },
  { key: 'email', titulo: 'E-mail', desc: 'Resumo de cada etapa' },
  { key: 'whatsapp', titulo: 'WhatsApp / SMS', desc: 'Avisos de chegada' },
]
const EVENTOS = [
  { key: 'saiu', titulo: 'Saiu para entrega', desc: 'Inclui link de rastreio' },
  { key: 'atraso', titulo: 'Atraso ou mudança de previsão', desc: 'Alertas proativos' },
  { key: 'comprovante', titulo: 'Entregue / comprovante', desc: 'Foto e assinatura' },
  { key: 'promocoes', titulo: 'Promoções e cupons' },
]

export default function Notificacoes() {
  const { notificacoes, marcarLida, marcarTodasLidas, preferencias, setPreferencias } = useApp()
  const alternar = (key) => (valor) => setPreferencias((p) => ({ ...p, [key]: valor }))
  const grupos = ['Hoje', 'Anteriores']

  return (
    <Page title="Notificações" subtitle="Fique atualizado sobre suas entregas">
      <div className="grid-aside">
        <div className="stack-sm">
          <div className="row-between">
            <span className="label pink">{notificacoes.filter((n) => !n.lida).length} não lidas</span>
            <button className="link btn btn-sm btn-secondary" onClick={marcarTodasLidas}>
              Marcar todas como lidas
            </button>
          </div>
          {notificacoes.length === 0 && <EmptyState icon="bell" title="Sem notificações" />}
          {grupos.map((g) => {
            const itens = notificacoes.filter((n) => n.grupo === g)
            if (!itens.length) return null
            return (
              <div key={g} className="stack-sm">
                <span className="label pink">{g}</span>
                {itens.map((n) => (
                  <Card key={n.id} compact style={{ background: n.lida ? 'var(--card)' : 'var(--card-2)' }}>
                    <ListItem
                      icon={n.icon}
                      color={n.cor}
                      title={n.titulo}
                      subtitle={n.texto}
                      meta={n.quando}
                      onClick={() => marcarLida(n.id)}
                      right={!n.lida && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--pink)', flex: 'none' }} title="Não lida" />}
                    />
                  </Card>
                ))}
              </div>
            )
          })}
        </div>
        <Card title="Preferências">
          <span className="label">Canais</span>
          {CANAIS.map((c) => (
            <Toggle key={c.key} title={c.titulo} description={c.desc} checked={preferencias[c.key]} onChange={alternar(c.key)} />
          ))}
          <span className="label">Avisar quando</span>
          {EVENTOS.map((c) => (
            <Toggle key={c.key} title={c.titulo} description={c.desc} checked={preferencias[c.key]} onChange={alternar(c.key)} />
          ))}
        </Card>
      </div>
    </Page>
  )
}
