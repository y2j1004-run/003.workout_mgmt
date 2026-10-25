import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { ageOn, INTENSITY_LABEL, intensityOf, maxHeartRate, zoneOf } from '../analytics/fitness'
import { fmtTime, runsOf, shoeTotals } from '../analytics/stats'
import { INTENSITY_CHIP } from '../components/FitnessCards'
import MemoInput, { MemoLine } from '../components/MemoInput'
import ShoePicker from '../components/ShoePicker'
import ThemePicker from '../components/ThemePicker'
import { StrengthForm, WorkoutEditor, WorkoutForm, WorkoutHistory } from '../components/WorkoutForms'
import { allEntries, durationOf, WORKOUT_TYPES, type Entry } from '../analytics/workouts'
import { themeOf } from '../analytics/themes'
import { addRun, db, deleteRun, editRun, setRunShoe, updateShoe, type StoredDay } from '../db/db'
import { getProfile } from '../db/profile'
import type { Activity, Feeling } from '../import/parseLog'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const km = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`

const MENU_KEY = 'workout-menu'
const ALL = '전체'

function savedMenu(): string {
  try {
    return localStorage.getItem(MENU_KEY) ?? '러닝'
  } catch {
    return '러닝'
  }
}

export default function Workout() {
  const days = useLiveQuery(() => db.days.orderBy('date').toArray())
  const shoes = useLiveQuery(() => db.shoes.toArray())
  const [menu, setMenu] = useState(savedMenu)
  if (!days || !shoes) return null
  const all = menu === ALL
  const type = WORKOUT_TYPES.find((t) => t.label === menu) ?? WORKOUT_TYPES[0]
  const pick = (label: string) => {
    setMenu(label)
    try {
      localStorage.setItem(MENU_KEY, label)
    } catch {
      // remembering the menu is only a convenience
    }
  }

  const totals = shoeTotals(days, shoes)
  // shoes in rotation, most recently used first
  const active = totals
    .filter((t) => !t.retired)
    .sort((a, b) => (b.lastUsed ?? '').localeCompare(a.lastUsed ?? ''))
    .map((t) => t.shoe)

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">운동</h1>
      <nav aria-label="운동 종류" className="flex flex-wrap gap-1.5">
        {[ALL, ...WORKOUT_TYPES.map((t) => t.label)].map((label) => {
          const on = all ? label === ALL : label === type.label
          return (
            <button
              key={label}
              onClick={() => pick(label)}
              aria-pressed={on}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${on ? 'bg-teal-700 font-semibold text-white' : 'bg-white text-slate-700 shadow-sm'}`}
            >
              {label}
            </button>
          )
        })}
      </nav>
      {all ? (
        <AllWorkouts days={days} />
      ) : type.kind === 'run' ? (
        <>
          <RunForm shoes={active} places={recentPlaces(days)} />
          <RecentRuns days={days} shoes={active} />
          <MyShoes totals={totals} />
        </>
      ) : (
        <>
          {type.kind === 'strength' ? <StrengthForm days={days} /> : <WorkoutForm key={type.label} type={type} days={days} />}
          <WorkoutHistory type={type} days={days} />
        </>
      )}
    </section>
  )
}

/** Places of recent runs, most recent first. */
function recentPlaces(days: StoredDay[]): string[] {
  const seen = new Set<string>()
  for (const r of runsOf(days).reverse()) if (r.place) seen.add(r.place)
  return [...seen]
}

function RunForm({ shoes, places }: { shoes: string[]; places: string[] }) {
  const [date, setDate] = useState(today)
  const [distance, setDistance] = useState('')
  const [shoe, setShoe] = useState<string | undefined>(shoes[0])
  const [theme, setTheme] = useState<string>()
  const [place, setPlace] = useState('')
  const [memo, setMemo] = useState('')
  const [feeling, setFeeling] = useState<Feeling>()
  const [msg, setMsg] = useState('')
  const valid = Number(distance) > 0

  const save = async () => {
    if (!valid) return
    await addRun(date, Number(distance), { shoe, theme, place, memo, feeling })
    setMsg(`${date.slice(5).replace('-', '.')} 러닝 ${km(Number(distance))}${place.trim() ? ` · ${place.trim()}` : ''}${theme ? ` · ${theme}` : ''}${shoe ? ` · ${shoe}` : ''} 저장했습니다.`)
    setDistance('')
    setTheme(undefined)
    setPlace('')
    setMemo('')
    setFeeling(undefined)
  }

  return (
    <Card title="러닝 기록하기">
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate-500">
          날짜
          <input id="run-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" />
        </label>
        <label className="w-28 text-xs text-slate-500">
          거리(km)
          <input
            id="run-km"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="10.2"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs text-slate-500">
        장소
        <input
          id="run-place"
          list="run-place-list"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="예: 광교호수공원"
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
        />
      </label>
      <datalist id="run-place-list">
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      {places.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {places.slice(0, 6).map((p) => (
            <button
              key={p}
              onClick={() => setPlace(place === p ? '' : p)}
              className={`rounded-full px-2.5 py-1 text-xs ${place === p ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 mb-1 text-xs text-slate-500">러닝 주제</p>
      <ThemePicker key={msg} id="run-theme" value={theme} onPick={setTheme} />
      <p className="mt-3 mb-1 text-xs text-slate-500">신발</p>
      <ShoePicker id="run-shoe" options={shoes} value={shoe} onPick={setShoe} allowNone />
      <div className="mt-3">
        <MemoInput id="run-memo" memo={memo} feeling={feeling} onMemo={setMemo} onFeeling={setFeeling} />
      </div>
      <button onClick={save} disabled={!valid} className="mt-4 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-40">
        저장
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </Card>
  )
}

function RecentRuns({ days, shoes }: { days: StoredDay[]; shoes: string[] }) {
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [editing, setEditing] = useState<string>()
  const [editingRun, setEditingRun] = useState<string>()
  const [limit, setLimit] = useState(15)
  const profile = useLiveQuery(getProfile)
  const maxHr = maxHeartRate(runsOf(days), ageOn(profile?.birthYear, today()), profile?.maxHr)
  const runs = days
    .flatMap((d) => d.activities.map((a, i) => ({ ...a, date: d.date, index: i })))
    .filter((a) => a.kind === 'run' && !a.deleted && (!onlyMissing || !a.shoe))
    .reverse()

  if (!days.length) {
    return (
      <Card title="최근 러닝">
        <p className="text-sm text-slate-500">위에서 러닝을 저장하거나 ⚙️ 설정에서 기록을 가져오면 여기에 나옵니다.</p>
      </Card>
    )
  }

  return (
    <Card title="최근 러닝">
      <label className="mb-2 flex items-center gap-2 text-sm">
        <input id="only-missing-shoe" type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
        신발을 안 고른 러닝만
      </label>
      <ul className="divide-y divide-slate-100">
        {runs.slice(0, limit).map((r) => {
          const key = `${r.date}#${r.index}`
          return (
            <li key={key} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setEditingRun(editingRun === key ? undefined : key)} className="min-w-0 flex-1 text-left text-sm" aria-label="러닝 수정">
                  <span className="font-semibold tabular-nums">{r.date.slice(2).replaceAll('-', '.')}</span>
                  <span className="ml-2 tabular-nums">{km(r.distanceKm)}</span>
                  {(() => {
                    const t = themeOf(r)
                    return t.theme ? (
                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[11px] ${t.inferred ? 'bg-slate-100 text-slate-500' : 'bg-teal-50 text-teal-800'}`}>{t.theme}</span>
                    ) : null
                  })()}
                  {(r.event || r.place) && <span className="ml-1 truncate text-xs text-slate-500">· {r.event ?? r.place}</span>}
                  {r.garmin && (
                    <div className="text-xs text-slate-500 tabular-nums">
                      ⌚ {r.garmin.durationSec ? `${fmtTime(r.garmin.durationSec)} · ${fmtTime(Math.round(r.garmin.durationSec / r.garmin.distanceKm))}/km` : `${r.garmin.distanceKm}km`}
                      {r.garmin.avgHr ? ` · 심박 ${r.garmin.avgHr}` : ''}
                      {r.garmin.cadence ? ` · ${r.garmin.cadence}spm` : ''}
                      {(() => {
                        const i = intensityOf(r, maxHr)
                        return i ? (
                          <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[11px] ${INTENSITY_CHIP[i]}`}>
                            {INTENSITY_LABEL[i]} · {zoneOf(r, maxHr)}영역
                          </span>
                        ) : null
                      })()}
                    </div>
                  )}
                  <MemoLine memo={r.memo} feeling={r.feeling} />
                </button>
                <button
                  onClick={() => setEditing(editing === key ? undefined : key)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs ${r.shoe ? 'bg-slate-100 text-slate-700' : 'border border-amber-400 text-amber-700'}`}
                >
                  {r.shoe ? `👟 ${r.shoe}` : '신발 선택'}
                </button>
              </div>
              {editingRun === key && <RunEditor run={r} onDone={() => setEditingRun(undefined)} />}
              {editing === key && (
                <div className="mt-2">
                  <ShoePicker
                    id={`shoe-${key}`}
                    options={shoes}
                    value={r.shoe}
                    allowNone
                    onPick={async (s) => {
                      await setRunShoe(r.date, r.index, s)
                      setEditing(undefined)
                    }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-400">날짜나 거리를 누르면 수정·삭제할 수 있습니다.</p>
      {runs.length > limit && (
        <button onClick={() => setLimit(limit + 30)} className="mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm">
          더 보기 ({runs.length - limit}개 남음)
        </button>
      )}
    </Card>
  )
}

/** Every workout in one list, grouped by day; tap one to edit it. */
function AllWorkouts({ days }: { days: StoredDay[] }) {
  const [limit, setLimit] = useState(14)
  const [editing, setEditing] = useState<string>()
  const entries = allEntries(days)
  if (!entries.length) {
    return (
      <Card title="전체 운동 기록">
        <p className="text-sm text-slate-500">위 메뉴에서 운동 종류를 골라 기록하면 여기에 날짜별로 모여요.</p>
      </Card>
    )
  }
  const dates = [...new Set(entries.map((e) => e.date))]
  const shown = dates.slice(0, limit)
  return (
    <Card title={`전체 운동 기록 (${dates.length}일)`}>
      <ul className="divide-y divide-slate-100">
        {shown.map((date) => (
          <li key={date} className="py-2">
            <div className="mb-1 text-xs font-semibold text-slate-500 tabular-nums">
              {date.slice(2).replaceAll('-', '.')} ({'일월화수목금토'[new Date(`${date}T00:00:00Z`).getUTCDay()]})
            </div>
            <ul className="space-y-1.5">
              {entries
                .filter((e) => e.date === date)
                .map((e) => {
                  const key = e.act ? `${e.date}#${e.act.index}` : `${e.date}#log`
                  return (
                    <li key={key}>
                      <button
                        onClick={() => e.act && setEditing(editing === key ? undefined : key)}
                        disabled={!e.act}
                        className="w-full text-left text-sm disabled:cursor-default"
                        aria-label={e.act ? `${e.label} 수정` : undefined}
                      >
                        <span className="mr-1">{e.icon}</span>
                        <b>{e.label}</b>
                        <span className="ml-1.5 text-slate-700 tabular-nums">{entrySummary(e)}</span>
                        {e.act && <MemoLine memo={e.act.memo} feeling={e.act.feeling} />}
                      </button>
                      {e.act &&
                        editing === key &&
                        (e.act.kind === 'run' ? (
                          <RunEditor run={e.act} onDone={() => setEditing(undefined)} />
                        ) : (
                          <WorkoutEditor act={e.act} days={days} onDone={() => setEditing(undefined)} />
                        ))}
                    </li>
                  )
                })}
            </ul>
          </li>
        ))}
      </ul>
      {dates.length > limit && (
        <button onClick={() => setLimit(limit + 30)} className="mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm">
          더 보기 ({dates.length - limit}일 남음)
        </button>
      )}
      <p className="mt-2 text-xs text-slate-400">기록을 누르면 수정·삭제할 수 있어요. 메모장의 웨이트 기록(부위만 있는 것)은 고칠 수 없어요.</p>
    </Card>
  )
}

function entrySummary(e: Entry): string {
  const a = e.act
  if (!a) return e.parts?.length ? e.parts.join(', ') : ''
  const sec = durationOf(a)
  const m = sec ? Math.round(sec / 60) : 0
  const mins = m ? (m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`) : ''
  if (a.kind === 'run') {
    const where = a.event ?? a.place
    return [km(a.distanceKm), sec && `${fmtTime(sec)}`, themeOf(a).theme, where].filter(Boolean).join(' · ')
  }
  return [a.kind === 'strength' && a.exercises?.join(', '), a.distanceKm > 0 && km(a.distanceKm), mins, a.place].filter(Boolean).join(' · ')
}

function RunEditor({ run, onDone }: { run: Activity & { date: string; index: number }; onDone: () => void }) {
  const [date, setDate] = useState(run.date)
  const [distance, setDistance] = useState(String(run.distanceKm))
  const [place, setPlace] = useState(run.place ?? '')
  const [theme, setTheme] = useState<string | undefined>(themeOf(run).theme)
  const [time, setTime] = useState(() => {
    const t = run.durationSec ?? 0
    return t ? { h: String(Math.floor(t / 3600)), m: String(Math.floor((t % 3600) / 60)), s: String(t % 60) } : { h: '', m: '', s: '' }
  })
  const [memo, setMemo] = useState(run.memo ?? '')
  const [feeling, setFeeling] = useState<Feeling | undefined>(run.feeling)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const key = `${run.date}-${run.index}`
  const valid = Number(distance) > 0 && !!date
  const seconds = Number(time.h || 0) * 3600 + Number(time.m || 0) * 60 + Number(time.s || 0)

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate-500">
          날짜
          <input id={`run-date-${key}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
        </label>
        <label className="w-24 text-xs text-slate-500">
          거리(km)
          <input
            id={`run-km-${key}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
      </div>
      <label className="block text-xs text-slate-500">
        장소
        <input id={`run-place-${key}`} value={place} onChange={(e) => setPlace(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900" />
      </label>
      <div className="text-xs text-slate-500">
        러닝 주제
        <div className="mt-1">
          <ThemePicker id={`run-theme-${key}`} value={theme} onPick={setTheme} />
        </div>
      </div>
      <div className="text-xs text-slate-500">
        기록 (선택)
        <div className="mt-1 flex items-center gap-1 text-sm text-slate-900 tabular-nums">
          {(['h', 'm', 's'] as const).map((k, i) => (
            <span key={k} className="flex items-center gap-1">
              <input
                id={`run-${k}-${key}`}
                type="number"
                inputMode="numeric"
                min="0"
                value={time[k]}
                onChange={(e) => setTime({ ...time, [k]: e.target.value })}
                className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-right"
              />
              <span className="text-xs text-slate-500">{['시간', '분', '초'][i]}</span>
            </span>
          ))}
        </div>
      </div>
      <MemoInput id={`run-memo-${key}`} memo={memo} feeling={feeling} onMemo={setMemo} onFeeling={setFeeling} />
      <div className="flex gap-2">
        <button
          disabled={!valid}
          onClick={async () => {
            await editRun(run.date, run.index, { date, distanceKm: Number(distance), place: place.trim() || undefined, theme, durationSec: seconds || undefined, memo, feeling })
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
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-red-700">이 러닝을 삭제할까요?</span>
          <button onClick={() => setConfirmDelete(false)} className="rounded-lg bg-slate-200 px-3 py-1.5">
            아니요
          </button>
          <button
            onClick={async () => {
              await deleteRun(run.date, run.index)
              onDone()
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white"
          >
            삭제
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="w-full rounded-lg border border-red-300 py-2 text-red-700">
          삭제…
        </button>
      )}
    </div>
  )
}

function MyShoes({ totals }: { totals: ReturnType<typeof shoeTotals> }) {
  const [editing, setEditing] = useState<string>()
  const [initial, setInitial] = useState('')
  if (!totals.length) return null

  return (
    <Card title="내 신발">
      <p className="mb-2 text-xs text-slate-500">기록하기 전에 이미 달린 거리가 있으면 "이전 거리"에 넣어 주세요. 누적 거리에 더해집니다.</p>
      <ul className="divide-y divide-slate-100">
        {totals.map((t) => (
          <li key={t.shoe} className="py-2">
            <button
              onClick={() => {
                setEditing(editing === t.shoe ? undefined : t.shoe)
                setInitial(String(t.km - t.loggedKm || ''))
              }}
              className="flex w-full items-baseline justify-between text-left text-sm"
            >
              <span className={`font-semibold ${t.retired ? 'text-slate-400' : ''}`}>
                {t.shoe}
                {t.retired && <span className="ml-1 text-xs font-normal">(은퇴)</span>}
              </span>
              <span className="tabular-nums">
                {km(t.km)} <span className="text-xs text-slate-500">· {t.runs}회</span>
              </span>
            </button>
            {editing === t.shoe && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  이전 거리
                  <input
                    id={`initial-${t.shoe}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={initial}
                    onChange={(e) => setInitial(e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
                  />
                  km
                </label>
                <button onClick={() => updateShoe(t.shoe, { initialKm: Number(initial) || 0 }).then(() => setEditing(undefined))} className="rounded-lg bg-teal-700 px-3 py-1 text-white">
                  저장
                </button>
                <button onClick={() => updateShoe(t.shoe, { retired: !t.retired }).then(() => setEditing(undefined))} className="rounded-lg bg-slate-200 px-3 py-1">
                  {t.retired ? '다시 신기' : '은퇴시키기'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
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
