// Papel do usuário logado: define qual área do sistema ele acessa.
//  cliente    → área do cliente
//  empresa    → visão operacional (administrador da empresa)
//  entregador → tela do entregador
export function papelDe(usuario) {
  if (!usuario) return null
  if (usuario.perfil === 'cliente') return 'cliente'
  return usuario.funcao === 'entregador' ? 'entregador' : 'empresa'
}

export const INICIO = { cliente: '/cliente', empresa: '/empresa', entregador: '/entregador' }
