import Icon from './Icon'

/** Cartão selecionável (ex.: tipo de entrega, tipo de rastreamento). */
export default function OptionCard({ icon, title, description, price, selected, onSelect }) {
  return (
    <button type="button" className={`option ${selected ? 'selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <span className="row">
        <Icon name={icon} color={selected ? 'var(--pink)' : 'var(--muted)'} />
        <strong className="grow">{title}</strong>
        {selected && <Icon name="check" size={18} color="var(--pink)" />}
      </span>
      <span className="small muted">{description}</span>
      <span className="price">{price}</span>
    </button>
  )
}
