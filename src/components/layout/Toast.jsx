import { useApp } from '../../context/AppContext'
import Icon from '../ui/Icon'

export default function Toast() {
  const { toastMsg } = useApp()
  if (!toastMsg) return null
  return (
    <div className="toast" role="status">
      <Icon name="check" color="var(--pink)" />
      {toastMsg}
    </div>
  )
}
