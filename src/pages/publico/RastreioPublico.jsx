import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import RastreioResultado from '../../components/entregas/RastreioResultado'
import { useApp } from '../../context/AppContext'
import { EntregasApi } from '../../services/api'
import { maskDocumento } from '../../utils/format'
import { CLIENTE_DEMO } from '../../data/contasDemo'

/** Rastreio sem login: código do localizador + CPF/CNPJ. */
export default function RastreioPublico() {
  const { rastrear, toast } = useApp()
  const [params] = useSearchParams()
  const [codigo, setCodigo] = useState(params.get('codigo') ?? '')
  const [documento, setDocumento] = useState('')
  const [resultado, setResultado] = useState(undefined) // undefined = ainda não buscou
  const [consultado, setConsultado] = useState('') // documento da busca que deu certo
  const [email, setEmail] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [mostrarExemplo, setMostrarExemplo] = useState(false)

  useEffect(() => {
    // o exemplo só aparece enquanto a empresa de demonstração existir
    EntregasApi.rastrear('RT-90827-BR', CLIENTE_DEMO.documento).then(() => setMostrarExemplo(true)).catch(() => {})
  }, [])

  // consulta pública na API: só devolve a entrega se código e documento conferirem
  const localizar = async (e) => {
    e.preventDefault()
    setBuscando(true)
    const r = await rastrear(codigo.trim(), documento)
    setResultado(r)
    setConsultado(r ? documento : '')
    setBuscando(false)
  }

  const avisar = async (e) => {
    e.preventDefault()
    try {
      await EntregasApi.inscreverAvisos({ codigo: resultado.id, documento: consultado, email })
      toast(`Pronto! Enviaremos as próximas atualizações para ${email}.`)
      setEmail('')
    } catch (err) {
      toast(err.message)
    }
  }

  return (
    <section className="public-section">
      <div className="container stack">
        <div>
          <h1 className="section-title" style={{ fontSize: 40 }}>
            Rastreie sua encomenda
          </h1>
          <p className="section-sub" style={{ marginBottom: 0 }}>
            Sem cadastro: informe o código do localizador e o CPF/CNPJ de quem recebe.
          </p>
        </div>
        <Card compact>
          <form className="track-form" onSubmit={localizar}>
            <Field label="Código do localizador" placeholder="RT-00000-BR" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
            <Field label="CPF / CNPJ" placeholder="000.000.000-00" value={documento} onChange={(e) => setDocumento(maskDocumento(e.target.value))} inputMode="numeric" required />
            <Button type="submit" disabled={buscando}>
              {buscando ? 'Buscando…' : 'Localizar encomenda'}
            </Button>
          </form>
          {mostrarExemplo && (
            <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => (setCodigo('RT-90827-BR'), setDocumento(CLIENTE_DEMO.documento))}>
              Usar exemplo da demonstração (RT-90827-BR)
            </button>
          )}
        </Card>

        {resultado === null && (
          <Card>
            <EmptyState icon="alert" title="Encomenda não encontrada">
              Confira o código e o documento. O CPF/CNPJ deve ser o de quem contratou o envio ou o informado pela transportadora.
            </EmptyState>
          </Card>
        )}

        {resultado && (
          <RastreioResultado
            entrega={resultado}
            documento={consultado}
            aside={
              <Card title="Receber avisos por e-mail">
                <form className="stack-sm" onSubmit={avisar}>
                  <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <Button type="submit" variant="violet" block>
                    Ativar avisos
                  </Button>
                </form>
              </Card>
            }
          />
        )}
      </div>
    </section>
  )
}
