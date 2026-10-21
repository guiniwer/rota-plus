import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import SearchInput from '../ui/SearchInput'

/** Cabeçalho: título da página, busca global, notificações e avatar. */
export default function Topbar({ title, subtitle, actions }) {
  const { perfil, openMenu } = useOutletContext()
  const { usuario, entregas, ativos, notificacoes, alertas, toast } = useApp()
  const [busca, setBusca] = useState('')
  const navigate = useNavigate()

  const temPendencia =
    perfil === 'empresa' ? alertas.some((a) => a.status === 'aberto') : notificacoes.some((n) => !n.lida)

  const buscar = (e) => {
    e.preventDefault()
    const q = busca.trim().toUpperCase()
    if (!q) return
    const entrega = entregas.find((x) => x.id.toUpperCase().includes(q))
    const ativo = ativos.find((x) => x.id.toUpperCase().includes(q) || x.nome.toUpperCase().includes(q))
    if (perfil === 'empresa' && ativo) navigate(`/empresa/ativos/${ativo.id}`)
    else if (perfil === 'empresa' && entrega) navigate(`/empresa/entregas?q=${entrega.id}`)
    else if (perfil === 'cliente' && entrega && entrega.cliente === usuario?.nome) navigate(`/cliente/status/${entrega.id}`)
    else toast(`Nada encontrado para "${busca}".`)
    setBusca('')
  }

  return (
    <header className="topbar">
      <button className="icon-button menu-toggle" onClick={openMenu} aria-label="Abrir menu">
        <Icon name="menu" />
      </button>
      <div className="grow">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="topbar-actions">
        {actions}
        <form onSubmit={buscar} className="topbar-search">
          <SearchInput
            value={busca}
            onChange={setBusca}
            placeholder={perfil === 'empresa' ? 'Buscar entrega ou ativo…' : 'Buscar código de rastreio…'}
          />
        </form>
        <button
          className="icon-button"
          aria-label={perfil === 'empresa' ? 'Alertas' : 'Notificações'}
          onClick={() => navigate(perfil === 'empresa' ? '/empresa/alertas' : '/cliente/notificacoes')}
        >
          <Icon name="bell" />
          {temPendencia && <span className="dot" />}
        </button>
        <Avatar name={usuario?.nome} size={44} />
      </div>
    </header>
  )
}
