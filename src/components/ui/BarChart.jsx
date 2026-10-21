/** Gráfico de colunas simples em CSS. data: [{ label, value, color? }] */
export default function BarChart({ data, max, format = (v) => v }) {
  const top = max ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div className="bar-col" key={`${d.label}-${i}`} title={`${d.label}: ${format(d.value)}`}>
          <span>{format(d.value)}</span>
          <div className="bar" style={{ height: `${(d.value / top) * 100}%`, background: d.color }} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  )
}
