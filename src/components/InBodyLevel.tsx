import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { addDays, runsOf } from '../analytics/stats'
import { ageOn } from '../analytics/fitness'
import { db } from '../db/db'
import { getProfile } from '../db/profile'
import { assessInBody, longTermChange, type Level } from '../inbody/assess'
import type { InBodyRecord } from '../inbody/inbody'

const CHIP: Record<Level, { label: string; className: string }> = {
  good: { label: '좋음', className: 'bg-teal-50 text-teal-800' },
  ok: { label: '보통', className: 'bg-slate-100 text-slate-600' },
  watch: { label: '주의', className: 'bg-amber-100 text-amber-800' },
}

/** `records` are the saved measurements; `all` also has the ones from the workout log, for the long-term view. */
export default function InBodyLevel({ records, all }: { records: InBodyRecord[]; all: InBodyRecord[] }) {
  const days = useLiveQuery(() => db.days.toArray())
  const profile = useLiveQuery(getProfile)
  const [open, setOpen] = useState(true)
  if (!days || !profile) return null
  const runs = runsOf(days)
  const kmBefore = (date: string) => {
    const from = addDays(date, -7)
    return runs.filter((r) => r.date >= from && r.date < date).reduce((s, r) => s + r.distanceKm, 0)
  }
  const latest = records.at(-1)?.date ?? ''
  const a = assessInBody(records, runs.length ? kmBefore : undefined, { sex: profile.sex, age: ageOn(profile.birthYear, latest), heightCm: profile.heightCm })
  if (!a) return null
  const long = longTermChange(all, profile)
  const hasProfile = profile.sex && profile.birthYear

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <button onClick={() => setOpen(!open)} className="flex w-full items-baseline justify-between text-left">
        <h2 className="font-semibold">현재 수준 · {a.date}</h2>
        <span className="text-xs text-slate-400">{open ? '접기' : '펼치기'}</span>
      </button>
      <p className="mt-1 text-sm text-slate-700">{a.headline}</p>
      {open && (
        <>
          <ul className="mt-3 divide-y divide-slate-100">
            {a.items.map((i) => (
              <li key={i.key} className="py-2">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{i.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="tabular-nums">{i.value}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${CHIP[i.level].className}`}>{CHIP[i.level].label}</span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{i.note}</p>
              </li>
            ))}
          </ul>

          {a.trends.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold text-slate-500">{a.trends[0].since} 이후 변화</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {a.trends.map((t) => {
                  const d = Math.round((t.to - t.from) * 10) / 10
                  return (
                    <div key={t.label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <div className="text-xs text-slate-500">{t.label}</div>
                      <div className="tabular-nums">
                        {t.from} → <b>{t.to}</b>
                        {t.unit} <span className="text-xs text-slate-500">({d > 0 ? '+' : ''}{d})</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {long && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold text-slate-500">
                장기 변화 · {long.from.slice(2).replaceAll('-', '.')} → {long.to.slice(2).replaceAll('-', '.')}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(
                  [
                    ['체중', long.weightKg, 'kg'],
                    ['체지방량', long.fatKg, 'kg'],
                    ['제지방량', long.leanKg, 'kg'],
                    ...(long.bmi ? [['BMI', long.bmi, ''] as const] : []),
                  ] as const
                ).map(([label, [from, to], unit]) => {
                  const d = Math.round((to - from) * 10) / 10
                  return (
                    <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="tabular-nums">
                        {from} → <b>{to}</b>
                        {unit} <span className="text-xs text-slate-500">({d > 0 ? '+' : ''}{d})</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">{leanNote(long.weightKg, long.fatKg)}</p>
            </div>
          )}

          {a.suggestions.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-semibold text-slate-500">도움이 될 것</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {a.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            결과지의 표준 범위와 일반 기준({hasProfile ? `${profile.sex === 'female' ? '여성' : '남성'}, ${ageOn(profile.birthYear, latest)}세` : '성인 남성'})으로 본 참고용 해석이며 진단이 아닙니다.
            {!hasProfile && ' ⚙️ 설정 → 내 정보에 성별·출생 연도를 넣으면 나이에 맞춰 봅니다.'}
          </p>
        </>
      )}
    </div>
  )
}

function leanNote([w0, w1]: [number, number], [f0, f1]: [number, number]): string {
  const lost = w0 - w1
  const fat = f0 - f1
  if (lost <= 0.5) return '체중은 거의 그대로이고, 체성분 비율이 바뀌었습니다.'
  const share = Math.round((fat / lost) * 100)
  return `줄어든 체중의 약 ${Math.min(100, Math.max(0, share))}%가 지방입니다.${share >= 75 ? ' 근육은 대부분 지키면서 뺐습니다.' : ' 근육도 함께 줄었으니 근력 운동을 챙겨 보세요.'}`
}
