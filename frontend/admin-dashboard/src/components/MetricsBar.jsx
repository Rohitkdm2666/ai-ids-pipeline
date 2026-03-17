export default function MetricsBar({ totalTraffic, attackCount, blockedIPs, systemStatus, newAttackCount }) {
  return (
    <div className="metrics-bar">
      <div className="metric-card">
        <div className="metric-icon">📈</div>
        <div className="metric-content">
          <span className="metric-label">Total Traffic</span>
          <span className="metric-value">{totalTraffic.toLocaleString()}</span>
        </div>
      </div>
      
      <div className={`metric-card metric-attacks ${newAttackCount > 0 ? 'has-new-attacks' : ''}`}>
        <div className="metric-icon">🚨</div>
        <div className="metric-content">
          <span className="metric-label">Attacks Detected</span>
          <span className="metric-value">{attackCount.toLocaleString()}</span>
          {newAttackCount > 0 && (
            <span className="new-attacks-indicator">+{newAttackCount}</span>
          )}
        </div>
      </div>
      
      <div className="metric-card metric-blocked">
        <div className="metric-icon">🚫</div>
        <div className="metric-content">
          <span className="metric-label">Blocked IPs</span>
          <span className="metric-value">{blockedIPs.toLocaleString()}</span>
        </div>
      </div>
      
      <div className={`metric-card metric-status status-${systemStatus}`}>
        <div className="metric-icon">
          {systemStatus === 'operational' ? '🟢' : 
           systemStatus === 'degraded' ? '🟡' : '🔴'}
        </div>
        <div className="metric-content">
          <span className="metric-label">System Status</span>
          <span className="metric-value">
            {systemStatus === 'operational' ? 'Online' : 
             systemStatus === 'degraded' ? 'Degraded' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  )
}
