import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import BarChart from '../../components/ui/BarChart'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import MapView from '../../components/ui/MapView'
import Modal from '../../components/ui/Modal'
import QrCode from '../../components/ui/QrCode'
import Segmented from '../../components/ui/Segmented'
import Timeline from '../../components/ui/Timeline'
import { AtivoBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { COR_STATUS_ATIVO, RESPONSAVEIS, toMarkers } from '../../utils/ativos'
import { brl } from '../../utils/format'
import { TIPO_ATIVO_ICON } from '../../utils/status'

const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D', 'S', 'T', 'Q', 'Q', 'S', 'S', 'D']

export default function AtivoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ativos, registrarMovimentacao, transferirAtivo, marcarExtraviado, toast } = useApp()
  const ativo = ativos.find((a) => a.id === id)
  const [modal, setModal] = useState(null) // 'mov' | 'transferir' | 'extraviado'
  const [mov, setMov] = useState({ tipo: 'checkout', responsavel: RESPONSAVEIS[0], local: '' })
  const [destino, setDestino] = useState(RESPONSAVEIS[1])

  if (!ativo) {
    return (
      <Page title="Ativo não encontrado">
        <Card>
          <EmptyState title={`Não existe ativo com o código ${id}`}>
            <Button onClick={() => navigate('/empresa/ativos')}>Voltar para ativos</Button>
          </EmptyState>
        </Card>
      </Page>
    )
  }

  const horasUso = ativo.uso.reduce((s, h) => s + h, 0)
  const utilizacao = Math.round((horasUso / (ativo.uso.length * 10)) * 100)
  const cor = COR_STATUS_ATIVO[ativo.status]

  const salvarMov = (e) => {
    e.preventDefault()
    registrarMovimentacao(ativo.id, { ...mov, local: mov.local || 'Almoxarifado CD' })
    setModal(null)
    toast(mov.tipo === 'checkout' ? `Check-out registrado para ${mov.responsavel}.` : 'Check-in registrado.')
  }

  return (
    <Page
      title={ativo.nome}
      subtitle={`Ativos › ${ativo.id} · ${ativo.tipo}`}
      actions={
        <Button variant="secondary" icon="back" onClick={() => navigate('/empresa/ativos')}>
          Voltar
        </Button>
      }
    >
      <div className="grid-aside">
        <Card>
          <div className="row wrap">
            <span className="icon-chip" style={{ width: 56, height: 56, background: `${cor}29` }}>
              <Icon name={TIPO_ATIVO_ICON[ativo.tipo] ?? 'box'} size={28} color={cor} />
            </span>
            <div className="grow">
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{ativo.nome}</h2>
              <span className="small muted">
                {ativo.id} · última leitura {ativo.ultimaLeitura}
              </span>
            </div>
            <AtivoBadge status={ativo.status} />
            <Badge tone="info">{ativo.bateria != null ? `${ativo.identificacao} · bateria ${ativo.bateria}%` : ativo.identificacao}</Badge>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="stack-sm">
              <KeyValue label="Responsável atual" value={ativo.responsavel ?? 'Ninguém (no estoque)'} />
              <KeyValue label="Localização" value={ativo.local} />
              <KeyValue label="Identificação" value={ativo.identificacao} />
            </div>
            <div className="stack-sm">
              <KeyValue label="Valor do ativo" value={brl(ativo.valor)} />
              <KeyValue label="Uso nos últimos 14 dias" value={`${horasUso} h`} />
              <KeyValue label="Utilização" value={`${utilizacao}%`} valueColor={utilizacao < 50 ? 'var(--amber)' : 'var(--green)'} />
            </div>
          </div>
          <div className="row wrap">
            <Button variant="violet" icon="qr" onClick={() => setModal('mov')}>
              Registrar check-in / out
            </Button>
            <Button variant="secondary" icon="users" onClick={() => setModal('transferir')}>
              Transferir responsável
            </Button>
            {ativo.status !== 'extraviado' && (
              <Button variant="outline" onClick={() => setModal('extraviado')}>
                Marcar como extraviado
              </Button>
            )}
          </div>
        </Card>
        <Card style={{ alignItems: 'center', textAlign: 'center' }}>
          <QrCode value={ativo.id} size={150} />
          <strong>{ativo.id}</strong>
          <span className="small muted">Escaneie no app de campo para check-in/out</span>
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir etiqueta
          </Button>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Localização">
          <MapView showRoute={false} markers={toMarkers([ativo])} selectedId={ativo.id} height={260} />
        </Card>
        <Card title="Uso nas últimas 2 semanas (horas/dia)">
          <BarChart data={ativo.uso.map((h, i) => ({ label: DIAS[i], value: h, color: h === 0 ? 'var(--line)' : 'var(--purple)' }))} max={10} />
          {utilizacao < 50 && <p className="small" style={{ color: 'var(--purple)' }}>Sugestão: ativo ocioso — avalie realocar para outra equipe ou obra.</p>}
        </Card>
      </div>

      <Card title="Histórico de movimentação e responsáveis">
        <Timeline items={ativo.historico} />
      </Card>

      <Modal title="Registrar movimentação" open={modal === 'mov'} onClose={() => setModal(null)}>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={salvarMov}>
          <Segmented
            value={mov.tipo}
            onChange={(t) => setMov({ ...mov, tipo: t })}
            options={[
              { value: 'checkout', label: 'Check-out (retirada)' },
              { value: 'checkin', label: 'Check-in (devolução/local)' },
            ]}
          />
          <Field label="Responsável" as="select" value={mov.responsavel} onChange={(e) => setMov({ ...mov, responsavel: e.target.value })} options={RESPONSAVEIS} />
          {mov.tipo === 'checkin' && <Field label="Local" value={mov.local} onChange={(e) => setMov({ ...mov, local: e.target.value })} placeholder="Almoxarifado CD" />}
          <Button type="submit" block>
            Confirmar
          </Button>
        </form>
      </Modal>

      <Modal title="Transferir responsável" open={modal === 'transferir'} onClose={() => setModal(null)}>
        <Field label="Novo responsável" as="select" value={destino} onChange={(e) => setDestino(e.target.value)} options={RESPONSAVEIS} />
        <Button
          block
          onClick={() => {
            transferirAtivo(ativo.id, destino)
            setModal(null)
            toast(`Responsabilidade transferida para ${destino}.`)
          }}
        >
          Transferir
        </Button>
      </Modal>

      <Modal title="Marcar como extraviado?" open={modal === 'extraviado'} onClose={() => setModal(null)}>
        <p className="muted">A equipe será notificada para busca e o ativo sai do inventário disponível.</p>
        <div className="grid-2" style={{ gap: 12 }}>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              marcarExtraviado(ativo.id)
              setModal(null)
              toast('Ativo marcado como extraviado.')
            }}
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
