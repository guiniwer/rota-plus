/**
 * Grupo de botões em que apenas um fica ativo (abas / filtros).
 * block: ocupa toda a largura, com botões de mesmo tamanho (uso em formulários).
 */
export default function Segmented({ options, value, onChange, block, label }) {
  return (
    <div className={`segmented ${block ? 'block' : ''}`} role="tablist" aria-label={label}>
      {options.map((opt) => {
        const { value: v, label } = typeof opt === 'string' ? { value: opt, label: opt } : opt
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={value === v}
            className={value === v ? 'active' : ''}
            onClick={() => onChange(v)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
