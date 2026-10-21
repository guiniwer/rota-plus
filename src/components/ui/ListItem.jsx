import Icon from './Icon'

/** Linha com ícone colorido, título, descrição e horário. */
export default function ListItem({ icon, color = 'var(--pink)', title, subtitle, meta, right, onClick }) {
  return (
    <div className="list-item" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <span className="icon-chip" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}>
        <Icon name={icon} size={18} color={color} />
      </span>
      <div className="grow">
        <strong style={{ display: 'block', fontSize: 14 }}>{title}</strong>
        {subtitle && <span className="small muted" style={{ display: 'block' }}>{subtitle}</span>}
        {meta && <span className="cell-sub">{meta}</span>}
      </div>
      {right}
    </div>
  )
}
