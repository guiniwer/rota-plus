import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Mapa, { MapChip } from '../../components/mapa/Mapa'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import ListItem from '../../components/ui/ListItem'
import Toggle from '../../components/ui/Toggle'
import { AtivoBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { COR_STATUS_ATIVO, marcadoresAtivos, marcadoresEntregadores } from '../../utils/ativos'
import { TIPO_ATIVO_ICON } from '../../utils/status'
import { relativo } from '../../utils/tempo'

const CAMADAS = ['Veículo', 'Equipamento', 'Ferramenta', 'Carga']

export default function MapaAoVivo() {
  const { ativos, posicoes, tempoReal } = useApp()
  const navigate = useNavigate()
  const [camadas, setCamadas] = useState({ entregadores: true, Veículo: true, Equipamento: true, Ferramenta: false, Carga: true, rotas: true })
  const [selecionadoId, setSelecionadoId] = useState(null)

  // cargas só aparecem enquanto estão em rota
  const noMapa = useMemo(() => ativos.filter((a) => a.lat != null && (a.tipo !== 'Carga' || ['coletado', 'em_uso'].includes(a.status))), [ativos])
  const visiveis = useMemo(() => noMapa.filter((a) => camadas[a.tipo]), [noMapa, camadas])
  const equipe = useMemo(() => (camadas.entregadores ? posicoes.entregadores : []), [camadas.entregadores, posicoes])
  const marcadores = useMemo(() => [...marcadoresAtivos(visiveis), ...marcadoresEntregadores(equipe)], [visiveis, equipe])
  const linhas = useMemo(
    () => (camadas.rotas ? posicoes.entregadores.filter((u) => posicoes.rotas[u.id]?.length > 1).map((u) => ({ pontos: posicoes.rotas[u.id], cor: '#8E64D8', tracejada: true })) : []),
    [camadas.rotas, posicoes],
  )
  const ativoSel = ativos.find((a) => a.id === selecionadoId)
  const entregadorSel = posicoes.entregadores.find((u) => `u${u.id}` === selecionadoId)
  const alternar = (k) => (v) => setCamadas((c) => ({ ...c, [k]: v }))

  return (
    <Page
      title="Mapa ao vivo"
      subtitle={`${marcadores.length} pontos no mapa · ${tempoReal ? 'tempo real' : 'reconectando…'}`}
      actions={
        <Button variant="secondary" icon="grid" onClick={() => navigate('/empresa')}>
          Voltar ao painel
        </Button>
      }
    >
      <div className="grid-aside" style={{ gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
        <Card compact>
          <Mapa marcadores={marcadores} linhas={linhas} selecionadoId={selecionadoId} onSelecionar={setSelecionadoId} height={620} rotulo="Mapa ao vivo">
            <MapChip style={{ top: 16, left: 56 }}>
              <Icon name="refresh" size={16} color={tempoReal ? 'var(--green)' : 'var(--amber)'} /> {tempoReal ? 'Ao vivo' : 'Reconectando'}
            </MapChip>
            <MapChip style={{ bottom: 24, left: 16 }}>
              <span className="green">● Em uso</span> <span style={{ color: 'var(--purple)' }}>● Disponível</span> <span className="amber">● Parado/desvio</span> <span className="red">● Sem sinal</span>
            </MapChip>
          </Mapa>
        </Card>
        <div className="stack">
          <Card title="Camadas" compact>
            <Toggle title={`Entregadores com GPS (${posicoes.entregadores.length})`} checked={camadas.entregadores} onChange={alternar('entregadores')} />
            {CAMADAS.map((c) => (
              <Toggle key={c} title={`${c === 'Carga' ? 'Cargas em rota' : `${c}s`} (${noMapa.filter((a) => a.tipo === c).length})`} checked={camadas[c]} onChange={alternar(c)} />
            ))}
            <Toggle title="Rotas planejadas" checked={camadas.rotas} onChange={alternar('rotas')} />
          </Card>
          {ativoSel && (
            <Card title={ativoSel.nome} compact action={<AtivoBadge status={ativoSel.status} />}>
              <KeyValue label="Código" value={ativoSel.id} />
              <KeyValue label="Responsável" value={ativoSel.responsavel ?? '—'} />
              <KeyValue label="Local" value={ativoSel.local} />
              <KeyValue label="Última leitura" value={relativo(ativoSel.ultimaLeituraEm)} />
              <Button variant="secondary" size="sm" onClick={() => navigate(`/empresa/ativos/${ativoSel.id}`)}>
                Ver detalhes
              </Button>
            </Card>
          )}
          {entregadorSel && (
            <Card title={entregadorSel.nome} compact>
              <KeyValue label="Veículo" value={entregadorSel.veiculo ?? '—'} />
              <KeyValue label="Entregas em rota" value={entregadorSel.emRota} />
              <KeyValue label="Último GPS" value={`${relativo(entregadorSel.atualizadoEm)}${entregadorSel.precisao ? ` · ±${entregadorSel.precisao} m` : ''}`} />
              {entregadorSel.telefone && (
                <a className="btn btn-secondary btn-sm" href={`tel:${entregadorSel.telefone.replace(/\D/g, '')}`}>
                  <Icon name="phone" size={16} /> Ligar
                </a>
              )}
            </Card>
          )}
          <Card title="Unidades" compact>
            {visiveis.length + equipe.length === 0 && <EmptyState icon="map" title="Nada com posição conhecida">Os pontos aparecem quando o app do entregador, um rastreador ou uma leitura de QR/RFID registram a localização.</EmptyState>}
            {equipe.map((u) => (
              <ListItem key={`u${u.id}`} icon="truck" color="var(--pink)" title={u.nome} subtitle={`GPS ${relativo(u.atualizadoEm)}`} onClick={() => setSelecionadoId(`u${u.id}`)} />
            ))}
            {visiveis.slice(0, 8).map((a) => (
              <ListItem key={a.id} icon={TIPO_ATIVO_ICON[a.tipo] ?? 'box'} color={COR_STATUS_ATIVO[a.status]} title={a.nome} subtitle={a.local} onClick={() => setSelecionadoId(a.id)} />
            ))}
          </Card>
        </div>
      </div>
    </Page>
  )
}
