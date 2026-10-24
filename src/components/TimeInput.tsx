import { useState } from 'react'

const split = (sec?: number) =>
  sec ? { h: String(Math.floor(sec / 3600)), m: String(Math.floor((sec % 3600) / 60)), s: String(Math.round(sec % 60)) } : { h: '', m: '', s: '' }

/**
 * A time as separate 시간 / 분 / 초 number boxes, so the phone's number keypad works
 * (it has no ':' key). Reports seconds, or undefined while all boxes are empty.
 */
export default function TimeInput({ id, value, onChange, label }: { id: string; value?: number; onChange: (sec: number | undefined) => void; label?: string }) {
  const [parts, setParts] = useState(() => split(value))
  const update = (k: 'h' | 'm' | 's', v: string) => {
    const next = { ...parts, [k]: v.replace(/\D/g, '').slice(0, 2) }
    setParts(next)
    const sec = Number(next.h || 0) * 3600 + Number(next.m || 0) * 60 + Number(next.s || 0)
    onChange(next.h || next.m || next.s ? sec : undefined)
  }
  return (
    <div className="flex items-center gap-1 text-sm text-slate-900 tabular-nums" role="group" aria-label={label}>
      {(['h', 'm', 's'] as const).map((k, i) => (
        <span key={k} className="flex items-center gap-1">
          <input
            id={`${id}-${k}`}
            type="number"
            inputMode="numeric"
            min="0"
            max={k === 'h' ? 99 : 59}
            value={parts[k]}
            onChange={(e) => update(k, e.target.value)}
            aria-label={['시간', '분', '초'][i]}
            className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
          />
          <span className="text-xs text-slate-500">{['시간', '분', '초'][i]}</span>
        </span>
      ))}
    </div>
  )
}
