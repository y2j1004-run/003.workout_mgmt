import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { fmtTime, RACE_DISTANCES } from '../analytics/stats'
import { parseGoalValue } from '../db/goals'
import { addRace } from '../db/db'
import { addUpcomingRace, daysUntil, deleteUpcomingRace, getUpcomingRaces, type UpcomingRace } from '../db/upcoming'

const input = 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900'
const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

/** Races the user has entered; the home tab's weekly plan tapers toward the next one. */
export default function UpcomingRacesCard() {
  const races = useLiveQuery(getUpcomingRaces)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [preset, setPreset] = useState<number | undefined>(21.0975)
  const [customKm, setCustomKm] = useState('')
  const [goal, setGoal] = useState('')
  const [msg, setMsg] = useState('')
  if (!races) return null
  const now = today()
  const km = preset ?? Number(customKm)
  const goalSec = parseGoalValue(goal)
  const goalOk = !goal.trim() || (!!goalSec?.time && goalSec.value > 0)
  const valid = !!name.trim() && !!date && date >= now && km > 0 && goalOk
  const upcoming = races.filter((r) => r.date >= now)
  const past = races.filter((r) => r.date < now)

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">다가오는 대회</h2>
      <p className="mb-3 text-sm text-slate-500">대회를 넣으면 홈의 "다음 주 추천 운동"이 대회에 맞춰 거리를 줄이고(테이퍼링) 대회 주간 계획을 짜 줍니다.</p>
      {upcoming.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100">
          {upcoming.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold">🏁 {r.name}</span>
                <span className="ml-1 text-xs text-slate-500 tabular-nums">
                  {r.date.slice(2).replaceAll('-', '.')} · {Math.round(r.distanceKm * 10) / 10}km{r.goalSec ? ` · 목표 ${fmtTime(r.goalSec)}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 tabular-nums">D-{daysUntil(r, now)}</span>
                <button onClick={() => confirm(`'${r.name}' 대회를 지울까요?`) && deleteUpcomingRace(r.id)} className="text-xs text-slate-400">
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <label className="block text-xs text-slate-500">
        대회 이름
        <input id="race-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: JTBC 마라톤" className={input} />
      </label>
      <label className="mt-2 block text-xs text-slate-500">
        날짜
        <input id="race-date" type="date" min={now} value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      </label>
      <p className="mt-2 mb-1 text-xs text-slate-500">거리</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {RACE_DISTANCES.map((d) => (
          <button key={d.label} type="button" onClick={() => setPreset(d.km)} className={chip(preset === d.km)}>
            {d.label}
          </button>
        ))}
        <input
          id="race-km"
          type="number"
          inputMode="decimal"
          value={customKm}
          onFocus={() => setPreset(undefined)}
          onChange={(e) => {
            setPreset(undefined)
            setCustomKm(e.target.value)
          }}
          placeholder="직접(km)"
          className={`w-24 rounded-full border px-3 py-1 text-xs ${preset == null ? 'border-teal-700' : 'border-slate-300'}`}
        />
      </div>
      <label className="mt-2 block text-xs text-slate-500">
        목표 기록 (선택)
        <input id="race-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="예: 1:40:00" inputMode="numeric" className={input} />
      </label>
      {!goalOk && <p className="mt-1 text-xs text-amber-700">1:40:00이나 45:00처럼 시간으로 넣어 주세요.</p>}
      <button
        disabled={!valid}
        onClick={async () => {
          await addUpcomingRace({ name: name.trim(), date, distanceKm: km, goalSec: goalSec?.value })
          setMsg(`'${name.trim()}' 대회를 추가했습니다.`)
          setName('')
          setDate('')
          setGoal('')
        }}
        className="mt-3 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40"
      >
        대회 추가
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
      {past.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="text-sm font-semibold">끝난 대회 · 기록 입력</h3>
          <p className="mb-2 text-xs text-slate-500">기록을 넣으면 통계 → 대회 기록으로 옮겨지고, 추천 운동의 페이스 계산에 쓰여요.</p>
          <ul className="divide-y divide-slate-100">
            {past.map((r) => (
              <PastRace key={r.id} race={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function PastRace({ race: r }: { race: UpcomingRace }) {
  const [time, setTime] = useState('')
  const sec = parseGoalValue(time)
  const ok = !!sec?.time && sec.value > 0
  return (
    <li className="py-2 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">🏁 {r.name}</span>
        <span className="text-xs text-slate-500 tabular-nums">
          {r.date.slice(2).replaceAll('-', '.')} · {Math.round(r.distanceKm * 10) / 10}km
        </span>
      </div>
      <div className="mt-1 flex gap-2">
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="완주 기록 1:33:20"
          inputMode="numeric"
          aria-label={`${r.name} 완주 기록`}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          disabled={!ok}
          onClick={async () => {
            await addRace(r.date, r.name, r.distanceKm, sec!.value)
            await deleteUpcomingRace(r.id)
          }}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          기록 저장
        </button>
        <button onClick={() => confirm(`'${r.name}'을(를) 목록에서 지울까요?`) && deleteUpcomingRace(r.id)} className="px-1 text-xs text-slate-400">
          삭제
        </button>
      </div>
    </li>
  )
}
