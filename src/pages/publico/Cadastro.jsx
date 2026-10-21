import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'
import { maskDocumento } from '../../utils/format'

const SEGMENTOS = ['Logística', 'Construção', 'Varejo', 'Saúde', 'Eventos', 'Assistência técnica', 'Manutenção', 'Locação de equipamentos', 'Distribuição', 'Tecnologia', 'Outro']

/** Cadastro de usuário (cliente) ou de empresa. */
export default function Cadastro() {
  const { cadastrar, toast } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [perfil, setPerfil] = useState(params.get('perfil') === 'empresa' ? 'empresa' : 'cliente')
  const [form, setForm] = useState({ nome: '', email: '', documento: '', fantasia: '', segmento: SEGMENTOS[0], telefone: '', senha: '', confirma: '', aceite: false })
  const [erros, setErros] = useState({})

  const set = (campo) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [campo]: campo === 'documento' ? maskDocumento(v) : v }))
  }

  const registrar = async (e) => {
    e.preventDefault()
    const n = {}
    if (form.nome.trim().length < 3) n.nome = 'Informe o nome completo.'
    if (!form.email.includes('@')) n.email = 'E-mail inválido.'
    const digitos = form.documento.replace(/\D/g, '').length
    if (perfil === 'empresa' ? digitos !== 14 : ![11, 14].includes(digitos)) n.documento = perfil === 'empresa' ? 'CNPJ deve ter 14 dígitos.' : 'CPF (11) ou CNPJ (14 dígitos).'
    if (form.senha.length < 6) n.senha = 'Mínimo de 6 caracteres.'
    if (form.senha !== form.confirma) n.confirma = 'As senhas não conferem.'
    if (!form.aceite) n.aceite = 'É preciso aceitar os termos.'
    setErros(n)
    if (Object.keys(n).length) return

    try {
      await cadastrar({ perfil, nome: form.nome, email: form.email, senha: form.senha, documento: form.documento, fantasia: form.fantasia, segmento: form.segmento })
      navigate(perfil === 'empresa' ? '/empresa' : '/cliente')
      toast('Conta criada com sucesso! Bem-vindo(a) à Rota+.')
    } catch (err) {
      setErros({ email: err.status === 409 ? err.message : undefined, geral: err.message })
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" style={{ width: 'min(760px, 100%)' }}>
        <div className="row-between wrap">
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>Cadastrar-se</h2>
            <p className="muted">Do envio à entrega, tudo sob controle.</p>
          </div>
          <Segmented
            value={perfil}
            onChange={setPerfil}
            options={[
              { value: 'cliente', label: 'Usuário' },
              { value: 'empresa', label: 'Empresa' },
            ]}
          />
        </div>
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={registrar} noValidate>
          <div className="grid-form">
            <Field label={perfil === 'empresa' ? 'Nome da empresa' : 'Nome completo'} value={form.nome} onChange={set('nome')} error={erros.nome} />
            <Field label={perfil === 'empresa' ? 'CNPJ' : 'CPF / CNPJ'} value={form.documento} onChange={set('documento')} error={erros.documento} inputMode="numeric" />
            {perfil === 'empresa' && <Field label="Nome fantasia" value={form.fantasia} onChange={set('fantasia')} />}
            <Field label={perfil === 'empresa' ? 'E-mail corporativo' : 'E-mail'} type="email" value={form.email} onChange={set('email')} error={erros.email} />
            {perfil === 'empresa' && <Field label="Segmento" as="select" value={form.segmento} onChange={set('segmento')} options={SEGMENTOS} />}
            {perfil === 'empresa' && <Field label="Telefone" type="tel" value={form.telefone} onChange={set('telefone')} />}
            <Field label="Senha" type="password" value={form.senha} onChange={set('senha')} error={erros.senha} />
            <Field label="Confirme sua senha" type="password" value={form.confirma} onChange={set('confirma')} error={erros.confirma} />
          </div>
          <label className="row">
            <input type="checkbox" checked={form.aceite} onChange={set('aceite')} />
            <span className="small">Aceito os Termos de Uso e a Política de Privacidade (LGPD)</span>
          </label>
          {erros.aceite && <small className="field-error">{erros.aceite}</small>}
          {erros.geral && (
            <p className="field-error" role="alert" style={{ fontSize: 14 }}>
              {erros.geral}
            </p>
          )}
          <div className="row">
            <Button variant="secondary" onClick={() => navigate('/login')}>
              Voltar
            </Button>
            <Button type="submit" variant="violet" className="grow">
              Registrar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
