import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertasApi, AtivosApi, AuthApi, EmpresaApi, EntregasApi, EquipeApi, GeralApi, LocalizacaoApi, RotasApi, tokenStorage, urlEventos } from '../services/api'
import { papelDe } from '../utils/papel'

const AppContext = createContext(null)
const RESERVA_A_CADA = 60_000 // ms — busca de segurança caso o canal em tempo real caia

/** Troca o item com o mesmo id dentro da lista (ou insere no início). */
const substituir = (lista, item) => (lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [item, ...lista])

/** Estado global da aplicação. Os dados vêm da API (Express + SQLite) e são atualizados em tempo real (SSE). */
export function AppProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(() => Boolean(tokenStorage.get()))
  const [entregas, setEntregas] = useState([])
  const [ativos, setAtivos] = useState([])
  const [alertas, setAlertas] = useState([])
  const [equipe, setEquipe] = useState([])
  const [posicoes, setPosicoes] = useState({ entregadores: [], rotas: {} })
  const [notificacoes, setNotificacoes] = useState([])
  const [preferencias, setPrefState] = useState({})
  const [empresa, setEmpresa] = useState(null)
  const [tempoReal, setTempoReal] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const ouvintes = useRef(new Set())

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3600)
  }, [])

  const sair = useCallback(() => {
    tokenStorage.clear()
    setUsuario(null)
    // não deixa dados de uma conta aparecerem para a próxima
    ;[setEntregas, setAtivos, setAlertas, setEquipe, setNotificacoes].forEach((set) => set([]))
    setEmpresa(null)
    setPosicoes({ entregadores: [], rotas: {} })
  }, [])

  /** Executa uma chamada à API mostrando o erro em um toast. */
  const executar = useCallback(
    async (fn) => {
      try {
        return await fn()
      } catch (err) {
        toast(err.message)
        if (err.status === 401) sair()
        return null
      }
    },
    [toast, sair],
  )

  // ---------- carregamento por recurso ----------
  const carregadores = useCallback(
    (u) => {
      const papel = papelDe(u)
      return {
        entregas: () => EntregasApi.listar().then(setEntregas),
        notificacoes: () => GeralApi.notificacoes().then(setNotificacoes),
        ...(papel === 'empresa' && {
          ativos: () => AtivosApi.listar().then(setAtivos),
          alertas: () => AlertasApi.listar().then(setAlertas),
          equipe: () => EquipeApi.listar().then(setEquipe),
          posicoes: () => LocalizacaoApi.equipe().then(setPosicoes),
        }),
      }
    },
    [],
  )

  const carregarDados = useCallback(
    async (u) => {
      const c = carregadores(u)
      const papel = papelDe(u)
      await Promise.all([
        ...Object.values(c).map((f) => f()),
        GeralApi.preferencias().then(setPrefState),
        papel !== 'cliente' ? EmpresaApi.dados().then(setEmpresa) : null,
      ])
    },
    [carregadores],
  )

  // ao abrir o site, recupera a sessão salva
  useEffect(() => {
    if (!tokenStorage.get()) return
    AuthApi.me()
      .then(async ({ usuario: u }) => {
        await carregarDados(u)
        setUsuario(u)
      })
      .catch(() => tokenStorage.clear())
      .finally(() => setCarregando(false))
  }, [carregarDados])

  // ---------- tempo real: o servidor avisa o que mudou e buscamos só aquele recurso ----------
  useEffect(() => {
    if (!usuario) return undefined
    const c = carregadores(usuario)
    const pendentes = new Map()
    const recarregar = (recurso) => {
      if (!c[recurso] || pendentes.has(recurso)) return
      // agrupa várias mudanças seguidas em uma só busca
      pendentes.set(recurso, setTimeout(() => {
        pendentes.delete(recurso)
        c[recurso]().catch(() => {})
      }, 300))
    }
    const fonte = new EventSource(urlEventos())
    fonte.onopen = () => setTempoReal(true)
    fonte.onerror = () => setTempoReal(false)
    fonte.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      msg.recursos.forEach(recarregar)
      ouvintes.current.forEach((fn) => fn(msg.recursos))
    }
    const reserva = setInterval(() => Object.keys(c).forEach(recarregar), RESERVA_A_CADA)
    return () => {
      fonte.close()
      clearInterval(reserva)
      pendentes.forEach((t) => clearTimeout(t))
      setTempoReal(false)
    }
  }, [usuario, carregadores])

  /** Permite que uma tela reaja a eventos (ex.: "posicoes", "mensagens:RT-123"). */
  const ouvir = useCallback((fn) => {
    ouvintes.current.add(fn)
    return () => ouvintes.current.delete(fn)
  }, [])

  // ---------- autenticação ----------
  const entrar = async (resposta) => {
    tokenStorage.set(resposta.token)
    await carregarDados(resposta.usuario)
    setUsuario(resposta.usuario)
    return resposta.usuario
  }
  /** Lança erro (com mensagem) se as credenciais forem inválidas. */
  const login = async (perfil, credenciais) => entrar(await AuthApi.login({ perfil, ...credenciais }))
  const cadastrar = async (dados) => entrar(await AuthApi.cadastro(dados))
  /** Atualiza nome, e-mail, telefone etc. Lança erro com mensagem se a API recusar. */
  const atualizarPerfil = async (dados) => {
    const { usuario: u } = await AuthApi.atualizarPerfil(dados)
    setUsuario(u)
    return u
  }
  const alterarSenha = (atual, nova) => AuthApi.alterarSenha(atual, nova)
  const logout = async () => {
    await AuthApi.logout().catch(() => {})
    sair()
  }

  // ---------- notificações ----------
  const marcarLida = (id) => {
    setNotificacoes((list) => list.map((n) => (n.id === id ? { ...n, lida: true } : n)))
    executar(() => GeralApi.lerNotificacao(id))
  }
  const marcarTodasLidas = () => {
    setNotificacoes((list) => list.map((n) => ({ ...n, lida: true })))
    executar(() => GeralApi.lerTodas())
  }

  // ---------- entregas ----------
  const atualizarEntrega = (e) => {
    if (e) setEntregas((list) => substituir(list, e))
    return e
  }
  /** Cria o pedido e devolve o código gerado pelo banco (ou null se falhar). */
  const criarPedido = async (dados) => (await executar(() => EntregasApi.criar(dados).then(atualizarEntrega)))?.id ?? null
  const atualizarStatusEntrega = (id, status, descricao, extra = {}) => executar(() => EntregasApi.status(id, { status, descricao, ...extra }).then(atualizarEntrega))
  const atribuirEntrega = (id, entregadorId) => executar(() => EntregasApi.atribuir(id, entregadorId || null).then(atualizarEntrega))
  /** Rota otimizada (null se falhar). O admin informa o entregador. */
  const otimizarRota = (entregadorId) => executar(() => RotasApi.otimizada(entregadorId))
  const avaliarEntrega = async (id, avaliacao) => {
    const e = await executar(() => EntregasApi.avaliar(id, avaliacao).then(atualizarEntrega))
    if (e) toast('Obrigado! Sua avaliação foi registrada.')
    return e
  }
  /** Rastreio público (sem login). Retorna a entrega ou null. */
  const rastrear = (codigo, documento) => EntregasApi.rastrear(codigo, documento).catch(() => null)

  // ---------- ativos ----------
  const atualizarAtivo = async (fn) => {
    const a = await executar(fn)
    if (a) setAtivos((list) => substituir(list, a))
    return a
  }
  const registrarMovimentacao = (id, mov) => atualizarAtivo(() => AtivosApi.movimentar(id, mov))
  const transferirAtivo = (id, responsavelId) => atualizarAtivo(() => AtivosApi.transferir(id, responsavelId))
  const marcarExtraviado = (id) => atualizarAtivo(() => AtivosApi.extraviado(id))
  const cadastrarAtivo = async (dados) => (await atualizarAtivo(() => AtivosApi.criar(dados)))?.id ?? null

  // ---------- alertas ----------
  const atualizarAlerta = async (fn) => {
    const a = await executar(fn)
    if (a) setAlertas((list) => substituir(list, a))
    return a
  }
  const assumirAlerta = (id) => atualizarAlerta(() => AlertasApi.assumir(id))
  const resolverAlerta = (id) => atualizarAlerta(() => AlertasApi.resolver(id))
  const alternarPasso = (id, ordem) => atualizarAlerta(() => AlertasApi.alternarPasso(id, ordem))

  // ---------- preferências e empresa (aceitam objeto ou função, como o setState) ----------
  const setPreferencias = (valorOuFn) => {
    const novo = typeof valorOuFn === 'function' ? valorOuFn(preferencias) : valorOuFn
    setPrefState(novo)
    executar(() => GeralApi.salvarPreferencias(novo))
  }
  const privacidade = empresa?.privacidade ?? {}
  const setPrivacidade = (valorOuFn) => {
    const novo = typeof valorOuFn === 'function' ? valorOuFn(privacidade) : valorOuFn
    setEmpresa((e) => ({ ...e, privacidade: novo }))
    executar(() => EmpresaApi.privacidade(novo))
  }
  const recarregarEmpresa = () => EmpresaApi.dados().then(setEmpresa).catch(() => {})

  const resetarDemo = async () => {
    const ok = await executar(() => GeralApi.resetDemo())
    if (!ok) return
    sair()
    toast('Dados de demonstração restaurados. Entre novamente.')
  }

  const value = {
    usuario,
    papel: papelDe(usuario),
    carregando,
    tempoReal,
    ouvir,
    executar,
    login,
    cadastrar,
    logout,
    atualizarPerfil,
    alterarSenha,
    otimizarRota,
    entregas,
    atualizarEntrega,
    criarPedido,
    atualizarStatusEntrega,
    atribuirEntrega,
    avaliarEntrega,
    rastrear,
    ativos,
    registrarMovimentacao,
    transferirAtivo,
    marcarExtraviado,
    cadastrarAtivo,
    alertas,
    assumirAlerta,
    resolverAlerta,
    alternarPasso,
    equipe,
    entregadores: equipe, // a equipe de campo são os usuários com função "entregador"
    posicoes,
    notificacoes,
    marcarLida,
    marcarTodasLidas,
    preferencias,
    setPreferencias,
    empresa,
    recarregarEmpresa,
    privacidade,
    setPrivacidade,
    toast,
    toastMsg,
    resetarDemo,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro de <AppProvider>')
  return ctx
}

/** Entregas do cliente logado (a API já devolve só as dele). */
// eslint-disable-next-line react-refresh/only-export-components
export function useEntregasDoCliente() {
  return useApp().entregas
}

/** Executa fn quando o servidor avisar que um dos recursos mudou. */
// eslint-disable-next-line react-refresh/only-export-components
export function useEventos(recursos, fn) {
  const { ouvir } = useApp()
  const ref = useRef(fn)
  useEffect(() => {
    ref.current = fn
  })
  const chave = recursos.join(',')
  useEffect(() => ouvir((mudou) => mudou.some((r) => chave.split(',').includes(r)) && ref.current()), [ouvir, chave])
}
