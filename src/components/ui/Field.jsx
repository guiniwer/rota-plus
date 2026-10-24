import { useId } from 'react'

const renderOption = (opt) => {
  const { value, label } = typeof opt === 'string' ? { value: opt, label: opt } : opt
  return (
    <option key={value} value={value}>
      {label}
    </option>
  )
}

/**
 * Campo de formulário com rótulo em caixa alta. Aceita input, select ou textarea.
 * Em select, options pode ter grupos: [{ grupo: 'Sul', options: [...] }].
 */
export default function Field({ label, as = 'input', options, error, hint, children, ...props }) {
  const id = useId()
  const control = { id, 'aria-invalid': Boolean(error), ...props }

  let input
  if (as === 'select') {
    input = (
      <select className="select" {...control}>
        {options.map((opt) =>
          opt.grupo ? (
            <optgroup key={opt.grupo} label={opt.grupo}>
              {opt.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(opt)
          ),
        )}
      </select>
    )
  } else if (as === 'textarea') {
    input = <textarea className="textarea" {...control} />
  } else {
    input = <input className="input" {...control} />
  }

  return (
    <div className="field">
      {/* com children (ex.: botões segmentados) o rótulo é só visual */}
      {children ? <span className="field-label">{label}</span> : <label className="field-label" htmlFor={id}>{label}</label>}
      {children ?? input}
      {error ? <small className="field-error">{error}</small> : hint && <small className="field-hint">{hint}</small>}
    </div>
  )
}
