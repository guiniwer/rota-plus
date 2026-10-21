/** Lista cronológica de eventos: [{ titulo, descricao, data, cor }] */
export default function Timeline({ items }) {
  return (
    <div className="timeline">
      {items.map((ev, i) => (
        <div className="timeline-item" key={`${ev.titulo}-${i}`}>
          <span className="timeline-dot" style={{ background: ev.cor ?? (i === 0 ? 'var(--pink)' : 'var(--purple)') }} />
          <div>
            <strong>{ev.titulo}</strong>
            {ev.descricao && <span className="small muted">{ev.descricao}</span>}
            <span className="cell-sub">{ev.data}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
