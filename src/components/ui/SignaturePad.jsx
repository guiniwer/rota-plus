import { useRef } from 'react'

/** Área de assinatura com o dedo ou mouse (eventos de ponteiro + canvas). */
export default function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const desenhando = useRef(false)

  const ponto = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * canvasRef.current.width, ((e.clientY - r.top) / r.height) * canvasRef.current.height]
  }

  const iniciar = (e) => {
    desenhando.current = true
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(...ponto(e))
    canvasRef.current.setPointerCapture(e.pointerId)
  }
  const mover = (e) => {
    if (!desenhando.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(...ponto(e))
    ctx.stroke()
  }
  const terminar = () => {
    if (!desenhando.current) return
    desenhando.current = false
    onChange?.(true)
  }
  const limpar = () => {
    const c = canvasRef.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    onChange?.(false)
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
