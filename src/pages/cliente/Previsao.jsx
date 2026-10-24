import { useEffect, useState } from 'react'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import KpiCard from '../../components/ui/KpiCard'
import Modal from '../../components/ui/Modal'
import Timeline from '../../components/ui/Timeline'
import { Instrucoes, Reagendar } from '../../components/entregas/AcoesCliente'
import EntregaSelector from '../../components/entregas/EntregaSelector'
import MapaEntrega from '../../components/entregas/MapaEntrega'
import useAcompanhamento from '../../hooks/useAcompanhamento'
import useEntregaSelecionada from '../../hooks/useEntregaSelecionada'
import { duracao, hora, previsaoTexto, relativo } from '../../utils/tempo'

const ativa = (e) => !['entregue', 'cancelado'].includes(e.status)
const MOTIVO = {
  sem_entregador: 'Assim que um entregador sair com a sua encomenda, a previsão aparece aqui.',
  aguardando_coleta: 'A previsão em minutos aparece quando o entregador sair para a entrega.',
  por_etapas: 'Esta entrega é rastreada por etapas; vale o prazo combinado.',
  privacidade: 'A transportadora não compartilha a localização em tempo real; vale o prazo combinado.',
  sem_sinal: 'O GPS do entregador está sem sinal. A previsão volta quando ele reconectar.',
}

export default function Previsao() {
  const { entrega, lista } = useEntregaSelecionada(ativa)
  const a = useAcompanhamento(entrega?.id)
  const [modal, setModal] = useState(null)
  const [, setTique] = useState(0)
  // atualiza a contagem a cada 30 s
  useEffect(() => {
    const t = setInterval(() => setTique((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  if (!entrega) {
    return (
      <Page title="Previsão de chegada">
        <Card>
          <EmptyState icon="clock" title="Nenhuma entrega em andamento" />
        </Card>
      </Page>
    )
  }

  const restante = a?.eta ? Math.max(1, Math.round((Date.parse(a.eta.chegada) - Date.now()) / 60_000)) : null

  return (
    <Page title="Previsão de chegada" subtitle={`${entrega.id} · ${entrega.transportadora}`} actions={<EntregaSelector entregas={lista} selecionada={entrega} basePath="/cliente/previsao" />}>
      <div className="grid-aside">
        <Card style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="label">{restante ? 'Tempo estimado' : 'Prazo combinado'}</span>
          {restante ? (
            <>
              <div>
                <span className="eta-number">{restante < 60 ? restante : duracao(restante)}</span> {restante < 60 && <strong className="pink" style={{ fontSize: 28 }}>min</strong>}
              </div>
              <p className="muted">Chegada por volta de {hora(a.eta.chegada)} · prazo: {previsaoTexto(entrega)}</p>
              <span className="small grey">{a.eta.fonte === 'osrm' ? 'Calculado pelas ruas (OSRM) a partir do GPS do entregador' : 'Estimativa por distância a partir do GPS do entregador'}</span>
            </>
          ) : (
            <>
              <strong style={{ fontSize: 28 }} className="pink">
                {previsaoTexto(entrega)}
              </strong>
              <p className="muted">{a ? MOTIVO[a.motivo] : 'Calculando…'}</p>
            </>
          )}
        </Card>
        <div className="stack">
          <KpiCard label="Distância restante" value={a?.eta ? `${a.eta.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '—'} delta={a?.entregador?.atualizadoEm ? `GPS ${relativo(a.entregador.atualizadoEm)}` : 'sem posição em tempo real'} deltaColor="var(--muted)" />
          <KpiCard label="Paradas antes da sua" value={a?.eta ? a.paradasAntes : '—'} delta="pela rota planejada do entregador" deltaColor="var(--muted)" />
        </div>
      </div>
      <div className="grid-aside">
        <Card compact>
          <MapaEntrega entrega={entrega} acompanhamento={a} height={320} />
        </Card>
        <Card title="Atualizações recentes">
          <Timeline items={entrega.eventos.slice(0, 4)} />
          <strong>Não vai estar em casa?</strong>
          <div className="grid-2" style={{ gap: 12 }}>
            <Button variant="secondary" onClick={() => setModal('reagendar')}>
              Reagendar
            </Button>
            <Button variant="secondary" onClick={() => setModal('instrucoes')}>
              Deixar recado
            </Button>
          </div>
        </Card>
      </div>

      <Modal title={modal === 'reagendar' ? 'Reagendar entrega' : 'Recado para o entregador'} open={Boolean(modal)} onClose={() => setModal(null)}>
        {modal === 'reagendar' && <Reagendar entrega={entrega} onFechar={() => setModal(null)} />}
        {modal === 'instrucoes' && <Instrucoes entrega={entrega} onFechar={() => setModal(null)} />}
      </Modal>
    </Page>
  )
}
