import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Logo from './Logo'

const LINKS = [
  { to: '/', label: 'Início', end: true },
  { to: '/#servicos', label: 'Serviços' },
  { to: '/rastreio', label: 'Rastrear' },
  { to: '/#cotacao', label: 'Cotação' },
]

/** Cabeçalho e rodapé do site público. */
export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <header className="public-header">
        <Logo />
        <button className="icon-button public-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Abrir menu">
          <Icon name={open ? 'x' : 'menu'} />
        </button>
        <nav className={`public-links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          {LINKS.map((l) =>
            l.to.includes('#') ? (
              <a key={l.to} href={`#${l.to.split('#')[1]}`} onClick={(e) => (e.preventDefault(), navigate('/'), setTimeout(() => document.getElementById(l.to.split('#')[1])?.scrollIntoView({ behavior: 'smooth' }), 50))}>
                {l.label}
              </a>
            ) : (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
              </NavLink>
            ),
          )}
          <Button variant="outline" onClick={() => navigate('/login')}>
            Fazer login
          </Button>
          <Button onClick={() => navigate('/cadastro')}>Criar conta</Button>
        </nav>
      </header>
      <Outlet />
      <footer className="public-footer">
        <span>© 2026 Rota+. Todos os direitos reservados.</span>
        <span>Privacidade · Termos · Ajuda</span>
      </footer>
    </>
  )
}
