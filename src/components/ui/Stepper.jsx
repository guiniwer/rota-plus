import Icon from './Icon'

/** Etapas da entrega. current = índice da etapa atual. */
export default function Stepper({ steps, current, vertical }) {
  return (
    <ol className={`stepper ${vertical ? 'vertical' : ''}`} style={{ '--steps': steps.length, padding: 0, margin: 0, listStyle: 'none' }}>
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : ''
        const icon = i < current ? 'check' : i === current ? 'truck' : 'clock'
        return (
          <li key={label} className={`step ${state}`}>
            <span className="step-dot">
              <Icon name={icon} size={14} color={state ? '#fff' : 'var(--grey)'} />
            </span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}
