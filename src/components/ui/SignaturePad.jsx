import { useRef } from 'react'

/**
 * Área de assinatura com o dedo ou mouse (eventos de ponteiro + canvas).
 * onChange(dataUrl | null): PNG com fundo branco e traço escuro, pronto para o comprovante.
 */
export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const tracos = useRef([]) // [[x, y], ...] por traço
  const desenhando = useRef(false)

  const ponto = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * canvasRef.current.width, ((e.clientY - r.top) / r.height) * canvasRef.current.height]
  }

  const iniciar = (e) => {
    desenhando.current = true
    const p = ponto(e)
    tracos.current.push([p])
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(...p)
    canvasRef.current.setPointerCapture(e.pointerId)
  }
  const mover = (e) => {
    if (!desenhando.current) return
    const p = ponto(e)
    tracos.current.at(-1).push(p)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(...p)
    ctx.stroke()
  }

  /** Redesenha os traços em um canvas branco (o da tela tem fundo escuro). */
  const exportar = () => {
    const { width, height } = canvasRef.current
    const c = Object.assign(document.createElement('canvas'), { width, height })
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#1A0D31'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const t of tracos.current) {
      ctx.beginPath()
      ctx.moveTo(...t[0])
      t.slice(1).forEach((p) => ctx.lineTo(...p))
      if (t.length === 1) ctx.lineTo(t[0][0] + 0.1, t[0][1])
      ctx.stroke()
    }
    return c.toDataURL('image/png')
  }

  const terminar = () => {
    if (!desenhando.current) return
    desenhando.current = false
    onChange?.(exportar())
  }
  const limpar = () => {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    tracos.current = []
    onChange?.(null)
  }

  return (
    <div className="stack-sm">
      <canvas ref={canvasRef} className="signature" width={600} height={160} onPointerDown={iniciar} onPointerMove={mover} onPointerUp={terminar} onPointerLeave={terminar} aria-label="Área de assinatura" />
      <button type="button" className="btn btn-secondary btn-sm" onClick={limpar} style={{ alignSelf: 'flex-end' }}>
        Limpar assinatura
      </button>
    </div>
  )
}
