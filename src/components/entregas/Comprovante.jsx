import { useEffect, useMemo, useState } from 'react'
import { EntregasApi } from '../../services/api'
import Mapa from '../mapa/Mapa'
import KeyValue from '../ui/KeyValue'
import { dataHora } from '../../utils/tempo'

const RESULTADO = { entregue: 'Entregue', avaria: 'Entregue com avaria', tentativa: 'Tentativa sem sucesso', recusado: 'Recusado' }

/** Comprovante de entrega registrado pelo entregador: foto, assinatura, recebedor e local (GPS). */
export default function Comprovante({ entregaId }) {
  const [c, setC] = useState(null)
  const [erro, setErro] = useState(null)
  useEffect(() => {
    EntregasApi.verComprovante(entregaId).then(setC).catch((e) => setErro(e.message))
  }, [entregaId])
  const marcadores = useMemo(() => (c?.lat != null ? [{ id: 'c', lat: c.lat, lng: c.lng, precisao: c.precisao, popup: ['Local do comprovante'] }] : []), [c])

  if (erro) return <p className="muted">{erro}</p>
  if (!c) return <p className="muted">Carregando comprovante…</p>
  return (
    <div className="stack-sm" style={{ gap: 14 }}>
      <KeyValue label="Resultado" value={RESULTADO[c.resultado] ?? c.resultado} />
      <KeyValue label="Recebido por" value={c.recebedor ?? '—'} />
      {c.documento && <KeyValue label="Documento" value={c.documento} />}
      <KeyValue label="Registrado" value={`${dataHora(c.criadoEm)}${c.entregador ? ` por ${c.entregador}` : ''}`} />
      <KeyValue label="Volumes conferidos" value={c.volumesConferidos ? 'Sim' : 'Não'} />
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="stack-sm">
          <span className="label">Foto</span>
          {c.foto ? <img src={c.foto} alt="Foto do comprovante" className="comprovante-img" /> : <span className="small muted">Sem foto</span>}
        </div>
        <div className="stack-sm">
          <span className="label">Assinatura</span>
          {c.assinatura ? <img src={c.assinatura} alt="Assinatura do recebedor" className="comprovante-img assinatura" /> : <span className="small muted">Sem assinatura</span>}
        </div>
      </div>
      <span className="label">Local do registro {c.precisao ? `(±${c.precisao} m)` : ''}</span>
      {c.lat != null ? <Mapa marcadores={marcadores} height={200} rotulo="Local do comprovante" /> : <span className="small muted">O aparelho não informou a localização.</span>}
    </div>
  )
}
