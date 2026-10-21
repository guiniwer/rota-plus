import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'

/** Layout das áreas logadas. Protege a rota pelo perfil (cliente/empresa). */
export default function AppLayout({ perfil }) {
  const { usuario } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // volta ao topo ao trocar de tela
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (usuario?.perfil !== perfil) return <Navigate to="/login" replace state={{ perfil }} />

  return (
    <div className="app-shell">
      <Sidebar perfil={perfil} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 45 }} onClick={() => setMenuOpen(false)} />}
      <main className="app-main">
        <Outlet context={{ perfil, openMenu: () => setMenuOpen(true) }} />
      </main>
      <BottomNav perfil={perfil} onOpenMenu={() => setMenuOpen(true)} />
    </div>
  )
}
