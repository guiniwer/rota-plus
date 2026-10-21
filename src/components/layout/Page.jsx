import Topbar from './Topbar'

/** Estrutura padrão de uma tela logada: topbar + corpo. */
export default function Page({ title, subtitle, actions, children }) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} actions={actions} />
      <div className="app-body stack">{children}</div>
    </>
  )
}
