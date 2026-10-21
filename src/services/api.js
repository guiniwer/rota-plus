// Cliente HTTP da API do Rota+ (Express + SQLite em /server).
const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'rota:token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

/** Faz a requisição, envia o token e transforma erros da API em ApiError com mensagem amigável. */
export async function api(path, { method = 'GET', body } = {}) {
  const token = tokenStorage.get()
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Ele está rodando (npm run dev)?', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.erro ?? 'Erro de comunicação com o servidor.', res.status)
  return data
}

const qs = (params) => new URLSearchParams(params).toString()

// Endpoints agrupados por recurso
export const AuthApi = {
  login: (dados) => api('/auth/login', { method: 'POST', body: dados }),
  cadastro: (dados) => api('/auth/cadastro', { method: 'POST', body: dados }),
  me: () => api('/auth/me'),
  logout: () => api('/auth/logout', { method: 'POST' }),
}

export const EntregasApi = {
  listar: () => api('/entregas'),
  criar: (dados) => api('/entregas', { method: 'POST', body: dados }),
  status: (id, status, descricao) => api(`/entregas/${id}/status`, { method: 'PATCH', body: { status, descricao } }),
  responsavel: (id, responsavel) => api(`/entregas/${id}/responsavel`, { method: 'PATCH', body: { responsavel } }),
  avaliar: (id, avaliacao) => api(`/entregas/${id}/avaliacao`, { method: 'POST', body: avaliacao }),
  rastrear: (codigo, documento) => api(`/rastreio?${qs({ codigo, documento })}`),
}

export const AtivosApi = {
  listar: () => api('/ativos'),
  criar: (dados) => api('/ativos', { method: 'POST', body: dados }),
  movimentar: (id, mov) => api(`/ativos/${id}/movimentacao`, { method: 'POST', body: mov }),
  transferir: (id, responsavel) => api(`/ativos/${id}/responsavel`, { method: 'PATCH', body: { responsavel } }),
  extraviado: (id) => api(`/ativos/${id}/extraviado`, { method: 'POST' }),
}

export const AlertasApi = {
  listar: () => api('/alertas'),
  assumir: (id) => api(`/alertas/${id}/assumir`, { method: 'POST' }),
  resolver: (id) => api(`/alertas/${id}/resolver`, { method: 'POST' }),
  alternarPasso: (id, ordem) => api(`/alertas/${id}/passos/${ordem}`, { method: 'PATCH' }),
}

export const GeralApi = {
  notificacoes: () => api('/notificacoes'),
  lerNotificacao: (id) => api(`/notificacoes/${id}/lida`, { method: 'POST' }),
  lerTodas: () => api('/notificacoes/lidas', { method: 'POST' }),
  config: (chave) => api(`/configuracoes/${chave}`),
  salvarConfig: (chave, valor) => api(`/configuracoes/${chave}`, { method: 'PUT', body: valor }),
  equipe: () => api('/equipe'),
  resetDemo: () => api('/demo/reset', { method: 'POST' }),
}
