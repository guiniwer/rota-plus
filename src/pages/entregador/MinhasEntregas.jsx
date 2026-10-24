import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import Modal from '../../components/ui/Modal'
import ProgressBar from '../../components/ui/ProgressBar'
import Segmented from '../../components/ui/Segmented'
import SignaturePad from '../../components/ui/SignaturePad'
import Conversa from '../../components/entregas/Conversa'
import RotaOtimizada from '../../components/entregas/RotaOtimizada'
import { EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import useFilaOffline from '../../hooks/useFilaOffline'
import useRastreamentoGps from '../../hooks/useRastreamentoGps'
import { EmpresaApi, EntregasApi } from '../../services/api'
import { comprimirFoto } from '../../utils/imagem'
import { hora, previsaoTexto, relativo } from '../../utils/tempo'

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

const FORM_VAZIO = { resultado: 'entregue', recebedor: '', documento: '', foto: null, assinatura: null, conferido: false }
const GPS_TEXTO = {
  iniciando: 'Obtendo localização…',
  ativo: 'GPS ativo — a central e o cliente veem sua posição durante a rota.',
  negado: 'Permissão de localização negada. Libere nas configurações do navegador para a central acompanhar a rota.',
  indisponivel: 'Este aparelho não tem GPS disponível no navegador.',
  fora_do_turno: 'Fora do expediente: sua localização não é enviada (LGPD).',
  erro: 'Não foi possível ler o GPS. Tentando de novo…',
}
const digitos = (s = '') => s.replace(/\D/g, '')

function TermoCiencia({ empresa, onAceitar }) {
  return (
    <Card highlight title="Uso da sua localização">
      <p className="small">
        {empresa.nome} usa a localização do seu aparelho <strong>somente durante o expediente ({empresa.turnoInicio}–{empresa.turnoFim})</strong> para acompanhar as entregas, calcular a previsão de
        chegada para o cliente e alertar a central sobre atrasos e desvios.
      </p>
      <p className="small muted">
        Fora do expediente nada é enviado. {empresa.privacidade.anonimizar90 ? 'O histórico de posições é apagado após 90 dias. ' : ''}O cliente só vê sua posição enquanto a entrega dele está a caminho.
      </p>
      <Button onClick={onAceitar}>Estou ciente — ativar GPS</Button>
    </Card>
  )
}

/**
 * App do entregador: só as entregas atribuídas a ele, na ordem da rota otimizada.
 * Envia o GPS do aparelho, guarda as ações feitas sem internet e envia ao reconectar.
 */
export default function MinhasEntregas() {
  const { usuario, entregas, empresa, recarregarEmpresa, atualizarEntrega, executar, toast } = useApp()
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState(FORM_VAZIO)
  const [ordemRota, setOrdemRota] = useState([])
  const [conversa, setConversa] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const precisaTermo = empresa?.privacidade?.termoCiencia && !empresa?.termoAceitoEm
  const gps = useRastreamentoGps(empresa, { ativo: Boolean(empresa) && !precisaTermo })
  const { online, fila, enviar } = useFilaOffline(
    usuario.id,
    {
      status: (i) => EntregasApi.status(i.entregaId, { status: i.status, descricao: i.descricao, lat: i.lat, lng: i.lng, quando: i.quando }).then(atualizarEntrega),
      comprovante: (i) => EntregasApi.comprovante(i.entregaId, { ...i.dados, quando: i.quando }).then(atualizarEntrega),
    },
    {
      onSincronizado: (n) => toast(`${n} registro(s) feito(s) sem internet foram enviados.`),
      onErro: (err, item) => toast(`${item.entregaId}: ${err.message}`),
    },
  )

  const pendentes = entregas.filter((e) => !['entregue', 'cancelado'].includes(e.status))
  const concluidasHoje = entregas.filter((e) => e.status === 'entregue' && new Date(e.entregueEm).toDateString() === new Date().toDateString())
  const total = pendentes.length + concluidasHoje.length
  const posicao = (id) => (ordemRota.includes(id) ? ordemRota.indexOf(id) : Infinity)
  const paradas = [...pendentes].sort((a, b) => posicao(a.id) - posicao(b.id) || Date.parse(a.prazoLimite) - Date.parse(b.prazoLimite))
  const proxima = paradas[0]
  const registrando = entregas.find((e) => e.id === params.get('registrar'))
  const naFila = (id) => fila.some((f) => f.entregaId === id)
  const chaveRota = pendentes.map((e) => e.id).sort().join(',')

  const mudar = async (e, status, descricao) => {
    const pos = await gps.posicaoAgora()
    try {
      const r = await enviar('status', { entregaId: e.id, status, descricao, lat: pos?.lat ?? null, lng: pos?.lng ?? null })
      if (r.enviado) atualizarEntrega(r.resultado)
      toast(r.enviado ? 'Status atualizado — a central já está vendo.' : 'Sem internet: salvo no aparelho, será enviado ao reconectar.')
    } catch (err) {
      toast(err.message)
    }
  }

  const avancar = (e) => {
    const passo = PROXIMO[e.status]
    if (!passo) return
    if (passo.registrar) {
      setForm(FORM_VAZIO)
      setParams({ registrar: e.id })
    } else mudar(e, passo.status, passo.descricao)
  }

  const escolherFoto = async (ev) => {
    const arquivo = ev.target.files?.[0]
    if (!arquivo) return
    try {
      const foto = await comprimirFoto(arquivo)
      setForm((f) => ({ ...f, foto }))
    } catch (err) {
      toast(err.message)
    }
  }

  const finalizar = async (ev) => {
    ev.preventDefault()
    if (form.resultado !== 'tentativa' && (!form.foto || !form.assinatura || !form.recebedor.trim())) return toast('Para concluir: foto, assinatura e nome do recebedor.')
    setEnviando(true)
    const pos = await gps.posicaoAgora()
    const dados = { resultado: form.resultado, recebedor: form.recebedor, documento: form.documento, foto: form.foto, assinatura: form.assinatura, conferido: form.conferido, lat: pos?.lat ?? null, lng: pos?.lng ?? null, precisao: pos?.precisao ?? null }
    try {
      const r = await enviar('comprovante', { entregaId: registrando.id, dados })
      if (r.enviado) atualizarEntrega(r.resultado)
      toast(r.enviado ? `Registrado${pos ? ' com GPS' : ' (sem GPS)'}. Cliente e central notificados.` : 'Sem internet: comprovante salvo no aparelho, será enviado ao reconectar.')
      setParams({})
    } catch (err) {
      toast(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const aceitarTermo = async () => {
    if (await executar(() => EmpresaApi.aceitarTermo())) recarregarEmpresa()
  }

  if (!empresa) return <Page title="Minhas entregas" subtitle="Carregando…" />

  return (
    <Page title="Minhas entregas" subtitle={`${usuario.nome} · ${usuario.veiculo ?? 'sem veículo'} · ${empresa.nome}`}>
      {precisaTermo && <TermoCiencia empresa={empresa} onAceitar={aceitarTermo} />}
      <Card compact>
        <div className="row wrap">
          <Icon name={online ? 'activity' : 'wifioff'} color={online ? 'var(--green)' : 'var(--amber)'} />
          <span className="grow">{online ? 'Conectado — cada atualização chega na hora à central.' : `Sem internet. ${fila.length} registro(s) guardado(s) no aparelho serão enviados ao reconectar.`}</span>
          {fila.length > 0 && online && <Badge tone="warning">Enviando {fila.length}…</Badge>}
        </div>
        {!precisaTermo && (
          <div className="row wrap small">
            <Icon name="pin" size={16} color={gps.estado === 'ativo' ? 'var(--green)' : 'var(--amber)'} />
            <span className={`grow ${gps.estado === 'ativo' ? 'muted' : 'amber'}`}>{GPS_TEXTO[gps.estado]}</span>
            {gps.posicao && <span className="grey">±{gps.posicao.precisao} m{gps.ultimoEnvio ? ` · enviado ${relativo(gps.ultimoEnvio)}` : ''}</span>}
          </div>
        )}
      </Card>

      <div className="grid-aside entregador-grid">
        <div className="stack">
          <Card compact>
            <div className="row-between">
              <strong>
                {concluidasHoje.length} de {total} entregas de hoje concluídas
              </strong>
              <strong className="pink">{Math.round((concluidasHoje.length / Math.max(1, total)) * 100)}%</strong>
            </div>
            <ProgressBar value={(concluidasHoje.length / Math.max(1, total)) * 100} />
          </Card>

          {proxima && !registrando && (
            <Card highlight>
              <div className="row-between wrap">
                <span className="label pink">Próxima parada</span>
                <Badge tone={proxima.atrasada ? 'danger' : 'pink'}>{proxima.janela ? `Janela ${proxima.janela}` : `Até ${hora(proxima.prazoLimite)}`}</Badge>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>{proxima.cliente}</h2>
              <p className="muted">{proxima.destino}</p>
              {proxima.instrucoes && (
                <p className="small">
                  <Icon name="alert" size={14} color="var(--amber)" /> {proxima.instrucoes}
                </p>
              )}
              <div className="row wrap small grey">
                <span>{proxima.id}</span>
                <EntregaBadge status={proxima.status} />
                {proxima.atrasada && <span className="red">prazo vencido</span>}
              </div>
              <div className="grid-3" style={{ gap: 8 }}>
                <a className="btn btn-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${proxima.lat != null ? `${proxima.lat},${proxima.lng}` : encodeURIComponent(proxima.destino)}`} target="_blank" rel="noreferrer">
                  <Icon name="send" size={18} /> Navegar
                </a>
                {proxima.telefoneDestinatario ? (
                  <a className="btn btn-secondary" href={`tel:${digitos(proxima.telefoneDestinatario)}`}>
                    <Icon name="phone" size={18} /> Ligar
                  </a>
                ) : (
                  <Button variant="secondary" icon="phone" disabled title="Sem telefone cadastrado">
                    Ligar
                  </Button>
                )}
                <Button variant="secondary" icon="mail" onClick={() => setConversa(proxima)}>
                  Mensagens
                </Button>
              </div>
              {PROXIMO[proxima.status] && (
                <Button variant="violet" block onClick={() => avancar(proxima)} disabled={naFila(proxima.id)}>
                  {naFila(proxima.id) ? 'Aguardando conexão…' : PROXIMO[proxima.status].label}
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
                {form.resultado !== 'tentativa' && (
                  <>
                    <label className="photo-drop">
                      {form.foto ? (
                        <img src={form.foto} alt="Foto do comprovante" />
                      ) : (
                        <>
                          <Icon name="camera" size={32} color="var(--purple)" />
                          <span>{form.resultado === 'avaria' ? 'Fotografe a avaria' : 'Tirar foto do comprovante'}</span>
                        </>
                      )}
                      <input type="file" accept="image/*" capture="environment" hidden onChange={escolherFoto} />
                    </label>
                    <span className="label">Assinatura do recebedor</span>
                    <SignaturePad onChange={(assinatura) => setForm((f) => ({ ...f, assinatura }))} />
                    <div className="grid-form">
                      <Field label="Nome do recebedor" value={form.recebedor} onChange={(e) => setForm({ ...form, recebedor: e.target.value })} />
                      <Field label="Documento (opcional)" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
                    </div>
                    <label className="row">
                      <input type="checkbox" checked={form.conferido} onChange={(e) => setForm({ ...form, conferido: e.target.checked })} />
                      <span>Volumes conferidos</span>
                    </label>
                  </>
                )}
                <span className="small grey">
                  <Icon name="pin" size={12} color={gps.posicao ? 'var(--green)' : 'var(--amber)'} /> {gps.posicao ? `Localização anexada (±${gps.posicao.precisao} m)` : 'A localização será anexada se o GPS responder'}
                </span>
                <Button type="submit" block disabled={enviando}>
                  {enviando ? 'Registrando…' : form.resultado === 'tentativa' ? 'Registrar tentativa' : 'Finalizar entrega'}
                </Button>
              </form>
            </Card>
          )}

          <Card title={`Paradas (${paradas.length})`}>
            {paradas.length === 0 && <p className="muted">Nenhuma entrega pendente.</p>}
            {paradas.map((p, i) => {
              const passo = PROXIMO[p.status]
              return (
                <div key={p.id} className="parada">
                  <span className="rota-num">{i + 1}</span>
                  <div className="grow">
                    <strong>{p.cliente}</strong>
                    <span className="cell-sub">{p.destino}</span>
                    <span className={`cell-sub ${p.atrasada ? 'red' : ''}`}>
                      {p.id} · {previsaoTexto(p)}
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
                      <button className="link small" onClick={() => mudar(p, 'atrasado', 'Atraso informado pelo entregador')}>
                        Informar atraso
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>

          {concluidasHoje.length > 0 && (
            <Card title={`Concluídas hoje (${concluidasHoje.length})`}>
              {concluidasHoje.map((c) => (
                <div key={c.id} className="row-between small">
                  <span>
                    <strong>{c.cliente}</strong>
                    <span className="cell-sub">
                      {c.id} · {hora(c.entregueEm)}
                    </span>
                  </span>
                  <EntregaBadge status={c.status} />
                </div>
              ))}
            </Card>
          )}
        </div>

        <RotaOtimizada compacto chave={chaveRota} onRota={(r) => setOrdemRota(r.paradas.map((p) => p.id))} />
      </div>

      <Modal title={conversa ? `Mensagens · ${conversa.id}` : ''} open={Boolean(conversa)} onClose={() => setConversa(null)}>
        {conversa && <Conversa entregaId={conversa.id} />}
      </Modal>
    </Page>
  )
}
