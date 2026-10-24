import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp, useEventos } from '../../context/AppContext'
import { EntregasApi } from '../../services/api'
import Button from '../ui/Button'
import { dataHora } from '../../utils/tempo'

const PAPEL = { cliente: 'Cliente', entregador: 'Entregador', admin: 'Central' }

/** Conversa da entrega entre cliente, entregador e central (atualiza em tempo real). */
export default function Conversa({ entregaId, desabilitada = false }) {
  const { executar } = useApp()
  const [msgs, setMsgs] = useState(null)
  const [texto, setTexto] = useState('')
  const fimRef = useRef(null)
  const carregar = useCallback(() => EntregasApi.mensagens(entregaId).then(setMsgs).catch(() => setMsgs([])), [entregaId])
  useEffect(() => {
    carregar()
  }, [carregar])
  useEventos([`mensagens:${entregaId}`], carregar)
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'nearest' })
  }, [msgs])

  const enviar = async (e) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return
    setTexto('')
    if ((await executar(() => EntregasApi.enviarMensagem(entregaId, t))) === null) setTexto(t)
    carregar()
  }

  return (
    <div className="stack-sm">
      <div className="conversa">
        {msgs === null && <p className="small muted">Carregando…</p>}
        {msgs?.length === 0 && <p className="small muted">Nenhuma mensagem ainda.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={`balao ${m.minha ? 'minha' : ''}`}>
            {!m.minha && <strong className="small">{m.autor} · {PAPEL[m.papel] ?? m.papel}</strong>}
            <span>{m.texto}</span>
            <span className="cell-sub">{dataHora(m.criadoEm)}</span>
          </div>
        ))}
        <div ref={fimRef} />
      </div>
      {!desabilitada && (
        <form className="row" onSubmit={enviar}>
          <input className="input grow" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva uma mensagem…" maxLength={1000} aria-label="Mensagem" />
          <Button type="submit" icon="send" aria-label="Enviar" />
        </form>
      )}
    </div>
  )
}
