import { useCallback, useEffect, useState } from 'react'
import { useEventos } from '../context/AppContext'
import { EmpresaApi } from '../services/api'

/** Relatório calculado pelo servidor a partir dos registros do banco; atualiza quando entregas/alertas/ativos mudam. */
export default function useRelatorio(periodo) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const carregar = useCallback(
    () =>
      EmpresaApi.relatorio(periodo)
        .then((r) => (setDados(r), setErro(null)))
        .catch((e) => setErro(e.message)),
    [periodo],
  )
  useEffect(() => {
    carregar()
  }, [carregar])
  useEventos(['entregas', 'alertas', 'ativos'], carregar)
  return { dados, erro, recarregar: carregar }
}
