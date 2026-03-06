export default function MetricsBar({ totalTraffic, attackCount, blockedIPs, systemStatus }) {
  return (
    <div className="metrics-bar">
      <div className="metric-card">
        <span className="metric-label">Total Traffic</span>
        <span className="metric-value">{totalTraffic.toLocaleString()}</span>
      </div>
      <div className="metric-card metric-attacks">
        <span className="metric-label">Attacks Detected</span>
        <span className="metric-value">{attackCount.toLocaleString()}</span>
      </div>
      <div className="metric-card metric-blocked">
        <span className="metric-label">Blocked IPs</span>
        <span className="metric-value">{blockedIPs.toLocaleString()}</span>
      </div>
      <div className={`metric-card metric-status status-${systemStatus}`}>
        <span className="metric-label">System Status</span>
        <span className="metric-value">{systemStatus === 'operational' ? 'Operational' : 'Offline'}</span>
      </div>
    </div>
  )
}
