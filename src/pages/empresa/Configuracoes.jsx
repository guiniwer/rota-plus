import { useState } from 'react'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import ProgressBar from '../../components/ui/ProgressBar'
import Segmented from '../../components/ui/Segmented'
import Toggle from '../../components/ui/Toggle'
import { useApp } from '../../context/AppContext'

const ABAS = ['Perfil da empresa', 'Integrações', 'Privacidade (LGPD)', 'Dispositivos e plano']

const INTEGRACOES = [
  { id: 'erp', icon: 'building', nome: 'ERP (SAP / TOTVS)', desc: 'Pedidos e notas fiscais importados automaticamente', on: true },
  { id: 'wms', icon: 'box', nome: 'WMS / Estoque', desc: 'Sincroniza saídas e retornos de ativos', on: true },
  { id: 'csv', icon: 'upload', nome: 'Planilhas CSV / Excel', desc: 'Importação em lote de entregas e ativos', on: false },
  { id: 'api', icon: 'link', nome: 'API REST e Webhooks', desc: 'Eventos de status, alertas e comprovantes em tempo real', on: true },
  { id: 'whats', icon: 'send', nome: 'WhatsApp Business', desc: 'Avisos de saída, atraso e entrega ao cliente', on: true },
  { id: 'cmms', icon: 'wrench', nome: 'Manutenção (CMMS)', desc: 'Abre ordens de serviço a partir de alertas', on: false },
]

export default function Configuracoes() {
  const { usuario, privacidade, setPrivacidade, resetarDemo, toast } = useApp()
  const [aba, setAba] = useState(ABAS[0])
  const [perfil, setPerfil] = useState({ razao: usuario.empresa ?? '', cnpj: usuario.cnpj ?? '', segmento: 'Logística e distribuição', email: usuario.email ?? '', telefone: '(81) 3333-4455', endereco: 'Rod. PE-60, km 10 — Complexo de Suape, Ipojuca/PE' })
  const [integracoes, setIntegracoes] = useState(INTEGRACOES)
  const set = (k) => (e) => setPerfil((p) => ({ ...p, [k]: e.target.value }))

  return (
    <Page title="Configurações" subtitle="Empresa, integrações, privacidade e dispositivos">
      <Segmented options={ABAS} value={aba} onChange={setAba} />

      {aba === 'Perfil da empresa' && (
        <Card title="Perfil da empresa">
          <form
            className="stack-sm"
            style={{ gap: 16 }}
            onSubmit={(e) => {
              e.preventDefault()
              toast('Dados da empresa salvos.')
            }}
          >
            <div className="grid-form">
              <Field label="Razão social" value={perfil.razao} onChange={set('razao')} />
              <Field label="CNPJ" value={perfil.cnpj} onChange={set('cnpj')} />
              <Field label="Segmento" value={perfil.segmento} onChange={set('segmento')} />
              <Field label="E-mail corporativo" type="email" value={perfil.email} onChange={set('email')} />
              <Field label="Telefone" value={perfil.telefone} onChange={set('telefone')} />
              <Field label="Endereço da sede" value={perfil.endereco} onChange={set('endereco')} />
            </div>
            <Button type="submit" style={{ alignSelf: 'flex-start' }}>
              Salvar alterações
            </Button>
          </form>
        </Card>
      )}

      {aba === 'Integrações' && (
        <div className="grid-2">
          {integracoes.map((i) => (
            <Card key={i.id} compact>
              <div className="row">
                <span className="icon-chip" style={{ background: 'rgba(142,100,216,.16)' }}>
                  <Icon name={i.icon} color="var(--purple)" />
                </span>
                <strong className="grow">{i.nome}</strong>
                <Badge tone={i.on ? 'success' : 'neutral'}>{i.on ? 'Conectado' : 'Desconectado'}</Badge>
              </div>
              <p className="small muted">{i.desc}</p>
              <Button
                variant={i.on ? 'secondary' : 'violet'}
                size="sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  setIntegracoes((list) => list.map((x) => (x.id === i.id ? { ...x, on: !x.on } : x)))
                  toast(`${i.nome} ${i.on ? 'desconectado' : 'conectado'}.`)
                }}
              >
                {i.on ? 'Desconectar' : 'Conectar'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {aba === 'Privacidade (LGPD)' && (
        <Card title="Privacidade e LGPD" action={<Icon name="shield" color="var(--green)" />}>
          <Toggle title="Rastrear pessoas só no expediente" description="Turnos definidos por equipe" checked={privacidade.soExpediente} onChange={(v) => setPrivacidade((p) => ({ ...p, soExpediente: v }))} />
          <Toggle title="Termo de ciência do colaborador" description="Assinado no 1º acesso ao app" checked={privacidade.termoCiencia} onChange={(v) => setPrivacidade((p) => ({ ...p, termoCiencia: v }))} />
          <Toggle title="Anonimizar localização após 90 dias" checked={privacidade.anonimizar90} onChange={(v) => setPrivacidade((p) => ({ ...p, anonimizar90: v }))} />
          <Toggle title="Compartilhar ETA com clientes finais" description="Sem expor a posição do colaborador fora da rota" checked={privacidade.compartilharEta} onChange={(v) => setPrivacidade((p) => ({ ...p, compartilharEta: v }))} />
          <span className="small grey">Encarregado de dados (DPO): dpo@empresa.com.br</span>
        </Card>
      )}

      {aba === 'Dispositivos e plano' && (
        <div className="grid-2">
          <Card title="Dispositivos">
            <KeyValue label="Rastreadores GPS" value="92 · 3 com bateria baixa" />
            <KeyValue label="Leitores RFID (portais)" value="6" />
            <KeyValue label="Etiquetas QR impressas" value="812" />
            <KeyValue label="Aparelhos com app de campo" value="42" />
          </Card>
          <Card title="Plano Pro" action={<Badge tone="success">Ativo</Badge>}>
            <KeyValue label="Ativos rastreados" value="1.248 / 1.500" />
            <ProgressBar value={83} />
            <p className="small muted">Planos para todos os portes: Essencial (até 100 ativos, só QR), Pro e Enterprise (RFID, API e SSO).</p>
          </Card>
          <Card title="Dados de demonstração">
            <p className="small muted">Volta todas as entregas, ativos e alertas para o estado inicial.</p>
            <Button variant="outline" onClick={resetarDemo} style={{ alignSelf: 'flex-start' }}>
              Restaurar dados
            </Button>
          </Card>
        </div>
      )}
    </Page>
  )
}
