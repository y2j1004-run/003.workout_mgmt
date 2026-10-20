import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { goalProgress, runStreak, weekSummary } from '../analytics/home'
import { bodyFatSeries, runsOf } from '../analytics/stats'
import { db } from '../db/db'
import { customGoalRatio, getCustomGoals, getGoals, updateCustomGoal } from '../db/goals'
import { getProfile } from '../db/profile'
import { pickGreeting } from '../analytics/greeting'
import type { InBodyRecord } from '../inbody/inbody'

const km = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export default function Home() {
  const days = useLiveQuery(() => db.days.orderBy('date').toArray())
  const inbody = useLiveQuery(() => db.inbody.orderBy('date').toArray())
  const goals = useLiveQuery(getGoals)
  const custom = useLiveQuery(getCustomGoals)
  const profile = useLiveQuery(getProfile)
  if (!days || !inbody || !goals || !custom || !profile) return null

  const now = today()
  const dateLabel = new Date(`${now}T00:00:00`).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  if (!days.length && !inbody.length) {
    return (
      <section className="space-y-4">
        <Header date={dateLabel} name={profile.name} sports={profile.sports} />
        <Card title="시작하기">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>⚙️ 설정 → 운동 기록 가져오기로 메모장 기록을 넣거나</li>
            <li>💪 운동 탭에서 오늘 러닝을 기록하세요.</li>
            <li>⚖️ 인바디 탭에서 측정값을 넣으면 여기에 변화가 나옵니다.</li>
          </ul>
        </Card>
      </section>
    )
  }

  const week = weekSummary(days, now)
  const streak = runStreak(days, now)
  const bodyFat = bodyFatSeries(days, inbody)
  const weights = inbody.filter((r) => r.weightKg != null)
  const progress = goalProgress(goals, days, now, {
    bodyFatPct: bodyFat.at(-1)?.value,
    startBodyFatPct: bodyFat[0]?.value,
    weightKg: weights.at(-1)?.weightKg,
    startWeightKg: weights[0]?.weightKg,
  })
  const recent = runsOf(days).slice(-3).reverse()
  const diff = Math.round((week.km - week.lastWeekKmSoFar) * 10) / 10
  const maxDay = Math.max(...week.byDay, 1)
  const todayIndex = (new Date(`${now}T00:00:00Z`).getUTCDay() + 6) % 7

  return (
    <section className="space-y-4">
      <Header date={dateLabel} streak={streak} name={profile.name} sports={profile.sports} />

      <Card title="이번 주">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-3xl font-bold tabular-nums">{km(week.km)}</div>
            <div className="text-xs text-slate-500 tabular-nums">
              지난주 같은 요일까지보다 {diff === 0 ? '같음' : `${diff > 0 ? '+' : ''}${km(diff)}`}
            </div>
          </div>
          <div className="text-right text-sm tabular-nums">
            <div>러닝 {week.runDays}일</div>
            <div>웨이트 {week.strengthDays}일</div>
          </div>
        </div>
        <div className="mt-4 flex h-20 items-end gap-1.5" role="img" aria-label="요일별 러닝 거리">
          {week.byDay.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-slate-500 tabular-nums">{v ? v : ''}</span>
              <div
                className={`w-full max-w-6 rounded-t ${i === todayIndex ? 'bg-teal-700' : 'bg-teal-700/50'}`}
                style={{ height: `${v ? Math.max(4, (v / maxDay) * 48) : 2}px`, opacity: i > todayIndex ? 0.25 : 1 }}
              />
              <span className={`text-xs ${i === todayIndex ? 'font-bold text-teal-700' : 'text-slate-500'}`}>{WEEKDAYS[i]}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="목표">
        {progress.length || custom.length ? (
          <>
            <ul className="space-y-3">
              {progress.map((g) => (
                <li key={g.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">
                      {g.label} {g.done && <span className="text-teal-700">✓</span>}
                    </span>
                    <span className="tabular-nums">
                      {g.current != null ? `${g.current}${g.unit}` : '-'} <span className="text-xs text-slate-500">/ {g.target}{g.unit}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-teal-700" style={{ width: `${Math.round(g.ratio * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {custom.length > 0 && (
              <ul className={`space-y-3 ${progress.length ? 'mt-3 border-t border-slate-100 pt-3' : ''}`}>
                {custom.map((g) => (
                  <li key={g.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <label className="flex min-w-0 items-center gap-2 font-semibold">
                        <input type="checkbox" checked={!!g.done} onChange={(e) => updateCustomGoal(g.id, { done: e.target.checked })} className="h-4 w-4 shrink-0 accent-teal-700" />
                        <span className={g.done ? 'text-slate-400 line-through' : ''}>{g.title}</span>
                      </label>
                      <span className="shrink-0 tabular-nums">
                        {g.target != null ? (
                          <>
                            {g.current ?? '-'}
                            {g.unit ?? ''} <span className="text-xs text-slate-500">/ {g.target}{g.unit ?? ''}</span>
                        </>
                      ) : null}
                      {g.due && <span className="ml-1 text-xs text-slate-500">~{g.due.slice(5).replace('-', '.')}</span>}
                    </span>
                  </div>
                  {g.target != null && (
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-teal-700" style={{ width: `${Math.round(customGoalRatio(g) * 100)}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          </>
        ) : (
          <p className="text-sm text-slate-500">⚙️ 설정 → 목표 설정에서 주간 거리나 목표 체지방률을 정하거나, 나만의 목표를 추가하면 여기에 나옵니다.</p>
        )}
      </Card>

      <LatestBody inbody={inbody} bodyFat={bodyFat} />

      {recent.length > 0 && (
        <Card title="최근 러닝">
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((r, i) => (
              <li key={`${r.date}${i}`} className="flex items-baseline justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  <span className="tabular-nums">{r.date.slice(5).replace('-', '.')}</span>
                  <span className="ml-2 text-xs text-slate-500">{r.event ?? r.place ?? ''}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <b>{km(r.distanceKm)}</b>
                  {r.shoe && <span className="ml-1 text-xs text-slate-500">👟 {r.shoe}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}

const LAST_GREETING = 'last-greeting'

/** A new greeting each time the home tab opens, remembering the last one so it doesn't repeat. */
function useGreeting(): string {
  const [greeting] = useState(() => {
    let last: string | undefined
    try {
      last = localStorage.getItem(LAST_GREETING) ?? undefined
    } catch {
      // without storage a repeat now and then is fine
    }
    const g = pickGreeting(new Date().getHours(), last)
    try {
      localStorage.setItem(LAST_GREETING, g)
    } catch {
      // ignore
    }
    return g
  })
  return greeting
}

function Header({ date, streak = 0, name, sports }: { date: string; streak?: number; name?: string; sports?: string[] }) {
  const greeting = useGreeting()
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h1 className="text-xl font-bold break-keep">
          {name ? `${name}님, ` : ''}
          {greeting}
        </h1>
        <p className="text-sm text-slate-500">
          {date}
          {sports?.length ? ` · ${sports.join(' · ')}` : ''}
        </p>
      </div>
      {streak >= 2 && <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 tabular-nums">🔥 {streak}일 연속 러닝</span>}
    </div>
  )
}

function LatestBody({ inbody, bodyFat }: { inbody: InBodyRecord[]; bodyFat: { date: string; value: number }[] }) {
  const last = inbody.at(-1)
  const prev = inbody.at(-2)
  if (!last && !bodyFat.length) return null
  const delta = (a?: number, b?: number, unit = '') => {
    if (a == null || b == null) return undefined
    const d = Math.round((a - b) * 10) / 10
    return `${d > 0 ? '+' : ''}${d}${unit}`
  }
  if (!last) {
    const bf = bodyFat.at(-1)!
    const before = bodyFat.at(-2)
    return (
      <Card title={`체지방률 · ${bf.date}`}>
        <div className="text-3xl font-bold tabular-nums">{bf.value}%</div>
        {before && <div className="text-xs text-slate-500 tabular-nums">지난 측정보다 {delta(bf.value, before.value, '%p')}</div>}
      </Card>
    )
  }
  const tiles: [string, number | undefined, string, string | undefined][] = [
    ['체중', last.weightKg, 'kg', delta(last.weightKg, prev?.weightKg, 'kg')],
    ['골격근량', last.skeletalMuscleKg, 'kg', delta(last.skeletalMuscleKg, prev?.skeletalMuscleKg, 'kg')],
    ['체지방률', last.bodyFatPct, '%', delta(last.bodyFatPct, prev?.bodyFatPct, '%p')],
  ]
  return (
    <Card title={`최근 인바디 · ${last.date}`}>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([label, v, unit, d]) => (
          <div key={label}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-lg font-bold tabular-nums">{v != null ? `${v}${unit}` : '-'}</div>
            {d && <div className="text-xs text-slate-500 tabular-nums">{d}</div>}
          </div>
        ))}
      </div>
      {prev && <p className="mt-2 text-xs text-slate-400">지난 측정({prev.date})과 비교</p>}
    </Card>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  )
}
