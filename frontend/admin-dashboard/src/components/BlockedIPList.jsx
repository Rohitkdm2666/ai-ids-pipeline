export default function BlockedIPList({ blocked }) {
  return (
    <div className="blocked-list">
      {blocked.length === 0 ? (
        <p className="empty-msg">No blocked IPs.</p>
      ) : (
        <ul>
          {blocked.slice(0, 10).map(b => (
            <li key={b.ip_address || b.id} className="blocked-item">
              <span className="ip">{b.ip_address}</span>
              <span className={`badge badge-${(b.severity || 'low').toLowerCase()}`}>
                {b.severity || 'blocked'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
