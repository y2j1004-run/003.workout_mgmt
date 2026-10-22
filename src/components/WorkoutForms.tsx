import { useState, type ReactNode } from 'react'
import { isOfType, STRENGTH_EXERCISES, workoutsOf, type DatedWorkout, type WorkoutType } from '../analytics/workouts'
import { addWorkout, deleteRun, setMemo, type StoredDay } from '../db/db'
import type { Feeling } from '../import/parseLog'
import MemoInput, { MemoLine } from './MemoInput'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const input = 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900'
const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`

/** Walk, hike or ball sport: date plus distance, time and place as the type needs. */
export function WorkoutForm({ type, days }: { type: WorkoutType; days: StoredDay[] }) {
  const [date, setDate] = useState(today)
  const [sport, setSport] = useState('')
  const [distance, setDistance] = useState('')
  const [minutes, setMinutes] = useState('')
  const [place, setPlace] = useState('')
  const [memo, setMemo] = useState('')
  const [feeling, setFeeling] = useState<Feeling>()
  const [msg, setMsg] = useState('')
  const places = [...new Set(workoutsOf(days, type).map((w) => w.place).filter((p): p is string => !!p))].slice(0, 6)
  const km = Number(distance)
  const min = Number(minutes)
  const name = type.custom ? sport.trim() : type.label
  const valid = (!type.custom || !!name) && (!distance.trim() || km > 0) && (!minutes.trim() || min > 0)

  const save = async () => {
    await addWorkout(date, {
      kind: type.kind,
      distanceKm: type.distance && km > 0 ? km : 0,
      durationSec: min > 0 ? Math.round(min * 60) : undefined,
      place,
      sport: type.kind === 'sport' ? name : undefined,
      memo,
      feeling,
    })
    const parts = [type.distance && km > 0 && `${km}km`, min > 0 && `${min}분`, place.trim()].filter(Boolean)
    setMsg(`${date.slice(5).replace('-', '.')} ${name}${parts.length ? ` · ${parts.join(' · ')}` : ''} 저장했습니다.`)
    setDistance('')
    setMinutes('')
    setPlace('')
    setMemo('')
    setFeeling(undefined)
  }

  return (
    <Card title={`${type.custom ? '기타 운동' : type.label} 기록하기`}>
      {type.custom && (
        <label className="mb-2 block text-xs text-slate-500">
          운동 이름
          <input id="workout-sport" value={sport} onChange={(e) => setSport(e.target.value)} placeholder="예: 수영, 요가, 자전거" className={input} />
        </label>
      )}
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate-500">
          날짜
          <input id="workout-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        {type.distance && (
          <label className="w-24 text-xs text-slate-500">
            거리(km)
            <input id="workout-km" type="number" inputMode="decimal" step="0.1" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} className={input} />
          </label>
        )}
        <label className="w-24 text-xs text-slate-500">
          시간(분)
          <input id="workout-min" type="number" inputMode="numeric" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={input} />
        </label>
      </div>
      {type.place && (
        <>
          <label className="mt-3 block text-xs text-slate-500">
            장소
            <input id="workout-place" value={place} onChange={(e) => setPlace(e.target.value)} className={input} />
          </label>
          {places.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {places.map((p) => (
                <button key={p} onClick={() => setPlace(place === p ? '' : p)} className={chip(place === p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="mt-3">
        <MemoInput id="workout-memo" memo={memo} feeling={feeling} onMemo={setMemo} onFeeling={setFeeling} />
      </div>
      <button onClick={save} disabled={!valid} className="mt-4 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-40">
        저장
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </Card>
  )
}

/** Strength session: date, exercises (preset or typed) and time. */
export function StrengthForm({ days }: { days: StoredDay[] }) {
  const [date, setDate] = useState(today)
  const [picked, setPicked] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [minutes, setMinutes] = useState('')
  const [memo, setMemo] = useState('')
  const [feeling, setFeeling] = useState<Feeling>()
  const [msg, setMsg] = useState('')
  // exercises typed before show up as chips too
  const typed = days.flatMap((d) => d.activities.flatMap((a) => (a.kind === 'strength' && !a.deleted ? (a.exercises ?? []) : [])))
  const options = [...new Set([...STRENGTH_EXERCISES, ...typed, ...picked])]
  const toggle = (x: string) => setPicked(picked.includes(x) ? picked.filter((p) => p !== x) : [...picked, x])
  const addCustom = () => {
    const x = custom.trim()
    if (x && !picked.includes(x)) setPicked([...picked, x])
    setCustom('')
  }
  const min = Number(minutes)

  return (
    <Card title="웨이트 기록하기">
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate-500">
          날짜
          <input id="strength-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        <label className="w-24 text-xs text-slate-500">
          시간(분)
          <input id="strength-min" type="number" inputMode="numeric" min="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={input} />
        </label>
      </div>
      <p className="mt-3 mb-1 text-xs text-slate-500">운동 항목 (여러 개 고를 수 있어요)</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((x) => (
          <button key={x} type="button" onClick={() => toggle(x)} className={chip(picked.includes(x))}>
            {x}
          </button>
        ))}
        <input
          id="strength-custom"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          onBlur={addCustom}
          placeholder="직접 입력"
          className="w-28 rounded-full border border-slate-300 px-3 py-1 text-xs"
        />
      </div>
      <div className="mt-3">
        <MemoInput id="strength-memo" memo={memo} feeling={feeling} onMemo={setMemo} onFeeling={setFeeling} />
      </div>
      <button
        onClick={async () => {
          await addWorkout(date, { kind: 'strength', exercises: picked, durationSec: min > 0 ? Math.round(min * 60) : undefined, memo, feeling })
          setMsg(`${date.slice(5).replace('-', '.')} 웨이트${picked.length ? ` · ${picked.join(', ')}` : ''} 저장했습니다.`)
          setPicked([])
          setMinutes('')
          setMemo('')
          setFeeling(undefined)
        }}
        disabled={!picked.length || (!!minutes.trim() && !(min > 0))}
        className="mt-4 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-40"
      >
        저장
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </Card>
  )
}

/** Recent entries of one menu entry; app entries can be deleted. For strength, log days without details are listed too. */
export function WorkoutHistory({ type, days }: { type: WorkoutType; days: StoredDay[] }) {
  const [limit, setLimit] = useState(10)
  const [editing, setEditing] = useState<string>()
  const items: { key: string; date: string; text: string; sub?: string; act?: DatedWorkout }[] = workoutsOf(days, type).map((w) => ({
    key: `${w.date}#${w.index}`,
    date: w.date,
    text: [
      type.custom && w.sport,
      w.kind === 'strength' && (w.exercises?.join(', ') || '웨이트'),
      w.distanceKm > 0 && `${w.distanceKm}km`,
      w.durationSec && fmtMinutes(w.durationSec),
    ]
      .filter(Boolean)
      .join(' · '),
    sub: w.place,
    act: w,
  }))
  if (type.kind === 'strength') {
    for (const d of days) {
      if (d.strength?.done && !d.activities.some((a) => isOfType(a, type) && !a.deleted)) {
        items.push({ key: d.date, date: d.date, text: d.strength.parts.length ? d.strength.parts.join(', ') : '웨이트' })
      }
    }
    items.sort((a, b) => b.date.localeCompare(a.date))
  }
  if (!items.length) return null

  return (
    <Card title={`최근 ${type.custom ? '기타 운동' : type.label}`}>
      <ul className="divide-y divide-slate-100 text-sm">
        {items.slice(0, limit).map((i) => (
          <li key={i.key} className="py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-semibold tabular-nums">{i.date.slice(2).replaceAll('-', '.')}</span>
                <span className="ml-2">{i.text}</span>
                {i.sub && <span className="ml-1 text-xs text-slate-500">· {i.sub}</span>}
              </span>
              {i.act && (
                <span className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(editing === i.key ? undefined : i.key)} className="px-1 text-xs text-teal-700">
                    소감
                  </button>
                  {i.act.source === 'app' && (
                    <button onClick={() => confirm(`${i.date} 기록을 지울까요?`) && deleteRun(i.act!.date, i.act!.index)} className="px-1 text-xs text-slate-400">
                      삭제
                    </button>
                  )}
                </span>
              )}
            </div>
            {i.act && editing !== i.key && <MemoLine memo={i.act.memo} feeling={i.act.feeling} />}
            {i.act && editing === i.key && <MemoEditor act={i.act} onDone={() => setEditing(undefined)} />}
          </li>
        ))}
      </ul>
      {items.length > limit && (
        <button onClick={() => setLimit(limit + 20)} className="mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm">
          더 보기 ({items.length - limit}개 남음)
        </button>
      )}
    </Card>
  )
}

function MemoEditor({ act, onDone }: { act: DatedWorkout; onDone: () => void }) {
  const [memo, setMemoText] = useState(act.memo ?? '')
  const [feeling, setFeeling] = useState<Feeling | undefined>(act.feeling)
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-3">
      <MemoInput id={`memo-${act.date}-${act.index}`} memo={memo} feeling={feeling} onMemo={setMemoText} onFeeling={setFeeling} />
      <div className="mt-2 flex gap-2">
        <button
          onClick={async () => {
            await setMemo(act.date, act.index, memo, feeling)
            onDone()
          }}
          className="flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white"
        >
          저장
        </button>
        <button onClick={onDone} className="rounded-lg bg-slate-200 px-4 py-2">
          취소
        </button>
      </div>
    </div>
  )
}

function fmtMinutes(sec: number) {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  )
}
