import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { Goals } from '../analytics/home'
import { getGoals, setGoals } from '../db/goals'

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
    </div>
  )
}
