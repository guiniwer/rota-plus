import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import usePersistentState from '../hooks/usePersistentState'
import { ALERTAS, ATIVOS, CLIENTE_DEMO, EMPRESA_DEMO, ENTREGAS, NOTIFICACOES, PREFERENCIAS, PRIVACIDADE } from '../data/mockData'
import { nowLabel } from '../utils/format'
import { STATUS_ENTREGA } from '../utils/status'

const AppContext = createContext(null)

/** Estado global da aplicação + ações de negócio. */
export function AppProvider({ children }) {
  const [usuario, setUsuario] = usePersistentState('rota:usuario', null)
  const [entregas, setEntregas] = usePersistentState('rota:entregas', ENTREGAS)
  const [ativos, setAtivos] = usePersistentState('rota:ativos', ATIVOS)
  const [alertas, setAlertas] = usePersistentState('rota:alertas', ALERTAS)
  const [notificacoes, setNotificacoes] = usePersistentState('rota:notificacoes', NOTIFICACOES)
  const [preferencias, setPreferencias] = usePersistentState('rota:preferencias', PREFERENCIAS)
  const [privacidade, setPrivacidade] = usePersistentState('rota:privacidade', PRIVACIDADE)
  const [toastMsg, setToastMsg] = useState(null)

  const toast = useCallback((msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3200)
  }, [])

  // ---------- autenticação (demonstração) ----------
  const login = useCallback(
    (perfil, dados = {}) => {
      const base = perfil === 'empresa' ? EMPRESA_DEMO : CLIENTE_DEMO
      setUsuario({ perfil, ...base, ...dados })
    },
    [setUsuario],
  )
  const logout = useCallback(() => setUsuario(null), [setUsuario])

  // ---------- notificações ----------
  const notificar = useCallback(
    (n) => setNotificacoes((list) => [{ id: `N${Date.now()}`, lida: false, grupo: 'Hoje', quando: 'agora', ...n }, ...list]),
    [setNotificacoes],
  )
  const marcarLida = (id) => setNotificacoes((list) => list.map((n) => (n.id === id ? { ...n, lida: true } : n)))
  const marcarTodasLidas = () => setNotificacoes((list) => list.map((n) => ({ ...n, lida: true })))

  // ---------- entregas ----------
  const criarPedido = (dados) => {
    const id = `RT-${Math.floor(10000 + Math.random() * 89999)}-BR`
    const nova = {
      id,
      cliente: usuario?.nome ?? 'Cliente',
      documento: (usuario?.documento ?? '').replace(/\D/g, ''),
      status: 'confirmado',
      criadoEm: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', ''),
      previsao: dados.prazoTexto,
      janela: '—',
      responsavel: null,
      progresso: 0,
      avaliacao: null,
      eventos: [{ titulo: 'Pedido confirmado', descricao: 'Aguardando coleta na origem', data: nowLabel() }],
      ...dados,
    }
    setEntregas((list) => [nova, ...list])
    notificar({ icon: 'check', cor: 'var(--green)', titulo: 'Pedido confirmado', texto: `Seu pedido ${id} foi registrado. Acompanhe pelo código.` })
    return id
  }

  const atualizarStatusEntrega = (id, status, descricao) => {
    setEntregas((list) =>
      list.map((e) => {
        if (e.id !== id) return e
        const titulo = STATUS_ENTREGA[status]?.label ?? status
        return {
          ...e,
          status,
          progresso: status === 'entregue' ? 1 : e.progresso,
          eventos: [{ titulo, descricao, data: nowLabel() }, ...e.eventos],
        }
      }),
    )
  }

  const atribuirEntrega = (id, responsavel) =>
    setEntregas((list) => list.map((e) => (e.id === id ? { ...e, responsavel } : e)))

  const avaliarEntrega = (id, avaliacao) => {
    setEntregas((list) => list.map((e) => (e.id === id ? { ...e, avaliacao, status: 'entregue' } : e)))
    toast('Obrigado! Sua avaliação foi registrada.')
  }

  // ---------- ativos ----------
  const registrarMovimentacao = (ativoId, { tipo, responsavel, local }) => {
    setAtivos((list) =>
      list.map((a) => {
        if (a.id !== ativoId) return a
        const evento =
          tipo === 'checkout'
            ? { titulo: `Check-out para ${responsavel}`, descricao: `Retirado em ${a.local}`, data: nowLabel(), cor: 'var(--pink)' }
            : { titulo: `Check-in em ${local}`, descricao: `Registrado por ${responsavel} via QR Code`, data: nowLabel(), cor: 'var(--green)' }
        return {
          ...a,
          responsavel: tipo === 'checkout' ? responsavel : a.responsavel,
          local: tipo === 'checkin' ? local : a.local,
          status: tipo === 'checkout' ? 'em_uso' : 'disponivel',
          ultimaLeitura: 'agora',
          historico: [evento, ...a.historico],
        }
      }),
    )
  }

  const transferirAtivo = (ativoId, responsavel) =>
    setAtivos((list) =>
      list.map((a) =>
        a.id === ativoId
          ? { ...a, responsavel, historico: [{ titulo: `Transferido para ${responsavel}`, descricao: 'Responsabilidade atualizada', data: nowLabel() }, ...a.historico] }
          : a,
      ),
    )

  const marcarExtraviado = (ativoId) =>
    setAtivos((list) =>
      list.map((a) =>
        a.id === ativoId
          ? { ...a, status: 'extraviado', historico: [{ titulo: 'Marcado como extraviado', descricao: 'Equipe notificada para busca', data: nowLabel(), cor: 'var(--red)' }, ...a.historico] }
          : a,
      ),
    )

  const cadastrarAtivo = (dados) => {
    const prefixo = { Veículo: 'VEI', Equipamento: 'EQP', Ferramenta: 'FER', Mercadoria: 'MER' }[dados.tipo] ?? 'ATV'
    const id = `${prefixo}-${Math.floor(1000 + Math.random() * 8999)}`
    const novo = {
      id,
      bateria: dados.identificacao === 'GPS' ? 100 : null,
      responsavel: null,
      ultimaLeitura: 'agora',
      status: 'disponivel',
      x: 150 + Math.random() * 700,
      y: 80 + Math.random() * 380,
      uso: Array(14).fill(0),
      historico: [{ titulo: 'Ativo cadastrado', descricao: `Etiqueta ${dados.identificacao} vinculada`, data: nowLabel(), cor: 'var(--green)' }],
      ...dados,
      valor: Number(dados.valor) || 0,
    }
    setAtivos((list) => [novo, ...list])
    return id
  }

  // ---------- alertas ----------
  const atualizarAlerta = (id, fn) => setAlertas((list) => list.map((a) => (a.id === id ? fn(a) : a)))
  const assumirAlerta = (id) => atualizarAlerta(id, (a) => ({ ...a, status: 'tratamento', responsavel: usuario?.nome ?? 'Você' }))
  const resolverAlerta = (id) => atualizarAlerta(id, (a) => ({ ...a, status: 'resolvido', passos: a.passos.map((p) => ({ ...p, feito: true })) }))
  const alternarPasso = (id, idx) =>
    atualizarAlerta(id, (a) => ({ ...a, passos: a.passos.map((p, i) => (i === idx ? { ...p, feito: !p.feito } : p)) }))

  const resetarDemo = () => {
    setEntregas(ENTREGAS)
    setAtivos(ATIVOS)
    setAlertas(ALERTAS)
    setNotificacoes(NOTIFICACOES)
    setPreferencias(PREFERENCIAS)
    setPrivacidade(PRIVACIDADE)
    toast('Dados de demonstração restaurados.')
  }

  const value = {
    usuario,
    login,
    logout,
    entregas,
    criarPedido,
    atualizarStatusEntrega,
    atribuirEntrega,
    avaliarEntrega,
    ativos,
    registrarMovimentacao,
    transferirAtivo,
    marcarExtraviado,
    cadastrarAtivo,
    alertas,
    assumirAlerta,
    resolverAlerta,
    alternarPasso,
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

// Helpers derivados usados em várias telas
// eslint-disable-next-line react-refresh/only-export-components
export function useEntregasDoCliente() {
  const { entregas, usuario } = useApp()
  return useMemo(() => entregas.filter((e) => e.cliente === usuario?.nome), [entregas, usuario])
}
