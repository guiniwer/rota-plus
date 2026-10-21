import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'
import { CLIENTE_DEMO, EMPRESA_DEMO } from '../../data/mockData'
import { maskDocumento } from '../../utils/format'

const VAZIO = { email: '', cnpj: '', senha: '' }

/** Login com escolha de perfil: usuário (cliente) ou empresa. */
export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [perfil, setPerfil] = useState(location.state?.perfil ?? 'cliente')
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: campo === 'cnpj' ? maskDocumento(e.target.value) : e.target.value }))

  const preencherDemo = () =>
    setForm(perfil === 'empresa' ? { email: EMPRESA_DEMO.email, cnpj: EMPRESA_DEMO.cnpj, senha: 'demo123' } : { ...VAZIO, email: CLIENTE_DEMO.email, senha: 'demo123' })

  const entrar = (e) => {
    e.preventDefault()
    const novos = {}
    if (!form.email.includes('@')) novos.email = 'Informe um e-mail válido.'
    if (perfil === 'empresa' && form.cnpj.replace(/\D/g, '').length !== 14) novos.cnpj = 'CNPJ deve ter 14 dígitos.'
    if (form.senha.length < 6) novos.senha = 'A senha deve ter pelo menos 6 caracteres.'
    setErros(novos)
    if (Object.keys(novos).length) return

    login(perfil, { email: form.email })
    navigate(perfil === 'empresa' ? '/empresa' : '/cliente')
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <p className="label" style={{ textAlign: 'center' }}>
          Entrar como
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Segmented
            value={perfil}
            onChange={(p) => (setPerfil(p), setErros({}))}
            options={[
              { value: 'cliente', label: 'Usuário' },
              { value: 'empresa', label: 'Empresa' },
            ]}
          />
        </div>
        <div className="social-row">
          <button className="social-btn" type="button" aria-label="Entrar com Google" onClick={preencherDemo}>
            G
          </button>
          <button className="social-btn" type="button" aria-label="Entrar com Apple" onClick={preencherDemo}>
            
          </button>
        </div>
        <div className="divider-text">ou</div>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800 }}>Login</h2>
          <p className="muted">Do envio à entrega, tudo sob controle.</p>
        </div>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={entrar} noValidate>
          <Field label={perfil === 'empresa' ? 'E-mail corporativo' : 'E-mail'} type="email" value={form.email} onChange={set('email')} error={erros.email} autoComplete="email" />
          {perfil === 'empresa' && <Field label="CNPJ" value={form.cnpj} onChange={set('cnpj')} error={erros.cnpj} inputMode="numeric" />}
          <Field label="Senha" type="password" value={form.senha} onChange={set('senha')} error={erros.senha} autoComplete="current-password" />
          <Button type="submit" variant="violet" block>
            Entrar
          </Button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={preencherDemo}>
            Preencher com dados de demonstração
          </button>
          <p className="muted" style={{ textAlign: 'center' }}>
            Ainda não possui conta? <Link to={`/cadastro?perfil=${perfil}`}>Cadastre-se</Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
