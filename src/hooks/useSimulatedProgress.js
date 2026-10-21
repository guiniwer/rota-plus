import { useEffect, useState } from 'react'

/** Simula o veículo avançando na rota (atualização "ao vivo"). */
export default function useSimulatedProgress(start, { step = 0.01, interval = 1500, max = 0.98 } = {}) {
  const [estado, setEstado] = useState({ start, ticks: 0 })

  // reinicia a simulação quando a posição inicial muda (ex.: outra entrega selecionada)
  if (estado.start !== start) setEstado({ start, ticks: 0 })

  useEffect(() => {
    if (start >= max || !step) return undefined
    const id = setInterval(() => setEstado((s) => ({ ...s, ticks: s.ticks + 1 })), interval)
    return () => clearInterval(id)
  }, [start, step, interval, max])

  return start >= max ? start : Math.min(max, start + estado.ticks * step)
}
