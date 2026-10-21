import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import KeyValue from '../../components/ui/KeyValue'
import { useApp } from '../../context/AppContext'
import { maskDocumento } from '../../utils/format'

const VEICULOS = ['Moto', 'Carro', 'Van', 'Caminhão', 'Bicicleta']
const PAPEL = { cliente: 'Cliente', empresa: 'Administrador', entregador: 'Entregador' }

const formDe = (u) => ({ nome: u?.nome ?? '', email: u?.email ?? '', telefone: u?.telefone ?? '', veiculo: u?.veiculo ?? '', empresa: u?.empresa ?? '' })

/** Página de perfil (cliente, administrador e entregador): dados pessoais, senha e resumo da conta. */
export default function Perfil() {
  const { usuario, papel, entregas, atualizarPerfil, alterarSenha, logout, toast } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => formDe(usuario))
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [senha, setSenha] = useState({ atual: '', nova: '', confirma: '' })
  const [errosSenha, setErrosSenha] = useState({})

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const setS = (campo) => (e) => setSenha((s) => ({ ...s, [campo]: e.target.value }))
  const alterado = JSON.stringify(form) !== JSON.stringify(formDe(usuario))

  const salvar = async (e) => {
    e.preventDefault()
    const n = {}
    if (form.nome.trim().length < 3) n.nome = 'Informe o nome completo.'
    if (!form.email.includes('@')) n.email = 'E-mail inválido.'
    setErros(n)
    if (Object.keys(n).length) return
    setSalvando(true)
    try {
      await atualizarPerfil(form)
      toast('Perfil atualizado.')
    } catch (err) {
      setErros(err.status === 409 ? { email: err.message } : { geral: err.message })
    } finally {
      setSalvando(false)
    }
  }

  const trocarSenha = async (e) => {
    e.preventDefault()
    const n = {}
    if (!senha.atual) n.atual = 'Informe a senha atual.'
    if (senha.nova.length < 6) n.nova = 'Mínimo de 6 caracteres.'
    if (senha.nova !== senha.confirma) n.confirma = 'As senhas não conferem.'
    setErrosSenha(n)
    if (Object.keys(n).length) return
    try {
      await alterarSenha(senha.atual, senha.nova)
      setSenha({ atual: '', nova: '', confirma: '' })
      toast('Senha alterada. As outras sessões foram encerradas.')
    } catch (err) {
      setErrosSenha({ atual: err.message })
    }
  }

  const sair = () => {
    logout()
    navigate('/login')
  }

  // resumo conforme o papel
  const concluidas = entregas.filter((x) => x.status === 'entregue').length
  const resumo =
    papel === 'cliente'
      ? [
          ['Pedidos realizados', entregas.length],
          ['Entregues', concluidas],
          ['Em andamento', entregas.filter((x) => !['entregue', 'cancelado'].includes(x.status)).length],
        ]
      : papel === 'entregador'
        ? [
            ['Entregas atribuídas', entregas.length],
            ['Concluídas', concluidas],
            ['Pendentes', entregas.filter((x) => !['entregue', 'cancelado'].includes(x.status)).length],
          ]
        : [
            ['Entregas na operação', entregas.length],
            ['Concluídas', concluidas],
            ['Atrasadas', entregas.filter((x) => x.status === 'atrasado').length],
          ]

  return (
    <Page title="Meu perfil" subtitle="Seus dados de acesso e de contato">
      <div className="grid-aside">
        <div className="stack">
          <Card title="Dados pessoais">
            <form className="stack-sm" style={{ gap: 16 }} onSubmit={salvar} noValidate>
              <div className="grid-form">
                <Field label="Nome completo" value={form.nome} onChange={set('nome')} error={erros.nome} autoComplete="name" />
                <Field label="E-mail" type="email" value={form.email} onChange={set('email')} error={erros.email} autoComplete="email" />
                <Field label="Telefone" type="tel" value={form.telefone} onChange={set('telefone')} placeholder="(81) 99999-0000" autoComplete="tel" />
                {papel === 'entregador' && (
                  <Field label="Veículo" value={form.veiculo} onChange={set('veiculo')} list="veiculos" placeholder="Ex.: Moto, Van PE-02" />
                )}
                {papel === 'empresa' && <Field label="Nome da empresa" value={form.empresa} onChange={set('empresa')} />}
              </div>
              <datalist id="veiculos">
                {VEICULOS.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
              {erros.geral && (
                <p className="field-error" role="alert">
                  {erros.geral}
                </p>
              )}
              <div className="row wrap">
                <Button type="submit" disabled={!alterado || salvando}>
                  {salvando ? 'Salvando…' : 'Salvar alterações'}
                </Button>
                {alterado && (
                  <Button variant="secondary" onClick={() => (setForm(formDe(usuario)), setErros({}))}>
                    Descartar
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Card title="Alterar senha">
            <form className="stack-sm" style={{ gap: 16 }} onSubmit={trocarSenha} noValidate>
              <div className="grid-form">
                <Field label="Senha atual" type="password" value={senha.atual} onChange={setS('atual')} error={errosSenha.atual} autoComplete="current-password" />
                <span className="hide-mobile" />
                <Field label="Nova senha" type="password" value={senha.nova} onChange={setS('nova')} error={errosSenha.nova} autoComplete="new-password" />
                <Field label="Confirme a nova senha" type="password" value={senha.confirma} onChange={setS('confirma')} error={errosSenha.confirma} autoComplete="new-password" />
              </div>
              <div>
                <Button type="submit" variant="violet">
                  Alterar senha
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="stack">
          <Card style={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar name={usuario?.nome} size={88} />
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{usuario?.nome}</h2>
              <p className="small muted">{usuario?.email}</p>
            </div>
            <Badge tone={papel === 'entregador' ? 'pink' : 'info'}>{PAPEL[papel]}</Badge>
          </Card>
          <Card title="Conta">
            {papel === 'cliente' ? (
              <KeyValue label="CPF / CNPJ" value={usuario?.documento ? maskDocumento(usuario.documento) : '—'} />
            ) : (
              <>
                <KeyValue label="Empresa" value={usuario?.empresa} />
                <KeyValue label="CNPJ" value={usuario?.cnpj ? maskDocumento(usuario.cnpj) : '—'} />
                <KeyValue label="Função" value={PAPEL[papel]} />
              </>
            )}
            {resumo.map(([label, valor]) => (
              <KeyValue key={label} label={label} value={valor} />
            ))}
            <Button variant="outline" icon="logout" onClick={sair}>
              Sair da conta
            </Button>
          </Card>
        </div>
      </div>
    </Page>
  )
}
