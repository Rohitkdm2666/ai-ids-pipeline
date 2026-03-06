export default function TrafficDistribution({ traffic }) {
  const attack = traffic.filter(t => t.is_attack).length
  const normal = traffic.filter(t => !t.is_attack).length
  const total = attack + normal
  const attackPct = total > 0 ? ((attack / total) * 100).toFixed(1) : 0
  const normalPct = total > 0 ? ((normal / total) * 100).toFixed(1) : 0

  return (
    <div className="traffic-dist">
      <div className="dist-bar">
        <div className="dist-segment normal" style={{ width: `${normalPct}%` }} />
        <div className="dist-segment attack" style={{ width: `${attackPct}%` }} />
      </div>
      <div className="dist-labels">
        <span><span className="dot green"></span> Normal: {normal} ({normalPct}%)</span>
        <span><span className="dot red"></span> Attack: {attack} ({attackPct}%)</span>
      </div>
    </div>
  )
}
