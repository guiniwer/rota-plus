import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Mapa from '../../components/mapa/Mapa'
import Badge from '../../components/ui/Badge'
import BarChart from '../../components/ui/BarChart'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import Modal from '../../components/ui/Modal'
import QrCode from '../../components/ui/QrCode'
import Segmented from '../../components/ui/Segmented'
import Timeline from '../../components/ui/Timeline'
import { AtivoBadge, EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp, useEventos } from '../../context/AppContext'
import { AtivosApi } from '../../services/api'
import { COR_STATUS_ATIVO, marcadoresAtivos } from '../../utils/ativos'
import { brl } from '../../utils/format'
import { TIPO_ATIVO_ICON } from '../../utils/status'
import { dataHora, relativo } from '../../utils/tempo'

const API_URL = `${window.location.origin}/api`
/** Horas do expediente da empresa (ex.: 06:00–22:00 = 16 h): a capacidade de uso de um ativo por dia, igual ao relatório. */
function horasExpediente(empresa) {
  const min = (hhmm = '08:00') => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
  let h = (min(empresa?.turnoFim ?? '18:00') - min(empresa?.turnoInicio ?? '08:00')) / 60
  if (h <= 0) h += 24
  return h
}

/** Rótulos dos últimos n dias (o último é hoje): "seg 13" */
const ultimosDias = (n) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 864e5)
    return `${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3)} ${d.getDate()}`
  })

function Rastreador({ ativo }) {
  const { executar, toast } = useApp()
  const [token, setToken] = useState(null)
  const vincular = async () => {
    if (ativo.temRastreador && !window.confirm('Gerar um novo token desconecta o rastreador atual. Continuar?')) return
    const r = await executar(() => AtivosApi.vincularRastreador(ativo.id))
    if (r) setToken(r.token)
  }
  const desvincular = async () => {
    if (!window.confirm('Desvincular o rastreador deste ativo?')) return
    if (!(await executar(() => AtivosApi.desvincularRastreador(ativo.id)))) return
    setToken(null)
    toast('Rastreador desvinculado.')
  }
  return (
    <Card title="Rastreador GPS" action={<Badge tone={ativo.temRastreador ? 'success' : 'neutral'}>{ativo.temRastreador ? 'Vinculado' : 'Sem rastreador'}</Badge>}>
      <p className="small muted">
        Qualquer rastreador que faça requisições HTTP (ou um celular dedicado) pode enviar a posição deste ativo. {ativo.temRastreador && `Último sinal ${relativo(ativo.ultimaLeituraEm)}${ativo.bateria != null ? ` · bateria ${ativo.bateria}%` : ''}.`}
      </p>
      {token && (
        <>
          <span className="label">Token do dispositivo (mostrado só agora)</span>
          <code className="codigo">{token}</code>
          <pre className="codigo">{`curl -X POST ${API_URL}/dispositivos/posicao \\
  -H "X-Dispositivo-Token: ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"lat":-8.0631,"lng":-34.8711,"velocidade":32,"bateria":87}'`}</pre>
        </>
      )}
      <div className="row">
        <Button size="sm" onClick={vincular}>
          {ativo.temRastreador ? 'Gerar novo token' : 'Vincular rastreador'}
        </Button>
        {ativo.temRastreador && (
          <Button size="sm" variant="outline" onClick={desvincular}>
            Desvincular
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function AtivoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ativos, entregas, equipe, empresa, registrarMovimentacao, transferirAtivo, marcarExtraviado, toast } = useApp()
  const ativo = ativos.find((a) => a.id === id)
  const [modal, setModal] = useState(null) // 'mov' | 'transferir' | 'extraviado'
  const [mov, setMov] = useState({ tipo: 'checkout', responsavelId: '', local: '' })
  const [destino, setDestino] = useState('')
  const [trilha, setTrilha] = useState([])

  const carregarTrilha = () => AtivosApi.posicoes(id, 24).then(setTrilha).catch(() => {})
  useEffect(() => {
    carregarTrilha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEventos(['posicoes'], carregarTrilha)

  const marcadores = useMemo(() => (ativo ? marcadoresAtivos([ativo]) : []), [ativo])
  const linhas = useMemo(() => (trilha.length > 1 ? [{ pontos: trilha.map((p) => [p.lat, p.lng]), cor: '#8E64D8' }] : []), [trilha])

  if (!ativo) {
    return (
      <Page title="Ativo não encontrado">
        <Card>
          <EmptyState title={`Não existe ativo com o código ${id} nesta empresa`}>
            <Button onClick={() => navigate('/empresa/ativos')}>Voltar para ativos</Button>
          </EmptyState>
        </Card>
      </Page>
    )
  }

  const uso = ativo.uso ?? []
  const horasUso = Math.round(uso.reduce((s, h) => s + h, 0))
  // mesma regra dos Relatórios: horas retirado ÷ (dias × horas de expediente), no máximo 100%
  const horasDia = horasExpediente(empresa)
  const utilizacao = uso.length ? Math.min(100, Math.round((horasUso / (uso.length * horasDia)) * 100)) : 0
  const cor = COR_STATUS_ATIVO[ativo.status]
  const entrega = ativo.entregaId ? entregas.find((e) => e.id === ativo.entregaId) : null
  const opcoesEquipe = equipe.map((p) => ({ value: String(p.id), label: p.nome }))

  const salvarMov = async (e) => {
    e.preventDefault()
    const r = await registrarMovimentacao(ativo.id, { tipo: mov.tipo, responsavelId: mov.responsavelId ? Number(mov.responsavelId) : undefined, local: mov.local, leitura: 'manual' })
    if (!r) return
    setModal(null)
    toast(mov.tipo === 'checkout' ? `Check-out registrado para ${r.responsavel}.` : `Check-in registrado em ${r.local}.`)
  }

  return (
    <Page
      title={ativo.nome}
      subtitle={`Ativos › ${ativo.id} · ${ativo.tipo}${ativo.entregaId ? ` · entrega ${ativo.entregaId}` : ''}`}
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
              <span className="small muted" title={dataHora(ativo.ultimaLeituraEm)}>
                {ativo.id} · última leitura {relativo(ativo.ultimaLeituraEm)}
              </span>
            </div>
            <AtivoBadge status={ativo.status} />
            <Badge tone="info">{ativo.bateria != null ? `${ativo.identificacao} · bateria ${ativo.bateria}%` : ativo.identificacao}</Badge>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="stack-sm">
              <KeyValue label="Responsável atual" value={ativo.responsavel ?? 'Ninguém (no estoque)'} />
              <KeyValue label="Localização" value={ativo.local} />
              <KeyValue label="Cadastrado em" value={dataHora(ativo.criadoEm)} />
            </div>
            <div className="stack-sm">
              <KeyValue label={entrega ? 'Valor declarado (NF)' : 'Valor do ativo'} value={ativo.valor ? brl(ativo.valor) : '—'} />
              {entrega ? (
                <>
                  <KeyValue label="Categoria" value="Carga (entrega)" />
                  <KeyValue label="Destino" value={entrega.destino} />
                </>
              ) : (
                <>
                  <KeyValue label="Uso nos últimos 14 dias" value={`${horasUso} h`} />
                  <KeyValue label="Utilização" value={`${utilizacao}%`} valueColor={utilizacao < 50 ? 'var(--amber)' : 'var(--green)'} />
                </>
              )}
            </div>
          </div>
          {entrega ? (
            <div className="row wrap">
              <EntregaBadge status={entrega.status} />
              <span className="small muted grow">A situação desta carga acompanha o status da entrega, atualizado pelo entregador.</span>
              <Button variant="violet" icon="truck" onClick={() => navigate(`/empresa/entregas?q=${entrega.id}`)}>
                Abrir entrega
              </Button>
            </div>
          ) : (
            <div className="row wrap">
              <Button variant="violet" icon="qr" onClick={() => (setMov({ tipo: ativo.status === 'em_uso' ? 'checkin' : 'checkout', responsavelId: '', local: '' }), setModal('mov'))}>
                Registrar check-in / out
              </Button>
              <Button variant="secondary" icon="users" onClick={() => (setDestino(opcoesEquipe[0]?.value ?? ''), setModal('transferir'))} disabled={!equipe.length}>
                Transferir responsável
              </Button>
              {ativo.status !== 'extraviado' && (
                <Button variant="outline" onClick={() => setModal('extraviado')}>
                  Marcar como extraviado
                </Button>
              )}
            </div>
          )}
        </Card>
        <Card style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="etiquetas" style={{ display: 'contents' }}>
            <QrCode value={ativo.id} size={150} />
          </div>
          <strong>{ativo.id}</strong>
          <span className="small muted">Escaneie na tela Escanear para registrar check-in/out</span>
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir etiqueta
          </Button>
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Localização" action={trilha.length > 1 && <span className="small muted">trilha das últimas 24 h · {trilha.length} posições</span>}>
          {ativo.lat != null ? (
            <Mapa marcadores={marcadores} linhas={linhas} height={260} rotulo={`Localização de ${ativo.nome}`} />
          ) : (
            <EmptyState icon="map" title="Sem posição registrada">A posição aparece após um check-in com GPS ou a primeira leitura do rastreador.</EmptyState>
          )}
        </Card>
        {entrega ? (
          <Card title="Eventos da entrega">
            <Timeline items={entrega.eventos} />
          </Card>
        ) : (
          <Card title="Uso nas últimas 2 semanas (horas/dia)">
            <BarChart data={uso.map((h, i) => ({ label: ultimosDias(uso.length)[i], value: h, color: h === 0 ? 'var(--line)' : 'var(--purple)' }))} max={Math.max(horasDia, ...uso)} format={(v) => `${v} h`} />
            <span className="small grey">Calculado pelos intervalos entre check-out e check-in.</span>
            {utilizacao < 50 && horasUso > 0 && <p className="small" style={{ color: 'var(--purple)' }}>Ativo pouco utilizado — avalie realocar para outra equipe ou obra.</p>}
          </Card>
        )}
      </div>

      {!entrega && ['Veículo', 'Equipamento', 'Ferramenta'].includes(ativo.tipo) && <Rastreador ativo={ativo} />}

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
          {mov.tipo === 'checkout' ? (
            <Field label="Retirado por" as="select" value={mov.responsavelId} onChange={(e) => setMov({ ...mov, responsavelId: e.target.value })} options={[{ value: '', label: 'Eu mesmo' }, ...opcoesEquipe]} />
          ) : (
            <Field label="Local" value={mov.local} onChange={(e) => setMov({ ...mov, local: e.target.value })} placeholder="Vazio = base da empresa" />
          )}
          <Button type="submit" block>
            Confirmar
          </Button>
        </form>
      </Modal>

      <Modal title="Transferir responsável" open={modal === 'transferir'} onClose={() => setModal(null)}>
        <Field label="Novo responsável" as="select" value={destino} onChange={(e) => setDestino(e.target.value)} options={opcoesEquipe} />
        <Button
          block
          onClick={async () => {
            const r = await transferirAtivo(ativo.id, Number(destino))
            if (!r) return
            setModal(null)
            toast(`Responsabilidade transferida para ${r.responsavel}.`)
          }}
        >
          Transferir
        </Button>
      </Modal>

      <Modal title="Marcar como extraviado?" open={modal === 'extraviado'} onClose={() => setModal(null)}>
        <p className="muted">Abre um alerta para a busca e o ativo sai do inventário disponível. Um check-in ou leitura posterior encerra o alerta.</p>
        <div className="grid-2" style={{ gap: 12 }}>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!(await marcarExtraviado(ativo.id))) return
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
