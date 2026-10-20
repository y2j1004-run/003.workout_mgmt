import { useState } from 'react'
import { AXIS_TEXT, GRID, niceMax, PAD, SERIES, ticks, W } from './chartTheme'

interface Props {
  data: { label: string; value: number }[]
  /** short label under the axis for a bar, or '' to skip */
  axisLabel: (label: string, i: number) => string
  format: (d: { label: string; value: number }) => string
  height?: number
}

// Single-series column chart. Tap a column to read its value; the latest one is shown by default.
export default function BarChart({ data, axisLabel, format, height = 180 }: Props) {
  const [sel, setSel] = useState<number>(data.length - 1)
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const plotW = W - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const band = plotW / data.length
  const barW = Math.min(24, Math.max(2, band - 2)) // 2px surface gap between neighbours
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const current = data[sel]

  return (
    <figure>
      <figcaption className="mb-1 h-5 text-sm font-semibold tabular-nums">{current && format(current)}</figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full touch-none select-none" role="img">
        {ticks(0, max).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 4} y={y(t) + 3} textAnchor="end" fontSize={9} fill={AXIS_TEXT}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + band * i + (band - barW) / 2
          const h = Math.max(0, PAD.top + plotH - y(d.value))
          const r = Math.min(4, barW / 2, h)
          const top = PAD.top + plotH - h
          const label = axisLabel(d.label, i)
          return (
            <g key={d.label} onPointerDown={() => setSel(i)} onPointerEnter={() => setSel(i)} style={{ cursor: 'pointer' }}>
              {/* hit target covers the whole band, bigger than the bar */}
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                  fill={SERIES}
                  opacity={i === sel ? 1 : 0.55}
                />
              )}
              {label && (
                <text x={PAD.left + band * i + band / 2} y={height - 6} textAnchor="middle" fontSize={9} fill={AXIS_TEXT}>
                  {label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
