import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Card from './Card'
import Icon from './Icon'

/** Janela modal; fecha com Esc ou clicando fora. wide: versão mais larga (ex.: mapa). */
export default function Modal({ title, open, onClose, wide, children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  // renderizado direto no <body>: fica acima de mapas e de qualquer card da página
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <Card
        className={`modal ${wide ? 'modal-wide' : ''}`}
        title={title}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        action={
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={18} />
          </button>
        }
      >
        {children}
      </Card>
    </div>,
    document.body,
  )
}
