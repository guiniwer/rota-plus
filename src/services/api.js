// Cliente HTTP da API do Rota+ (Express + SQLite em /server).
const BASE = import.meta.env.VITE_API_URL ?? '/api'
const TOKEN_KEY = 'rota:token'

const seguro = (fn, padrao = null) => {
  try {
    return fn()
  } catch {
    return padrao
  }
}

export const tokenStorage = {
  get: () => seguro(() => localStorage.getItem(TOKEN_KEY)),
  set: (t) => seguro(() => localStorage.setItem(TOKEN_KEY, t)),
  clear: () => seguro(() => localStorage.removeItem(TOKEN_KEY)),
}

export class ApiError extends Error {
  constructor(message, status, dados = {}) {
    super(message)
    this.status = status
    this.campo = dados.campo
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
    // status 0 = sem conexão (o app do entregador guarda na fila offline)
    throw new ApiError('Sem conexão com o servidor.', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.erro ?? 'Erro de comunicação com o servidor.', res.status, data)
  return data
}

/** Baixa um arquivo autenticado (ex.: relatório CSV). */
export async function baixar(path, nome) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${tokenStorage.get()}` } })
  if (!res.ok) throw new ApiError('Não foi possível baixar o arquivo.', res.status)
  const url = URL.createObjectURL(await res.blob())
  Object.assign(document.createElement('a'), { href: url, download: nome }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * URL do fluxo de eventos em tempo real. O EventSource não envia cabeçalhos, então pedimos antes
 * um ingresso de uso único (60 s) — o token da sessão nunca vai na URL.
 */
export async function urlEventos() {
  const { ingresso } = await api('/eventos/ingresso', { method: 'POST' })
  return `${BASE}/eventos?ingresso=${encodeURIComponent(ingresso)}`
}

const qs = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString()

// Endpoints agrupados por recurso
export const AuthApi = {
  login: (dados) => api('/auth/login', { method: 'POST', body: dados }),
  cadastro: (dados) => api('/auth/cadastro', { method: 'POST', body: dados }),
  convite: (token) => api(`/auth/convite/${token}`),
  me: () => api('/auth/me'),
  atualizarPerfil: (dados) => api('/auth/perfil', { method: 'PATCH', body: dados }),
  alterarSenha: (atual, nova) => api('/auth/senha', { method: 'POST', body: { atual, nova } }),
  logout: () => api('/auth/logout', { method: 'POST' }),
}

export const EntregasApi = {
  listar: () => api('/entregas'),
  buscar: (id) => api(`/entregas/${id}`),
  criar: (dados) => api('/entregas', { method: 'POST', body: dados }),
  importar: (linhas) => api('/entregas/importar', { method: 'POST', body: { linhas } }),
  status: (id, dados) => api(`/entregas/${id}/status`, { method: 'PATCH', body: dados }),
  comprovante: (id, dados) => api(`/entregas/${id}/comprovante`, { method: 'POST', body: dados }),
  verComprovante: (id) => api(`/entregas/${id}/comprovante`),
  atribuir: (id, entregadorId) => api(`/entregas/${id}/responsavel`, { method: 'PATCH', body: { entregadorId } }),
  avaliar: (id, avaliacao) => api(`/entregas/${id}/avaliacao`, { method: 'POST', body: avaliacao }),
  ocorrencia: (id, dados) => api(`/entregas/${id}/ocorrencia`, { method: 'POST', body: dados }),
  reagendar: (id, dados) => api(`/entregas/${id}/reagendar`, { method: 'PATCH', body: dados }),
  instrucoes: (id, instrucoes) => api(`/entregas/${id}/instrucoes`, { method: 'PATCH', body: { instrucoes } }),
  mensagens: (id) => api(`/entregas/${id}/mensagens`),
  enviarMensagem: (id, texto) => api(`/entregas/${id}/mensagens`, { method: 'POST', body: { texto } }),
  avisar: (id, canal, mensagem) => api(`/entregas/${id}/aviso`, { method: 'POST', body: { canal, mensagem } }),
  acompanhamento: (id) => api(`/entregas/${id}/acompanhamento`),
  rastrear: (codigo, documento) => api(`/rastreio?${qs({ codigo, documento })}`),
  acompanhamentoPublico: (codigo, documento) => api(`/rastreio/acompanhamento?${qs({ codigo, documento })}`),
  inscreverAvisos: (dados) => api('/rastreio/avisos', { method: 'POST', body: dados }),
}

export const AtivosApi = {
  listar: () => api('/ativos'),
  criar: (dados) => api('/ativos', { method: 'POST', body: dados }),
  movimentar: (id, mov) => api(`/ativos/${id}/movimentacao`, { method: 'POST', body: mov }),
  transferir: (id, responsavelId) => api(`/ativos/${id}/responsavel`, { method: 'PATCH', body: { responsavelId } }),
  extraviado: (id) => api(`/ativos/${id}/extraviado`, { method: 'POST' }),
  vincularRastreador: (id) => api(`/ativos/${id}/rastreador`, { method: 'POST' }),
  desvincularRastreador: (id) => api(`/ativos/${id}/rastreador`, { method: 'DELETE' }),
  posicoes: (id, horas = 24) => api(`/ativos/${id}/posicoes?${qs({ horas })}`),
}

export const AlertasApi = {
  listar: () => api('/alertas'),
  assumir: (id) => api(`/alertas/${id}/assumir`, { method: 'POST' }),
  resolver: (id) => api(`/alertas/${id}/resolver`, { method: 'POST' }),
  alternarPasso: (id, ordem) => api(`/alertas/${id}/passos/${ordem}`, { method: 'PATCH' }),
}

export const RotasApi = {
  /** Ordem otimizada das paradas pendentes (entregador: a própria; admin: informe o entregador). */
  otimizada: (entregadorId) => api(`/rotas/otimizada${entregadorId ? `?${qs({ entregadorId })}` : ''}`),
}

export const LocalizacaoApi = {
  enviar: (pos) => api('/localizacao', { method: 'POST', body: pos }),
  equipe: () => api('/posicoes'),
}

export const EmpresaApi = {
  publicas: () => api('/empresas'),
  sistema: () => api('/sistema'),
  dados: () => api('/empresa'),
  salvar: (dados) => api('/empresa', { method: 'PATCH', body: dados }),
  privacidade: (valor) => api('/empresa/privacidade', { method: 'PUT', body: valor }),
  aceitarTermo: () => api('/empresa/termo', { method: 'POST' }),
  gerarApiKey: () => api('/empresa/api-key', { method: 'POST' }),
  revogarApiKey: () => api('/empresa/api-key', { method: 'DELETE' }),
  webhook: (url) => api('/empresa/webhook', { method: 'PUT', body: { url } }),
  testarWebhook: () => api('/empresa/webhook/teste', { method: 'POST' }),
  testarEmail: (para) => api('/empresa/email/teste', { method: 'POST', body: { para } }),
  mensagens: () => api('/mensagens'),
  relatorio: (periodo) => api(`/relatorios?${qs({ periodo })}`),
  baixarRelatorio: (periodo) => baixar(`/relatorios/csv?${qs({ periodo })}`, `relatorio-rota-plus-${periodo}.csv`),
}

export const EquipeApi = {
  listar: () => api('/equipe'),
  adesao: () => api('/equipe/adesao'),
  lembrete: (texto) => api('/equipe/lembrete', { method: 'POST', body: { texto } }),
  definirBase: (id, dados) => api(`/equipe/${id}`, { method: 'PATCH', body: dados }),
  convites: () => api('/convites'),
  convidar: (email) => api('/convites', { method: 'POST', body: { email } }),
  cancelarConvite: (token) => api(`/convites/${token}`, { method: 'DELETE' }),
}

export const GeralApi = {
  notificacoes: () => api('/notificacoes'),
  lerNotificacao: (id) => api(`/notificacoes/${id}/lida`, { method: 'POST' }),
  lerTodas: () => api('/notificacoes/lidas', { method: 'POST' }),
  preferencias: () => api('/configuracoes/preferencias'),
  salvarPreferencias: (valor) => api('/configuracoes/preferencias', { method: 'PUT', body: valor }),
  inscreverPush: (inscricao) => api('/push/inscricao', { method: 'POST', body: inscricao }),
  cancelarPush: (endpoint) => api('/push/inscricao', { method: 'DELETE', body: { endpoint } }),
  resetDemo: () => api('/demo/reset', { method: 'POST' }),
}
