import { useCallback, useEffect, useRef, useState } from 'react'
import { LocalizacaoApi } from '../services/api'

const INTERVALO_MIN_MS = 30_000 // não envia mais que uma posição a cada 30 s…
const DISTANCIA_MIN_M = 60 // …a não ser que tenha andado
const PULSO_MS = 60_000 // parado, confirma a posição a cada minuto

const metros = (a, b) => {
  const r = (g) => (g * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** Está dentro do expediente da empresa (no fuso dela)? */
export function noExpediente(empresa, quando = new Date()) {
  if (!empresa?.turnoInicio) return true
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: empresa.fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(quando).split(':').map(Number)
  const agora = h * 60 + m
  const min = (s) => s.split(':').reduce((a, b, i) => (i ? a + Number(b) : Number(b) * 60), 0)
  const ini = min(empresa.turnoInicio)
  const fim = min(empresa.turnoFim)
  return ini <= fim ? agora >= ini && agora < fim : agora >= ini || agora < fim
}

/**
 * GPS do app do entregador: acompanha a posição (navigator.geolocation) e envia para a API.
 * Respeita a LGPD da empresa: fora do expediente não envia nada.
 */
export default function useRastreamentoGps(empresa, { ativo = true } = {}) {
  const [estado, setEstado] = useState('iniciando') // iniciando | ativo | negado | indisponivel | fora_do_turno | erro
  const [posicao, setPosicao] = useState(null)
  const [ultimoEnvio, setUltimoEnvio] = useState(null)
  const atual = useRef(null)
  const enviado = useRef({ em: 0, pos: null })
  const restrito = empresa?.privacidade?.soExpediente !== false

  const enviar = useCallback(
    async (forcar = false) => {
      const p = atual.current
      if (!p) return
      if (restrito && !noExpediente(empresa)) return setEstado('fora_do_turno')
      const desde = Date.now() - enviado.current.em
      const andou = enviado.current.pos ? metros(enviado.current.pos, p) : Infinity
      if (!forcar && desde < INTERVALO_MIN_MS && andou < DISTANCIA_MIN_M) return
      enviado.current = { em: Date.now(), pos: p }
      try {
        const r = await LocalizacaoApi.enviar(p)
        if (r?.registrada === false) setEstado('fora_do_turno')
        else {
          setUltimoEnvio(new Date().toISOString())
          setEstado('ativo')
        }
      } catch {
        enviado.current.em = 0 // sem conexão: tenta de novo na próxima leitura
      }
    },
    [empresa, restrito],
  )

  useEffect(() => {
    if (!ativo || !empresa) return undefined
    if (!('geolocation' in navigator)) {
      setEstado('indisponivel')
      return undefined
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy),
          velocidade: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : null,
          em: pos.timestamp,
        }
        atual.current = p
        setPosicao(p)
        enviar()
      },
      (err) => setEstado(err.code === err.PERMISSION_DENIED ? 'negado' : 'erro'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    )
    const pulso = setInterval(() => enviar(Date.now() - enviado.current.em >= PULSO_MS), 15_000)
    return () => {
      navigator.geolocation.clearWatch(id)
      clearInterval(pulso)
    }
  }, [ativo, empresa, enviar])

  /** Posição para anexar a um registro (comprovante, status): a do rastreamento ou uma leitura nova. */
  const posicaoAgora = useCallback(
    () =>
      new Promise((resolve) => {
        if (atual.current && Date.now() - atual.current.em < 60_000) return resolve(atual.current)
        if (!('geolocation' in navigator)) return resolve(null)
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: Math.round(pos.coords.accuracy) }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
        )
      }),
    [],
  )

  return { estado, posicao, ultimoEnvio, posicaoAgora }
}
