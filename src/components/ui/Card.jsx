/** Contêiner com título opcional e ação à direita. */
export default function Card({ title, action, children, compact, highlight, className = '', ...props }) {
  const classes = ['card', compact && 'compact', highlight && 'highlight', className].filter(Boolean).join(' ')
  return (
    <section className={classes} {...props}>
      {(title || action) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
