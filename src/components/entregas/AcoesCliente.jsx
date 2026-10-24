import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { EntregasApi } from '../../services/api'
import Button from '../ui/Button'
import Field from '../ui/Field'
import QrCode from '../ui/QrCode'
import { num } from '../../utils/format'
import { data } from '../../utils/tempo'

const JANELAS = ['08:00–12:00', '12:00–15:00', '15:00–18:00']
const MOTIVOS = ['Atraso na entrega', 'Encomenda danificada', 'Item faltando', 'Endereço incorreto', 'Outro']

/** Próximos 6 dias úteis (seg–sáb) a partir de amanhã, no formato AAAA-MM-DD. */
function proximosDias() {
  const dias = []
  for (let i = 1; dias.length < 6; i++) {
    const d = new Date(Date.now() + i * 864e5)
    if (d.getDay() === 0) continue
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    dias.push({ value: iso, label: d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) })
  }
  return dias
}

export function Reagendar({ entrega, onFechar }) {
  const { atualizarEntrega, executar, toast } = useApp()
  const dias = proximosDias()
  const [dia, setDia] = useState(dias[0].value)
  const [janela, setJanela] = useState(JANELAS[0])
  const confirmar = async () => {
    const e = await executar(() => EntregasApi.reagendar(entrega.id, { data: dia, janela }))
    if (!e) return
    atualizarEntrega(e)
    toast(`Entrega reagendada: ${e.janela}.`)
    onFechar()
  }
  return (
    <div className="stack-sm" style={{ gap: 16 }}>
      <Field label="Dia" as="select" value={dia} onChange={(e) => setDia(e.target.value)} options={dias} />
      <Field label="Janela" as="select" value={janela} onChange={(e) => setJanela(e.target.value)} options={JANELAS} />
      <p className="small muted">O entregador e a central são avisados na hora.</p>
      <Button block onClick={confirmar}>
        Confirmar
      </Button>
    </div>
  )
}

export function Instrucoes({ entrega, onFechar }) {
  const { atualizarEntrega, executar, toast } = useApp()
  const [texto, setTexto] = useState(entrega.instrucoes ?? '')
  const salvar = async (ev) => {
    ev.preventDefault()
    const e = await executar(() => EntregasApi.instrucoes(entrega.id, texto))
    if (!e) return
    atualizarEntrega(e)
    toast(texto.trim() ? 'Recado enviado ao entregador.' : 'Instruções removidas.')
    onFechar()
  }
  return (
    <form className="stack-sm" style={{ gap: 16 }} onSubmit={salvar}>
      <Field label="Instruções para o entregador" as="textarea" rows={3} maxLength={300} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: deixar na portaria; falar com o vizinho do 1002" />
      <Button type="submit" block>
        Salvar
      </Button>
    </form>
  )
}

export function ReportarProblema({ entrega, onFechar }) {
  const { executar, toast } = useApp()
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [detalhes, setDetalhes] = useState('')
  const enviar = async (ev) => {
    ev.preventDefault()
    const r = await executar(() => EntregasApi.ocorrencia(entrega.id, { motivo, detalhes }))
    if (!r) return
    toast(`Chamado #${r.id} aberto com a transportadora. Prazo de resposta: ${r.prazoRespostaMin / 60} h.`)
    onFechar()
  }
  return (
    <form className="stack-sm" style={{ gap: 16 }} onSubmit={enviar}>
      <Field label="Motivo" as="select" value={motivo} onChange={(e) => setMotivo(e.target.value)} options={MOTIVOS} />
      <Field label="Detalhes" as="textarea" value={detalhes} onChange={(e) => setDetalhes(e.target.value)} placeholder="Conte o que aconteceu" />
      <Button type="submit" block>
        Enviar
      </Button>
    </form>
  )
}

/** Etiqueta de envio com QR Code (lido na coleta pela tela Escanear da transportadora). */
export function Etiqueta({ entrega }) {
  return (
    <div className="stack-sm" style={{ gap: 16 }}>
      <div className="etiquetas" style={{ gridTemplateColumns: '1fr' }}>
        <div className="etiqueta" style={{ alignItems: 'flex-start', padding: 16 }}>
          <QrCode value={entrega.id} size={130} />
          <div className="stack-sm" style={{ gap: 4 }}>
            <strong style={{ fontSize: 18 }}>{entrega.id}</strong>
            <span>
              <b>De:</b> {entrega.remetente} — {entrega.origem}
            </span>
            <span>
              <b>Para:</b> {entrega.destinatario || entrega.cliente} — {entrega.destino}
            </span>
            <span>
              {entrega.tipoCarga} · {num(entrega.pesoTaxado)} kg · {entrega.modalidade === 'expressa' ? 'Expressa' : 'Normal'}
            </span>
            <span>
              {entrega.transportadora} · emitida {data(entrega.criadoEm)}
            </span>
          </div>
        </div>
      </div>
      <Button icon="download" onClick={() => window.print()}>
        Imprimir etiqueta
      </Button>
    </div>
  )
}
