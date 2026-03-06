import { useState, useEffect } from 'react'
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

  const fetchData = async () => {
    try {
      setError(null)
      const [mRes, aRes, tRes, bRes] = await Promise.all([
        fetch(`${API}/metrics`),
        fetch(`${API}/attacks?limit=50`),
        fetch(`${API}/traffic?limit=100`),
        fetch(`${API}/blocked-ips`)
      ])
      if (mRes.ok) setMetrics(await mRes.json())
      if (aRes.ok) setAttacks(await aRes.json())
      if (tRes.ok) setTraffic(await tRes.json())
      if (bRes.ok) setBlocked(await bRes.json())
      setLastUpdate(new Date())
      console.log('[DASHBOARD_API_DATA]', { metrics, attacksCount: (await aRes.clone().json?.() || []).length, trafficCount: (await tRes.clone().json?.() || []).length });
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 5000)
    return () => clearInterval(t)
  }, [])

  const systemStatus = error ? 'offline' : 'operational'

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>IDS Security Operations Center</h1>
        <div className="header-actions">
          <span className="last-update">
            {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
          </span>
          <button className="btn-refresh" onClick={fetchData}>Refresh</button>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          Backend unavailable: {error}
        </div>
      )}

      <MetricsBar
        totalTraffic={metrics.totalTraffic}
        attackCount={metrics.totalAttacks}
        blockedIPs={metrics.blockedIpCount}
        systemStatus={systemStatus}
      />

      <div className="dashboard-grid">
        <section className="card chart-section">
          <h2>Traffic Overview</h2>
          <TrafficChart traffic={traffic} />
        </section>

        <section className="card">
          <h2>Recent Attacks</h2>
          <AttackTable attacks={attacks} />
        </section>

        <section className="card">
          <h2>Recent Traffic</h2>
          <div className="traffic-summary">
            <TrafficDistribution traffic={traffic} />
          </div>
          <TrafficTable traffic={traffic} />
        </section>

        <section className="card">
          <h2>Blocked IPs</h2>
          <BlockedIPList blocked={blocked} />
        </section>
      </div>
    </div>
  )
}

export default App
