import type { ReactNode } from 'react'
import { addDays } from '../analytics/stats'
import type { NutritionDay, SleepNight, StepDay } from '../shealth/shealth'
import { avgSleep, fmtHours } from '../shealth/sleepStats'
import BarChart from './charts/BarChart'

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Last night and the week's average; `compact` for the home tab. */
export function SleepCard({ nights, today, compact }: { nights: SleepNight[]; today: string; compact?: boolean }) {
  const last = nights.filter((n) => n.date <= today).at(-1)
  if (!last) return null
  const week = avgSleep(nights, today, 7, 1)
  const month = avgSleep(nights, today, 30, 1)
  const pct = (m: number) => Math.round((m / Math.max(1, last.minutes)) * 100)
  const stale = last.date < addDays(today, -2)
  const recent = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((d) => ({ label: d, value: Math.round(((nights.find((n) => n.date === d)?.minutes ?? 0) / 60) * 10) / 10 }))

  return (
    <Card title={`수면 · ${md(last.date)}${stale ? ' (최근 기록)' : ''}`} note={last.source}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className={`text-2xl font-bold tabular-nums ${last.minutes < 360 ? 'text-amber-700' : ''}`}>{fmtHours(last.minutes)}</div>
          <div className="text-xs text-slate-500 tabular-nums">
            {last.start.slice(11)} → {last.end.slice(11)}
            {last.awake ? ` · 깸 ${last.awake}분` : ''}
          </div>
        </div>
        <div className="text-right text-xs text-slate-600 tabular-nums">
          {week != null && <div>7일 평균 {fmtHours(week)}</div>}
          {!compact && month != null && <div>30일 평균 {fmtHours(month)}</div>}
        </div>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="수면 단계 비율">
        <div className="bg-indigo-800" style={{ width: `${pct(last.deep)}%` }} />
        <div className="bg-indigo-400" style={{ width: `${pct(last.rem)}%` }} />
        <div className="bg-indigo-200" style={{ width: `${pct(last.light)}%` }} />
      </div>
      <div className="mt-1 flex gap-3 text-[11px] text-slate-600 tabular-nums">
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-800" />
          깊은 잠 {pct(last.deep)}%
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-400" />
          렘 {pct(last.rem)}%
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-200" />
          얕은 잠 {pct(last.light)}%
        </span>
      </div>
      {!compact && (
        <div className="mt-3">
          <BarChart data={recent} height={150} axisLabel={(d, i) => (i % 7 === 0 || i === 29 ? md(d) : '')} format={(d) => `${md(d.label)} · ${d.value ? `${d.value}시간` : '기록 없음'}`} />
          <p className="text-xs text-slate-400">최근 30일 수면 시간. 깊은 잠은 보통 13~23%, 렘은 20~25%가 일반적이에요.</p>
        </div>
      )}
    </Card>
  )
}

/** Meals logged in Samsung Health: calories and protein per day, protein per kg of body weight. */
export function NutritionCard({ days, today, weightKg }: { days: NutritionDay[]; today: string; weightKg?: number }) {
  const recent = days.filter((d) => d.date > addDays(today, -30) && d.date <= today)
  const last = days.filter((d) => d.date <= today).at(-1)
  if (!last) return null
  const shown = recent.length ? recent : days.slice(-10)
  const kcal = avg(shown.map((d) => d.kcal))
  const protein = avg(shown.map((d) => d.protein))
  const perKg = weightKg ? protein / weightKg : undefined
  return (
    <Card title="식단" note={recent.length ? `최근 30일 중 ${recent.length}일 기록` : `마지막 기록 ${md(last.date)}`}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="하루 평균" value={`${Math.round(kcal).toLocaleString('ko-KR')}kcal`} />
        <Tile label="단백질" value={`${Math.round(protein)}g`} sub={perKg ? `체중 1kg당 ${perKg.toFixed(1)}g` : undefined} />
        <Tile label="탄·단·지" value={ratio(shown)} sub="칼로리 비율" />
      </div>
      {perKg != null && (
        <p className="mt-2 text-xs text-slate-600">
          {perKg < 1.2
            ? '러너가 근육을 지키려면 하루 체중 1kg당 1.2~1.6g의 단백질이 좋아요. 기록된 끼니 기준으로는 조금 부족해요.'
            : '단백질은 체중 1kg당 1.2g 이상으로 충분한 편이에요.'}
        </p>
      )}
      <ul className="mt-3 divide-y divide-slate-100 text-sm tabular-nums">
        {[...shown]
          .reverse()
          .slice(0, 7)
          .map((d) => (
            <li key={d.date} className="flex justify-between py-1">
              <span>
                {md(d.date)} <span className="text-xs text-slate-500">{d.meals}끼</span>
              </span>
              <span>
                {d.kcal.toLocaleString('ko-KR')}kcal <span className="text-xs text-slate-500">· 단백질 {d.protein}g</span>
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-1 text-xs text-slate-400">삼성 헬스에 기록된 끼니만 더했어요(회사 식당 앱 연동 등). 기록 안 한 끼니는 빠져 있어요.</p>
    </Card>
  )
}

function ratio(days: NutritionDay[]) {
  const c = avg(days.map((d) => d.carb)) * 4
  const p = avg(days.map((d) => d.protein)) * 4
  const f = avg(days.map((d) => d.fat)) * 9
  const t = c + p + f || 1
  return `${Math.round((c / t) * 100)}:${Math.round((p / t) * 100)}:${Math.round((f / t) * 100)}`
}

/** Daily steps counted by the phone. */
export function StepsCard({ days, today }: { days: StepDay[]; today: string }) {
  const last = days.filter((d) => d.date <= today).at(-1)
  if (!last) return null
  const recent = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((d) => ({ label: d, value: days.find((x) => x.date === d)?.steps ?? 0 }))
  const week = recent.slice(-7).filter((d) => d.value)
  return (
    <Card title="걸음 수" note="휴대폰 기준">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold tabular-nums">{last.steps.toLocaleString('ko-KR')}보</div>
          <div className="text-xs text-slate-500 tabular-nums">
            {md(last.date)} · {last.km}km
          </div>
        </div>
        {week.length > 0 && <div className="text-xs text-slate-600 tabular-nums">7일 평균 {Math.round(avg(week.map((d) => d.value))).toLocaleString('ko-KR')}보</div>}
      </div>
      <div className="mt-3">
        <BarChart data={recent} height={140} axisLabel={(d, i) => (i % 7 === 0 || i === 29 ? md(d) : '')} format={(d) => `${md(d.label)} · ${d.value.toLocaleString('ko-KR')}보`} />
        <p className="text-xs text-slate-400">휴대폰을 들고 다닌 걸음만 세서, 시계만 차고 달린 러닝은 빠져 있어요.</p>
      </div>
    </Card>
  )
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {note && <span className="text-xs text-slate-500">{note}</span>}
      </div>
      {children}
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-base font-bold whitespace-nowrap tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 tabular-nums">{sub}</div>}
    </div>
  )
}
