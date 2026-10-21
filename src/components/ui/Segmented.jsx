/** Grupo de botões em que apenas um fica ativo (abas / filtros). */
export default function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
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
