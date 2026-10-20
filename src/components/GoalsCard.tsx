import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Goals } from '../analytics/home'
import { addCustomGoal, deleteCustomGoal, getCustomGoals, getGoals, setGoals, updateCustomGoal, type CustomGoal } from '../db/goals'

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

/** Goals the user writes: a title, optionally a target number with a unit and a due date. */
function CustomGoals() {
  const goals = useLiveQuery(getCustomGoals)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [due, setDue] = useState('')
  if (!goals) return null
  const t = Number(target)
  const valid = !!title.trim() && (!target.trim() || t > 0)

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="mb-1 text-sm font-semibold">내가 정한 목표</h3>
      <p className="mb-3 text-xs text-slate-500">예: 하프마라톤 완주, 턱걸이 10개, 월 4회 등산. 숫자 목표를 넣으면 홈에 진행률이 나오고, 없으면 완료 체크만 합니다.</p>
      {goals.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </ul>
      )}
      <label className="block text-xs text-slate-500">
        목표
        <input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="턱걸이 10개" className={input} />
      </label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="text-xs text-slate-500">
          목표 숫자
          <input id="goal-target" type="number" inputMode="decimal" min="0" value={target} onChange={(e) => setTarget(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-slate-500">
          단위
          <input id="goal-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="개" className={input} />
        </label>
        <label className="text-xs text-slate-500">
          기한
          <input id="goal-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${input} px-1 text-sm`} />
        </label>
      </div>
      <button
        disabled={!valid}
        onClick={async () => {
          await addCustomGoal({ title: title.trim(), target: t > 0 ? t : undefined, unit: unit.trim() || undefined, due: due || undefined })
          setTitle('')
          setTarget('')
          setUnit('')
          setDue('')
        }}
        className="mt-3 w-full rounded-lg border border-teal-700 py-2 font-semibold text-teal-700 disabled:opacity-40"
      >
        + 목표 추가
      </button>
    </div>
  )
}

function GoalRow({ goal: g }: { goal: CustomGoal }) {
  const [current, setCurrent] = useState(g.current != null ? String(g.current) : '')
  return (
    <li className="py-2 text-sm">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!g.done}
          onChange={(e) => updateCustomGoal(g.id, { done: e.target.checked })}
          aria-label={`${g.title} 완료`}
          className="h-4 w-4 accent-teal-700"
        />
        <span className={`flex-1 font-semibold ${g.done ? 'text-slate-400 line-through' : ''}`}>{g.title}</span>
        {g.due && <span className="text-xs text-slate-500 tabular-nums">~{g.due.slice(2).replaceAll('-', '.')}</span>}
        <button onClick={() => confirm(`'${g.title}' 목표를 지울까요?`) && deleteCustomGoal(g.id)} className="px-1 text-xs text-slate-400">
          삭제
        </button>
      </div>
      {g.target != null && (
        <label className="mt-1 flex items-center gap-2 pl-6 text-xs text-slate-500">
          지금
          <input
            type="number"
            inputMode="decimal"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            onBlur={() => updateCustomGoal(g.id, { current: current.trim() ? Number(current) : undefined })}
            aria-label={`${g.title} 현재 값`}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
          / {g.target}
          {g.unit ?? ''}
        </label>
      )}
    </li>
  )
}
