import { relativo } from './tempo'

// Cor do marcador do ativo no mapa, conforme o status
export const COR_STATUS_ATIVO = {
  em_uso: '#4CAF50',
  disponivel: '#8E64D8',
  inativo: '#F5A524',
  desvio: '#F5A524',
  manutencao: '#979797',
  sem_sinal: '#FF5C6C',
  extraviado: '#FF5C6C',
  entregue: '#06B6D4',
}

/** Categorias de ativo. "Carga" = ativo criado automaticamente para cada entrega. */
export const CATEGORIAS_ATIVO = ['Veículo', 'Equipamento', 'Ferramenta', 'Carga']

/** Tipos genéricos sugeridos no cadastro (sem marca/modelo do item). */
export const SUGESTOES_TIPO_ATIVO = {
  Veículo: ['Van de entrega', 'Caminhão', 'Motocicleta', 'Carro utilitário'],
  Equipamento: ['Gerador de energia', 'Andaime', 'Rastreador GPS', 'Empilhadeira', 'Betoneira'],
  Ferramenta: ['Furadeira', 'Multímetro', 'Parafusadeira', 'Kit de ferramentas'],
  Carga: ['Caixa', 'Envelope / documentos', 'Palete', 'Contêiner', 'Volume'],
}

/** Marcadores (Leaflet) dos ativos com posição conhecida. */
export const marcadoresAtivos = (ativos) =>
  ativos
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => ({
      id: a.id,
      lat: a.lat,
      lng: a.lng,
      cor: COR_STATUS_ATIVO[a.status] ?? '#8E64D8',
      titulo: `${a.nome} (${a.id})`,
      popup: [`${a.nome} · ${a.id}`, a.responsavel ? `Com ${a.responsavel}` : a.local, `Última leitura ${relativo(a.ultimaLeituraEm)}`],
    }))

/** Marcadores dos entregadores pela última posição enviada pelo app. */
export const marcadoresEntregadores = (lista) =>
  lista.map((u) => {
    const recente = Date.now() - Date.parse(u.atualizadoEm) < 10 * 60_000
    return {
      id: `u${u.id}`,
      lat: u.lat,
      lng: u.lng,
      forma: 'veiculo',
      texto: u.nome[0],
      cor: recente ? '#E856A6' : '#979797',
      precisao: u.precisao,
      titulo: u.nome,
      popup: [u.nome, `${u.emRota} entrega(s) em rota`, `GPS ${relativo(u.atualizadoEm)}${u.precisao ? ` · ±${u.precisao} m` : ''}`],
    }
  })
