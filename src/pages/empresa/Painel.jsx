import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Mapa, { MapChip } from '../../components/mapa/Mapa'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import KpiCard from '../../components/ui/KpiCard'
import LabeledBar from '../../components/ui/LabeledBar'
import ListItem from '../../components/ui/ListItem'
import Person from '../../components/ui/Person'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import useRelatorio from '../../hooks/useRelatorio'
import { marcadoresAtivos, marcadoresEntregadores } from '../../utils/ativos'
import { deltaPp, pct } from '../../utils/format'
import { SEVERIDADE, TIPOS_ALERTA } from '../../utils/status'
import { duracao, previsaoTexto, relativo } from '../../utils/tempo'

const EM_ABERTO = ['confirmado', 'coletado', 'transito', 'saiu', 'atrasado', 'tentativa']

export default function Painel() {
  const { entregas, ativos, alertas, posicoes, usuario, tempoReal } = useApp()
  const navigate = useNavigate()
  const { dados: rel } = useRelatorio('7d')

  const pendentes = entregas.filter((e) => EM_ABERTO.includes(e.status)).sort((a, b) => Date.parse(a.prazoLimite) - Date.parse(b.prazoLimite))
  const atrasadas = pendentes.filter((e) => e.atrasada).length
  const operacionais = ativos.filter((a) => a.tipo !== 'Carga')
  const emCampo = operacionais.filter((a) => ['em_uso', 'desvio', 'inativo'].includes(a.status)).length
  const abertos = alertas.filter((a) => a.status !== 'resolvido').sort((a, b) => SEVERIDADE[b.severidade].peso - SEVERIDADE[a.severidade].peso || Date.parse(b.abertoEm) - Date.parse(a.abertoEm))
  const criticos = abertos.filter((a) => a.severidade === 'critico').length

  const marcadores = useMemo(
    () => [...marcadoresAtivos(ativos.filter((a) => a.tipo !== 'Carga' || ['coletado', 'em_uso'].includes(a.status))), ...marcadoresEntregadores(posicoes.entregadores)],
    [ativos, posicoes],
  )
  const etapas = rel?.entregas.etapas ?? []
  const maiorEtapa = Math.max(1, ...etapas.map((g) => g.mediaMin ?? 0))

  return (
    <Page title="Painel da operação" subtitle={`${usuario.empresa ?? 'Sua empresa'} · ${tempoReal ? 'atualizando em tempo real' : 'reconectando…'}`}>
      <div className="grid-4">
        <KpiCard label="Entregas em aberto" value={pendentes.length} delta={`${atrasadas} atrasada(s) agora`} deltaColor={atrasadas ? 'var(--amber)' : 'var(--green)'} />
        <KpiCard
          label="No prazo · 7 dias"
          value={pct(rel?.entregas.noPrazoPct)}
          delta={rel ? deltaPp(rel.entregas.noPrazoPct, rel.entregas.noPrazoPctAnterior) ?? `${rel.entregas.concluidas} entregas concluídas` : '…'}
          deltaColor={rel && rel.entregas.noPrazoPct < rel.entregas.noPrazoPctAnterior ? 'var(--red)' : 'var(--green)'}
        />
        <KpiCard label="Ativos em campo" value={`${emCampo} / ${operacionais.length}`} delta={`${operacionais.filter((a) => a.status === 'disponivel').length} disponíveis`} deltaColor="var(--muted)" />
        <KpiCard label="Alertas abertos" value={abertos.length} delta={`${criticos} crítico(s)`} deltaColor={criticos ? 'var(--red)' : 'var(--muted)'} />
      </div>

      <div className="grid-aside">
        <Card
          title="Mapa ao vivo"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/empresa/mapa')}>
              Tela cheia
            </Button>
          }
        >
          <Mapa marcadores={marcadores} onSelecionar={(id) => !id.startsWith('u') && navigate(`/empresa/ativos/${id}`)} height={340} rotulo="Mapa ao vivo da operação">
            <MapChip style={{ bottom: 12, left: 12 }}>
              <Icon name="map" size={16} color="var(--pink)" /> {posicoes.entregadores.length} entregador(es) com GPS · {marcadores.length - posicoes.entregadores.length} ativos
            </MapChip>
          </Mapa>
        </Card>
        <Card title="Alertas" action={<Badge tone={abertos.length ? 'danger' : 'success'}>{abertos.length} abertos</Badge>}>
          {abertos.length === 0 && <EmptyState icon="check" title="Nenhum alerta aberto">As regras de monitoramento são conferidas a cada minuto.</EmptyState>}
          {abertos.slice(0, 4).map((a) => (
            <ListItem
              key={a.id}
              icon={TIPOS_ALERTA[a.tipo]?.icon ?? 'alert'}
              color={SEVERIDADE[a.severidade].color}
              title={a.titulo}
              subtitle={a.entidade}
              meta={`aberto ${relativo(a.abertoEm)}`}
              onClick={() => navigate(`/empresa/alertas?id=${a.id}`)}
            />
          ))}
          <Button variant="violet" block onClick={() => navigate('/empresa/alertas')}>
            Abrir central de alertas
          </Button>
        </Card>
      </div>

      <div className="grid-aside">
        <Card title="Próximos prazos" action={<button className="link" onClick={() => navigate('/empresa/entregas')}>Ver todas →</button>}>
          {pendentes.length === 0 ? (
            <EmptyState icon="box" title="Nenhuma entrega em aberto" />
          ) : (
            <DataTable
              rows={pendentes.slice(0, 6)}
              onRowClick={(e) => navigate(`/empresa/entregas?q=${e.id}`)}
              columns={[
                { key: 'id', label: 'Código', render: (e) => <strong>{e.id}</strong> },
                { key: 'cliente', label: 'Destino' },
                { key: 'resp', label: 'Responsável', render: (e) => (e.responsavel ? <Person name={e.responsavel} /> : <span className="amber">Sem entregador</span>) },
                { key: 'prazo', label: 'Prazo', render: (e) => <span className={e.atrasada ? 'red' : undefined}>{previsaoTexto(e)}</span> },
                { key: 'status', label: 'Status', render: (e) => <EntregaBadge status={e.status} /> },
              ]}
            />
          )}
        </Card>
        <Card title="Gargalos por etapa">
          {!rel && <p className="muted">Calculando…</p>}
          {etapas.map((g) => (
            <LabeledBar
              key={g.etapa}
              label={g.etapa}
              value={g.mediaMin == null ? '—' : duracao(g.mediaMin)}
              percent={((g.mediaMin ?? 0) / maiorEtapa) * 100}
              color={g.mediaMin === maiorEtapa ? 'var(--red)' : g.mediaMin > maiorEtapa / 2 ? 'var(--amber)' : 'var(--green)'}
            />
          ))}
          <span className="small grey">Tempo médio em cada etapa, medido pelos eventos das entregas concluídas nos últimos 7 dias</span>
        </Card>
      </div>
    </Page>
  )
}
