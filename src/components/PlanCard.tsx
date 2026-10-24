import { useState } from 'react'
import type { WeekPlan, PlanKind } from '../analytics/plan'
import { daysUntil, type UpcomingRace } from '../db/upcoming'

const STYLE: Record<PlanKind, string> = {
  race: 'bg-rose-600 text-white',
  long: 'bg-teal-700 text-white',
  quality: 'bg-rose-100 text-rose-800',
  easy: 'bg-teal-50 text-teal-800',
  strength: 'bg-amber-100 text-amber-800',
  rest: 'bg-slate-100 text-slate-500',
}
const ICON: Record<PlanKind, string> = { race: '', long: '🏃', quality: '⚡', easy: '🏃', strength: '🏋️', rest: '😴' }

/** Next week's suggested schedule, worked out from the records. */
export default function PlanCard({ plan, today, nextRace }: { plan: WeekPlan; today: string; nextRace?: UpcomingRace }) {
  const race = plan.race ?? nextRace
  const [open, setOpen] = useState(true)
  const range = `${plan.start.slice(5).replace('-', '.')} ~ ${plan.days.at(-1)!.date.slice(5).replace('-', '.')}`
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <button onClick={() => setOpen(!open)} className="flex w-full items-baseline justify-between text-left">
        <h2 className="font-semibold">다음 주 추천 운동</h2>
        <span className="text-xs text-slate-500 tabular-nums">
          {range} · 러닝 {plan.targetKm}km {open ? '▲' : '▼'}
        </span>
      </button>
      {race && (
        <p className="mt-1 text-sm font-semibold text-rose-700">
          🏁 {race.name} D-{daysUntil(race, today)}
          <span className="ml-1 text-xs font-normal text-slate-500">({race.date.slice(5).replace('-', '.')})</span>
        </p>
      )}
      {open && (
        <>
          <ul className="mt-3 divide-y divide-slate-100">
            {plan.days.map((d) => (
              <li key={d.date} className="flex gap-3 py-2">
                <span className="w-8 shrink-0 text-center">
                  <span className="block text-sm font-semibold">{d.dow}</span>
                  <span className="block text-[11px] text-slate-400 tabular-nums">{Number(d.date.slice(8))}일</span>
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  {d.items.map((it, i) => (
                    <div key={i}>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE[it.kind]}`}>
                        {ICON[it.kind]} {it.title}
                        {it.km ? ` ${it.km}km` : ''}
                      </span>
                      {it.detail && <p className="mt-0.5 text-xs text-slate-500">{it.detail}</p>}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
            <p className="mb-1 text-xs font-semibold text-slate-600">이렇게 짠 이유</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
              {plan.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-xs text-slate-400">최근 기록·인바디·목표로 계산한 참고용 계획이에요. 몸 상태가 안 좋으면 쉬는 게 먼저예요.</p>
        </>
      )}
    </div>
  )
}
