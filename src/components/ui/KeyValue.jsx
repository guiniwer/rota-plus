/** Linha "rótulo ........ valor". */
export default function KeyValue({ label, value, valueColor, strong }) {
  return (
    <div className="row-between" style={strong ? { fontSize: 18 } : undefined}>
      <span className={strong ? '' : 'muted'} style={strong ? { fontWeight: 700 } : undefined}>{label}</span>
      <strong style={{ color: valueColor, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</strong>
    </div>
  )
}
