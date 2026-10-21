import { Link } from 'react-router-dom'

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="brand" aria-label="Rota+ — página inicial">
      <img className="brand-mark" src="./favicon.svg" alt="" />
      <span>Rota+</span>
    </Link>
  )
}
