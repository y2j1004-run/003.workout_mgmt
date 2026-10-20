import { useState, type ReactNode } from 'react'
import { fmtTime, isRace, personalBests, RACE_DISTANCES, races, type RaceRow } from '../analytics/stats'
import { addRace, editRace, type StoredDay } from '../db/db'

const km = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}km`
/** "하프" / "풀" / "10K" for standard distances, otherwise the distance in km */
const distanceLabel = (d: number) => RACE_DISTANCES.find((x) => Math.abs(x.km - d) < 0.001)?.label ?? km(d)
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export default function RaceRecords({ days }: { days: StoredDay[] }) {
  const list = races(days)
  const pbs = personalBests(list)
  const [editing, setEditing] = useState<string>()
  const [adding, setAdding] = useState(false)

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">대회 기록</h2>
        <button onClick={() => setAdding(!adding)} className="text-sm text-teal-700">
          {adding ? '닫기' : '+ 대회 추가'}
        </button>
      </div>

      {pbs.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pbs.map(({ label, race }) => (
            <span key={label} className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800 tabular-nums">
              {label} 최고 <b>{fmtTime(race.durationSec!)}</b>
            </span>
          ))}
        </div>
      )}

      {adding && <AddRace days={days} onDone={() => setAdding(false)} />}

      {list.length === 0 && !adding && <p className="text-sm text-slate-500">아직 대회 기록이 없습니다. "+ 대회 추가"로 넣을 수 있습니다.</p>}

      <ul className="divide-y divide-slate-100 text-sm">
        {list.map((r) => {
          const key = `${r.date}#${r.index}`
          return (
            <li key={key} className="py-2">
              <button onClick={() => setEditing(editing === key ? undefined : key)} className="flex w-full items-baseline justify-between gap-2 text-left">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.event ?? '대회'}</div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {r.date} · {distanceLabel(r.raceDistanceKm ?? r.distanceKm)}
                  </div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <div className="font-semibold">{r.durationSec ? fmtTime(r.durationSec) : <span className="text-amber-600">기록 없음</span>}</div>
                  {r.paceSecPerKm ? <div className="text-xs text-slate-500">{fmtTime(r.paceSecPerKm)}/km</div> : null}
                </div>
              </button>
              {editing === key && <EditRace race={r} onDone={() => setEditing(undefined)} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EditRace({ race, onDone }: { race: RaceRow; onDone: () => void }) {
  const [form, setForm] = useState<RaceForm>(() => ({
    event: race.event ?? '',
    distance: race.raceDistanceKm ?? race.distanceKm,
    ...splitTime(race.durationSec),
  }))
  const id = `${race.date}-${race.index}`
  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
      <RaceFields id={id} form={form} setForm={setForm} loggedKm={race.distanceKm} />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            await editRace(race.date, race.index, {
              event: form.event.trim(),
              raceDistanceKm: Math.abs(form.distance - race.distanceKm) < 0.001 ? null : form.distance,
              durationSec: joinTime(form) ?? null,
            })
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
      <button
        onClick={async () => {
          await editRace(race.date, race.index, { race: false })
          onDone()
        }}
        className="w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600"
      >
        대회가 아님 (목록에서 빼기)
      </button>
    </div>
  )
}

function AddRace({ days, onDone }: { days: StoredDay[]; onDone: () => void }) {
  const [date, setDate] = useState(today)
  const [pick, setPick] = useState<number | 'new'>('new')
  const [form, setForm] = useState<RaceForm>({ event: '', distance: 10, h: '', m: '', s: '' })
  const dayRuns = (days.find((d) => d.date === date)?.activities ?? []).map((a, index) => ({ a, index })).filter(({ a }) => a.kind === 'run' && !isRace(a))
  const valid = form.event.trim() && form.distance > 0

  const save = async () => {
    if (pick === 'new') await addRace(date, form.event.trim(), form.distance, joinTime(form))
    else {
      const run = dayRuns.find((r) => r.index === pick)!.a
      await editRace(date, pick, {
        race: true,
        event: form.event.trim(),
        raceDistanceKm: Math.abs(form.distance - run.distanceKm) < 0.001 ? null : form.distance,
        durationSec: joinTime(form) ?? null,
      })
    }
    onDone()
  }

  return (
    <div className="mb-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
      <Field label="날짜">
        <input
          id="race-date"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPick('new')
          }}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
        />
      </Field>
      {dayRuns.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">이날 기록된 러닝을 대회로 바꾸거나, 새로 추가할 수 있습니다.</p>
          {dayRuns.map(({ a, index }) => (
            <label key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name="race-pick"
                checked={pick === index}
                onChange={() => {
                  setPick(index)
                  setForm({ ...form, event: form.event || a.event || a.place || '', distance: a.raceDistanceKm ?? a.distanceKm, ...splitTime(a.durationSec) })
                }}
              />
              {km(a.distanceKm)} {a.event ?? a.place ?? ''}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="radio" name="race-pick" checked={pick === 'new'} onChange={() => setPick('new')} />새 기록으로 추가
          </label>
        </div>
      )}
      <RaceFields id="new-race" form={form} setForm={setForm} />
      <button onClick={save} disabled={!valid} className="w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40">
        대회 저장
      </button>
    </div>
  )
}

interface RaceForm {
  event: string
  distance: number
  h: string
  m: string
  s: string
}

function RaceFields({ id, form, setForm, loggedKm }: { id: string; form: RaceForm; setForm: (f: RaceForm) => void; loggedKm?: number }) {
  const preset = RACE_DISTANCES.find((d) => Math.abs(d.km - form.distance) < 0.001)
  return (
    <>
      <Field label="대회명">
        <input id={`${id}-name`} value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5" />
      </Field>
      <Field label="대회 거리">
        <div className="flex flex-wrap items-center gap-1">
          {RACE_DISTANCES.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setForm({ ...form, distance: d.km })}
              className={`rounded-full border px-3 py-1 text-xs ${preset?.km === d.km ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white'}`}
            >
              {d.label}
            </button>
          ))}
          <input
            id={`${id}-km`}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={form.distance}
            onChange={(e) => setForm({ ...form, distance: Number(e.target.value) })}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right tabular-nums"
          />
          km
        </div>
        {loggedKm != null && Math.abs(loggedKm - form.distance) >= 0.001 && <p className="mt-1 text-xs text-slate-500">그날 달린 거리 {km(loggedKm)}는 그대로 두고, 페이스는 대회 거리로 계산합니다.</p>}
      </Field>
      <Field label="기록">
        <div className="flex items-center gap-1 tabular-nums">
          {(['h', 'm', 's'] as const).map((k, i) => (
            <span key={k} className="flex items-center gap-1">
              <input
                id={`${id}-${k}`}
                type="number"
                inputMode="numeric"
                min="0"
                max={k === 'h' ? 23 : 59}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-right"
              />
              {['시간', '분', '초'][i]}
            </span>
          ))}
        </div>
      </Field>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-slate-500">{label}</div>
      {children}
    </div>
  )
}

function splitTime(sec?: number): Pick<RaceForm, 'h' | 'm' | 's'> {
  if (!sec) return { h: '', m: '', s: '' }
  return { h: String(Math.floor(sec / 3600)), m: String(Math.floor((sec % 3600) / 60)), s: String(sec % 60) }
}

function joinTime(f: Pick<RaceForm, 'h' | 'm' | 's'>): number | undefined {
  const total = Number(f.h || 0) * 3600 + Number(f.m || 0) * 60 + Number(f.s || 0)
  return total > 0 ? total : undefined
}
