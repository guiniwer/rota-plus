import Icon from './Icon'

const VARIANTS = {
  primary: 'btn-primary',
  violet: 'btn-violet',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
}

/** Botão padrão. variant: primary | violet | secondary | outline */
export default function Button({ children, variant = 'primary', icon, block, size, className = '', ...props }) {
  const classes = ['btn', VARIANTS[variant], block && 'btn-block', size === 'sm' && 'btn-sm', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type="button" className={classes} {...props}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}
