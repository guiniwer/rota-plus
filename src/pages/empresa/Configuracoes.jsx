import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import Segmented from '../../components/ui/Segmented'
import Toggle from '../../components/ui/Toggle'
import { useApp } from '../../context/AppContext'
import { EmpresaApi } from '../../services/api'
import { maskDocumento } from '../../utils/format'
import { dataHora } from '../../utils/tempo'

const ABAS = ['Empresa', 'Privacidade (LGPD)', 'Integrações']
const FUSOS = ['America/Recife', 'America/Sao_Paulo', 'America/Fortaleza', 'America/Bahia', 'America/Belem', 'America/Manaus', 'America/Cuiaba', 'America/Porto_Velho', 'America/Rio_Branco', 'America/Noronha']
const STATUS_MSG = {
  enviado: { label: 'Enviado', tone: 'success' },
  link: { label: 'Link gerado', tone: 'info' },
  nao_configurado: { label: 'Não enviado (SMTP não configurado)', tone: 'warning' },
  falhou: { label: 'Falhou', tone: 'danger' },
}
const API_URL = `${window.location.origin}/api`

function Copiavel({ valor }) {
  const { toast } = useApp()
  return (
    <div className="row" style={{ gap: 8 }}>
      <code className="codigo grow">{valor}</code>
      <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(valor).then(() => toast('Copiado.'))}>
        Copiar
      </Button>
    </div>
  )
}

function DadosEmpresa() {
  const { empresa, recarregarEmpresa, executar, toast } = useApp()
  const [f, setF] = useState(() => ({ ...empresa }))
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const salvar = async (e) => {
    e.preventDefault()
    const r = await executar(() =>
      EmpresaApi.salvar({ razaoSocial: f.razaoSocial, fantasia: f.fantasia, segmento: f.segmento, email: f.email, telefone: f.telefone, endereco: f.endereco, turnoInicio: f.turnoInicio, turnoFim: f.turnoFim, fuso: f.fuso }),
    )
    if (!r) return
    await recarregarEmpresa()
    toast(r.baseLocalizada ? 'Dados da empresa salvos.' : 'Salvo, mas o endereço não foi encontrado no mapa — a base continua na posição anterior.')
  }
  return (
    <div className="grid-2">
      <Card title="Dados cadastrais">
        <form className="stack-sm" style={{ gap: 16 }} onSubmit={salvar}>
          <div className="grid-form">
            <Field label="Razão social" value={f.razaoSocial ?? ''} onChange={set('razaoSocial')} />
            <Field label="CNPJ" value={maskDocumento(f.cnpj ?? '')} disabled hint="O CNPJ identifica a empresa e não pode ser alterado." />
            <Field label="Nome fantasia" value={f.fantasia ?? ''} onChange={set('fantasia')} />
            <Field label="Segmento" value={f.segmento ?? ''} onChange={set('segmento')} />
            <Field label="E-mail corporativo" type="email" value={f.email ?? ''} onChange={set('email')} />
            <Field label="Telefone" value={f.telefone ?? ''} onChange={set('telefone')} />
          </div>
          <Field label="Endereço da base / CD (ponto de saída das rotas)" value={f.endereco ?? ''} onChange={set('endereco')} />
          <div className="grid-form">
            <Field label="Expediente — início" type="time" value={f.turnoInicio ?? ''} onChange={set('turnoInicio')} />
            <Field label="Expediente — fim" type="time" value={f.turnoFim ?? ''} onChange={set('turnoFim')} />
            <Field label="Fuso horário" as="select" value={f.fuso} onChange={set('fuso')} options={FUSOS} />
          </div>
          <Button type="submit" style={{ alignSelf: 'flex-start' }}>
            Salvar alterações
          </Button>
        </form>
      </Card>
      <Card title="Como o expediente é usado">
        <p className="small muted">O horário de expediente define quando o GPS dos entregadores é aceito (LGPD), quando um check-out de ativo gera alerta de uso indevido e a capacidade usada no cálculo de utilização dos ativos.</p>
        <KeyValue label="Base no mapa" value={empresa.lat != null ? `${empresa.lat.toFixed(4)}, ${empresa.lng.toFixed(4)}` : 'não localizada'} />
        <KeyValue label="E-mail transacional" value={empresa.emailConfigurado ? 'SMTP configurado' : 'SMTP não configurado no servidor'} />
      </Card>
    </div>
  )
}

function Integracoes() {
  const { empresa, recarregarEmpresa, executar, toast } = useApp()
  const [chave, setChave] = useState(null)
  const [url, setUrl] = useState(empresa.webhookUrl ?? '')
  const [segredo, setSegredo] = useState(null)
  const [teste, setTeste] = useState(null)

  const gerar = async () => {
    if (empresa.temApiKey && !window.confirm('Gerar uma nova chave invalida a atual. Continuar?')) return
    const r = await executar(() => EmpresaApi.gerarApiKey())
    if (!r) return
    setChave(r.apiKey)
    recarregarEmpresa()
  }
  const revogar = async () => {
    if (!window.confirm('Revogar a chave? Integrações que a usam deixam de funcionar.')) return
    if (!(await executar(() => EmpresaApi.revogarApiKey().then(() => true)))) return
    setChave(null)
    recarregarEmpresa()
    toast('Chave revogada.')
  }
  const salvarWebhook = async (e) => {
    e.preventDefault()
    const r = await executar(() => EmpresaApi.webhook(url))
    if (!r) return
    setSegredo(r.segredo)
    recarregarEmpresa()
    toast(r.webhookUrl ? 'Webhook salvo.' : 'Webhook removido.')
  }
  const testar = async () => setTeste(await executar(() => EmpresaApi.testarWebhook()))

  return (
    <div className="grid-2">
      <Card title="API REST" action={<Badge tone={empresa.temApiKey ? 'success' : 'neutral'}>{empresa.temApiKey ? 'Chave ativa' : 'Sem chave'}</Badge>}>
        <p className="small muted">Para o seu ERP, WMS ou e-commerce criar e consultar entregas. Envie a chave no cabeçalho <code>X-Api-Key</code>.</p>
        {chave && (
          <>
            <span className="label">Sua chave (mostrada só agora — guarde em local seguro)</span>
            <Copiavel valor={chave} />
          </>
        )}
        <div className="row">
          <Button size="sm" onClick={gerar}>
            {empresa.temApiKey ? 'Gerar nova chave' : 'Gerar chave'}
          </Button>
          {empresa.temApiKey && (
            <Button size="sm" variant="outline" onClick={revogar}>
              Revogar
            </Button>
          )}
        </div>
        <span className="label">Exemplo</span>
        <pre className="codigo">{`curl ${API_URL}/v1/entregas \\
  -H "X-Api-Key: ${chave ?? 'rp_...'}" \\
  -H "Content-Type: application/json" \\
  -d '{"cliente":"Loja Centro","destino":"Rua da Aurora, 100, Recife/PE","janela":"14:00–16:00"}'`}</pre>
        <p className="small muted">Endpoints: GET/POST /v1/entregas · GET /v1/entregas/:id · PATCH /v1/entregas/:id/status · GET /v1/ativos</p>
      </Card>
      <Card title="Webhook" action={<Badge tone={empresa.webhookUrl ? 'success' : 'neutral'}>{empresa.webhookUrl ? 'Ativo' : 'Desligado'}</Badge>}>
        <p className="small muted">
          Recebe um POST a cada evento (<code>entrega.criada</code> e <code>entrega.status</code>). O corpo é assinado com HMAC-SHA256 no cabeçalho <code>X-RotaPlus-Assinatura</code>.
        </p>
        <form className="stack-sm" onSubmit={salvarWebhook}>
          <Field label="URL de destino" type="url" placeholder="https://seu-sistema.com.br/webhooks/rota" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="row">
            <Button size="sm" type="submit">
              Salvar
            </Button>
            {empresa.webhookUrl && (
              <Button size="sm" variant="secondary" onClick={testar}>
                Enviar teste
              </Button>
            )}
          </div>
        </form>
        {segredo && (
          <>
            <span className="label">Segredo para validar a assinatura</span>
            <Copiavel valor={segredo} />
          </>
        )}
        {teste && <p className={`small ${teste.ok ? 'green' : 'red'}`}>{teste.ok ? `Recebido pelo seu servidor (HTTP ${teste.status}).` : `Falhou: ${teste.erro ?? `HTTP ${teste.status}`}`}</p>}
      </Card>
      <Card title="Rastreadores GPS (dispositivos)">
        <p className="small muted">
          Um rastreador ou celular dedicado envia a posição de um ativo para <code>POST {API_URL}/dispositivos/posicao</code> com o cabeçalho <code>X-Dispositivo-Token</code>. Gere o token na página do ativo.
        </p>
      </Card>
      <EmailTeste />
    </div>
  )
}

function EmailTeste() {
  const { empresa, usuario, executar } = useApp()
  const [para, setPara] = useState(usuario.email ?? '')
  const [resultado, setResultado] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const enviar = async (ev) => {
    ev.preventDefault()
    setEnviando(true)
    setResultado(await executar(() => EmpresaApi.testarEmail(para)))
    setEnviando(false)
  }
  return (
    <Card title="E-mail e WhatsApp" action={<Badge tone={empresa.emailConfigurado ? 'success' : 'warning'}>{empresa.emailConfigurado ? 'SMTP configurado' : 'SMTP não configurado'}</Badge>}>
      <p className="small muted">
        {empresa.emailConfigurado
          ? 'Avisos ao cliente e convites de entregador são enviados por e-mail.'
          : 'Configure SMTP_HOST, SMTP_USER, SMTP_PASS e SMTP_FROM no servidor para enviar e-mails. Até lá, as mensagens ficam registradas na caixa de saída.'}{' '}
        Avisos por WhatsApp abrem o WhatsApp do operador com a mensagem pronta (wa.me).
      </p>
      <form className="row wrap" onSubmit={enviar}>
        <div className="grow">
          <Field label="Enviar e-mail de teste para" type="email" value={para} onChange={(e) => setPara(e.target.value)} required />
        </div>
        <Button type="submit" variant="secondary" icon="mail" disabled={enviando} style={{ alignSelf: 'flex-end' }}>
          {enviando ? 'Enviando…' : 'Enviar teste'}
        </Button>
      </form>
      {resultado && (
        <p className={`small ${resultado.status === 'enviado' ? 'green' : resultado.status === 'falhou' ? 'red' : 'amber'}`}>
          {resultado.status === 'enviado' ? `Enviado para ${para}. Confira a caixa de entrada (e o spam).` : resultado.status === 'falhou' ? `Falhou: ${resultado.erro}` : 'Registrado na caixa de saída, mas não enviado: o SMTP não está configurado no servidor.'}
        </p>
      )}
    </Card>
  )
}

function CaixaSaida() {
  const [lista, setLista] = useState(null)
  useEffect(() => {
    EmpresaApi.mensagens().then(setLista).catch(() => setLista([]))
  }, [])
  return (
    <Card title="Caixa de saída" action={<span className="small muted">últimas 100 mensagens</span>}>
      {!lista ? (
        <p className="muted">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="muted">Nenhuma mensagem enviada ainda.</p>
      ) : (
        <DataTable
          rows={lista}
          columns={[
            { key: 'criadoEm', label: 'Quando', render: (m) => dataHora(m.criadoEm) },
            { key: 'canal', label: 'Canal', render: (m) => <Badge tone="neutral">{m.canal}</Badge> },
            { key: 'destino', label: 'Para', render: (m) => <span style={{ wordBreak: 'break-all' }}>{m.destino}</span> },
            { key: 'assunto', label: 'Assunto', render: (m) => (<span>{m.assunto}{m.entregaId && <span className="cell-sub">{m.entregaId}</span>}</span>) },
            { key: 'status', label: 'Situação', render: (m) => (<span><Badge tone={STATUS_MSG[m.status]?.tone ?? 'neutral'}>{STATUS_MSG[m.status]?.label ?? m.status}</Badge>{m.erro && <span className="cell-sub red">{m.erro}</span>}</span>) },
          ]}
        />
      )}
    </Card>
  )
}

export default function Configuracoes() {
  const { empresa, privacidade, setPrivacidade, resetarDemo } = useApp()
  const [params] = useSearchParams()
  const [aba, setAba] = useState(ABAS[0])
  // endereço antigo: a importação agora fica em Entregas
  if (params.get('aba') === 'importar') return <Navigate to="/empresa/entregas?importar=1" replace />
  if (!empresa) return <Page title="Configurações" subtitle="Carregando…" />
  const d = empresa.dispositivos

  return (
    <Page title="Configurações" subtitle={`${empresa.razaoSocial} · CNPJ ${maskDocumento(empresa.cnpj)}`}>
      <Segmented options={ABAS} value={aba} onChange={setAba} />

      {aba === 'Empresa' && <DadosEmpresa key={empresa.id} />}
      {aba === 'Integrações' && (
        <>
          <Integracoes />
          <CaixaSaida />
        </>
      )}

      {aba === 'Privacidade (LGPD)' && (
        <Card title="Privacidade e LGPD" action={<Icon name="shield" color="var(--green)" />}>
          <Toggle title="Rastrear pessoas só no expediente" description={`O servidor recusa posições do app fora de ${empresa.turnoInicio}–${empresa.turnoFim}`} checked={privacidade.soExpediente} onChange={(v) => setPrivacidade((p) => ({ ...p, soExpediente: v }))} />
          <Toggle title="Termo de ciência do colaborador" description="Exibido no app do entregador antes de ativar o GPS" checked={privacidade.termoCiencia} onChange={(v) => setPrivacidade((p) => ({ ...p, termoCiencia: v }))} />
          <Toggle title="Apagar localização de pessoas após 90 dias" description="Rotina diária remove o histórico de GPS dos entregadores" checked={privacidade.anonimizar90} onChange={(v) => setPrivacidade((p) => ({ ...p, anonimizar90: v }))} />
          <Toggle title="Compartilhar ETA e mapa com clientes finais" description="Só durante a entrega; o cliente nunca vê a posição fora da rota" checked={privacidade.compartilharEta} onChange={(v) => setPrivacidade((p) => ({ ...p, compartilharEta: v }))} />
        </Card>
      )}

      {aba === 'Empresa' && (
        <div className="grid-2">
          <Card title="Dispositivos">
            <KeyValue label="Rastreadores GPS" value={`${d.rastreadores} · ${d.rastreadoresAtivos} com sinal nos últimos 30 min`} />
            <KeyValue label="Etiquetas QR" value={d.etiquetasQr} />
            <KeyValue label="Etiquetas RFID" value={d.etiquetasRfid} />
            <KeyValue label="Apps de campo com GPS ativo" value={`${d.appsAtivos} de ${d.entregadores} entregador(es)`} />
          </Card>
          {empresa.demo && (
            <Card title="Dados de demonstração">
              <p className="small muted">Esta é a empresa de demonstração. Restaurar apaga tudo o que foi feito nela e gera de novo o histórico de 30 dias.</p>
              <Button variant="outline" onClick={() => window.confirm('Restaurar os dados de demonstração?') && resetarDemo()} style={{ alignSelf: 'flex-start' }}>
                Restaurar dados
              </Button>
            </Card>
          )}
        </div>
      )}
    </Page>
  )
}
