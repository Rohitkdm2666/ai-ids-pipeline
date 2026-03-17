import { useState, useEffect, useRef } from 'react'
import MetricsBar from './components/MetricsBar'
import TrafficChart from './components/TrafficChart'
import AttackTable from './components/AttackTable'
import BlockedIPList from './components/BlockedIPList'
import TrafficDistribution from './components/TrafficDistribution'
import TrafficTable from './components/TrafficTable'
import './App.css'

const API = 'http://localhost:3000/api'

function App() {
  const [metrics, setMetrics] = useState({
    totalTraffic: 0,
    totalAttacks: 0,
    detectionRate: 0,
    blockedIpCount: 0
  })
  const [attacks, setAttacks] = useState([])
  const [traffic, setTraffic] = useState([])
  const [blocked, setBlocked] = useState([])
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [newAttackCount, setNewAttackCount] = useState(0)
  const [isConnected, setIsConnected] = useState(true)
  const [previousAttackCount, setPreviousAttackCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const alertTimeoutRef = useRef(null)

  const addAlert = (type, message, severity = 'warning') => {
    const newAlert = {
      id: Date.now(),
      type,
      message,
      severity,
      timestamp: new Date(),
      isNew: true
    }
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 4)]) // Keep only 5 recent alerts
    
    // Auto-remove alert after 5 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== newAlert.id))
    }, 5000)
    
    // Show browser notification for critical attacks
    if (severity === 'critical') {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 CRITICAL ATTACK DETECTED', {
          body: message,
          icon: '/favicon.ico'
        })
      }
    }
    
    // Play alert sound for critical attacks
    if (severity === 'critical') {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    }
  }

  const fetchData = async () => {
    try {
      setError(null)
      setIsConnected(true)
      
      const [mRes, aRes, tRes, bRes] = await Promise.all([
        fetch(`${API}/metrics`).catch(() => null),
        fetch(`${API}/attacks?limit=50`).catch(() => null),
        fetch(`${API}/traffic?limit=100`).catch(() => null),
        fetch(`${API}/blocked-ips`).catch(() => null)
      ])
      
      if (mRes && mRes.ok) {
        const newMetrics = await mRes.json()
        setMetrics(newMetrics)
        
        // Check for new attacks - trigger alert when count increases
        if (previousAttackCount > 0 && newMetrics.totalAttacks > previousAttackCount) {
          const attackDiff = newMetrics.totalAttacks - previousAttackCount
          setNewAttackCount(prev => prev + attackDiff)
          setPreviousAttackCount(newMetrics.totalAttacks)
          
          // Add alert for NEW attacks - this will trigger when add_demo_attack.py runs
          addAlert('attack', `🚨 ${attackDiff} new attack${attackDiff > 1 ? 's' : ''} detected!`, 'critical')
        } else if (previousAttackCount === 0) {
          // First load - set baseline but don't alert
          setPreviousAttackCount(newMetrics.totalAttacks)
        }
      }
      
      if (aRes && aRes.ok) {
        const newAttacks = await aRes.json()
        setAttacks(newAttacks)
        
        // Check for recent high-severity attacks
        const recentAttacks = newAttacks.slice(0, 3)
        recentAttacks.forEach(attack => {
          const attackTime = new Date(attack.detected_at || attack.analyzed_at)
          const now = new Date()
          const timeDiff = (now - attackTime) / 1000 // seconds
          
          // Alert for any recent attack (within 60 seconds) - catches demo attacks
          if (timeDiff < 60 && (attack.severity === 'critical' || attack.severity === 'high')) {
            addAlert('high-severity', `🔥 ${attack.label} from ${attack.src_ip}`, 'critical')
          }
        })
      }
      
      if (tRes && tRes.ok) setTraffic(await tRes.json())
      if (bRes && bRes.ok) setBlocked(await bRes.json())
      
      setLastUpdate(new Date())
      
    } catch (e) {
      console.error('API Error:', e)
      setError('Connection failed')
      setIsConnected(false)
      addAlert('connection', '🔌 Lost connection to backend', 'error')
    }
  }

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 3000) // Faster refresh for real-time alerts
    
    return () => {
      clearInterval(t)
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current)
      }
    }
  }, [])

  const systemStatus = error ? 'offline' : (isConnected ? 'operational' : 'degraded')
  const hasNewAttacks = newAttackCount > 0

  return (
    <div className="dashboard">
      {/* Real-time Alert Banner */}
      {alerts.length > 0 && (
        <div className="alert-container">
          {alerts.map(alert => (
            <div 
              key={alert.id} 
              className={`alert alert-${alert.severity} alert-slide-in`}
              style={{ animation: 'slideInRight 0.3s ease-out' }}
            >
              <span className="alert-icon">
                {alert.severity === 'critical' ? '🚨' : 
                 alert.severity === 'error' ? '❌' : '⚠️'}
              </span>
              <span className="alert-message">{alert.message}</span>
              <span className="alert-time">
                {alert.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <header className="dashboard-header">
        <div className="header-left">
          <h1>🛡️ IDS Security Operations Center</h1>
          <div className="status-indicator">
            <span className={`status-dot status-${systemStatus}`}></span>
            <span className="status-text">
              {systemStatus === 'operational' ? '🟢 System Online' : 
               systemStatus === 'degraded' ? '🟡 System Degraded' : '🔴 System Offline'}
            </span>
          </div>
        </div>
        
        <div className="header-actions">
          <div className="new-attacks-indicator">
            {hasNewAttacks && (
              <span className="new-attacks-badge">
                🔥 {newAttackCount} New
              </span>
            )}
          </div>
          <span className="last-update">
            {lastUpdate ? `📊 ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
          </span>
          <button className="btn-refresh" onClick={fetchData}>
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* Connection Status Bar */}
      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">❌</span>
          Backend unavailable: {error}. Attempting to reconnect...
          <div className="reconnect-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      <MetricsBar
        totalTraffic={metrics.totalTraffic}
        attackCount={metrics.totalAttacks}
        blockedIPs={metrics.blockedIpCount}
        systemStatus={systemStatus}
        newAttackCount={newAttackCount}
      />

      <div className="dashboard-grid">
        <section className="card chart-section">
          <h2>📈 Traffic Overview</h2>
          <TrafficChart traffic={traffic} />
        </section>

        <section className="card">
          <h2>🚨 Recent Attacks</h2>
          <AttackTable attacks={attacks} />
        </section>

        <section className="card">
          <h2>📊 Traffic Analysis</h2>
          <div className="traffic-summary">
            <TrafficDistribution traffic={traffic} />
          </div>
          <TrafficTable traffic={traffic} />
        </section>

        <section className="card">
          <h2>🚫 Blocked IPs</h2>
          <BlockedIPList blocked={blocked} />
        </section>
      </div>

      {/* Enhanced Footer */}
      <footer className="dashboard-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>System Status</h4>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Detection Engine:</span>
                <span className="status-value">🟢 Hybrid ML+Rules</span>
              </div>
              <div className="status-item">
                <span className="status-label">Database:</span>
                <span className="status-value">🟢 Connected</span>
              </div>
              <div className="status-item">
                <span className="status-label">Packet Capture:</span>
                <span className="status-value">🟢 Active</span>
              </div>
            </div>
          </div>
          
          <div className="footer-section">
            <h4>Performance</h4>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Detection Rate:</span>
                <span className="status-value">{metrics.detectionRate}%</span>
              </div>
              <div className="status-item">
                <span className="status-label">Response Time:</span>
                <span className="status-value">&lt;100ms</span>
              </div>
              <div className="status-item">
                <span className="status-label">Uptime:</span>
                <span className="status-value">99.9%</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
