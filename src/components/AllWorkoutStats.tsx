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

const hours = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.round((sec % 3600) / 60)}분` : `${Math.round(sec / 60)}분`)

/** Every kind of workout together: how many days and sessions, time and distance per type, and active days per week. */
export default function AllWorkoutStats({ days, today }: { days: DayEntry[]; today: string }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('4w')
  const first = days[0]?.date ?? today
  const from = { '4w': addDays(today, -27), month: `${today.slice(0, 7)}-01`, year: `${today.slice(0, 4)}-01-01`, all: first }[period]
  const s = workoutStats(days, from, today)
  const spanDays = Math.max(1, Math.round((Date.parse(today) - Date.parse(from)) / 864e5) + 1)

  // active days per week, last 12 weeks
  const entries = allEntries(days)
  const start = weekStart(today)
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(start, -7 * (11 - i))).map((w) => ({
    label: w,
    value: new Set(entries.filter((e) => e.date >= w && e.date <= addDays(w, 6)).map((e) => e.date)).size,
  }))

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-semibold">전체 운동</h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            aria-pressed={period === p.id}
            className={`rounded-full border px-3 py-1 text-xs ${period === p.id ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="운동한 날" value={`${s.activeDays}일`} sub={`${spanDays}일 중 ${Math.round((s.activeDays / spanDays) * 100)}%`} />
        <Tile label="운동 횟수" value={`${s.sessions}회`} sub={`주 ${Math.round((s.sessions / spanDays) * 7 * 10) / 10}회`} />
        <Tile label="운동 시간" value={s.sec ? hours(s.sec) : '-'} sub="기록된 것만" />
      </div>
      {s.byType.length > 0 && (
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
                  {t.icon} {t.label}
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
          format={(d) => `${d.label.slice(5).replace('-', '.')} 주 · 운동한 날 ${d.value}일`}
        />
        <p className="text-xs text-slate-400">주별 운동한 날 (최근 12주) · 시간은 시간이 기록된 운동만 더했어요</p>
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
