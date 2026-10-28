import { useState } from 'react'
import type { DayStatus, WeekReview } from '../analytics/weekReview'
import { iconOf, typeLabelOf } from '../analytics/workouts'

const STATUS: Record<DayStatus, { icon: string; label: string; className: string }> = {
  done: { icon: '✅', label: '완료', className: 'text-teal-700' },
  partial: { icon: '🔸', label: '일부', className: 'text-amber-700' },
  missed: { icon: '❌', label: '놓침', className: 'text-rose-700' },
  rested: { icon: '😴', label: '휴식', className: 'text-slate-500' },
  extra: { icon: '➕', label: '추가', className: 'text-indigo-700' },
  upcoming: { icon: '⋯', label: '예정', className: 'text-slate-400' },
}

const km = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`

/** This week's plan (as of last Sunday) next to what was done each day. */
export default function WeekReviewCard({ review: r, today }: { review: WeekReview; today: string }) {
  const [open, setOpen] = useState(false)
  const pct = r.plannedKmSoFar ? Math.round((r.actualKm / r.plannedKmSoFar) * 100) : undefined
  const range = `${r.plan.start.slice(5).replace('-', '.')} ~ ${r.days.at(-1)!.date.slice(5).replace('-', '.')}`

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <button onClick={() => setOpen(!open)} className="flex w-full items-baseline justify-between text-left">
        <h2 className="font-semibold">이번 주 계획 vs 실제</h2>
        <span className="text-xs text-slate-500 tabular-nums">
          {range} {open ? '▲' : '▼'}
        </span>
      </button>

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm tabular-nums">
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-xs text-slate-500">러닝 거리</div>
          <div>
            <b className="text-lg">{km(r.actualKm)}</b> <span className="text-xs text-slate-500">/ 계획 {km(r.plannedKm)}</span>
          </div>
          {pct != null && <div className="text-[11px] text-slate-500">오늘까지 계획의 {pct}%</div>}
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-xs text-slate-500">계획한 운동</div>
          <div>
            <b className="text-lg">{r.doneSessions}</b> <span className="text-xs text-slate-500">/ {r.plannedSessions}회 완료</span>
          </div>
        </div>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-teal-700" style={{ width: `${Math.min(100, (r.actualKm / Math.max(1, r.plannedKm)) * 100)}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="list" aria-label="요일별 결과">
        {r.days.map((d) => {
          const s = STATUS[d.status]
          return (
            <div key={d.date} role="listitem" className={`rounded-lg py-1 text-[11px] ${d.date === today ? 'ring-2 ring-teal-700 ring-offset-1' : 'bg-slate-50'}`}>
              <div className="font-semibold">{d.dow}</div>
              <div className={`text-sm ${s.className}`} aria-label={s.label}>
                {s.icon}
              </div>
              <div className="text-slate-500 tabular-nums">{d.actualKm ? d.actualKm : d.plannedKm ? `(${d.plannedKm})` : ''}</div>
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">✅ 완료 · 🔸 일부 · ❌ 놓침 · 😴 휴식 · ➕ 계획 외 운동. 숫자는 실제 러닝 km, 괄호는 계획 km예요. 계획의 80% 이상 달리고 계획한 웨이트까지 하면 완료예요.</p>

      {open && (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {r.days.map((d) => (
            <li key={d.date} className="flex gap-3 py-2">
              <span className="w-8 shrink-0 text-center">
                <span className="block font-semibold">{d.dow}</span>
                <span className={`block text-xs ${STATUS[d.status].className}`}>{STATUS[d.status].label}</span>
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs text-slate-500">
                  계획: {d.planned.map((i) => `${i.title}${i.km ? ` ${i.km}km` : ''}`).join(' + ')}
                </p>
                <p>
                  실제:{' '}
                  {d.actual.length || d.strength
                    ? [
                        ...d.actual.map((a) => `${iconOf(a)} ${typeLabelOf(a)}${a.distanceKm ? ` ${km(a.distanceKm)}` : ''}`),
                        ...(d.strength && !d.actual.some((a) => a.kind === 'strength') ? ['🏋️ 웨이트'] : []),
                      ].join(' · ')
                    : d.date >= today
                      ? '-'
                      : '기록 없음'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!open && (
        <button onClick={() => setOpen(true)} className="mt-2 w-full text-xs text-teal-700">
          요일별로 자세히 보기
        </button>
      )}
    </div>
  )
}
