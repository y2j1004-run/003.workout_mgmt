import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Goals } from '../analytics/home'
import { fmtTime } from '../analytics/stats'
import {
  addCustomGoal,
  categoryIcon,
  checkedNow,
  daysThisWeek,
  deleteCustomGoal,
  formatGoalValue,
  getCustomGoals,
  getGoals,
  GOAL_CATEGORIES,
  GOAL_TEMPLATES,
  habitStreak,
  parseGoalValue,
  repeatOf,
  setGoals,
  toggleHabit,
  updateCustomGoal,
  type CustomGoal,
  type GoalRepeat,
} from '../db/goals'

const FIELDS: [keyof Goals, string, string][] = [
  ['weeklyKm', '주간 러닝 거리', 'km'],
  ['monthlyKm', '월간 러닝 거리', 'km'],
  ['yearlyKm', '연간 러닝 거리', 'km'],
  ['bodyFatPct', '목표 체지방률', '%'],
  ['weightKg', '목표 체중', 'kg'],
]

export default function GoalsCard() {
  const saved = useLiveQuery(getGoals)
  const [form, setForm] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (saved) setForm(Object.fromEntries(FIELDS.map(([k]) => [k, saved[k] != null ? String(saved[k]) : ''])))
  }, [saved])

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">목표 설정</h2>
      <p className="mb-3 text-sm text-slate-500">정한 목표는 홈 화면에 진행률로 나옵니다. 비워 두면 표시하지 않습니다.</p>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(([k, label, unit]) => (
          <label key={k} className="text-xs text-slate-500">
            {label} ({unit})
            <input
              id={`goal-${k}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={form[k] ?? ''}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
            />
          </label>
        ))}
      </div>
      <button
        onClick={async () => {
          const goals: Goals = {}
          for (const [k] of FIELDS) if (Number(form[k]) > 0) goals[k] = Number(form[k])
          await setGoals(goals)
          setMsg('목표를 저장했습니다.')
        }}
        className="mt-3 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white"
      >
        저장
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
      <CustomGoals />
    </div>
  )
}

const input = 'mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900'
const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`
const REPEATS: [GoalRepeat, string][] = [
  ['once', '한 번'],
  ['daily', '매일'],
  ['weekly', '매주'],
]

/** Goals the user writes: one-off goals (with a number or time target, or just a check) and daily/weekly habits. */
function CustomGoals() {
  const goals = useLiveQuery(getCustomGoals)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('etc')
  const [repeat, setRepeat] = useState<GoalRepeat>('once')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [lower, setLower] = useState(false)
  const [due, setDue] = useState('')
  const [msg, setMsg] = useState('')
  if (!goals) return null
  const parsed = parseGoalValue(target)
  const valid = !!title.trim() && (repeat !== 'once' || !target.trim() || (!!parsed && parsed.value > 0))
  const reset = () => {
    setTitle('')
    setTarget('')
    setUnit('')
    setLower(false)
    setDue('')
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="mb-1 text-sm font-semibold">내가 정한 목표</h3>
      <p className="mb-2 text-xs text-slate-500">식단, 물 마시기, 영양제처럼 매일·매주 체크하는 습관이나, 10k TT 같은 기록 목표를 자유롭게 추가하세요.</p>
      {goals.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </ul>
      )}

      <p className="mb-1 text-xs text-slate-500">빠른 추가</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {GOAL_TEMPLATES.filter((t) => !goals.some((g) => g.title === t.title)).map((t) => (
          <button
            key={t.title}
            onClick={async () => {
              await addCustomGoal(t)
              setMsg(`'${t.title}' 목표를 추가했습니다.`)
            }}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
          >
            {categoryIcon(t.category)} {t.title}
          </button>
        ))}
      </div>

      <p className="mb-1 text-xs text-slate-500">직접 추가 · 분류</p>
      <div className="flex flex-wrap gap-1.5">
        {GOAL_CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={chip(category === c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <p className="mt-2 mb-1 text-xs text-slate-500">반복</p>
      <div className="flex gap-1.5">
        {REPEATS.map(([r, label]) => (
          <button key={r} type="button" onClick={() => setRepeat(r)} className={chip(repeat === r)}>
            {label}
          </button>
        ))}
      </div>
      <label className="mt-2 block text-xs text-slate-500">
        목표
        <input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={repeat === 'once' ? '10k TT 45분 이내' : '물 2L 마시기'} className={input} />
      </label>
      {repeat === 'once' && (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="text-xs text-slate-500">
              목표 값
              <input id="goal-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10 또는 45:00" className={input} />
            </label>
            <label className="text-xs text-slate-500">
              단위
              <input id="goal-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="개" disabled={parsed?.time} className={`${input} disabled:bg-slate-50`} />
            </label>
            <label className="text-xs text-slate-500">
              기한
              <input id="goal-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${input} px-1 text-sm`} />
            </label>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input id="goal-lower" type="checkbox" checked={lower || !!parsed?.time} disabled={parsed?.time} onChange={(e) => setLower(e.target.checked)} className="h-4 w-4 accent-teal-700" />
            낮을수록 좋음 (기록 단축, 체중 감량 등){parsed?.time ? ' · 시간 목표는 자동' : ''}
          </label>
          {target.trim() && !parsed && <p className="mt-1 text-xs text-amber-700">숫자나 45:00 같은 시간으로 넣어 주세요.</p>}
        </>
      )}
      <button
        disabled={!valid}
        onClick={async () => {
          const once = repeat === 'once'
          await addCustomGoal({
            title: title.trim(),
            category,
            repeat,
            target: once && parsed && parsed.value > 0 ? parsed.value : undefined,
            time: once && parsed?.time ? true : undefined,
            lower: once && (lower || parsed?.time) ? true : undefined,
            unit: once && !parsed?.time ? unit.trim() || undefined : undefined,
            due: once ? due || undefined : undefined,
          })
          setMsg(`'${title.trim()}' 목표를 추가했습니다.`)
          reset()
        }}
        className="mt-3 w-full rounded-lg border border-teal-700 py-2 font-semibold text-teal-700 disabled:opacity-40"
      >
        + 목표 추가
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}

function GoalRow({ goal: g }: { goal: CustomGoal }) {
  const [current, setCurrent] = useState(g.current == null ? '' : g.time ? fmtTime(g.current) : String(g.current))
  const repeat = repeatOf(g)
  const today = todayStr()
  return (
    <li className="py-2 text-sm">
      <div className="flex items-center gap-2">
        {repeat === 'once' ? (
          <input
            type="checkbox"
            checked={!!g.done}
            onChange={(e) => updateCustomGoal(g.id, { done: e.target.checked })}
            aria-label={`${g.title} 완료`}
            className="h-4 w-4 accent-teal-700"
          />
        ) : (
          <input
            type="checkbox"
            checked={checkedNow(g, today)}
            onChange={() => toggleHabit(g.id, today)}
            aria-label={`${g.title} ${repeat === 'daily' ? '오늘' : '이번 주'} 완료`}
            className="h-4 w-4 accent-teal-700"
          />
        )}
        <span className={`flex-1 font-semibold ${g.done ? 'text-slate-400 line-through' : ''}`}>
          {categoryIcon(g.category)} {g.title}
        </span>
        <span className="text-xs text-slate-500 tabular-nums">
          {repeat === 'daily' ? '매일' : repeat === 'weekly' ? '매주' : g.due ? `~${g.due.slice(2).replaceAll('-', '.')}` : ''}
        </span>
        <button onClick={() => confirm(`'${g.title}' 목표를 지울까요?`) && deleteCustomGoal(g.id)} className="px-1 text-xs text-slate-400">
          삭제
        </button>
      </div>
      {repeat === 'once' && g.target != null && (
        <label className="mt-1 flex items-center gap-2 pl-6 text-xs text-slate-500">
          지금
          <input
            inputMode="decimal"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            onBlur={() => updateCustomGoal(g.id, { current: parseGoalValue(current)?.value })}
            placeholder={g.time ? '47:30' : ''}
            aria-label={`${g.title} 현재 값`}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
          / {formatGoalValue(g, g.target)}
          {g.lower && ' 이하'}
        </label>
      )}
      {repeat !== 'once' && <p className="pl-6 text-xs text-slate-500">연속 {habitStreak(g, today)}{repeat === 'daily' ? `일 · 이번 주 ${daysThisWeek(g, today)}/7일` : '주'}</p>}
    </li>
  )
}

function todayStr() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
