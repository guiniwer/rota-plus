import Icon from './Icon'

export default function EmptyState({ icon = 'search', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={32} color="var(--purple)" />
      <strong style={{ color: 'var(--white)' }}>{title}</strong>
      {children}
    </div>
  )
}
