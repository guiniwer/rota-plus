// Etapas e status de uma entrega
export const ETAPAS = ['Pedido confirmado', 'Coletado', 'Em trânsito', 'Saiu para entrega', 'Entregue']

export const STATUS_ENTREGA = {
  confirmado: { label: 'Confirmado', tone: 'info', etapa: 0 },
  coletado: { label: 'Coletado', tone: 'info', etapa: 1 },
  transito: { label: 'Em trânsito', tone: 'pink', etapa: 2 },
  saiu: { label: 'Saiu para entrega', tone: 'pink', etapa: 3 },
  atrasado: { label: 'Atrasada', tone: 'danger', etapa: 3 },
  entregue: { label: 'Entregue', tone: 'success', etapa: 4 },
  tentativa: { label: 'Tentativa sem sucesso', tone: 'warning', etapa: 3 },
  cancelado: { label: 'Cancelado', tone: 'danger', etapa: -1 },
}

export const STATUS_ATIVO = {
  disponivel: { label: 'Disponível', tone: 'success' },
  em_uso: { label: 'Em uso', tone: 'info' },
  inativo: { label: 'Inativo', tone: 'warning' },
  desvio: { label: 'Desvio de rota', tone: 'warning' },
  sem_sinal: { label: 'Sem sinal', tone: 'danger' },
  manutencao: { label: 'Manutenção', tone: 'neutral' },
  extraviado: { label: 'Extraviado', tone: 'danger' },
  entregue: { label: 'Entregue', tone: 'success' }, // cargas
}

export const SEVERIDADE = {
  critico: { label: 'Crítico', color: 'var(--red)', tone: 'danger', peso: 3 },
  alto: { label: 'Alto', color: 'var(--amber)', tone: 'warning', peso: 2 },
  medio: { label: 'Médio', color: 'var(--amber)', tone: 'warning', peso: 1 },
  baixo: { label: 'Baixo', color: 'var(--purple)', tone: 'info', peso: 0 },
}

export const TIPOS_ALERTA = {
  atraso: { label: 'Atrasos', icon: 'clock', color: 'var(--red)' },
  desvio: { label: 'Desvio de rota', icon: 'route', color: 'var(--amber)' },
  inatividade: { label: 'Inatividade', icon: 'activity', color: 'var(--amber)' },
  sinal: { label: 'Perda de sinal', icon: 'wifioff', color: 'var(--red)' },
  uso_indevido: { label: 'Uso indevido', icon: 'lock', color: 'var(--purple)' },
  geocerca: { label: 'Saída de geocerca', icon: 'pin', color: 'var(--cyan)' },
}

export const TIPO_ATIVO_ICON = {
  Veículo: 'truck',
  Equipamento: 'wrench',
  Ferramenta: 'wrench',
  Carga: 'box',
}
