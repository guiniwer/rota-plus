import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import MapView, { MapChip } from '../../components/ui/MapView'
import Segmented from '../../components/ui/Segmented'
import { brl, num } from '../../utils/format'
import { REGIOES, calcularFrete } from '../../utils/frete'

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
  const [cotacao, setCotacao] = useState({ tipoCarga: 'documento', regiao: 'cidade', modalidade: 'normal', rastreio: 'cd', peso: '1', comprimento: '30', largura: '20', altura: '15' })
  const [resultado, setResultado] = useState(null)

  const set = (campo) => (e) => setCotacao((c) => ({ ...c, [campo]: e.target ? e.target.value : e }))

  const calcular = (e) => {
    e.preventDefault()
    setResultado(calcularFrete({ ...cotacao, valorNF: 0 }))
  }

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
        <div className="container grid-aside">
          <Card title="Faça uma cotação">
            <form className="stack-sm" style={{ gap: 16 }} onSubmit={calcular}>
              <div className="grid-form">
                <Field label="Destino" as="select" value={cotacao.regiao} onChange={set('regiao')} options={REGIOES} />
                <Field
                  label="Tipo de carga"
                  as="select"
                  value={cotacao.tipoCarga}
                  onChange={set('tipoCarga')}
                  options={[
                    { value: 'documento', label: 'Documentos / Envelopes' },
                    { value: 'caixa', label: 'Caixas' },
                  ]}
                />
              </div>
              {cotacao.tipoCarga === 'caixa' && (
                <div className="grid-form-4">
                  <Field label="Compr. (cm)" type="number" min="1" value={cotacao.comprimento} onChange={set('comprimento')} />
                  <Field label="Largura (cm)" type="number" min="1" value={cotacao.largura} onChange={set('largura')} />
                  <Field label="Altura (cm)" type="number" min="1" value={cotacao.altura} onChange={set('altura')} />
                  <Field label="Peso (kg)" type="number" min="0.1" step="0.1" value={cotacao.peso} onChange={set('peso')} />
                </div>
              )}
              <div className="grid-form">
                <Field label="Tipo de entrega">
                  <Segmented
                    value={cotacao.modalidade}
                    onChange={set('modalidade')}
                    options={[
                      { value: 'normal', label: 'Normal' },
                      { value: 'expressa', label: 'Mais rápida' },
                    ]}
                  />
                </Field>
                <Field label="Tipo de rastreamento">
                  <Segmented
                    value={cotacao.rastreio}
                    onChange={set('rastreio')}
                    options={[
                      { value: 'cd', label: 'Centro de distribuição' },
                      { value: 'gps', label: 'GPS (+R$ 50)' },
                    ]}
                  />
                </Field>
              </div>
              <Button type="submit" variant="violet">
                Calcular frete
              </Button>
            </form>
          </Card>
          <Card title="Estimativa">
            {resultado ? (
              <>
                <KeyValue label="Peso cobrado" value={`${num(resultado.pesoTaxado)} kg`} />
                <KeyValue label="Prazo" value={resultado.prazoTexto} />
                <KeyValue label="Total estimado" value={brl(resultado.total)} valueColor="var(--pink)" strong />
                <Button block onClick={() => navigate('/login')}>
                  Solicitar envio
                </Button>
              </>
            ) : (
              <p className="muted">Preencha os dados ao lado para ver o valor e o prazo estimados da sua entrega.</p>
            )}
          </Card>
        </div>
      </section>
    </>
  )
}
