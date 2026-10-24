import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { INICIO } from '../../utils/papel'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'

/** Layout das áreas logadas. Protege a rota pelo papel (cliente / empresa-admin / entregador). */
export default function AppLayout({ perfil }) {
  const { usuario, papel, carregando } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // volta ao topo e fecha o menu ao trocar de tela
  useEffect(() => {
    window.scrollTo(0, 0)
    setMenuOpen(false)
  }, [pathname])

  // Esc fecha o menu
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  if (carregando) return <div className="empty" style={{ minHeight: '100vh', justifyContent: 'center' }}>Carregando…</div>
  if (!usuario) return <Navigate to="/login" replace state={{ perfil: perfil === 'cliente' ? 'cliente' : 'empresa' }} />
  // logado, mas em área de outro papel (ex.: entregador tentando abrir a visão operacional)
  if (papel !== perfil) return <Navigate to={INICIO[papel]} replace />

  return (
    <div className="app-shell">
      <Sidebar perfil={perfil} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
      <main className="app-main">
        <Outlet context={{ perfil, openMenu: () => setMenuOpen(true) }} />
      </main>
      <BottomNav perfil={perfil} onOpenMenu={() => setMenuOpen(true)} />
    </div>
  )
}
