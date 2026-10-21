import { useId } from 'react'

/** Campo de formulário com rótulo em caixa alta. Aceita input, select ou textarea. */
export default function Field({ label, as = 'input', options, error, children, ...props }) {
  const id = useId()
  const control = { id, 'aria-invalid': Boolean(error), ...props }

  let input
  if (as === 'select') {
    input = (
      <select className="select" {...control}>
        {options.map((opt) => {
          const { value, label: text } = typeof opt === 'string' ? { value: opt, label: opt } : opt
          return (
            <option key={value} value={value}>
              {text}
            </option>
          )
        })}
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
      {error && <small className="field-error">{error}</small>}
    </div>
  )
}
