import { useState } from 'react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Field from '../../components/ui/Field'
import RastreioResultado from '../../components/entregas/RastreioResultado'
import { useApp } from '../../context/AppContext'
import { maskDocumento, onlyDigits } from '../../utils/format'

/** Rastreio sem login: código do localizador + CPF/CNPJ. */
export default function RastreioPublico() {
  const { entregas, toast } = useApp()
  const [codigo, setCodigo] = useState('')
  const [documento, setDocumento] = useState('')
  const [resultado, setResultado] = useState(undefined) // undefined = ainda não buscou
  const [contato, setContato] = useState('')

  const localizar = (e) => {
    e.preventDefault()
    const achada = entregas.find((x) => x.id.toUpperCase() === codigo.trim().toUpperCase() && x.documento === onlyDigits(documento))
    setResultado(achada ?? null)
  }

  const usarExemplo = () => {
    setCodigo('RT-90827-BR')
    setDocumento('123.456.789-00')
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
            <Button type="submit">Localizar encomenda</Button>
          </form>
          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={usarExemplo}>
            Usar exemplo (RT-90827-BR)
          </button>
        </Card>

        {resultado === null && (
          <Card>
            <EmptyState icon="alert" title="Encomenda não encontrada">
              Confira o código e o documento. O CPF/CNPJ deve ser o do destinatário ou de quem contratou o envio.
            </EmptyState>
          </Card>
        )}

        {resultado && (
          <RastreioResultado
            entrega={resultado}
            aside={
              <Card title="Receber avisos desta entrega">
                <form
                  className="stack-sm"
                  onSubmit={(e) => {
                    e.preventDefault()
                    toast(`Avisos ativados para ${contato}.`)
                    setContato('')
                  }}
                >
                  <Field label="WhatsApp ou e-mail" value={contato} onChange={(e) => setContato(e.target.value)} required />
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
