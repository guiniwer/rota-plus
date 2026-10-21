/** Selo de status. tone: success | warning | danger | info | pink | neutral */
export default function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
