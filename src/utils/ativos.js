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

export const toMarkers = (ativos) =>
  ativos.map((a) => ({ id: a.id, x: a.x, y: a.y, color: COR_STATUS_ATIVO[a.status] ?? '#8E64D8', label: `${a.nome} (${a.id})` }))
