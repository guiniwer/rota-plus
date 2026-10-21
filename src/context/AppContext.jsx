import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AlertasApi, AtivosApi, AuthApi, EntregasApi, GeralApi, RotasApi, tokenStorage } from '../services/api'
import { papelDe } from '../utils/papel'

const AppContext = createContext(null)
const ATUALIZAR_A_CADA = 10_000 // ms — busca novidades no banco (ex.: status alterado pela empresa)

/** Troca o item com o mesmo id dentro da lista. */
const substituir = (lista, item) => lista.map((x) => (x.id === item.id ? item : x))

/** Estado global da aplicação. Os dados vêm da API (Express + SQLite). */
export function AppProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(() => Boolean(tokenStorage.get()))
  const [entregas, setEntregas] = useState([])
  const [ativos, setAtivos] = useState([])
  const [alertas, setAlertas] = useState([])
  const [equipe, setEquipe] = useState([])
  const [notificacoes, setNotificacoes] = useState([])
  const [preferencias, setPrefState] = useState({})
  const [privacidade, setPrivState] = useState({})
  const [toastMsg, setToastMsg] = useState(null)

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3200)
  }, [])

  /** Executa uma chamada à API mostrando o erro em um toast. */
  const executar = useCallback(
    async (fn) => {
      try {
        return await fn()
      } catch (err) {
        toast(err.message)
        if (err.status === 401) {
          tokenStorage.clear()
          setUsuario(null)
        }
        return null
      }
    },
    [toast],
  )

  // ---------- carregamento dos dados do usuário logado ----------
  const carregarDados = useCallback(async (u) => {
    const papel = papelDe(u)
    if (papel === 'entregador') {
      setEntregas(await EntregasApi.listar())
    } else if (papel === 'empresa') {
      const [e, a, al, eq, priv] = await Promise.all([EntregasApi.listar(), AtivosApi.listar(), AlertasApi.listar(), GeralApi.equipe(), GeralApi.config('privacidade')])
      setEntregas(e)
      setAtivos(a)
      setAlertas(al)
      setEquipe(eq)
      setPrivState(priv)
    } else {
      const [e, n, pref] = await Promise.all([EntregasApi.listar(), GeralApi.notificacoes(), GeralApi.config('preferencias')])
      setEntregas(e)
      setNotificacoes(n)
      setPrefState(pref)
    }
  }, [])

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

  // atualização periódica: mostra mudanças feitas por outros usuários
  useEffect(() => {
    if (!usuario) return undefined
    const id = setInterval(() => {
      const papel = papelDe(usuario)
      const tarefas = [EntregasApi.listar().then(setEntregas)]
      // a visão operacional também recebe as atualizações feitas pelos entregadores
      if (papel === 'empresa') tarefas.push(AlertasApi.listar().then(setAlertas), AtivosApi.listar().then(setAtivos), GeralApi.equipe().then(setEquipe))
      if (papel === 'cliente') tarefas.push(GeralApi.notificacoes().then(setNotificacoes))
      Promise.all(tarefas).catch(() => {})
    }, ATUALIZAR_A_CADA)
    return () => clearInterval(id)
  }, [usuario])

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
    if (papelDe(u) !== 'cliente') EntregasApi.listar().then(setEntregas).catch(() => {})
    return u
  }
  const alterarSenha = (atual, nova) => AuthApi.alterarSenha(atual, nova)
  const logout = async () => {
    await AuthApi.logout().catch(() => {})
    tokenStorage.clear()
    setUsuario(null)
    // não deixa dados de uma conta aparecerem para a próxima
    ;[setEntregas, setAtivos, setAlertas, setEquipe, setNotificacoes].forEach((set) => set([]))
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
  // cada entrega tem um ativo "Carga": quando a entrega muda, a lista de ativos do admin é recarregada
  const recarregarAtivos = () => {
    if (papelDe(usuario) === 'empresa') AtivosApi.listar().then(setAtivos).catch(() => {})
  }
  /** Cria o pedido e devolve o código gerado pelo banco (ou null se falhar). */
  const criarPedido = async (dados) => {
    const nova = await executar(() => EntregasApi.criar(dados))
    if (!nova) return null
    setEntregas((list) => [nova, ...list])
    recarregarAtivos()
    if (usuario?.perfil === 'cliente') GeralApi.notificacoes().then(setNotificacoes).catch(() => {})
    return nova.id
  }
  const atualizarStatusEntrega = async (id, status, descricao) => {
    const e = await executar(() => EntregasApi.status(id, status, descricao))
    if (e) {
      setEntregas((list) => substituir(list, e))
      recarregarAtivos()
    }
    return e
  }
  const atribuirEntrega = async (id, entregadorId) => {
    const e = await executar(() => EntregasApi.atribuir(id, entregadorId || null))
    if (e) {
      setEntregas((list) => substituir(list, e))
      recarregarAtivos()
    }
    return e
  }
  /** Rota otimizada (null se falhar). O admin informa o entregador. */
  const otimizarRota = (entregadorId) => executar(() => RotasApi.otimizada(entregadorId))
  const avaliarEntrega = async (id, avaliacao) => {
    const e = await executar(() => EntregasApi.avaliar(id, avaliacao))
    if (e) {
      setEntregas((list) => substituir(list, e))
      toast('Obrigado! Sua avaliação foi registrada.')
    }
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
  const transferirAtivo = (id, responsavel) => atualizarAtivo(() => AtivosApi.transferir(id, responsavel))
  const marcarExtraviado = (id) => atualizarAtivo(() => AtivosApi.extraviado(id))
  const cadastrarAtivo = async (dados) => {
    const a = await executar(() => AtivosApi.criar(dados))
    if (!a) return null
    setAtivos((list) => [a, ...list])
    return a.id
  }

  // ---------- alertas ----------
  const atualizarAlerta = async (fn) => {
    const a = await executar(fn)
    if (a) setAlertas((list) => substituir(list, a))
    return a
  }
  const assumirAlerta = (id) => atualizarAlerta(() => AlertasApi.assumir(id))
  const resolverAlerta = (id) => atualizarAlerta(() => AlertasApi.resolver(id))
  const alternarPasso = (id, ordem) => atualizarAlerta(() => AlertasApi.alternarPasso(id, ordem))

  // ---------- configurações (aceitam objeto ou função, como o setState) ----------
  const salvarConfig = (chave, setter, atual) => (valorOuFn) => {
    const novo = typeof valorOuFn === 'function' ? valorOuFn(atual) : valorOuFn
    setter(novo)
    executar(() => GeralApi.salvarConfig(chave, novo))
  }
  const setPreferencias = salvarConfig('preferencias', setPrefState, preferencias)
  const setPrivacidade = salvarConfig('privacidade', setPrivState, privacidade)

  const resetarDemo = async () => {
    const ok = await executar(() => GeralApi.resetDemo())
    if (!ok) return
    tokenStorage.clear()
    setUsuario(null)
    toast('Banco restaurado com os dados de demonstração. Entre novamente.')
  }

  const value = {
    usuario,
    papel: papelDe(usuario),
    carregando,
    login,
    cadastrar,
    logout,
    atualizarPerfil,
    alterarSenha,
    otimizarRota,
    entregas,
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
    entregadores: equipe.filter((p) => p.usuarioId), // colaboradores com login de entregador
    notificacoes,
    marcarLida,
    marcarTodasLidas,
    preferencias,
    setPreferencias,
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
