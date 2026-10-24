import { useMemo } from 'react'
import useAcompanhamento from '../../hooks/useAcompanhamento'
import Mapa, { MapChip } from '../mapa/Mapa'
import Icon from '../ui/Icon'
import { STATUS_ENTREGA } from '../../utils/status'
import { duracao, hora, relativo } from '../../utils/tempo'

const MOTIVO = {
  sem_entregador: 'Aguardando a transportadora designar o entregador.',
  aguardando_coleta: 'O entregador ainda não saiu com a sua encomenda.',
  finalizada: null,
  por_etapas: 'Rastreamento por centro de distribuição: atualizado a cada etapa.',
  privacidade: 'A transportadora não compartilha a posição do entregador.',
  sem_sinal: 'O entregador está sem sinal de GPS no momento.',
}

/** Mapa real da entrega: origem, destino e — quando a caminho — o entregador, o trajeto e a chegada estimada. */
export default function MapaEntrega({ entrega, height = 320, acompanhamento, documento }) {
  // a página pode já ter os dados (para mostrar o ETA em outro lugar); senão, busca aqui
  const proprio = useAcompanhamento(acompanhamento === undefined ? entrega.id : null, documento)
  const a = acompanhamento === undefined ? proprio : acompanhamento

  const marcadores = useMemo(() => {
    if (!a) return []
    const m = []
    if (a.origem) m.push({ id: 'origem', lat: a.origem.lat, lng: a.origem.lng, forma: 'base', cor: 'var(--violet)', texto: 'A', popup: ['Origem', entrega.origem] })
    if (a.destino) m.push({ id: 'destino', lat: a.destino.lat, lng: a.destino.lng, forma: 'numero', texto: 'B', popup: ['Destino', entrega.destino, a.destino.aproximado ? 'Posição aproximada (cidade)' : ''].filter(Boolean) })
    if (a.entregador?.lat != null) m.push({ id: 'entregador', lat: a.entregador.lat, lng: a.entregador.lng, forma: 'veiculo', texto: '➤', cor: '#E856A6', precisao: a.entregador.precisao, popup: [a.entregador.nome, `GPS ${relativo(a.entregador.atualizadoEm)}`] })
    return m
  }, [a, entrega.origem, entrega.destino])
  const linhas = useMemo(() => {
    if (!a) return []
    if (a.eta?.trajeto?.length > 1) return [{ pontos: a.eta.trajeto }]
    if (a.origem && a.destino) return [{ pontos: [[a.origem.lat, a.origem.lng], [a.destino.lat, a.destino.lng]], tracejada: true, cor: '#8E64D8' }]
    return []
  }, [a])

  const aviso = a && !a.eta && MOTIVO[a.motivo]
  return (
    <Mapa marcadores={marcadores} linhas={linhas} chaveAjuste={a?.entregador ? 'entregador' : 'rota'} height={height} rotulo={`Mapa da entrega ${entrega.id}`}>
      <MapChip style={{ top: 12, left: 56 }}>
        <Icon name="truck" size={16} color="var(--pink)" /> {STATUS_ENTREGA[entrega.status].label}
      </MapChip>
      {a?.eta && (
        <div className="map-overlay" style={{ top: 12, right: 12 }}>
          <div className="map-chip" style={{ flexDirection: 'column', alignItems: 'flex-start', borderRadius: 14, padding: 12 }}>
            <span className="label">Chegada estimada</span>
            <strong style={{ fontSize: 24, color: 'var(--pink)' }}>{hora(a.eta.chegada)}</strong>
            <span className="small muted">
              ~{duracao(a.eta.minutos)} · {a.eta.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km{a.paradasAntes ? ` · ${a.paradasAntes} parada(s) antes` : ''}
            </span>
          </div>
        </div>
      )}
      {aviso && <MapChip style={{ bottom: 24, left: 12, right: 12 }}>{aviso}</MapChip>}
    </Mapa>
  )
}
