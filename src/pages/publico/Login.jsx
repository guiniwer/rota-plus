import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'
import { CLIENTE_DEMO, EMPRESA_DEMO, ENTREGADOR_DEMO, SENHA_DEMO } from '../../data/contasDemo'
import { maskDocumento } from '../../utils/format'
import { INICIO, papelDe } from '../../utils/papel'

const VAZIO = { email: '', cnpj: '', senha: '' }

/** Login com escolha de perfil: usuário (cliente) ou empresa. */
export default function Login() {
  const { login } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [perfil, setPerfil] = useState(location.state?.perfil ?? 'cliente')
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [enviando, setEnviando] = useState(false)

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: campo === 'cnpj' ? maskDocumento(e.target.value) : e.target.value }))

  /** Preenche com uma conta de demonstração. Na aba Empresa: administrador ou entregador. */
  const preencherDemo = (funcao = 'admin') =>
    setForm(
      perfil === 'empresa'
        ? { email: funcao === 'entregador' ? ENTREGADOR_DEMO.email : EMPRESA_DEMO.email, cnpj: EMPRESA_DEMO.cnpj, senha: SENHA_DEMO }
        : { ...VAZIO, email: CLIENTE_DEMO.email, senha: SENHA_DEMO },
    )

  const entrar = async (e) => {
    e.preventDefault()
    const novos = {}
    if (!form.email.includes('@')) novos.email = 'Informe um e-mail válido.'
    if (perfil === 'empresa' && form.cnpj.replace(/\D/g, '').length !== 14) novos.cnpj = 'CNPJ deve ter 14 dígitos.'
    if (form.senha.length < 6) novos.senha = 'A senha deve ter pelo menos 6 caracteres.'
    setErros(novos)
    if (Object.keys(novos).length) return

    setEnviando(true)
    try {
      const u = await login(perfil, { email: form.email, senha: form.senha, cnpj: form.cnpj })
      // administrador vai para a visão operacional; entregador, para a tela de entregas
      navigate(INICIO[papelDe(u)])
    } catch (err) {
      setErros({ geral: err.message })
    } finally {
      setEnviando(false)
    }
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
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800 }}>Login</h2>
          <p className="muted">Do envio à entrega, tudo sob controle.</p>
        </div>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={entrar} noValidate>
          <Field label={perfil === 'empresa' ? 'E-mail corporativo' : 'E-mail'} type="email" value={form.email} onChange={set('email')} error={erros.email} autoComplete="email" />
          {perfil === 'empresa' && <Field label="CNPJ" value={form.cnpj} onChange={set('cnpj')} error={erros.cnpj} inputMode="numeric" />}
          {perfil === 'empresa' && <p className="small muted">Administradores e entregadores entram com o CNPJ da empresa.</p>}
          <Field label="Senha" type="password" value={form.senha} onChange={set('senha')} error={erros.senha} autoComplete="current-password" />
          {erros.geral && (
            <p className="field-error" role="alert" style={{ fontSize: 14 }}>
              {erros.geral}
            </p>
          )}
          <Button type="submit" variant="violet" block disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
          {perfil === 'empresa' ? (
            <div className="grid-2" style={{ gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => preencherDemo('admin')}>
                Demo: administrador
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => preencherDemo('entregador')}>
                Demo: entregador
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => preencherDemo()}>
              Preencher com dados de demonstração
            </button>
          )}
          <p className="muted" style={{ textAlign: 'center' }}>
            Ainda não possui conta? <Link to={`/cadastro?perfil=${perfil}`}>Cadastre-se</Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
