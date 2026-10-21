/** Campo de formulário com rótulo em caixa alta. Aceita input, select ou textarea. */
export default function Field({ label, as = 'input', options, error, children, ...props }) {
  let control
  if (as === 'select') {
    control = (
      <select className="select" {...props}>
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
    control = <textarea className="textarea" {...props} />
  } else {
    control = <input className="input" {...props} />
  }

  return (
    <label className="field">
      <span>{label}</span>
      {children ?? control}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}
