import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import ListItem from '../../components/ui/ListItem'
import Toggle from '../../components/ui/Toggle'
import { useApp } from '../../context/AppContext'
import { ativarPush, desativarPush, estadoPush } from '../../utils/push'
import { mesmoDia, relativo } from '../../utils/tempo'

const EVENTOS = [
  { key: 'saiu', titulo: 'Saiu para entrega', desc: 'Inclui link de rastreio' },
  { key: 'atraso', titulo: 'Atraso no prazo', desc: 'Quando a entrega passa do horário combinado' },
  { key: 'comprovante', titulo: 'Entregue / comprovante', desc: 'Foto e assinatura do recebimento' },
]
const TEXTO_PUSH = { ativo: 'Ativas neste navegador', inativo: 'Toque para ativar neste navegador', bloqueado: 'Bloqueadas nas configurações do navegador', indisponivel: 'Este navegador não suporta' }

function agrupar(lista) {
  const ontem = new Date(Date.now() - 864e5)
  const grupos = { Hoje: [], Ontem: [], Anteriores: [] }
  for (const n of lista) grupos[mesmoDia(n.criadoEm) ? 'Hoje' : mesmoDia(n.criadoEm, ontem) ? 'Ontem' : 'Anteriores'].push(n)
  return Object.entries(grupos).filter(([, itens]) => itens.length)
}

export default function Notificacoes() {
  const { notificacoes, marcarLida, marcarTodasLidas, preferencias, setPreferencias, toast } = useApp()
  const navigate = useNavigate()
  const [push, setPush] = useState('inativo')
  useEffect(() => {
    estadoPush().then(setPush).catch(() => setPush('indisponivel'))
  }, [])
  const alternar = (key) => (valor) => setPreferencias((p) => ({ ...p, [key]: valor }))
  const alternarPush = async (ligar) => {
    try {
      setPush(ligar ? await ativarPush() : await desativarPush())
      setPreferencias((p) => ({ ...p, push: ligar }))
      toast(ligar ? 'Notificações push ativadas neste navegador.' : 'Notificações push desativadas.')
    } catch (err) {
      toast(err.message)
      setPush(await estadoPush())
    }
  }
  const abrir = (n) => {
    marcarLida(n.id)
    if (n.link) navigate(n.link)
  }

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
          {agrupar(notificacoes).map(([g, itens]) => (
            <div key={g} className="stack-sm">
              <span className="label pink">{g}</span>
              {itens.map((n) => (
                <Card key={n.id} compact style={{ background: n.lida ? 'var(--card)' : 'var(--card-2)' }}>
                  <ListItem
                    icon={n.icon}
                    color={n.cor}
                    title={n.titulo}
                    subtitle={n.texto}
                    meta={relativo(n.criadoEm)}
                    onClick={() => abrir(n)}
                    right={!n.lida && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--pink)', flex: 'none' }} title="Não lida" />}
                  />
                </Card>
              ))}
            </div>
          ))}
        </div>
        <Card title="Preferências">
          <span className="label">Canais</span>
          <Toggle title="Notificações push" description={TEXTO_PUSH[push]} checked={push === 'ativo'} onChange={alternarPush} disabled={['bloqueado', 'indisponivel'].includes(push)} />
          <Toggle title="E-mail" description="Um e-mail a cada etapa importante" checked={preferencias.email} onChange={alternar('email')} />
          <span className="label">Avisar quando</span>
          {EVENTOS.map((c) => (
            <Toggle key={c.key} title={c.titulo} description={c.desc} checked={preferencias[c.key]} onChange={alternar(c.key)} />
          ))}
        </Card>
      </div>
    </Page>
  )
}
