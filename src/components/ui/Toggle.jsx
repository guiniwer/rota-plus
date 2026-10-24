/** Interruptor liga/desliga com título e descrição opcionais. */
export default function Toggle({ checked, onChange, title, description, disabled }) {
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      disabled={disabled}
      aria-label={title}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    />
  )
  if (!title) return button
  return (
    <div className="row">
      <div className="grow">
        <strong style={{ display: 'block', fontSize: 14 }}>{title}</strong>
        {description && <span className="small muted">{description}</span>}
      </div>
      {button}
    </div>
  )
}
