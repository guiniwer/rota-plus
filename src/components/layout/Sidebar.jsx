import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import Logo from './Logo'
import { NAV } from './navItems'

export default function Sidebar({ perfil, open, onNavigate }) {
  const { usuario, logout, notificacoes, alertas } = useApp()
  const navigate = useNavigate()
  const contadores = {
    notificacoes: notificacoes.filter((n) => !n.lida).length,
    alertas: alertas.filter((a) => a.status !== 'resolvido').length,
  }

  const sair = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Menu principal" aria-hidden={!open}>
      <div className="sidebar-topo">
        <Logo />
        <button className="icon-button" onClick={onNavigate} aria-label="Fechar menu">
          <Icon name="x" size={18} />
        </button>
      </div>
      <p className="sidebar-section label">Menu</p>
      <nav className="stack-sm" style={{ gap: 4 }}>
        {NAV[perfil].filter((item) => !item.soBarra).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onNavigate}
            title={item.label}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.badge && contadores[item.badge] > 0 && <b className="nav-badge">{contadores[item.badge]}</b>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <button className="nav-item" onClick={sair} title="Sair">
        <Icon name="logout" />
        <span>Sair</span>
      </button>
      <NavLink to={`/${perfil}/perfil`} className="user-card" onClick={onNavigate} title="Meu perfil">
        <Avatar name={usuario?.nome} size={40} />
        <div>
          <strong>{usuario?.nome}</strong>
          <span className="small muted">{usuario?.empresa ?? 'Meu perfil'}</span>
        </div>
      </NavLink>
    </aside>
  )
}
