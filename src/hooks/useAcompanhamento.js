import { useCallback, useEffect, useState } from 'react'
import { useEventos } from '../context/AppContext'
import { EntregasApi } from '../services/api'

/**
 * Posição do entregador, ETA e trajeto de uma entrega (atualiza a cada nova posição GPS).
 * documento: rastreio público (sem login) — usa o código + CPF/CNPJ e atualiza só pelo relógio.
 */
export default function useAcompanhamento(entregaId, documento) {
  const [dados, setDados] = useState(null)
  const carregar = useCallback(() => {
    if (!entregaId) return
    const req = documento ? EntregasApi.acompanhamentoPublico(entregaId, documento) : EntregasApi.acompanhamento(entregaId)
    req.then(setDados).catch(() => {})
  }, [entregaId, documento])
  useEffect(() => {
    setDados(null)
    carregar()
    const t = setInterval(carregar, documento ? 30_000 : 60_000) // o ETA muda com o tempo mesmo sem nova posição
    return () => clearInterval(t)
  }, [carregar, documento])
  useEventos(['posicoes', 'entregas'], carregar)
  return dados
}
