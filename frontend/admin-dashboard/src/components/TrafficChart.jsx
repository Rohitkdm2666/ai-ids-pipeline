import { useMemo, useState } from 'react'

export default function TrafficChart({ traffic }) {
  const [selectedView, setSelectedView] = useState('hourly')
  
  const { hourlyData, dailyData, severityData } = useMemo(() => {
    // Hourly breakdown
    const byHour = {}
    const now = new Date()
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now)
      h.setHours(h.getHours() - i, 0, 0, 0)
      byHour[h.toISOString().slice(0, 13)] = { attack: 0, normal: 0, critical: 0, high: 0, medium: 0, low: 0, total: 0 }
    }
    
    traffic.forEach(t => {
      const key = t.analyzed_at ? new Date(t.analyzed_at).toISOString().slice(0, 13) : null
      if (key && byHour[key] !== undefined) {
        byHour[key].total = (byHour[key].total || 0) + 1
        if (t.is_attack) {
          byHour[key].attack++
          if (t.severity === 'critical') byHour[key].critical++
          else if (t.severity === 'high') byHour[key].high++
          else if (t.severity === 'medium') byHour[key].medium++
          else byHour[key].low++
        } else {
          byHour[key].normal++
        }
      }
    })
    
    // Daily breakdown
    const byDay = {}
    traffic.forEach(t => {
      const dayKey = t.analyzed_at ? new Date(t.analyzed_at).toDateString() : null
      if (dayKey && byDay[dayKey] === undefined) {
        byDay[dayKey] = { attack: 0, normal: 0, critical: 0, high: 0, medium: 0, low: 0, total: 0 }
      }
      if (dayKey) {
        byDay[dayKey].total = (byDay[dayKey].total || 0) + 1
        if (t.is_attack) {
          byDay[dayKey].attack++
          if (t.severity === 'critical') byDay[dayKey].critical++
          else if (t.severity === 'high') byDay[dayKey].high++
          else if (t.severity === 'medium') byDay[dayKey].medium++
          else byDay[dayKey].low++
        } else {
          byDay[dayKey].normal++
        }
      }
    })
    
    // Severity breakdown
    const severityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, normal: 0 }
    traffic.forEach(t => {
      if (t.is_attack) {
        severityBreakdown[t.severity]++
      } else {
        severityBreakdown.normal++
      }
    })
    
    return { hourlyData: byHour, dailyData: byDay, severityData: severityBreakdown }
  }, [traffic])

  const hourlyLabels = useMemo(() => {
    const keys = Object.keys(hourlyData).sort()
    return keys.map(k => new Date(k).getHours() + ':00')
  }, [hourlyData])

  const dailyLabels = useMemo(() => {
    const keys = Object.keys(dailyData).sort().slice(-7)
    return keys.map(k => new Date(k).toLocaleDateString())
  }, [dailyData])

  const severityLabels = ['Critical', 'High', 'Medium', 'Low', 'Normal']
  const severityColors = {
    critical: '#dc3545',
    high: '#fd7e14', 
    medium: '#ffc107',
    low: '#20c997',
    normal: '#28a745'
  }

  const maxHourlyVal = useMemo(() => {
    return Math.max(1, ...Object.values(hourlyData).map(h => h.total || 0))
  }, [hourlyData])

  const maxDailyVal = useMemo(() => {
    return Math.max(1, ...Object.values(dailyData).map(d => d.total || 0))
  }, [dailyData])

  const maxSeverityVal = useMemo(() => {
    return Math.max(1, ...Object.values(severityData))
  }, [severityData])

  return (
    <div className="traffic-chart">
      <div className="chart-controls">
        <div className="view-selector">
          <label>View:</label>
          <select value={selectedView} onChange={(e) => setSelectedView(e.target.value)} className="view-select">
            <option value="hourly">📊 Hourly Traffic</option>
            <option value="daily">📅 Daily Trends</option>
            <option value="severity">🎯 Severity Breakdown</option>
          </select>
        </div>
      </div>

      {selectedView === 'hourly' && (
        <div className="chart-container">
          <h3>📈 Traffic Overview (Last 24 Hours)</h3>
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot normal"></span> Normal</span>
            <span className="legend-item"><span className="legend-dot attack"></span> Attack</span>
            <span className="legend-item"><span className="legend-dot critical"></span> Critical</span>
          </div>
          <div className="chart-bars">
            {hourlyLabels.map((label, i) => {
              const hourData = hourlyData[label] || { attack: 0, normal: 0, critical: 0 }
              const total = hourData.attack + hourData.normal + hourData.critical
              return (
                <div key={i} className="chart-group">
                  <div className="bar-container">
                    <div
                      className="bar bar-normal"
                      style={{ height: `${(hourData.normal / maxHourlyVal) * 100}%` }}
                      title={`Normal: ${hourData.normal}`}
                    />
                    <div
                      className="bar bar-attack"
                      style={{ height: `${(hourData.attack / maxHourlyVal) * 100}%` }}
                      title={`Attack: ${hourData.attack}`}
                    />
                    <div
                      className="bar bar-critical"
                      style={{ height: `${(hourData.critical / maxHourlyVal) * 100}%` }}
                      title={`Critical: ${hourData.critical}`}
                    />
                    <div className="bar-label">{label}</div>
                    <div className="bar-stats">
                      <span className="stat">T: {total}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedView === 'daily' && (
        <div className="chart-container">
          <h3>📅 7-Day Traffic Trends</h3>
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot normal"></span> Normal</span>
            <span className="legend-item"><span className="legend-dot attack"></span> Attack</span>
          </div>
          <div className="chart-bars">
            {dailyLabels.map((label, i) => {
              const dayData = dailyData[label] || { attack: 0, normal: 0 }
              const total = dayData.attack + dayData.normal
              return (
                <div key={i} className="chart-group">
                  <div className="bar-container">
                    <div
                      className="bar bar-normal"
                      style={{ height: `${(dayData.normal / maxDailyVal) * 100}%` }}
                      title={`Normal: ${dayData.normal}`}
                    />
                    <div
                      className="bar bar-attack"
                      style={{ height: `${(dayData.attack / maxDailyVal) * 100}%` }}
                      title={`Attack: ${dayData.attack}`}
                    />
                    <div className="bar-label">{label}</div>
                    <div className="bar-stats">
                      <span className="stat">T: {total}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedView === 'severity' && (
        <div className="chart-container">
          <h3>🎯 Attack Severity Distribution</h3>
          <div className="severity-chart">
            {severityLabels.map((label, i) => {
              const value = severityData[label.toLowerCase()] || 0
              const percentage = (value / maxSeverityVal) * 100
              return (
                <div key={i} className="severity-item">
                  <div className="severity-bar">
                    <div
                      className="severity-fill"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: severityColors[label.toLowerCase()]
                      }}
                    />
                  </div>
                  <div className="severity-info">
                    <div className="severity-label">{label}</div>
                    <div className="severity-value">{value}</div>
                    <div className="severity-percentage">{percentage.toFixed(1)}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
