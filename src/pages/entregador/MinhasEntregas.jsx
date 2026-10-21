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
import RotaOtimizada from '../../components/entregas/RotaOtimizada'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'

const RESULTADOS = [
  { value: 'entregue', label: 'Entregue' },
  { value: 'tentativa', label: 'Tentativa sem sucesso' },
  { value: 'avaria', label: 'Com avaria' },
]

/** Próximo passo de cada status. "registrar" abre o formulário de comprovante. */
const PROXIMO = {
  confirmado: { status: 'coletado', label: 'Confirmar coleta', descricao: 'Coleta confirmada pelo entregador' },
  coletado: { status: 'transito', label: 'Iniciar trajeto', descricao: 'Carga em trânsito' },
  transito: { status: 'saiu', label: 'Saí para entrega', descricao: 'A caminho do destinatário' },
  saiu: { registrar: true, label: 'Registrar entrega' },
  atrasado: { registrar: true, label: 'Registrar entrega' },
  tentativa: { status: 'saiu', label: 'Nova tentativa', descricao: 'Nova tentativa de entrega' },
}

const FORM_VAZIO = { resultado: 'entregue', recebedor: '', documento: '', foto: null, assinou: false, conferido: false }

/**
 * Tela do entregador: só as entregas atribuídas a ele, na ordem da rota otimizada.
 * Cada atualização de status vai para a API e aparece na visão operacional do administrador.
 */
export default function MinhasEntregas() {
  const { usuario, entregas, atualizarStatusEntrega, toast } = useApp()
  const [params, setParams] = useSearchParams()
  const [online, setOnline] = useState(true)
  const [fila, setFila] = useState([]) // atualizações feitas sem conexão
  const [form, setForm] = useState(FORM_VAZIO)
  const [ordemRota, setOrdemRota] = useState([]) // ids na ordem otimizada

  const pendentes = entregas.filter((e) => !['entregue', 'cancelado'].includes(e.status))
  const concluidas = entregas.filter((e) => e.status === 'entregue')
  const total = pendentes.length + concluidas.length
  const posicao = (id) => (ordemRota.includes(id) ? ordemRota.indexOf(id) : Infinity)
  const paradas = [...pendentes].sort((a, b) => posicao(a.id) - posicao(b.id))
  const proxima = paradas[0]
  const registrando = entregas.find((e) => e.id === params.get('registrar'))
  const naFila = (id) => fila.some((f) => f.id === id)
  // refaz a rota quando entra ou sai uma parada (não a cada mudança de status)
  const chaveRota = pendentes.map((e) => e.id).sort().join(',')

  const enviar = (id, status, descricao, msg) => {
    if (online) {
      atualizarStatusEntrega(id, status, descricao)
      toast(msg ?? 'Status atualizado — a central já está vendo.')
    } else {
      setFila((q) => [...q, { id, status, descricao }])
      toast('Sem conexão: atualização salva no aparelho.')
    }
  }

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
    setForm(FORM_VAZIO)
    setParams({ registrar: id })
  }

  const avancar = (e) => {
    const passo = PROXIMO[e.status]
    if (!passo) return
    if (passo.registrar) abrirRegistro(e.id)
    else enviar(e.id, passo.status, passo.descricao)
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
    enviar(registrando.id, status, descricao, 'Entrega registrada. Cliente e central notificados.')
    setParams({})
  }

  return (
    <Page title="Minhas entregas" subtitle={`${usuario?.nome} · ${usuario?.veiculo ?? 'sem veículo'} · rota do dia`}>
      <Card compact>
        <div className="row wrap">
          <Icon name={online ? 'activity' : 'wifioff'} color={online ? 'var(--green)' : 'var(--amber)'} />
          <span className="grow">
            {online ? 'Conectado — cada atualização chega na hora à central.' : `Sem conexão. ${fila.length} atualização(ões) serão enviadas ao reconectar.`}
          </span>
          <Toggle checked={online} onChange={alternarConexao} />
          <span className="small muted">Simular conexão</span>
        </div>
      </Card>

      <div className="grid-aside entregador-grid">
        <div className="stack">
          <Card compact>
            <div className="row-between">
              <strong>
                {concluidas.length} de {total} entregas concluídas
              </strong>
              <strong className="pink">{Math.round((concluidas.length / Math.max(1, total)) * 100)}%</strong>
            </div>
            <ProgressBar value={(concluidas.length / Math.max(1, total)) * 100} />
          </Card>

          {proxima && !registrando && (
            <Card highlight>
              <div className="row-between wrap">
                <span className="label pink">Próxima parada</span>
                <Badge tone={proxima.status === 'atrasado' ? 'danger' : 'pink'}>Janela {proxima.janela}</Badge>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{proxima.cliente}</h2>
              <p className="muted">{proxima.destino}</p>
              <div className="row wrap small grey">
                <span>{proxima.id}</span>
                <EntregaBadge status={proxima.status} />
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <a className="btn btn-secondary" href={`https://www.google.com/maps/search/?api=1&query=${proxima.lat != null ? `${proxima.lat},${proxima.lng}` : encodeURIComponent(proxima.destino)}`} target="_blank" rel="noreferrer">
                  <Icon name="send" size={18} /> Navegar
                </a>
                <a className="btn btn-secondary" href="tel:+5581999999999">
                  <Icon name="phone" size={18} /> Ligar
                </a>
              </div>
              {PROXIMO[proxima.status] && (
                <Button variant="violet" block onClick={() => avancar(proxima)} disabled={naFila(proxima.id)}>
                  {PROXIMO[proxima.status].label}
                </Button>
              )}
            </Card>
          )}

          {registrando && (
            <Card title={`Registrar entrega · ${registrando.id}`} action={<button className="link" onClick={() => setParams({})}>Cancelar</button>}>
              <form className="stack-sm" style={{ gap: 16 }} onSubmit={finalizar}>
                <p className="muted">
                  {registrando.cliente} — {registrando.destino}
                </p>
                <Segmented block label="Resultado" options={RESULTADOS} value={form.resultado} onChange={(v) => setForm({ ...form, resultado: v })} />
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

          <Card title={`Paradas (${paradas.length})`}>
            {paradas.length === 0 && <p className="muted">Todas as entregas concluídas. 🎉</p>}
            {paradas.map((p, i) => {
              const passo = PROXIMO[p.status]
              return (
                <div key={p.id} className="parada">
                  <span className="rota-num">{i + 1}</span>
                  <div className="grow">
                    <strong>{p.cliente}</strong>
                    <span className="cell-sub">
                      {p.destino} · janela {p.janela}
                    </span>
                    <span className="cell-sub">
                      {p.id} · {p.tipoCarga}
                    </span>
                  </div>
                  <div className="parada-acoes">
                    {naFila(p.id) ? <Badge tone="warning">Aguardando envio</Badge> : <EntregaBadge status={p.status} />}
                    {passo && (
                      <Button size="sm" variant={passo.registrar ? 'primary' : 'secondary'} onClick={() => avancar(p)} disabled={naFila(p.id)}>
                        {passo.label}
                      </Button>
                    )}
                    {['transito', 'saiu'].includes(p.status) && !naFila(p.id) && (
                      <button className="link small" onClick={() => enviar(p.id, 'atrasado', 'Atraso informado pelo entregador')}>
                        Informar atraso
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>

          {concluidas.length > 0 && (
            <Card title={`Concluídas (${concluidas.length})`}>
              {concluidas.map((c) => (
                <div key={c.id} className="row-between small">
                  <span>
                    <strong>{c.cliente}</strong>
                    <span className="cell-sub">{c.id}</span>
                  </span>
                  <EntregaBadge status={c.status} />
                </div>
              ))}
            </Card>
          )}
        </div>

        <RotaOtimizada compacto chave={chaveRota} onRota={(r) => setOrdemRota(r.paradas.map((p) => p.id))} />
      </div>
    </Page>
  )
}
