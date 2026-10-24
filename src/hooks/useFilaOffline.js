import { useCallback, useEffect, useRef, useState } from 'react'
import { ler, gravar } from '../utils/armazenamento'

/**
 * Fila de envios do app de campo. Sem internet (navigator.onLine ou falha de rede),
 * a ação fica guardada no aparelho (IndexedDB) e é enviada sozinha quando a conexão volta.
 *  executores: { [tipo]: (item) => Promise }  — chamadas reais à API
 */
export default function useFilaOffline(usuarioId, executores, { onSincronizado, onErro } = {}) {
  const chave = `fila:${usuarioId}`
  const [online, setOnline] = useState(() => navigator.onLine)
  const [fila, setFila] = useState([])
  const filaRef = useRef([])
  const enviando = useRef(false)
  const exec = useRef(executores)
  const avisos = useRef({ onSincronizado, onErro })
  useEffect(() => {
    exec.current = executores
    avisos.current = { onSincronizado, onErro }
  })

  const salvar = useCallback(
    (nova) => {
      filaRef.current = nova
      setFila(nova)
      gravar(chave, nova)
    },
    [chave],
  )

  /** Envia o que estiver na fila, na ordem em que foi feito. */
  const sincronizar = useCallback(async () => {
    if (enviando.current || !filaRef.current.length || !navigator.onLine) return
    enviando.current = true
    let enviados = 0
    try {
      for (const item of [...filaRef.current]) {
        try {
          await exec.current[item.tipo](item)
          enviados++
        } catch (err) {
          if (err.status === 0) break // ainda sem conexão: tenta depois
          avisos.current.onErro?.(err, item) // recusado pelo servidor (ex.: já finalizada): descarta
        }
        salvar(filaRef.current.filter((x) => x.id !== item.id))
      }
    } finally {
      enviando.current = false
    }
    if (enviados) avisos.current.onSincronizado?.(enviados)
  }, [salvar])

  // carrega a fila salva no aparelho
  useEffect(() => {
    let vivo = true
    ler(chave).then((salva) => {
      if (!vivo) return
      filaRef.current = salva ?? []
      setFila(filaRef.current)
      sincronizar()
    })
    return () => {
      vivo = false
    }
  }, [chave, sincronizar])

  useEffect(() => {
    const on = () => {
      setOnline(true)
      sincronizar()
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const tentar = setInterval(sincronizar, 30_000)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      clearInterval(tentar)
    }
  }, [sincronizar])

  /**
   * Executa agora; se não houver conexão, guarda na fila.
   * Retorna { enviado: true, resultado } ou { enviado: false } (na fila). Erros do servidor são relançados.
   */
  const enviar = useCallback(
    async (tipo, dados) => {
      const item = { id: crypto.randomUUID(), tipo, ...dados, quando: new Date().toISOString() }
      if (navigator.onLine) {
        try {
          return { enviado: true, resultado: await exec.current[tipo](item) }
        } catch (err) {
          if (err.status !== 0) throw err
          setOnline(false)
        }
      }
      salvar([...filaRef.current, item])
      return { enviado: false }
    },
    [salvar],
  )

  return { online, fila, enviar, sincronizar }
}
