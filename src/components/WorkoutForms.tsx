import { useState, type ReactNode } from 'react'
import { durationOf, isOfType, STRENGTH_EXERCISES, workoutsOf, type DatedWorkout, type WorkoutType } from '../analytics/workouts'
import { addWorkout, deleteRun, editRun, type StoredDay } from '../db/db'
import type { DayEntry, Feeling } from '../import/parseLog'
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
                    {editing === i.key ? '닫기' : '수정'}
                  </button>
                </span>
              )}
            </div>
            {i.act && editing !== i.key && <MemoLine memo={i.act.memo} feeling={i.act.feeling} />}
            {i.act && editing === i.key && <WorkoutEditor act={i.act} days={days} onDone={() => setEditing(undefined)} />}
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

/** Edits any workout other than a run: date, numbers, place, sport name or exercises, and the note. */
export function WorkoutEditor({ act, days, onDone }: { act: DatedWorkout; days: DayEntry[]; onDone: () => void }) {
  const [date, setDate] = useState(act.date)
  const [distance, setDistance] = useState(act.distanceKm ? String(act.distanceKm) : '')
  const [minutes, setMinutes] = useState(durationOf(act) ? String(Math.round(durationOf(act)! / 60)) : '')
  const [place, setPlace] = useState(act.place ?? '')
  const [sport, setSport] = useState(act.sport ?? '')
  const [exercises, setExercises] = useState<string[]>(act.exercises ?? [])
  const [custom, setCustom] = useState('')
  const [memo, setMemoText] = useState(act.memo ?? '')
  const [feeling, setFeeling] = useState<Feeling | undefined>(act.feeling)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const key = `${act.date}-${act.index}`
  const hasDistance = act.kind === 'walk' || act.kind === 'hike'
  const km = Number(distance)
  const min = Number(minutes)
  const typed = days.flatMap((d) => d.activities.flatMap((a) => (a.kind === 'strength' && !a.deleted ? (a.exercises ?? []) : [])))
  const options = [...new Set([...STRENGTH_EXERCISES, ...typed, ...exercises])]
  const toggle = (x: string) => setExercises(exercises.includes(x) ? exercises.filter((e) => e !== x) : [...exercises, x])
  const addCustom = () => {
    const x = custom.trim()
    if (x && !exercises.includes(x)) setExercises([...exercises, x])
    setCustom('')
  }
  const valid = !!date && (!distance.trim() || km > 0) && (!minutes.trim() || min > 0) && (act.kind !== 'sport' || !!sport.trim())
  const field = 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900'

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
      {act.kind === 'sport' && (
        <label className="block text-xs text-slate-500">
          운동 이름
          <input id={`w-sport-${key}`} value={sport} onChange={(e) => setSport(e.target.value)} className={field} />
        </label>
      )}
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate-500">
          날짜
          <input id={`w-date-${key}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        {hasDistance && (
          <label className="w-20 text-xs text-slate-500">
            거리(km)
            <input id={`w-km-${key}`} type="number" inputMode="decimal" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} className={field} />
          </label>
        )}
        <label className="w-20 text-xs text-slate-500">
          시간(분)
          <input id={`w-min-${key}`} type="number" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field} />
        </label>
      </div>
      {act.kind === 'strength' ? (
        <div className="text-xs text-slate-500">
          운동 항목
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {options.map((x) => (
              <button key={x} type="button" onClick={() => toggle(x)} className={chip(exercises.includes(x))}>
                {x}
              </button>
            ))}
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              onBlur={addCustom}
              placeholder="직접 입력"
              aria-label="운동 항목 직접 입력"
              className="w-28 rounded-full border border-slate-300 px-3 py-1 text-xs"
            />
          </div>
        </div>
      ) : (
        <label className="block text-xs text-slate-500">
          장소
          <input id={`w-place-${key}`} value={place} onChange={(e) => setPlace(e.target.value)} className={field} />
        </label>
      )}
      <MemoInput id={`w-memo-${key}`} memo={memo} feeling={feeling} onMemo={setMemoText} onFeeling={setFeeling} />
      <div className="flex gap-2">
        <button
          disabled={!valid}
          onClick={async () => {
            await editRun(act.date, act.index, {
              date,
              distanceKm: hasDistance && km > 0 ? km : act.kind === 'run' ? act.distanceKm : 0,
              place: place.trim() || undefined,
              durationSec: min > 0 ? Math.round(min * 60) : undefined,
              memo,
              feeling,
              exercises: act.kind === 'strength' ? exercises : undefined,
              sport: act.kind === 'sport' ? sport.trim() : undefined,
            })
            onDone()
          }}
          className="flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40"
        >
          저장
        </button>
        <button onClick={onDone} className="rounded-lg bg-slate-200 px-4 py-2">
          취소
        </button>
      </div>
      {confirmDelete ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
          이 기록을 지울까요?
          <span className="flex gap-2">
            <button
              onClick={async () => {
                await deleteRun(act.date, act.index)
                onDone()
              }}
              className="rounded bg-red-700 px-3 py-1 font-semibold text-white"
            >
              삭제
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded bg-white px-3 py-1">
              아니요
            </button>
          </span>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="w-full text-xs text-red-700">
          이 기록 삭제
        </button>
      )}
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
