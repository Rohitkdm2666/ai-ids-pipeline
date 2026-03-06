export default function TrafficTable({ traffic }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Source IP</th>
            <th>Dest IP</th>
            <th>Dest Port</th>
            <th>Probability</th>
            <th>Severity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {traffic.slice(0, 20).map((t, i) => (
            <tr key={t.id || i}>
              <td>{t.analyzed_at ? new Date(t.analyzed_at).toLocaleString() : '-'}</td>
              <td>{t.src_ip || '-'}</td>
              <td>{t.dest_ip || '-'}</td>
              <td>{t.dest_port != null ? t.dest_port : '-'}</td>
              <td>{(t.probability != null ? (t.probability * 100).toFixed(1) : '-')}%</td>
              <td>{t.severity || 'low'}</td>
              <td>{t.is_attack ? 'ATTACK' : 'NORMAL'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {traffic.length === 0 && <p className="empty-msg">No traffic received yet.</p>}
    </div>
  )
}
