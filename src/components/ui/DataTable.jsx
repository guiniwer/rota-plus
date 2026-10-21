/**
 * Tabela que vira lista de cards no mobile (via data-label + CSS).
 * columns: [{ key, label, width?, render?(row) }]
 */
export default function DataTable({ columns, rows, rowKey = 'id', onRowClick, selectedKey }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = row[rowKey]
            const classes = [onRowClick && 'clickable', selectedKey === key && 'selected'].filter(Boolean).join(' ')
            return (
              <tr key={key} className={classes} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
