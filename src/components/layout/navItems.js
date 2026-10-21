// Itens de navegação por perfil. "mobile: true" aparece na barra inferior do celular.
export const NAV = {
  cliente: [
    { to: '/cliente', icon: 'home', label: 'Início', end: true, mobile: true },
    { to: '/cliente/novo-pedido', icon: 'plus', label: 'Novo pedido', fab: true },
    { to: '/cliente/acompanhar', icon: 'truck', label: 'Acompanhar entrega' },
    { to: '/cliente/status', icon: 'box', label: 'Status da encomenda' },
    { to: '/cliente/previsao', icon: 'clock', label: 'Previsão de chegada' },
    { to: '/cliente/historico', icon: 'list', label: 'Histórico', mobile: true },
    { to: '/cliente/notificacoes', icon: 'bell', label: 'Notificações', mobile: true, badge: 'notificacoes' },
    { to: '/cliente/avaliar', icon: 'star', label: 'Avaliar entrega' },
  ],
  empresa: [
    { to: '/empresa', icon: 'grid', label: 'Painel da operação', end: true, mobile: true },
    { to: '/empresa/entregas', icon: 'truck', label: 'Entregas' },
    { to: '/empresa/ativos', icon: 'box', label: 'Ativos', mobile: true },
    { to: '/empresa/mapa', icon: 'map', label: 'Mapa ao vivo' },
    { to: '/empresa/alertas', icon: 'alert', label: 'Central de alertas', mobile: true, badge: 'alertas' },
    { to: '/empresa/equipes', icon: 'users', label: 'Equipes de campo' },
    { to: '/empresa/relatorios', icon: 'chart', label: 'Relatórios' },
    { to: '/empresa/campo', icon: 'route', label: 'App de campo' },
    { to: '/empresa/escanear', icon: 'qr', label: 'Escanear QR Code', fab: true },
    { to: '/empresa/configuracoes', icon: 'settings', label: 'Configurações' },
  ],
}
