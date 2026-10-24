import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import LeitorCamera from '../../components/leitor/LeitorCamera'
import LeitorRfid from '../../components/leitor/LeitorRfid'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import KeyValue from '../../components/ui/KeyValue'
import Segmented from '../../components/ui/Segmented'
import { AtivoBadge, EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'
import { relativo } from '../../utils/tempo'

const MODOS = ['Câmera (QR Code)', 'Leitor RFID / NFC', 'Digitar código']
// o QR da etiqueta pode conter só o código ou uma URL que termina nele
const CODIGO = /(RT-\d{4,6}(?:-BR)?|[A-Z]{3}-[\d-]{3,})/i

/** Posição atual do aparelho para registrar onde a leitura aconteceu (null se negado ou indisponível). */
const posicaoAtual = () =>
  new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    )
  })

export default function Escanear() {
  const { ativos, entregas, equipe, registrarMovimentacao, toast } = useApp()
  const navigate = useNavigate()
  const [modo, setModo] = useState(MODOS[0])
  const [codigo, setCodigo] = useState('')
  const [lido, setLido] = useState(null) // { tipo, id, via }
  const [para, setPara] = useState('') // responsável do check-out
  const [local, setLocal] = useState('')
  const [salvando, setSalvando] = useState(false)

  const identificar = (texto, via) => {
    const v = (texto.match(CODIGO)?.[1] ?? texto).trim().toUpperCase()
    const ativo = ativos.find((a) => a.id === v)
    const entrega = entregas.find((e) => e.id === v)
    if (ativo) setLido({ tipo: ativo.tipo === 'Carga' && ativo.entregaId ? 'entrega' : 'ativo', id: ativo.tipo === 'Carga' && ativo.entregaId ? ativo.entregaId : ativo.id, via })
    else if (entrega) setLido({ tipo: 'entrega', id: entrega.id, via })
    else {
      setLido(null)
      toast(`Código ${v} não pertence a esta empresa.`)
      return
    }
    setCodigo(v)
  }

  const movimentar = async (tipo) => {
    setSalvando(true)
    const pos = await posicaoAtual()
    const r = await registrarMovimentacao(lido.id, { tipo, responsavelId: tipo === 'checkout' && para ? Number(para) : undefined, local: tipo === 'checkin' ? local : undefined, leitura: lido.via, lat: pos?.lat ?? null, lng: pos?.lng ?? null })
    setSalvando(false)
    if (!r) return
    toast(tipo === 'checkout' ? `Check-out registrado para ${r.responsavel}.` : `Check-in registrado em ${r.local}${pos ? ' (com GPS)' : ''}.`)
    setLido(null)
    setCodigo('')
    setLocal('')
    setPara('')
  }

  const ativo = lido?.tipo === 'ativo' ? ativos.find((a) => a.id === lido.id) : null
  const entrega = lido?.tipo === 'entrega' ? entregas.find((e) => e.id === lido.id) : null

  return (
    <Page title="Escanear código" subtitle="Identifique ativos e volumes pela etiqueta para registrar check-in e check-out">
      <div className="grid-aside">
        <Card>
          <Segmented options={MODOS} value={modo} onChange={setModo} />
          {modo === MODOS[0] && <LeitorCamera ativo={!lido} onLeitura={(t) => identificar(t, 'qr')} />}
          {modo === MODOS[1] && <LeitorRfid ativo={!lido} onLeitura={(t) => identificar(t, 'rfid')} />}
          {modo === MODOS[2] && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                identificar(codigo, 'manual')
              }}
            >
              <div className="grow">
                <Field label="Código do ativo ou da entrega" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ATV-00412 ou RT-90911" />
              </div>
              <Button type="submit" variant="secondary" style={{ alignSelf: 'flex-end' }}>
                Buscar
              </Button>
            </form>
          )}
        </Card>

        <Card title="Resultado da leitura" action={lido && <span className="small muted">via {lido.via === 'qr' ? 'QR Code' : lido.via === 'rfid' ? 'RFID' : 'digitação'}</span>}>
          {!lido && <p className="muted">Nenhum código lido ainda.</p>}
          {ativo && (
            <>
              <div className="row-between">
                <strong style={{ fontSize: 17 }}>{ativo.nome}</strong>
                <AtivoBadge status={ativo.status} />
              </div>
              <KeyValue label="Código" value={ativo.id} />
              <KeyValue label="Responsável atual" value={ativo.responsavel ?? '—'} />
              <KeyValue label="Local registrado" value={ativo.local} />
              <KeyValue label="Última leitura" value={relativo(ativo.ultimaLeituraEm)} />
              {ativo.status === 'em_uso' ? (
                <>
                  <Field label="Local da devolução" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Vazio = endereço pela localização do aparelho" />
                  <Button onClick={() => movimentar('checkin')} disabled={salvando}>
                    {salvando ? 'Registrando…' : 'Registrar check-in (devolução)'}
                  </Button>
                </>
              ) : (
                <>
                  <Field
                    label="Retirado por"
                    as="select"
                    value={para}
                    onChange={(e) => setPara(e.target.value)}
                    options={[{ value: '', label: 'Eu mesmo' }, ...equipe.map((p) => ({ value: String(p.id), label: p.nome }))]}
                  />
                  <Button onClick={() => movimentar('checkout')} disabled={salvando}>
                    {salvando ? 'Registrando…' : 'Registrar check-out (retirada)'}
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => navigate(`/empresa/ativos/${ativo.id}`)}>
                Abrir ficha do ativo
              </Button>
            </>
          )}
          {entrega && (
            <>
              <div className="row-between">
                <strong style={{ fontSize: 17 }}>{entrega.id}</strong>
                <EntregaBadge status={entrega.status} />
              </div>
              <KeyValue label="Cliente" value={entrega.cliente} />
              <KeyValue label="Destino" value={entrega.destino} />
              <KeyValue label="Entregador" value={entrega.responsavel ?? 'Não atribuído'} />
              <Button onClick={() => navigate(`/empresa/entregas?q=${entrega.id}`)}>Abrir entrega</Button>
            </>
          )}
          {lido && (
            <Button variant="secondary" onClick={() => setLido(null)}>
              Ler outro código
            </Button>
          )}
        </Card>
      </div>
    </Page>
  )
}
