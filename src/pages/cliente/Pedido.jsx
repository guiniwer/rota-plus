import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import Modal from '../../components/ui/Modal'
import Timeline from '../../components/ui/Timeline'
import { Etiqueta, Instrucoes, Reagendar, ReportarProblema } from '../../components/entregas/AcoesCliente'
import Avaliacao, { AvaliacaoFeita } from '../../components/entregas/Avaliacao'
import Comprovante from '../../components/entregas/Comprovante'
import Conversa from '../../components/entregas/Conversa'
import MapaEntrega from '../../components/entregas/MapaEntrega'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp, useEntregasDoCliente } from '../../context/AppContext'
import useAcompanhamento from '../../hooks/useAcompanhamento'
import { brl, num } from '../../utils/format'
import { previsaoTexto, relativo } from '../../utils/tempo'

const TITULOS = {
  etiqueta: 'Etiqueta de envio',
  comprovante: 'Comprovante de entrega',
  problema: 'Reportar problema',
  instrucoes: 'Recado para o entregador',
  reagendar: 'Reagendar entrega',
  conversa: 'Mensagens',
  avaliar: 'Confirmar recebimento',
}

/** Tudo de um pedido numa tela só: mapa e chegada, entregador, linha do tempo, ações e avaliação. */
export default function Pedido() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const entrega = useEntregasDoCliente().find((e) => e.id === id)
  const { toast } = useApp()
  const navigate = useNavigate()
  const aberta = entrega && !['entregue', 'cancelado'].includes(entrega.status)
  const a = useAcompanhamento(aberta ? entrega.id : null)
  const [modal, setModalState] = useState(() => (params.get('avaliar') ? 'avaliar' : null))

  const setModal = (m) => {
    setModalState(m)
    if (!m && params.has('avaliar')) setParams({}, { replace: true })
  }

  if (!entrega) {
    return (
      <Page title="Pedido">
        <Card>
          <EmptyState icon="box" title="Pedido não encontrado">
            <Button onClick={() => navigate('/cliente/pedidos')}>Ver meus pedidos</Button>
          </EmptyState>
        </Card>
      </Page>
    )
  }

  const podeAvaliar = !entrega.avaliacao && ['entregue', 'saiu'].includes(entrega.status)
  const compartilhar = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/rastreio?codigo=${entrega.id}`
    try {
      if (navigator.share) await navigator.share({ title: `Rastreio ${entrega.id}`, url: link })
      else {
        await navigator.clipboard.writeText(link)
        toast('Link de rastreio copiado!')
      }
    } catch {
      /* compartilhamento cancelado */
    }
  }

  return (
    <Page title={entrega.id} subtitle={`${entrega.transportadora} · ${previsaoTexto(entrega)}`} actions={<EntregaBadge status={entrega.status} />}>
      <div className="grid-aside">
        <div className="stack">
          {aberta && (
            <Card compact>
              <MapaEntrega entrega={entrega} acompanhamento={a} height={380} />
            </Card>
          )}

          {podeAvaliar && entrega.status === 'entregue' && (
            <Card title="Sua encomenda chegou!">
              <p className="muted">Confirme o recebimento e avalie o entregador. Leva 10 segundos.</p>
              <Button icon="star" onClick={() => setModal('avaliar')}>
                Avaliar entrega
              </Button>
            </Card>
          )}

          <Card title="Detalhes do envio">
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="stack-sm">
                <KeyValue label="De" value={entrega.origem} />
                <KeyValue label="Para" value={entrega.destino} />
                <KeyValue label="Destinatário" value={entrega.destinatario || entrega.cliente} />
                <KeyValue label="Carga" value={`${entrega.tipoCarga} · ${num(entrega.pesoTaxado)} kg`} />
              </div>
              <div className="stack-sm">
                <KeyValue label={entrega.status === 'entregue' ? 'Entregue' : 'Prazo'} value={previsaoTexto(entrega)} valueColor="var(--pink)" />
                <KeyValue label="Modalidade" value={`${entrega.modalidade === 'expressa' ? 'Mais rápida' : 'Normal'} · ${entrega.rastreio === 'gps' ? 'GPS' : 'por etapas'}`} />
                <KeyValue label="Frete" value={brl(entrega.valor)} />
                {entrega.instrucoes && <KeyValue label="Recado" value={entrega.instrucoes} />}
              </div>
            </div>
            <div className="row wrap">
              <Button variant="secondary" size="sm" icon="qr" onClick={() => setModal('etiqueta')}>
                Etiqueta
              </Button>
              {entrega.comprovante && (
                <Button variant="secondary" size="sm" icon="check" onClick={() => setModal('comprovante')}>
                  Comprovante
                </Button>
              )}
              {aberta && (
                <Button variant="secondary" size="sm" icon="link" onClick={compartilhar}>
                  Compartilhar rastreio
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="stack">
          {aberta && entrega.responsavel && (
            <Card compact>
              <div className="row">
                <Avatar name={entrega.responsavel} size={48} />
                <div className="grow">
                  <strong>{entrega.responsavel}</strong>
                  <p className="small muted">{a?.entregador?.veiculo ?? entrega.transportadora}</p>
                  {a?.entregador?.atualizadoEm && <p className="small muted">GPS {relativo(a.entregador.atualizadoEm)}</p>}
                </div>
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <Button variant="secondary" icon="mail" onClick={() => setModal('conversa')}>
                  Mensagem
                </Button>
                {a?.contato ? (
                  <a className="btn btn-violet" href={`tel:${a.contato.replace(/\D/g, '')}`}>
                    <Icon name="phone" size={18} /> Ligar
                  </a>
                ) : (
                  <Button variant="violet" icon="phone" disabled>
                    Ligar
                  </Button>
                )}
              </div>
            </Card>
          )}

          {entrega.avaliacao && (
            <Card title="Sua avaliação">
              <AvaliacaoFeita avaliacao={entrega.avaliacao} />
            </Card>
          )}

          <Card title="Atualizações">
            <Timeline items={entrega.eventos} />
            {aberta && (
              <div className="grid-2" style={{ gap: 12 }}>
                <Button variant="secondary" size="sm" onClick={() => setModal('reagendar')}>
                  Reagendar
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setModal('instrucoes')}>
                  Deixar recado
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" block onClick={() => setModal('problema')}>
              Reportar problema
            </Button>
          </Card>
        </div>
      </div>

      <Modal title={modal === 'conversa' ? `Mensagens · ${entrega.id}` : (TITULOS[modal] ?? '')} open={Boolean(modal)} onClose={() => setModal(null)}>
        {modal === 'etiqueta' && <Etiqueta entrega={entrega} />}
        {modal === 'comprovante' && <Comprovante entregaId={entrega.id} />}
        {modal === 'problema' && <ReportarProblema entrega={entrega} onFechar={() => setModal(null)} />}
        {modal === 'instrucoes' && <Instrucoes entrega={entrega} onFechar={() => setModal(null)} />}
        {modal === 'reagendar' && <Reagendar entrega={entrega} onFechar={() => setModal(null)} />}
        {modal === 'conversa' && <Conversa entregaId={entrega.id} />}
        {modal === 'avaliar' && (podeAvaliar ? <Avaliacao entrega={entrega} onFechar={() => setModal(null)} /> : <p className="muted">Esta entrega já foi avaliada ou ainda não saiu para entrega.</p>)}
      </Modal>
    </Page>
  )
}
