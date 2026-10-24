import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import OptionCard from '../../components/ui/OptionCard'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'
import { AuthApi } from '../../services/api'
import { documentoValido } from '../../utils/documento'
import { maskDocumento } from '../../utils/format'
import { INICIO, papelDe } from '../../utils/papel'

const SEGMENTOS = ['Logística', 'Construção', 'Varejo', 'Saúde', 'Eventos', 'Assistência técnica', 'Manutenção', 'Locação de equipamentos', 'Distribuição', 'Tecnologia', 'Outro']
const VEICULOS = ['Moto', 'Carro', 'Van', 'Caminhão', 'Bicicleta']

/** Cadastro de usuário (cliente) ou de empresa — nesta, como administrador ou entregador. */
export default function Cadastro() {
  const { cadastrar, toast } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tokenConvite = params.get('convite')
  const [perfil, setPerfil] = useState(params.get('perfil') === 'empresa' || tokenConvite ? 'empresa' : 'cliente')
  const [funcao, setFuncao] = useState(tokenConvite ? 'entregador' : 'admin') // só para empresa: 'admin' | 'entregador'
  const [convite, setConvite] = useState(null) // { empresa, cnpj, email } quando veio por link de convite
  const [form, setForm] = useState({ nome: '', responsavel: '', email: '', documento: '', fantasia: '', segmento: SEGMENTOS[0], telefone: '', veiculo: VEICULOS[0], senha: '', confirma: '', aceite: false })
  const [erros, setErros] = useState({})

  useEffect(() => {
    if (!tokenConvite) return
    AuthApi.convite(tokenConvite)
      .then((c) => {
        setConvite(c)
        setForm((f) => ({ ...f, documento: maskDocumento(c.cnpj), email: c.email ?? f.email }))
      })
      .catch((err) => setErros({ geral: err.message }))
  }, [tokenConvite])

  const empresa = perfil === 'empresa'
  const admin = empresa && funcao === 'admin'
  const entregador = empresa && funcao === 'entregador'

  const set = (campo) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [campo]: campo === 'documento' ? maskDocumento(v) : v }))
  }

  const registrar = async (e) => {
    e.preventDefault()
    const n = {}
    if (form.nome.trim().length < 3) n.nome = admin ? 'Informe o nome da empresa.' : 'Informe o nome completo.'
    if (admin && form.responsavel.trim().length < 3) n.responsavel = 'Informe o nome do administrador.'
    if (!form.email.includes('@')) n.email = 'E-mail inválido.'
    const digitos = form.documento.replace(/\D/g, '').length
    if (empresa ? digitos !== 14 : ![11, 14].includes(digitos)) n.documento = empresa ? 'CNPJ deve ter 14 dígitos.' : 'CPF (11) ou CNPJ (14 dígitos).'
    else if (!documentoValido(form.documento)) n.documento = empresa ? 'CNPJ inválido (confira os dígitos).' : 'CPF/CNPJ inválido (confira os dígitos).'
    if (form.senha.length < 6) n.senha = 'Mínimo de 6 caracteres.'
    if (form.senha !== form.confirma) n.confirma = 'As senhas não conferem.'
    if (!form.aceite) n.aceite = 'É preciso aceitar os termos.'
    setErros(n)
    if (Object.keys(n).length) return

    try {
      const u = await cadastrar({ perfil, funcao: empresa ? funcao : undefined, ...form, convite: entregador && convite ? tokenConvite : undefined })
      navigate(INICIO[papelDe(u)])
      toast('Conta criada com sucesso! Bem-vindo(a) à Rota+.')
    } catch (err) {
      // erro de e-mail ou CNPJ aparece no próprio campo; os demais, embaixo do formulário
      // a API indica o campo com problema (e-mail já usado, CNPJ já cadastrado ou inexistente…)
      if (err.campo && ['email', 'documento', 'nome', 'senha', 'responsavel'].includes(err.campo)) setErros({ [err.campo]: err.message })
      else setErros({ geral: err.message })
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
          {!convite && <Segmented
            value={perfil}
            onChange={(p) => (setPerfil(p), setErros({}))}
            options={[
              { value: 'cliente', label: 'Usuário' },
              { value: 'empresa', label: 'Empresa' },
            ]}
          />}
        </div>
        {convite && (
          <p className="small" style={{ padding: 12, borderRadius: 12, background: 'var(--card-2)' }}>
            Convite para a equipe de entregas de <strong>{convite.empresa}</strong>. Crie seu acesso de entregador abaixo.
          </p>
        )}
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={registrar} noValidate>
          {empresa && !convite && (
            <div className="field">
              <span className="field-label">Você é</span>
              <div className="grid-2" style={{ gap: 12 }}>
                <OptionCard
                  icon="grid"
                  title="Administrador"
                  description="Acesso à visão operacional: entregas, ativos, equipes e alertas"
                  selected={admin}
                  onSelect={() => (setFuncao('admin'), setErros({}))}
                />
                <OptionCard
                  icon="truck"
                  title="Entregador"
                  description="Acesso à tela do entregador: rota do dia e atualização das entregas"
                  selected={entregador}
                  onSelect={() => (setFuncao('entregador'), setErros({}))}
                />
              </div>
            </div>
          )}
          <div className="grid-form">
            <Field label={admin ? 'Nome da empresa' : 'Nome completo'} value={form.nome} onChange={set('nome')} error={erros.nome} />
            <Field label={entregador ? 'CNPJ da empresa em que trabalha' : empresa ? 'CNPJ' : 'CPF / CNPJ'} value={form.documento} onChange={set('documento')} error={erros.documento} inputMode="numeric" disabled={Boolean(convite)} />
            {admin && <Field label="Nome do administrador" value={form.responsavel} onChange={set('responsavel')} error={erros.responsavel} />}
            {admin && <Field label="Nome fantasia" value={form.fantasia} onChange={set('fantasia')} />}
            <Field label={empresa ? 'E-mail corporativo' : 'E-mail'} type="email" value={form.email} onChange={set('email')} error={erros.email} />
            <Field label="Telefone" type="tel" value={form.telefone} onChange={set('telefone')} />
            {admin && <Field label="Segmento" as="select" value={form.segmento} onChange={set('segmento')} options={SEGMENTOS} />}
            {entregador && <Field label="Veículo" as="select" value={form.veiculo} onChange={set('veiculo')} options={VEICULOS} />}
            <Field label="Senha" type="password" value={form.senha} onChange={set('senha')} error={erros.senha} />
            <Field label="Confirme sua senha" type="password" value={form.confirma} onChange={set('confirma')} error={erros.confirma} />
          </div>
          {entregador && <p className="small muted">A empresa precisa já ter um administrador cadastrado. Você verá apenas as entregas atribuídas a você.</p>}
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
