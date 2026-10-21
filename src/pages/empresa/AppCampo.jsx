import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import ProgressBar from '../../components/ui/ProgressBar'
import Segmented from '../../components/ui/Segmented'
import SignaturePad from '../../components/ui/SignaturePad'
import Toggle from '../../components/ui/Toggle'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'

const RESULTADOS = [
  { value: 'entregue', label: 'Entregue' },
  { value: 'tentativa', label: 'Tentativa sem sucesso' },
  { value: 'avaria', label: 'Com avaria' },
]

/** App da equipe de campo: rota do dia, registro de entrega com foto/assinatura e modo offline. */
export default function AppCampo() {
  const { entregas, atualizarStatusEntrega, toast } = useApp()
  const [params, setParams] = useSearchParams()
  const [online, setOnline] = useState(true)
  const [fila, setFila] = useState([]) // atualizações feitas sem conexão
  const [form, setForm] = useState({ resultado: 'entregue', recebedor: '', documento: '', foto: null, assinou: false, conferido: false })

  const paradas = entregas.filter((e) => !['entregue', 'cancelado'].includes(e.status) && e.responsavel)
  const concluidas = entregas.filter((e) => e.status === 'entregue' && e.responsavel).length
  const registrandoId = params.get('registrar')
  const registrando = entregas.find((e) => e.id === registrandoId)
  const proxima = paradas[0]

  // ao voltar a conexão, envia o que ficou na fila
  const alternarConexao = (conectado) => {
    setOnline(conectado)
    if (conectado && fila.length) {
      fila.forEach((f) => atualizarStatusEntrega(f.id, f.status, f.descricao))
      toast(`${fila.length} atualização(ões) sincronizada(s).`)
      setFila([])
    }
  }

  const abrirRegistro = (id) => {
    setForm({ resultado: 'entregue', recebedor: '', documento: '', foto: null, assinou: false, conferido: false })
    setParams({ registrar: id })
  }

  const escolherFoto = (e) => {
    const arquivo = e.target.files?.[0]
    if (arquivo) setForm((f) => ({ ...f, foto: URL.createObjectURL(arquivo) }))
  }

  const finalizar = (e) => {
    e.preventDefault()
    if (form.resultado === 'entregue' && (!form.foto || !form.assinou || !form.recebedor.trim())) {
      toast('Para concluir: foto, assinatura e nome do recebedor.')
      return
    }
    const status = form.resultado === 'entregue' ? 'entregue' : 'tentativa'
    const descricao =
      form.resultado === 'entregue'
        ? `Recebido por ${form.recebedor} · foto + assinatura + GPS`
        : form.resultado === 'avaria'
          ? 'Entregue com avaria registrada'
          : 'Destinatário ausente — nova tentativa agendada'
    if (online) {
      atualizarStatusEntrega(registrando.id, status, descricao)
      toast('Entrega registrada e cliente notificado.')
    } else {
      setFila((q) => [...q, { id: registrando.id, status, descricao }])
      toast('Sem conexão: registro salvo no aparelho.')
    }
    setParams({})
  }

  return (
    <Page title="App de campo" subtitle="Rota do dia · visão do entregador / técnico">
      <Card compact>
        <div className="row wrap">
          <Icon name={online ? 'activity' : 'wifioff'} color={online ? 'var(--green)' : 'var(--amber)'} />
          <span className="grow">
            {online ? 'Conectado — atualizações enviadas na hora.' : `Sem conexão. ${fila.length} atualização(ões) salva(s) serão enviadas ao reconectar.`}
          </span>
          <Toggle checked={online} onChange={alternarConexao} />
          <span className="small muted">Simular conexão</span>
        </div>
      </Card>

      <div className="grid-aside">
        <div className="stack">
          <Card compact>
            <div className="row-between">
              <strong>
                {concluidas} de {concluidas + paradas.length} entregas
              </strong>
              <strong className="pink">{Math.round((concluidas / Math.max(1, concluidas + paradas.length)) * 100)}%</strong>
            </div>
            <ProgressBar value={(concluidas / Math.max(1, concluidas + paradas.length)) * 100} />
          </Card>

          {proxima && !registrando && (
            <Card highlight>
              <div className="row-between">
                <span className="label pink">Próxima parada</span>
                <Badge tone={proxima.status === 'atrasado' ? 'danger' : 'pink'}>Janela {proxima.janela}</Badge>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{proxima.cliente}</h2>
              <p className="muted">{proxima.destino}</p>
              <p className="small grey">
                {proxima.tipoCarga} · {proxima.id}
              </p>
              <div className="grid-2" style={{ gap: 12 }}>
                <a className="btn btn-primary" href={`https://www.google.com/maps/search/${encodeURIComponent(proxima.destino)}`} target="_blank" rel="noreferrer">
                  <Icon name="send" size={18} /> Navegar
                </a>
                <a className="btn btn-secondary" href="tel:+5581999999999">
                  <Icon name="phone" size={18} /> Ligar
                </a>
              </div>
              <Button variant="violet" block onClick={() => abrirRegistro(proxima.id)}>
                Registrar entrega
              </Button>
            </Card>
          )}

          {registrando && (
            <Card title={`Registrar entrega · ${registrando.id}`} action={<button className="link" onClick={() => setParams({})}>Cancelar</button>}>
              <form className="stack-sm" style={{ gap: 16 }} onSubmit={finalizar}>
                <p className="muted">
                  {registrando.cliente} — {registrando.destino}
                </p>
                <Segmented options={RESULTADOS} value={form.resultado} onChange={(v) => setForm({ ...form, resultado: v })} />
                <label className="photo-drop">
                  {form.foto ? (
                    <img src={form.foto} alt="Foto do comprovante" />
                  ) : (
                    <>
                      <Icon name="camera" size={32} color="var(--purple)" />
                      <span>Tirar foto do comprovante</span>
                    </>
                  )}
                  <input type="file" accept="image/*" capture="environment" hidden onChange={escolherFoto} />
                </label>
                <span className="small grey">
                  <Icon name="pin" size={12} color="var(--green)" /> Localização GPS anexada automaticamente
                </span>
                <span className="label">Assinatura do recebedor</span>
                <SignaturePad onChange={(assinou) => setForm((f) => ({ ...f, assinou }))} />
                <div className="grid-form">
                  <Field label="Nome do recebedor" value={form.recebedor} onChange={(e) => setForm({ ...form, recebedor: e.target.value })} />
                  <Field label="Documento" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
                </div>
                <label className="row">
                  <input type="checkbox" checked={form.conferido} onChange={(e) => setForm({ ...form, conferido: e.target.checked })} />
                  <span>Volumes conferidos</span>
                </label>
                <Button type="submit" block>
                  Finalizar entrega
                </Button>
              </form>
            </Card>
          )}
        </div>

        <Card title="Paradas do dia">
          {paradas.length === 0 && <p className="muted">Todas as entregas concluídas. 🎉</p>}
          {paradas.map((p, i) => (
            <div key={p.id} className="card compact" style={{ background: 'var(--card-2)', cursor: 'pointer' }} onClick={() => abrirRegistro(p.id)}>
              <div className="row">
                <span className="badge badge-neutral">{i + 1}</span>
                <div className="grow">
                  <strong>{p.cliente}</strong>
                  <span className="cell-sub">
                    {p.responsavel} · {p.janela}
                  </span>
                </div>
                <EntregaBadge status={p.status} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </Page>
  )
}
