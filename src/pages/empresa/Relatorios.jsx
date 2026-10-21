import { useState } from 'react'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import BarChart from '../../components/ui/BarChart'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import KpiCard from '../../components/ui/KpiCard'
import LabeledBar from '../../components/ui/LabeledBar'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'

const PERIODOS = {
  '7d': { label: '7 dias', serie: [92, 93, 94, 93, 95, 94, 94], prefixo: 'D' },
  '30d': { label: '30 dias', serie: [88, 90, 92, 94], prefixo: 'S' },
  tri: { label: 'Trimestre', serie: [82, 84, 85, 87, 86, 89, 90, 91, 92, 93, 94, 94], prefixo: 'S' },
}
const CORES_TIPO = { Veículo: 'var(--pink)', Equipamento: 'var(--purple)', Ferramenta: 'var(--amber)', Mercadoria: 'var(--cyan)' }

export default function Relatorios() {
  const { ativos, alertas, entregas, toast } = useApp()
  const [periodo, setPeriodo] = useState('tri')
  const p = PERIODOS[periodo]

  // utilização média por tipo de ativo, a partir das horas de uso registradas
  const porTipo = Object.keys(CORES_TIPO).map((tipo) => {
    const lista = ativos.filter((a) => a.tipo === tipo)
    const horas = lista.reduce((s, a) => s + a.uso.reduce((x, h) => x + h, 0), 0)
    const pct = lista.length ? Math.round((horas / (lista.length * 14 * 10)) * 100) : 0
    return { tipo, pct }
  })
  const resolvidos = alertas.filter((a) => a.status === 'resolvido').length
  const rastreadas = entregas.filter((e) => e.rastreio === 'gps').length

  const exportar = () => {
    const linhas = [['Período', p.label], ['Indicador', 'Valor'], ['Entregas no prazo (último ponto)', `${p.serie.at(-1)}%`], ...porTipo.map((t) => [`Utilização ${t.tipo}`, `${t.pct}%`])]
    const url = URL.createObjectURL(new Blob([linhas.map((l) => l.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }))
    Object.assign(document.createElement('a'), { href: url, download: `relatorio-rota-plus-${periodo}.csv` }).click()
    URL.revokeObjectURL(url)
    toast('Relatório exportado.')
  }

  return (
    <Page
      title="Relatórios"
      subtitle="Desempenho logístico, utilização de ativos e cumprimento de prazos"
      actions={
        <>
          <Segmented options={Object.entries(PERIODOS).map(([value, x]) => ({ value, label: x.label }))} value={periodo} onChange={setPeriodo} />
          <Button icon="download" onClick={exportar}>
            Exportar CSV
          </Button>
        </>
      }
    >
      <div className="grid-4">
        <KpiCard label="Entregas no prazo" value={`${p.serie.at(-1)}%`} delta={`▲ ${p.serie.at(-1) - p.serie[0]} p.p. no período`} />
        <KpiCard label="Tempo médio p/ localizar ativo" value="3 min" delta="antes: 47 min (controle manual)" />
        <KpiCard label="Ativos extraviados" value={ativos.filter((a) => a.status === 'extraviado').length} delta="▼ 60% vs. período anterior" />
        <KpiCard label="Entregas rastreadas por GPS" value={`${Math.round((rastreadas / entregas.length) * 100)}%`} delta="demais: por centro de distribuição" deltaColor="var(--muted)" />
      </div>
      <div className="grid-aside">
        <Card title="Entregas no prazo" action={<Badge tone="success">Meta 92%</Badge>}>
          <BarChart data={p.serie.map((v, i) => ({ label: `${p.prefixo}${i + 1}`, value: v - 70, color: i === p.serie.length - 1 ? 'var(--pink)' : 'var(--purple)' }))} max={30} format={(v) => `${v + 70}%`} />
        </Card>
        <Card title="Utilização de ativos por tipo">
          {porTipo.map((t) => (
            <LabeledBar key={t.tipo} label={t.tipo} value={`${t.pct}%`} percent={t.pct} color={CORES_TIPO[t.tipo]} />
          ))}
        </Card>
      </div>
      <div className="grid-4">
        <KpiCard label="Alertas tratados" value={`${resolvidos} / ${alertas.length}`} delta="resolvidos dentro do fluxo" />
        <KpiCard label="Custo com reposição" value="R$ 4.900" delta="▼ R$ 7.500 vs. período anterior" />
        <KpiCard label="Satisfação dos clientes" value="4,7 ★" delta="▲ previsibilidade de entrega" />
        <KpiCard label="Retrabalho administrativo" value="−62 h/mês" delta="menos ligações e planilhas" />
      </div>
    </Page>
  )
}
