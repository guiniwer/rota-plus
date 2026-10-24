// Itens de navegação por perfil. "mobile: true" aparece na barra inferior do celular;
// "soBarra: true" fica só na barra inferior (no menu lateral já há o cartão do perfil / o atalho equivalente).
export const NAV = {
  cliente: [
    // enxuto: o pedido concentra mapa, chegada, ações e avaliação; as notificações ficam no sino do topo
    { to: '/cliente', icon: 'home', label: 'Início', end: true, mobile: true },
    { to: '/cliente/pedidos', icon: 'box', label: 'Meus pedidos', curto: 'Pedidos', mobile: true },
    { to: '/cliente/novo-pedido', icon: 'plus', label: 'Novo pedido', fab: true },
    { to: '/cliente/perfil', icon: 'user', label: 'Meu perfil', curto: 'Perfil', mobile: true, soBarra: true },
  ],
  empresa: [
    // o mapa ao vivo fica no Painel (com "tela cheia"); escanear fica em Ativos e no botão central do celular
    { to: '/empresa', icon: 'grid', label: 'Painel', end: true, mobile: true },
    { to: '/empresa/entregas', icon: 'truck', label: 'Entregas' },
    { to: '/empresa/ativos', icon: 'box', label: 'Ativos', mobile: true },
    { to: '/empresa/alertas', icon: 'alert', label: 'Central de alertas', curto: 'Alertas', mobile: true, badge: 'alertas' },
    { to: '/empresa/equipes', icon: 'users', label: 'Equipes' },
    { to: '/empresa/relatorios', icon: 'chart', label: 'Relatórios' },
    { to: '/empresa/configuracoes', icon: 'settings', label: 'Configurações' },
    { to: '/empresa/escanear', icon: 'qr', label: 'Escanear QR Code', fab: true, soBarra: true },
  ],
  // o entregador só acessa a própria tela de entregas (e o perfil)
  entregador: [
    { to: '/entregador', icon: 'route', label: 'Minhas entregas', curto: 'Entregas', end: true, mobile: true },
    { to: '/entregador/perfil', icon: 'user', label: 'Meu perfil', curto: 'Perfil', mobile: true, soBarra: true },
  ],
}
