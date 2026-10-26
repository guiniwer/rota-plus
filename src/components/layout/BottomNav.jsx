import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon'
import { NAV } from './navItems'

/** Barra inferior do mobile: itens principais + botão de ação central. */
export default function BottomNav({ perfil, onOpenMenu }) {
  const items = NAV[perfil].filter((i) => i.mobile)
  const fab = NAV[perfil].find((i) => i.fab)
  // perfis com só dois destinos (entregador) dispensam a barra: o perfil já está no avatar do topo
  if (!fab && items.length <= 2) return null
  const left = items.slice(0, 2)
  const right = items.slice(2)
  // o botão "Menu" só aparece se houver itens que não cabem na barra
  const temMais = NAV[perfil].some((i) => !i.mobile && !i.fab && !i.soBarra)

  const link = (i) => (
    <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
      <Icon name={i.icon} size={22} />
      {i.curto ?? i.label.split(' ')[0]}
    </NavLink>
  )

  return (
    <nav className="bottom-nav" aria-label="Navegação inferior">
      {left.map(link)}
      {fab && (
        <NavLink to={fab.to} className={({ isActive }) => `fab ${isActive ? 'active' : ''}`} aria-label={fab.label}>
          <span className="fab-icone">
            <Icon name={fab.icon} size={14} />
          </span>
          {fab.curto ?? fab.label.split(' ')[0]}
        </NavLink>
      )}
      {right.map(link)}
      {temMais && (
        <a
          href="#menu"
          onClick={(e) => {
            e.preventDefault()
            onOpenMenu()
          }}
        >
          <Icon name="menu" size={22} />
          Menu
        </a>
      )}
    </nav>
  )
}
