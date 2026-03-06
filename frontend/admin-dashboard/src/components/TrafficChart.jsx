import { useMemo } from 'react'

export default function TrafficChart({ traffic }) {
  const { labels, attackCounts, normalCounts } = useMemo(() => {
    const byHour = {}
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const h = new Date(now)
      h.setHours(h.getHours() - i, 0, 0, 0)
      byHour[h.toISOString().slice(0, 13)] = { attack: 0, normal: 0 }
    }
    traffic.forEach(t => {
      const key = t.analyzed_at ? new Date(t.analyzed_at).toISOString().slice(0, 13) : null
      if (key && byHour[key] !== undefined) {
        if (t.is_attack) byHour[key].attack++
        else byHour[key].normal++
      }
    })
    const keys = Object.keys(byHour).sort()
    const labels = keys.map(k => new Date(k).getHours() + ':00')
    const attackCounts = keys.map(k => byHour[k].attack)
    const normalCounts = keys.map(k => byHour[k].normal)
    return { labels, attackCounts, normalCounts }
  }, [traffic])

  const maxVal = Math.max(1, ...attackCounts, ...normalCounts)

  return (
    <div className="traffic-chart">
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot normal"></span> Normal</span>
        <span className="legend-item"><span className="legend-dot attack"></span> Attack</span>
      </div>
      <div className="chart-bars">
        {labels.map((label, i) => (
          <div key={i} className="chart-group">
            <div className="bar-pair">
              <div
                className="bar bar-normal"
                style={{ height: `${(normalCounts[i] / maxVal) * 100}%` }}
                title={`Normal: ${normalCounts[i]}`}
              />
              <div
                className="bar bar-attack"
                style={{ height: `${(attackCounts[i] / maxVal) * 100}%` }}
                title={`Attack: ${attackCounts[i]}`}
              />
            </div>
            <span className="bar-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
