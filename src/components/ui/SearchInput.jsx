import Icon from './Icon'

export default function SearchInput({ value, onChange, placeholder = 'Buscar…', className = '' }) {
  return (
    <div className={`search ${className}`}>
      <Icon name="search" size={18} color="var(--grey)" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  )
}
