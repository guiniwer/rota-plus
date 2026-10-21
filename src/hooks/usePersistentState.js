import { useEffect, useState } from 'react'

/** useState que salva automaticamente no localStorage (dados continuam após recarregar). */
export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? JSON.parse(saved) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // armazenamento indisponível (modo privado) — segue só em memória
    }
  }, [key, value])

  return [value, setValue]
}
