import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import KeyValue from '../../components/ui/KeyValue'
import Segmented from '../../components/ui/Segmented'
import { AtivoBadge, EntregaBadge } from '../../components/entregas/StatusBadge'
import { useApp } from '../../context/AppContext'

/**
 * Simula a leitura de QR Code / RFID / código de barras.
 * Em produção usaria a câmera (BarcodeDetector) ou um leitor RFID via Bluetooth.
 */
export default function Escanear() {
  const { ativos, entregas, usuario, registrarMovimentacao, toast } = useApp()
  const navigate = useNavigate()
  const [modo, setModo] = useState('QR Code')
  const [codigo, setCodigo] = useState('')
  const [lendo, setLendo] = useState(false)
  const [lido, setLido] = useState(null)

  const identificar = (valor) => {
    const v = valor.trim().toUpperCase()
    const ativo = ativos.find((a) => a.id === v)
    const entrega = entregas.find((e) => e.id === v)
    if (ativo) setLido({ tipo: 'ativo', item: ativo })
    else if (entrega) setLido({ tipo: 'entrega', item: entrega })
    else {
      setLido(null)
      toast(`Código ${v} não encontrado.`)
    }
  }

  const simularLeitura = () => {
    setLendo(true)
    setLido(null)
    setTimeout(() => {
      const pool = [...ativos.map((a) => a.id), ...entregas.filter((e) => e.status !== 'entregue').map((e) => e.id)]
      const sorteado = pool[Math.floor(Math.random() * pool.length)]
      setLendo(false)
      setCodigo(sorteado)
      identificar(sorteado)
    }, 1200)
  }

  const movimentar = (tipo) => {
    registrarMovimentacao(lido.item.id, { tipo, responsavel: usuario.nome, local: 'Leitura via app' })
    toast(tipo === 'checkout' ? 'Check-out registrado para você.' : 'Check-in registrado no local atual.')
    setLido(null)
    setCodigo('')
  }

  // ativo atualizado após a movimentação
  const atual = lido?.tipo === 'ativo' ? ativos.find((a) => a.id === lido.item.id) : lido?.item

  return (
    <Page title="Escanear código" subtitle="Identifique ativos e volumes para registrar movimentações">
      <div className="grid-aside">
        <Card>
          <Segmented options={['QR Code', 'RFID / NFC', 'Código de barras']} value={modo} onChange={setModo} />
          <div className="scanner">
            <div className="scanner-frame">{lendo && <div className="scanner-line" />}</div>
          </div>
          <p className="muted" style={{ textAlign: 'center' }}>
            {lendo ? 'Lendo…' : `Aponte para a etiqueta (${modo}) do ativo ou do volume`}
          </p>
          <Button onClick={simularLeitura} disabled={lendo} icon="camera">
            {lendo ? 'Lendo…' : 'Simular leitura'}
          </Button>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              identificar(codigo)
            }}
          >
            <div className="grow">
              <Field label="Ou digite o código" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ATV-00412 ou RT-90911" />
            </div>
            <Button type="submit" variant="secondary" style={{ alignSelf: 'flex-end' }}>
              Buscar
            </Button>
          </form>
        </Card>

        <Card title="Resultado da leitura">
          {!atual && <p className="muted">Nenhum código lido ainda.</p>}
          {lido?.tipo === 'ativo' && atual && (
            <>
              <div className="row-between">
                <strong style={{ fontSize: 17 }}>{atual.nome}</strong>
                <AtivoBadge status={atual.status} />
              </div>
              <KeyValue label="Código" value={atual.id} />
              <KeyValue label="Responsável atual" value={atual.responsavel ?? '—'} />
              <KeyValue label="Local registrado" value={atual.local} />
              <div className="grid-2" style={{ gap: 12 }}>
                <Button variant="secondary" onClick={() => movimentar('checkin')}>
                  Check-in aqui
                </Button>
                <Button onClick={() => movimentar('checkout')}>Check-out p/ mim</Button>
              </div>
              <Button variant="outline" onClick={() => navigate(`/empresa/ativos/${atual.id}`)}>
                Abrir ficha do ativo
              </Button>
            </>
          )}
          {lido?.tipo === 'entrega' && atual && (
            <>
              <div className="row-between">
                <strong style={{ fontSize: 17 }}>{atual.id}</strong>
                <EntregaBadge status={atual.status} />
              </div>
              <KeyValue label="Cliente" value={atual.cliente} />
              <KeyValue label="Destino" value={atual.destino} />
              <KeyValue label="Entregador" value={atual.responsavel ?? 'Não atribuído'} />
              <Button onClick={() => navigate(`/empresa/entregas?q=${atual.id}`)}>Abrir entrega</Button>
            </>
          )}
        </Card>
      </div>
    </Page>
  )
}
