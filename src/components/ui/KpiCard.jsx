/** Indicador numérico do painel. */
export default function KpiCard({ label, value, delta, deltaColor = 'var(--green)' }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {delta && (
        <span className="kpi-delta" style={{ color: deltaColor }}>
          {delta}
        </span>
      )}
    </div>
  )
}
