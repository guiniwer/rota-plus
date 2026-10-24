import { Component } from 'react'

/** Se alguma tela quebrar, mostra um aviso com "Recarregar" em vez de deixar a página em branco. */
export default class ErroGeral extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('Erro na interface:', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="empty" style={{ minHeight: '100vh', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <strong style={{ fontSize: 20 }}>Algo deu errado nesta tela.</strong>
        <p className="muted">Seus dados estão salvos. Recarregue a página para continuar.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </div>
    )
  }
}
