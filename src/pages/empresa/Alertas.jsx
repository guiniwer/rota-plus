import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Page from '../../components/layout/Page'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Icon from '../../components/ui/Icon'
import Person from '../../components/ui/Person'
import SearchInput from '../../components/ui/SearchInput'
import Segmented from '../../components/ui/Segmented'
import { useApp } from '../../context/AppContext'
import { SEVERIDADE, TIPOS_ALERTA } from '../../utils/status'
import { dataHora, relativo, slaRestante } from '../../utils/tempo'

/** Para onde o alerta aponta: entrega (RT-…), ativo ou entregador. */
const destinoDe = (a) => (!a.referencia ? null : a.referencia.startsWith('RT-') ? `/empresa/entregas?q=${a.referencia}` : /^\d+$/.test(a.referencia) ? '/empresa/equipes' : `/empresa/ativos/${a.referencia}`)

export default function Alertas() {
  const { alertas, assumirAlerta, resolverAlerta, alternarPasso, toast } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [aba, setAba] = useState('aberto')
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState(null)

  const lista = useMemo(
    () =>
      alertas
        .filter((a) => a.status === aba && (!tipo || a.tipo === tipo) && a.titulo.toLowerCase().includes(busca.toLowerCase()))
        .sort((a, b) => (aba === 'resolvido' ? Date.parse(b.resolvidoEm) - Date.parse(a.resolvidoEm) : SEVERIDADE[b.severidade].peso - SEVERIDADE[a.severidade].peso || Date.parse(a.abertoEm) - Date.parse(b.abertoEm))),
    [alertas, aba, tipo, busca],
  )
  const selecionado = alertas.find((a) => String(a.id) === params.get('id')) ?? lista[0]
  const destino = selecionado && destinoDe(selecionado)
  const contar = (s) => alertas.filter((a) => a.status === s).length

  return (
    <Page title="Central de alertas" subtitle="Gerados automaticamente pelas regras de monitoramento (a cada minuto) e pelas ocorrências de campo">
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {Object.entries(TIPOS_ALERTA).map(([k, t]) => (
          <button key={k} className="kpi" style={{ cursor: 'pointer', textAlign: 'left', outline: tipo === k ? '2px solid var(--pink)' : 'none' }} onClick={() => setTipo(tipo === k ? null : k)} aria-pressed={tipo === k}>
            <span className="row">
              <Icon name={t.icon} color={t.color} />
              <strong style={{ fontSize: 22 }}>{alertas.filter((a) => a.tipo === k && a.status !== 'resolvido').length}</strong>
            </span>
            <span className="small muted">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid-aside">
        <Card>
          <div className="row wrap">
            <SearchInput className="grow" value={busca} onChange={setBusca} placeholder="Buscar alerta…" />
            <Segmented
              value={aba}
              onChange={setAba}
              options={[
                { value: 'aberto', label: `Abertos ${contar('aberto')}` },
                { value: 'tratamento', label: `Em tratamento ${contar('tratamento')}` },
                { value: 'resolvido', label: `Resolvidos ${contar('resolvido')}` },
              ]}
            />
          </div>
          {lista.length ? (
            <DataTable
              rows={lista}
              selectedKey={selecionado?.id}
              onRowClick={(a) => setParams({ id: String(a.id) })}
              columns={[
                { key: 'sev', label: 'Sev.', render: (a) => <Badge tone={SEVERIDADE[a.severidade].tone}>{SEVERIDADE[a.severidade].label}</Badge> },
                { key: 'titulo', label: 'Alerta', render: (a) => (<span><strong>{a.titulo}</strong><span className="cell-sub">{a.entidade}</span></span>) },
                { key: 'aberto', label: 'Aberto', render: (a) => <span title={dataHora(a.abertoEm)}>{relativo(a.abertoEm)}</span> },
                {
                  key: 'sla',
                  label: aba === 'resolvido' ? 'Tempo' : 'SLA restante',
                  render: (a) => {
                    const s = slaRestante(a)
                    return <strong style={{ color: s.vencido ? 'var(--red)' : undefined }}>{s.texto}</strong>
                  },
                },
                { key: 'resp', label: 'Responsável', render: (a) => (a.responsavel ? <Person name={a.responsavel} /> : <span className="muted">{a.resolucao === 'automatica' ? 'Automático' : '—'}</span>) },
              ]}
            />
          ) : (
            <EmptyState icon="check" title="Nenhum alerta nesta lista">Bom trabalho!</EmptyState>
          )}
        </Card>

        {selecionado && (
          <Card title={selecionado.titulo} action={<Badge tone={SEVERIDADE[selecionado.severidade].tone}>{SEVERIDADE[selecionado.severidade].label}</Badge>}>
            <p className="muted">{selecionado.descricao}</p>
            <span className="small muted">
              Aberto {dataHora(selecionado.abertoEm)} · SLA {selecionado.slaMin} min
              {selecionado.resolvidoEm && ` · resolvido ${dataHora(selecionado.resolvidoEm)} (${selecionado.resolucao === 'automatica' ? 'condição normalizada' : `por ${selecionado.responsavel ?? 'operador'}`})`}
            </span>
            {destino && (
              <Button variant="secondary" size="sm" icon="arrow" onClick={() => navigate(destino)}>
                Ver {selecionado.referencia}
              </Button>
            )}
            <span className="label">Fluxo de resposta</span>
            {selecionado.passos.map((p, i) => (
              <label key={p.texto} className="row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={p.feito} onChange={() => alternarPasso(selecionado.id, i)} disabled={selecionado.status === 'resolvido'} style={{ marginTop: 3, accentColor: 'var(--green)' }} />
                <span className={p.feito ? '' : 'muted'}>{p.texto}</span>
              </label>
            ))}
            {selecionado.status !== 'resolvido' ? (
              <div className="grid-2" style={{ gap: 12 }}>
                <Button variant="secondary" onClick={async () => (await assumirAlerta(selecionado.id)) && toast('Você assumiu o alerta.')} disabled={selecionado.status === 'tratamento'}>
                  Assumir
                </Button>
                <Button variant="violet" onClick={async () => (await resolverAlerta(selecionado.id)) && toast('Alerta resolvido. Se a condição persistir, o monitor abre um novo.')}>
                  Resolver
                </Button>
              </div>
            ) : (
              <Badge tone="success">Resolvido</Badge>
            )}
          </Card>
        )}
      </div>
    </Page>
  )
}
