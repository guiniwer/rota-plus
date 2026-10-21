import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Field from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import KeyValue from '../../components/ui/KeyValue'
import OptionCard from '../../components/ui/OptionCard'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'
import { brl, num } from '../../utils/format'
import RotaCidades from '../../components/entregas/RotaCidades'
import { nomeCidade } from '../../data/cidades'
import { FATOR_CUBAGEM, TAXA_EXPRESSA, TAXA_GPS, calcularFrete } from '../../utils/frete'

const INICIAL = {
  destinatario: '',
  telefone: '',
  enderecoOrigem: '',
  enderecoDestino: '',
  origem: 'recife-pe', // cidades (ids de data/cidades.js)
  destino: 'saopaulo-sp',
  tipoCarga: 'caixa',
  comprimento: '35',
  largura: '25',
  altura: '12',
  peso: '2.5',
  descricao: '',
  valorNF: '4500',
  modalidade: 'expressa',
  rastreio: 'gps',
}

/** Formulário de pedido com cálculo de frete em tempo real. */
export default function NovoPedido() {
  const { criarPedido, toast } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState(INICIAL)
  const [erros, setErros] = useState({})

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e?.target ? e.target.value : e }))
  const frete = useMemo(() => calcularFrete(form), [form])

  const enviar = async (e) => {
    e.preventDefault()
    const n = {}
    if (!form.destinatario.trim()) n.destinatario = 'Informe o destinatário.'
    if (!form.enderecoOrigem.trim()) n.enderecoOrigem = 'Informe o endereço de retirada.'
    if (!form.enderecoDestino.trim()) n.enderecoDestino = 'Informe o endereço de entrega.'
    if (form.tipoCarga === 'caixa' && !(Number(form.peso) > 0)) n.peso = 'Peso inválido.'
    setErros(n)
    if (Object.keys(n).length) {
      toast('Revise os campos destacados.')
      return
    }
    const id = await criarPedido({
      remetente: 'Você',
      destinatario: form.destinatario,
      origem: `${form.enderecoOrigem} — ${nomeCidade(form.origem)}`,
      destino: `${form.enderecoDestino} — ${nomeCidade(form.destino)}`,
      tipoCarga: form.tipoCarga === 'caixa' ? `Caixa · ${form.descricao || 'diversos'}` : 'Documentos',
      pesoTaxado: frete.pesoTaxado,
      modalidade: form.modalidade,
      rastreio: form.rastreio,
      valor: frete.total,
      prazoTexto: frete.prazoTexto,
    })
    if (!id) return
    toast(`Pedido ${id} criado!`)
    navigate(`/cliente/status/${id}`)
  }

  return (
    <Page title="Fazer pedido" subtitle="Envie pacotes de forma rápida e segura">
      <form className="grid-aside" onSubmit={enviar} noValidate>
        <div className="stack">
          <Card title="1. Endereços">
            <RotaCidades origem={form.origem} destino={form.destino} onChange={(rota) => setForm((f) => ({ ...f, ...rota }))} />
            <div className="grid-form">
              <Field label="Endereço de retirada (origem)" value={form.enderecoOrigem} onChange={set('enderecoOrigem')} error={erros.enderecoOrigem} placeholder="Rua, número e bairro" />
              <Field label="Endereço de entrega (destino)" value={form.enderecoDestino} onChange={set('enderecoDestino')} error={erros.enderecoDestino} placeholder="Avenida, número e bairro" />
              <Field label="Nome do destinatário" value={form.destinatario} onChange={set('destinatario')} error={erros.destinatario} placeholder="Maria Silva" />
              <Field label="Telefone" type="tel" value={form.telefone} onChange={set('telefone')} placeholder="(11) 98765-4321" />
            </div>
          </Card>

          <Card title="2. Especificações da carga">
            <Field label="Tipo de carga">
              <Segmented
                block
                label="Tipo de carga"
                value={form.tipoCarga}
                onChange={set('tipoCarga')}
                options={[
                  { value: 'documento', label: 'Documentos / Envelopes' },
                  { value: 'caixa', label: 'Caixas' },
                ]}
              />
            </Field>
            {form.tipoCarga === 'caixa' ? (
              <>
                <p className="small muted">Para caixas, informe as dimensões e o peso — cobramos o maior valor entre peso real e peso cubado.</p>
                <div className="grid-form-4">
                  <Field label="Comprimento (cm)" type="number" min="1" value={form.comprimento} onChange={set('comprimento')} />
                  <Field label="Largura (cm)" type="number" min="1" value={form.largura} onChange={set('largura')} />
                  <Field label="Altura (cm)" type="number" min="1" value={form.altura} onChange={set('altura')} />
                  <Field label="Peso real (kg)" type="number" min="0.1" step="0.1" value={form.peso} onChange={set('peso')} error={erros.peso} />
                </div>
              </>
            ) : (
              <p className="small muted">Documentos e envelopes têm peso fixo de 0,3 kg.</p>
            )}
            <div className="grid-form">
              <Field label="Descrição do conteúdo" value={form.descricao} onChange={set('descricao')} placeholder="Notebook e acessórios" />
              <Field label="Valor declarado na nota fiscal (R$)" type="number" min="0" value={form.valorNF} onChange={set('valorNF')} />
            </div>
          </Card>

          <Card title="3. Tipo de entrega">
            <div className="grid-2">
              <OptionCard icon="truck" title="Entrega normal" description="Prazo padrão da região" price="Incluso no frete" selected={form.modalidade === 'normal'} onSelect={() => set('modalidade')('normal')} />
              <OptionCard icon="send" title="Mais rápida" description="Prioridade na coleta e na rota" price={`+ ${brl(TAXA_EXPRESSA)}`} selected={form.modalidade === 'expressa'} onSelect={() => set('modalidade')('expressa')} />
            </div>
          </Card>

          <Card title="4. Tipo de rastreamento">
            <div className="grid-2">
              <OptionCard icon="building" title="Por centro de distribuição" description="Atualização a cada etapa (coleta, triagem, saída e entrega)" price="Incluso no frete" selected={form.rastreio === 'cd'} onSelect={() => set('rastreio')('cd')} />
              <OptionCard icon="pin" title="Por GPS em tempo real" description="Posição do entregador no mapa, ETA ao vivo e alertas de desvio" price={`+ ${brl(TAXA_GPS)}`} selected={form.rastreio === 'gps'} onSelect={() => set('rastreio')('gps')} />
            </div>
          </Card>
        </div>

        <div className="stack" style={{ position: 'sticky', top: 16 }}>
          <Card title="Resumo do frete">
            <KeyValue label="Peso real" value={`${num(frete.pesoReal)} kg`} />
            {form.tipoCarga === 'caixa' && <KeyValue label={`Peso cubado (fator ${FATOR_CUBAGEM})`} value={`${num(frete.pesoCubado)} kg`} />}
            <KeyValue label="Peso taxado" value={`${num(frete.pesoTaxado)} kg`} valueColor="var(--pink)" />
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%', margin: 0 }} />
            {frete.itens.map((i) => (
              <KeyValue key={i.label} label={i.label} value={brl(i.valor)} />
            ))}
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%', margin: 0 }} />
            <KeyValue label="Total estimado" value={brl(frete.total)} valueColor="var(--pink)" strong />
            <KeyValue label="Prazo" value={frete.prazoTexto} />
            <Button type="submit" block>
              Solicitar envio
            </Button>
            <p className="small grey">Ao solicitar, você concorda com os Termos de Uso e a Política de Privacidade.</p>
          </Card>
          <Card compact style={{ background: 'var(--card-2)' }}>
            <div className="row">
              <Icon name="help" size={18} color="var(--purple)" />
              <strong>Como calculamos</strong>
            </div>
            <p className="small muted">
              Peso cubado = (C × L × A em m³) × {FATOR_CUBAGEM}. A transportadora cobra o maior entre o peso real e o cubado. Ad valorem e GRIS são calculados sobre
              o valor da nota fiscal.
            </p>
          </Card>
        </div>
      </form>
    </Page>
  )
}
