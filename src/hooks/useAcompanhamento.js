import { useCallback, useEffect, useState } from 'react'
import { useEventos } from '../context/AppContext'
import { EntregasApi } from '../services/api'

/**
 * Posição do entregador, ETA e trajeto de uma entrega (atualiza a cada nova posição GPS).
 * documento: rastreio público (sem login) — usa o código + CPF/CNPJ e atualiza só pelo relógio.
 */
export default function useAcompanhamento(entregaId, documento) {
  // guarda a entrega a que os dados pertencem: ao trocar de entrega, os dados antigos deixam de valer sem precisar limpar o estado
  const [dados, setDados] = useState({ id: null, valor: null })
  const carregar = useCallback(() => {
    if (!entregaId) return
    const req = documento ? EntregasApi.acompanhamentoPublico(entregaId, documento) : EntregasApi.acompanhamento(entregaId)
    req.then((valor) => setDados({ id: entregaId, valor })).catch(() => {})
  }, [entregaId, documento])
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, documento ? 30_000 : 60_000) // o ETA muda com o tempo mesmo sem nova posição
    return () => clearInterval(t)
  }, [carregar, documento])
  useEventos(['posicoes', 'entregas'], carregar)
  return entregaId && dados.id === entregaId ? dados.valor : null
}
