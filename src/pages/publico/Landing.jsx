import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import MapView, { MapChip } from '../../components/ui/MapView'
import Segmented from '../../components/ui/Segmented'
import { brl, num } from '../../utils/format'
import RotaCidades from '../../components/entregas/RotaCidades'
import { useApp } from '../../context/AppContext'
import { nomeCidade } from '../../data/cidades'
import { TAXA_EXPRESSA, TAXA_GPS, calcularFrete } from '../../utils/frete'

const DIFERENCIAIS = [
  { icon: 'send', titulo: 'Entrega expressa', texto: 'Coleta imediata e entrega no menor tempo possível dentro da cidade.' },
  { icon: 'shield', titulo: 'Total segurança', texto: 'Encomendas seguradas (ad valorem) e cuidadas por profissionais treinados.' },
  { icon: 'pin', titulo: 'Rastreamento real', texto: 'Acompanhe o entregador no mapa até o destino final, com previsão ao vivo.' },
]

const PARA_EMPRESAS = [
  { icon: 'box', titulo: 'Ativos sob controle', texto: 'Equipamentos, ferramentas, veículos e mercadorias com QR Code, RFID ou GPS.' },
  { icon: 'alert', titulo: 'Alertas inteligentes', texto: 'Atraso, desvio de rota, inatividade, perda de sinal e uso indevido — com fluxo de resposta.' },
  { icon: 'grid', titulo: 'Painel da operação', texto: 'Entregas pendentes, ativos disponíveis e gargalos em tempo real.' },
  { icon: 'route', titulo: 'App de campo', texto: 'Equipes atualizam status, escaneiam QR e registram comprovantes — mesmo offline.' },
  { icon: 'chart', titulo: 'Relatórios', texto: 'Cumprimento de prazos, utilização de ativos, perdas e satisfação dos clientes.' },
  { icon: 'lock', titulo: 'LGPD por padrão', texto: 'Rastreamento de pessoas só no expediente, com transparência para o colaborador.' },
]

/** Página inicial pública: apresentação, serviços e cotação rápida. */
export default function Landing() {
  const navigate = useNavigate()
  const { usuario } = useApp()
  const [cotacao, setCotacao] = useState({
    origem: 'recife-pe',
    destino: 'saopaulo-sp',
    tipoCarga: 'documento',
    modalidade: 'normal',
    rastreio: 'cd',
    peso: '1',
    comprimento: '30',
    largura: '20',
    altura: '15',
  })

  const set = (campo) => (e) => setCotacao((c) => ({ ...c, [campo]: e?.target ? e.target.value : e }))
  // recalcula a cada alteração — sem precisar clicar em "calcular"
  const resultado = useMemo(() => calcularFrete({ ...cotacao, valorNF: 0 }), [cotacao])

  const solicitar = () => navigate(usuario?.perfil === 'cliente' ? '/cliente/novo-pedido' : '/login', { state: { perfil: 'cliente' } })

  return (
    <>
      <section className="hero">
        <div>
          <h1>Sua encomenda no caminho certo, com a velocidade que você precisa.</h1>
          <p>
            Rastreabilidade ponta a ponta para entregas e ativos: clientes acompanham o pedido em tempo real e empresas
            sabem onde está cada equipamento, quem é o responsável e o que pode atrasar a operação.
          </p>
          <div className="row wrap">
            <Button onClick={() => navigate('/rastreio')} icon="search">
              Rastrear encomenda
            </Button>
            <Button variant="outline" onClick={() => navigate('/cadastro?perfil=empresa')}>
              Sou empresa
            </Button>
          </div>
        </div>
        <MapView progress={0.55} height={320}>
          <MapChip style={{ top: 16, left: 16 }}>
            <Icon name="truck" size={16} color="var(--pink)" /> Motorista a caminho
          </MapChip>
          <MapChip style={{ bottom: 16, left: 16 }}>
            <Icon name="clock" size={16} color="var(--green)" /> Chega em ~25 min
          </MapChip>
        </MapView>
      </section>

      <section className="public-section" id="quem-somos">
        <div className="container">
          <h2 className="section-title">Quem somos</h2>
          <p className="section-sub">A Rota+ nasceu para transformar a logística, unindo tecnologia e eficiência para encurtar distâncias.</p>
          <div className="grid-2">
            <Card title="Missão">
              <p className="muted">Entregar soluções logísticas rápidas, seguras e inovadoras, conectando pessoas e negócios com confiabilidade.</p>
            </Card>
            <Card title="Visão">
              <p className="muted">Ser referência em agilidade e visibilidade operacional, reconhecida pela precisão, tecnologia e sustentabilidade.</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="public-section alt" id="servicos">
        <div className="container">
          <h2 className="section-title">Por que escolher a Rota+?</h2>
          <p className="section-sub">Para quem envia e para quem gerencia uma operação inteira.</p>
          <div className="grid-3">
            {DIFERENCIAIS.map((d) => (
              <div className="feature-card" key={d.titulo}>
                <Icon name={d.icon} color="var(--pink)" size={28} />
                <h3>{d.titulo}</h3>
                <p className="muted">{d.texto}</p>
              </div>
            ))}
          </div>
          <h2 className="section-title" style={{ marginTop: 64 }}>
            Para empresas
          </h2>
          <p className="section-sub">Logística, construção, saúde, varejo, eventos e serviços técnicos — do pequeno ao grande porte.</p>
          <div className="grid-3">
            {PARA_EMPRESAS.map((d) => (
              <div className="feature-card" key={d.titulo}>
                <Icon name={d.icon} color="var(--purple)" size={28} />
                <h3>{d.titulo}</h3>
                <p className="muted">{d.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" id="cotacao">
        <div className="container">
          <h2 className="section-title">Faça uma cotação</h2>
          <p className="section-sub">Escolha as cidades e o tipo de envio — o valor é calculado na hora.</p>
          <div className="grid-aside cotacao">
            <Card>
              <form className="stack-sm" style={{ gap: 20 }} onSubmit={(e) => e.preventDefault()}>
                <RotaCidades origem={cotacao.origem} destino={cotacao.destino} onChange={(rota) => setCotacao((c) => ({ ...c, ...rota }))} />

                <Field label="Tipo de carga">
                  <Segmented
                    block
                    label="Tipo de carga"
                    value={cotacao.tipoCarga}
                    onChange={set('tipoCarga')}
                    options={[
                      { value: 'documento', label: 'Documentos / Envelopes' },
                      { value: 'caixa', label: 'Caixas' },
                    ]}
                  />
                </Field>
                {cotacao.tipoCarga === 'caixa' && (
                  <div className="grid-form-4">
                    <Field label="Compr. (cm)" type="number" min="1" inputMode="numeric" value={cotacao.comprimento} onChange={set('comprimento')} />
                    <Field label="Largura (cm)" type="number" min="1" inputMode="numeric" value={cotacao.largura} onChange={set('largura')} />
                    <Field label="Altura (cm)" type="number" min="1" inputMode="numeric" value={cotacao.altura} onChange={set('altura')} />
                    <Field label="Peso (kg)" type="number" min="0.1" step="0.1" inputMode="decimal" value={cotacao.peso} onChange={set('peso')} />
                  </div>
                )}

                <div className="grid-form">
                  <Field label="Tipo de entrega">
                    <Segmented
                      block
                      label="Tipo de entrega"
                      value={cotacao.modalidade}
                      onChange={set('modalidade')}
                      options={[
                        { value: 'normal', label: 'Normal' },
                        { value: 'expressa', label: `Mais rápida +${TAXA_EXPRESSA}` },
                      ]}
                    />
                  </Field>
                  <Field label="Tipo de rastreamento">
                    <Segmented
                      block
                      label="Tipo de rastreamento"
                      value={cotacao.rastreio}
                      onChange={set('rastreio')}
                      options={[
                        { value: 'cd', label: 'Por etapas (CD)' },
                        { value: 'gps', label: `GPS ao vivo +${TAXA_GPS}` },
                      ]}
                    />
                  </Field>
                </div>
              </form>
            </Card>

            <Card className="cotacao-resultado" aria-live="polite">
              <span className="label">Estimativa</span>
              <div>
                <strong className="cotacao-total">{brl(resultado.total)}</strong>
                <p className="muted">
                  {nomeCidade(cotacao.origem)} → {nomeCidade(cotacao.destino)}
                </p>
              </div>
              <KeyValue label="Prazo" value={resultado.prazoTexto} valueColor="var(--pink)" />
              <KeyValue label="Distância" value={`${resultado.km.toLocaleString('pt-BR')} km`} />
              <KeyValue label="Peso cobrado" value={`${num(resultado.pesoTaxado)} kg`} />
              <KeyValue label="Rastreamento" value={cotacao.rastreio === 'gps' ? 'GPS em tempo real' : 'Por etapas'} />
              <Button block onClick={solicitar} icon="send">
                Solicitar envio
              </Button>
              <p className="small grey">Valor sem seguro da mercadoria. O ad valorem é calculado no pedido, com o valor da nota fiscal.</p>
            </Card>
          </div>
        </div>
      </section>
    </>
  )
}
