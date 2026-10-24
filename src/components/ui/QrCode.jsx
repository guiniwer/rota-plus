import { useEffect, useState } from 'react'
import QRCodeLib from 'qrcode'

/** QR Code real (padrão ISO/IEC 18004), legível por qualquer leitor ou pela tela Escanear. */
export default function QrCode({ value, size = 140 }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let vivo = true
    QRCodeLib.toString(String(value), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1A0D31', light: '#FFFFFF' } })
      .then((s) => vivo && setSvg(s))
      .catch(() => vivo && setSvg(''))
    return () => {
      vivo = false
    }
  }, [value])
  return (
    <span
      role="img"
      aria-label={`QR Code ${value}`}
      className="qr"
      style={{ width: size, height: size }}
      // SVG gerado pela biblioteca a partir do código (não contém conteúdo do usuário além do próprio código)
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
