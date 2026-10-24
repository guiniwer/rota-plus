import { useEffect, useRef, useState } from 'react'

/**
 * Leitores RFID/NFC e de código de barras USB ou Bluetooth funcionam como teclado ("keyboard wedge"):
 * digitam o código da etiqueta muito rápido e terminam com Enter. Este campo fica em foco
 * esperando essa digitação. As etiquetas devem estar gravadas com o código do ativo (ex.: EQP-3101).
 */
export default function LeitorRfid({ ativo, onLeitura }) {
  const ref = useRef(null)
  const [valor, setValor] = useState('')
  const [foco, setFoco] = useState(false)
  useEffect(() => {
    if (ativo) ref.current?.focus()
  }, [ativo])
  return (
    <div className="stack-sm">
      <div className={`scanner rfid ${foco ? 'pronto' : ''}`} onClick={() => ref.current?.focus()}>
        <div className="rfid-onda" />
        <strong>{foco ? 'Pronto para ler — aproxime a etiqueta do leitor' : 'Toque aqui para ativar o leitor'}</strong>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valor.trim()) onLeitura(valor.trim())
          setValor('')
        }}
      >
        <input
          ref={ref}
          className="input"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          placeholder="Código lido pelo leitor RFID / NFC / código de barras"
          aria-label="Entrada do leitor RFID"
          autoComplete="off"
        />
      </form>
      <p className="small muted">Compatível com leitores USB/Bluetooth em modo teclado (HID). A leitura chega aqui como texto seguido de Enter.</p>
    </div>
  )
}
