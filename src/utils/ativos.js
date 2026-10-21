// Cor do marcador do ativo no mapa, conforme o status
export const COR_STATUS_ATIVO = {
  em_uso: '#4CAF50',
  disponivel: '#8E64D8',
  inativo: '#F5A524',
  desvio: '#F5A524',
  manutencao: '#979797',
  sem_sinal: '#FF5C6C',
  extraviado: '#FF5C6C',
}

export const RESPONSAVEIS = ['Thiago Rodrigues', 'Carla Menezes', 'Diego Santos', 'Ana Paula Lima', 'Rafael Toscano', 'Jonas Ferreira']

export const toMarkers = (ativos) =>
  ativos.map((a) => ({ id: a.id, x: a.x, y: a.y, color: COR_STATUS_ATIVO[a.status] ?? '#8E64D8', label: `${a.nome} (${a.id})` }))
