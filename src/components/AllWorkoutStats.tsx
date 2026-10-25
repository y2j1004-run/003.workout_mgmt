import { useState } from 'react'
import { weekStart } from '../analytics/home'
import { addDays } from '../analytics/stats'
import { allEntries, workoutStats } from '../analytics/workouts'
import type { DayEntry } from '../import/parseLog'
import BarChart from './charts/BarChart'

const PERIODS = [
  { id: '4w', label: '최근 4주' },
  { id: 'month', label: '이번 달' },
  { id: 'year', label: '올해' },
  { id: 'all', label: '전체' },
] as const
const ALL = '전체'

const hours = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.round((sec % 3600) / 60)}분` : `${Math.round(sec / 60)}분`)
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`

/** Every kind of workout together, or one type at a time: days, sessions, time and distance, and a weekly chart. */
export default function AllWorkoutStats({ days, today }: { days: DayEntry[]; today: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('4w')
  const [type, setType] = useState(ALL)
  const entries = allEntries(days)
  // types in the order of how often they were done
  const counts = new Map<string, { icon: string; n: number }>()
  for (const e of entries) counts.set(e.label, { icon: e.icon, n: (counts.get(e.label)?.n ?? 0) + 1 })
  const types = [...counts].sort((a, b) => b[1].n - a[1].n)
  const one = type !== ALL && counts.has(type) ? type : undefined

  const first = days[0]?.date ?? today
  const from = { '4w': addDays(today, -27), month: `${today.slice(0, 7)}-01`, year: `${today.slice(0, 4)}-01-01`, all: first }[period]
  const s = workoutStats(days, from, today, one)
  const spanDays = Math.max(1, Math.round((Date.parse(today) - Date.parse(from)) / 864e5) + 1)
  const km = s.byType.reduce((t, x) => t + x.km, 0)

  // last 12 weeks: active days for all, else distance (if the type has any) or sessions
  const mine = entries.filter((e) => !one || e.label === one)
  const byKm = !!one && mine.some((e) => (e.act?.distanceKm ?? 0) > 0)
  const start = weekStart(today)
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(start, -7 * (11 - i))).map((w) => {
    const inWeek = mine.filter((e) => e.date >= w && e.date <= addDays(w, 6))
    const value = !one ? new Set(inWeek.map((e) => e.date)).size : byKm ? Math.round(inWeek.reduce((t, e) => t + (e.act?.distanceKm ?? 0), 0) * 10) / 10 : inWeek.length
    return { label: w, value }
  })
  const unit = !one ? '운동한 날' : byKm ? '거리' : '횟수'
  const fmt = (v: number) => (!one ? `${v}일` : byKm ? `${v}km` : `${v}회`)

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-semibold">전체 운동</h2>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="종목">
        {[[ALL, ''] as const, ...types.map(([label, v]) => [label, v.icon] as const)].map(([label, icon]) => (
          <button key={label} onClick={() => setType(label)} aria-pressed={(one ?? ALL) === label} className={chip((one ?? ALL) === label)}>
            {icon ? `${icon} ` : ''}
            {label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2" role="group" aria-label="기간">
        {PERIODS.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)} aria-pressed={period === p.id} className={chip(period === p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label={one ? `${one} 한 날` : '운동한 날'} value={`${s.activeDays}일`} sub={`${spanDays}일 중 ${Math.round((s.activeDays / spanDays) * 100)}%`} />
        <Tile label="횟수" value={`${s.sessions}회`} sub={`주 ${Math.round((s.sessions / spanDays) * 7 * 10) / 10}회`} />
        {one && km > 0 ? (
          <Tile label="거리" value={`${Math.round(km).toLocaleString('ko-KR')}km`} sub={`주 ${Math.round((km / spanDays) * 7 * 10) / 10}km`} />
        ) : (
          <Tile label="운동 시간" value={s.sec ? hours(s.sec) : '-'} sub="기록된 것만" />
        )}
      </div>
      {one && km > 0 && s.sec > 0 && <p className="mt-2 text-xs text-slate-500">기록된 운동 시간 {hours(s.sec)}</p>}
      {!one && s.byType.length > 0 && (
        <table className="mt-3 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="font-normal">종류</th>
              <th className="text-right font-normal">횟수</th>
              <th className="text-right font-normal">거리</th>
              <th className="text-right font-normal">시간</th>
            </tr>
          </thead>
          <tbody>
            {s.byType.map((t) => (
              <tr key={t.label} className="border-t border-slate-100">
                <td className="py-1.5">
                  <button onClick={() => setType(t.label)} className="text-left text-teal-800">
                    {t.icon} {t.label}
                  </button>
                </td>
                <td className="text-right">{t.count}회</td>
                <td className="text-right">{t.km ? `${t.km.toLocaleString('ko-KR')}km` : '-'}</td>
                <td className="text-right">{t.sec ? hours(t.sec) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4">
        <BarChart
          data={weeks}
          height={150}
          axisLabel={(w, i) => (i % 3 === 0 || i === 11 ? `${Number(w.slice(5, 7))}/${Number(w.slice(8))}` : '')}
          format={(d) => `${d.label.slice(5).replace('-', '.')} 주 · ${unit} ${fmt(d.value)}`}
        />
        <p className="text-xs text-slate-400">
          주별 {one ? `${one} ${unit}` : unit} (최근 12주){!one && ' · 종류를 누르면 그 종목만 볼 수 있어요'}
        </p>
      </div>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-bold whitespace-nowrap tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 tabular-nums">{sub}</div>}
    </div>
  )
}
