import { useEffect, useRef, useState } from 'react'

/**
 * Lê QR Codes (e códigos de barras, quando o navegador suporta) pela câmera traseira.
 * Usa o BarcodeDetector nativo quando existe; senão decodifica os quadros com jsQR.
 * onLeitura(texto) é chamado uma vez por código (repetições do mesmo código em 3 s são ignoradas).
 */
export default function LeitorCamera({ ativo, onLeitura }) {
  const videoRef = useRef(null)
  const [estado, setEstado] = useState('parado') // parado | iniciando | lendo | negado | indisponivel | erro
  const ultimo = useRef({ texto: null, em: 0 })
  const onLeituraRef = useRef(onLeitura)
  useEffect(() => {
    onLeituraRef.current = onLeitura
  })

  useEffect(() => {
    if (!ativo) return undefined
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado('indisponivel')
      return undefined
    }
    let vivo = true
    let stream
    let quadro
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const entregar = (texto) => {
      const agora = Date.now()
      if (texto === ultimo.current.texto && agora - ultimo.current.em < 3000) return
      ultimo.current = { texto, em: agora }
      navigator.vibrate?.(80)
      onLeituraRef.current(texto)
    }

    async function iniciar() {
      setEstado('iniciando')
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      } catch (err) {
        if (vivo) setEstado(err.name === 'NotAllowedError' ? 'negado' : 'indisponivel')
        return
      }
      if (!vivo) return stream.getTracks().forEach((t) => t.stop())
      const video = videoRef.current
      video.srcObject = stream
      await video.play().catch(() => {})
      setEstado('lendo')

      let detector = null
      if ('BarcodeDetector' in window) {
        try {
          const formatos = await window.BarcodeDetector.getSupportedFormats()
          detector = new window.BarcodeDetector({ formats: formatos.filter((f) => ['qr_code', 'code_128', 'ean_13', 'code_39', 'data_matrix'].includes(f)) })
        } catch {
          detector = null
        }
      }
      const jsQR = detector ? null : (await import('jsqr')).default

      const ler = async () => {
        if (!vivo) return
        if (video.readyState >= 2) {
          try {
            if (detector) {
              const [c] = await detector.detect(video)
              if (c?.rawValue) entregar(c.rawValue)
            } else {
              // reduz o quadro para decodificar rápido no celular
              const escala = Math.min(1, 640 / video.videoWidth)
              canvas.width = Math.round(video.videoWidth * escala)
              canvas.height = Math.round(video.videoHeight * escala)
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
              const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
              if (r?.data) entregar(r.data)
            }
          } catch {
            /* quadro ilegível: segue tentando */
          }
        }
        quadro = setTimeout(() => requestAnimationFrame(ler), 120)
      }
      ler()
    }
    iniciar()
    return () => {
      vivo = false
      clearTimeout(quadro)
      stream?.getTracks().forEach((t) => t.stop())
      setEstado('parado')
    }
  }, [ativo])

  const mensagem = {
    iniciando: 'Abrindo a câmera…',
    lendo: 'Aponte para o QR Code da etiqueta',
    negado: 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.',
    indisponivel: 'Câmera indisponível neste aparelho (é preciso HTTPS ou localhost).',
    erro: 'Não foi possível usar a câmera.',
    parado: 'Câmera desligada',
  }[estado]

  return (
    <div className="stack-sm">
      <div className="scanner">
        <video ref={videoRef} className="scanner-video" muted playsInline style={{ display: estado === 'lendo' ? 'block' : 'none' }} />
        <div className="scanner-frame">{estado === 'lendo' && <div className="scanner-line" />}</div>
      </div>
      <p className={`small ${['negado', 'indisponivel', 'erro'].includes(estado) ? 'amber' : 'muted'}`} style={{ textAlign: 'center' }} role="status">
        {mensagem}
      </p>
    </div>
  )
}
