import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addDays, runsOf } from '../analytics/stats'
import { db } from '../db/db'
import { assessInBody, type Level } from '../inbody/assess'
import type { InBodyRecord } from '../inbody/inbody'

const CHIP: Record<Level, { label: string; className: string }> = {
  good: { label: '좋음', className: 'bg-teal-50 text-teal-800' },
  ok: { label: '보통', className: 'bg-slate-100 text-slate-600' },
  watch: { label: '주의', className: 'bg-amber-100 text-amber-800' },
}

export default function InBodyLevel({ records }: { records: InBodyRecord[] }) {
  const days = useLiveQuery(() => db.days.toArray())
  const [open, setOpen] = useState(true)
  if (!days) return null
  const runs = runsOf(days)
  const kmBefore = (date: string) => {
    const from = addDays(date, -7)
    return runs.filter((r) => r.date >= from && r.date < date).reduce((s, r) => s + r.distanceKm, 0)
  }
  const a = assessInBody(records, runs.length ? kmBefore : undefined)
  if (!a) return null

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <button onClick={() => setOpen(!open)} className="flex w-full items-baseline justify-between text-left">
        <h2 className="font-semibold">현재 수준 · {a.date}</h2>
        <span className="text-xs text-slate-400">{open ? '접기' : '펼치기'}</span>
      </button>
      <p className="mt-1 text-sm text-slate-700">{a.headline}</p>
      {open && (
        <>
          <ul className="mt-3 divide-y divide-slate-100">
            {a.items.map((i) => (
              <li key={i.key} className="py-2">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{i.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="tabular-nums">{i.value}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${CHIP[i.level].className}`}>{CHIP[i.level].label}</span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{i.note}</p>
              </li>
            ))}
          </ul>

          {a.trends.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold text-slate-500">{a.trends[0].since} 이후 변화</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {a.trends.map((t) => {
                  const d = Math.round((t.to - t.from) * 10) / 10
                  return (
                    <div key={t.label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <div className="text-xs text-slate-500">{t.label}</div>
                      <div className="tabular-nums">
                        {t.from} → <b>{t.to}</b>
                        {t.unit} <span className="text-xs text-slate-500">({d > 0 ? '+' : ''}{d})</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {a.suggestions.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold text-slate-500">도움이 될 것</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {a.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">결과지의 표준 범위와 일반 기준(성인 남성)으로 본 참고용 해석이며 진단이 아닙니다.</p>
        </>
      )}
    </div>
  )
}
