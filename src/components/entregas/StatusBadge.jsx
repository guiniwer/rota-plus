import Badge from '../ui/Badge'
import { STATUS_ATIVO, STATUS_ENTREGA } from '../../utils/status'

export function EntregaBadge({ status }) {
  const s = STATUS_ENTREGA[status] ?? { label: status, tone: 'neutral' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function AtivoBadge({ status }) {
  const s = STATUS_ATIVO[status] ?? { label: status, tone: 'neutral' }
  return <Badge tone={s.tone}>{s.label}</Badge>
}
