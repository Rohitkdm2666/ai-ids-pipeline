export default function AttackTable({ attacks }) {
  const severityClass = s => {
    if (!s) return 'low'
    const v = String(s).toLowerCase()
    if (v === 'critical' || v === 'high') return 'critical'
    if (v === 'medium') return 'medium'
    return 'low'
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Source IP</th>
            <th>Dest IP</th>
            <th>Severity</th>
            <th>Probability</th>
          </tr>
        </thead>
        <tbody>
          {attacks.slice(0, 15).map((a, i) => (
            <tr key={a.id || i} className="row-attack">
              <td>{a.detected_at ? new Date(a.detected_at).toLocaleString() : '-'}</td>
              <td>{a.src_ip || '-'}</td>
              <td>{a.dest_ip || '-'}</td>
              <td>
                <span className={`badge badge-${severityClass(a.severity)}`}>
                  {a.severity || 'low'}
                </span>
              </td>
              <td>{(a.probability != null ? (a.probability * 100).toFixed(1) : '-')}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {attacks.length === 0 && <p className="empty-msg">No attacks detected yet.</p>}
    </div>
  )
}
