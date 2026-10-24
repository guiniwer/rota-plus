import { useState } from 'react'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import BarChart from '../../components/ui/BarChart'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import KpiCard from '../../components/ui/KpiCard'
import LabeledBar from '../../components/ui/LabeledBar'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'
import useRelatorio from '../../hooks/useRelatorio'
import { EmpresaApi } from '../../services/api'
import { brl, deltaPp, pct } from '../../utils/format'
import { TIPOS_ALERTA } from '../../utils/status'
import { duracao } from '../../utils/tempo'

const PERIODOS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]
const META_PRAZO = 92
const CORES_TIPO = { Veículo: 'var(--pink)', Equipamento: 'var(--purple)', Ferramenta: 'var(--amber)' } // cargas não entram: o uso delas é a própria entrega

export default function Relatorios() {
  const { executar, toast } = useApp()
  const [periodo, setPeriodo] = useState('30d')
  const { dados: r, erro } = useRelatorio(periodo)

  const exportar = async () => {
    const ok = await executar(() => EmpresaApi.baixarRelatorio(periodo).then(() => true))
    if (ok) toast('Relatório exportado.')
  }

  return (
    <Page
      title="Relatórios"
      subtitle={r ? `${new Date(r.de).toLocaleDateString('pt-BR')} a ${new Date(r.ate).toLocaleDateString('pt-BR')} · calculado a partir dos registros do sistema` : 'Desempenho logístico, utilização de ativos e cumprimento de prazos'}
      actions={
        <>
          <Segmented options={PERIODOS} value={periodo} onChange={setPeriodo} />
          <Button icon="download" onClick={exportar} disabled={!r}>
            Exportar CSV
          </Button>
        </>
      }
    >
      {erro && <p className="field-error">{erro}</p>}
      {!r ? (
        <p className="muted">Calculando indicadores…</p>
      ) : (
        <>
          <div className="grid-4">
            <KpiCard
              label="Entregas no prazo"
              value={pct(r.entregas.noPrazoPct)}
              delta={deltaPp(r.entregas.noPrazoPct, r.entregas.noPrazoPctAnterior) ?? 'sem período anterior para comparar'}
              deltaColor={r.entregas.noPrazoPct >= (r.entregas.noPrazoPctAnterior ?? 0) ? 'var(--green)' : 'var(--red)'}
            />
            <KpiCard label="Entregas concluídas" value={r.entregas.concluidas} delta={`${r.entregas.criadas} criadas · ${r.entregas.canceladas} canceladas`} deltaColor="var(--muted)" />
            <KpiCard label="Tempo médio pedido → entrega" value={duracao(r.entregas.tempoMedioHoras * 60)} delta={r.entregas.atrasoMedioMin ? `atraso médio quando atrasa: ${duracao(r.entregas.atrasoMedioMin)}` : 'nenhum atraso'} deltaColor="var(--muted)" />
            <KpiCard label="Faturamento de frete" value={brl(r.entregas.faturamento)} delta={`${pct(r.entregas.rastreadasGpsPct)} rastreadas por GPS`} deltaColor="var(--muted)" />
          </div>
          <div className="grid-aside">
            <Card title="Entregas no prazo" action={<Badge tone={r.entregas.noPrazoPct >= META_PRAZO ? 'success' : 'warning'}>Meta {META_PRAZO}%</Badge>}>
              <BarChart
                data={r.entregas.serie.map((p, i) => ({ label: p.rotulo, value: p.pct ?? 0, color: p.pct == null ? 'var(--line)' : i === r.entregas.serie.length - 1 ? 'var(--pink)' : p.pct < META_PRAZO ? 'var(--amber)' : 'var(--purple)' }))}
                max={100}
                format={(v) => `${Math.round(v)}%`}
              />
              <span className="small grey">{r.entregas.serie.reduce((s, p) => s + p.total, 0)} entregas concluídas no período · % entregue até o prazo combinado</span>
            </Card>
            <Card title="Utilização de ativos por tipo">
              {r.ativos.utilizacao.map((t) => (
                <LabeledBar key={t.tipo} label={`${t.tipo} (${t.ativos})`} value={`${t.pct}% · ${t.horas} h`} percent={t.pct} color={CORES_TIPO[t.tipo]} />
              ))}
              <span className="small grey">Horas entre check-out e check-in sobre {r.ativos.capacidadeHorasPorAtivo} h disponíveis por ativo (expediente × dias úteis)</span>
            </Card>
          </div>
          <div className="grid-4">
            <KpiCard label="Alertas tratados" value={`${r.alertas.resolvidos} / ${r.alertas.abertos}`} delta={`${pct(r.alertas.dentroSlaPct)} dentro do SLA · ${r.alertas.automaticos} normalizados sozinhos`} deltaColor="var(--muted)" />
            <KpiCard label="Tempo médio de resolução" value={duracao(r.alertas.tempoMedioResolucaoMin)} delta={r.alertas.porTipo.map((t) => `${TIPOS_ALERTA[t.tipo]?.label ?? t.tipo}: ${t.total}`).join(' · ') || 'nenhum alerta'} deltaColor="var(--muted)" />
            <KpiCard label="Ativos extraviados" value={r.ativos.extraviados} delta={r.ativos.valorExtraviado ? `${brl(r.ativos.valorExtraviado)} em ativos sem localização` : 'nenhum valor perdido'} deltaColor={r.ativos.extraviados ? 'var(--red)' : 'var(--green)'} />
            <KpiCard label="Satisfação dos clientes" value={r.avaliacao.total ? `${r.avaliacao.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ★` : '—'} delta={`${r.avaliacao.total} avaliação(ões)`} deltaColor="var(--muted)" />
          </div>
          <div className="grid-aside">
            <Card title="Desempenho por entregador">
              <DataTable
                rows={r.porEntregador}
                columns={[
                  { key: 'nome', label: 'Entregador', render: (e) => <strong>{e.nome}</strong> },
                  { key: 'entregues', label: 'Entregues' },
                  { key: 'prazo', label: 'No prazo', render: (e) => <span className={e.noPrazoPct < META_PRAZO ? 'amber' : 'green'}>{pct(e.noPrazoPct)}</span> },
                  { key: 'comp', label: 'Comprovante completo', render: (e) => pct(e.comprovantePct) },
                  { key: 'nota', label: 'Nota', render: (e) => (e.nota ? `${e.nota.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ★` : '—') },
                ]}
              />
            </Card>
            <Card title="Qualidade dos comprovantes">
              <LabeledBar label="Com foto" value={pct(r.comprovantes.fotoPct)} percent={r.comprovantes.fotoPct ?? 0} color="var(--purple)" />
              <LabeledBar label="Com assinatura" value={pct(r.comprovantes.assinaturaPct)} percent={r.comprovantes.assinaturaPct ?? 0} color="var(--purple)" />
              <LabeledBar label="Com GPS do local" value={pct(r.comprovantes.gpsPct)} percent={r.comprovantes.gpsPct ?? 0} color="var(--purple)" />
              <LabeledBar label="Completos (foto + assinatura + GPS)" value={pct(r.comprovantes.completoPct)} percent={r.comprovantes.completoPct ?? 0} color="var(--green)" />
              <span className="small grey">
                {r.entregas.tentativas} tentativa(s) sem sucesso · {r.ativos.movimentacoes} check-ins/outs de ativos · {pct(r.ativos.leituraPct)} dos ativos lidos no período
              </span>
            </Card>
          </div>
        </>
      )}
    </Page>
  )
}
