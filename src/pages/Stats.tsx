import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { moveSection, resolveOrder, STATS_SECTIONS, type StatsSectionId } from '../analytics/sectionOrder'
import { ageOn, maxHeartRate } from '../analytics/fitness'
import { bodyFatSeries, crewCounts, metricSeries, monthlyKm, runsOf, shoeTotals, summary } from '../analytics/stats'
import BarChart from '../components/charts/BarChart'
import LineChart from '../components/charts/LineChart'
import { IntensityCard, Vo2Card } from '../components/FitnessCards'
import RaceRecords from '../components/RaceRecords'
import { db } from '../db/db'
import { getStatsOrder, setStatsOrder } from '../db/layout'
import { getProfile, getVo2Entries } from '../db/profile'

const km = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export default function Stats() {
  const days = useLiveQuery(() => db.days.orderBy('date').toArray())
  const shoeList = useLiveQuery(() => db.shoes.toArray())
  const inbody = useLiveQuery(() => db.inbody.toArray())
  // wrapped so "no saved order" (undefined) is told apart from "still loading"
  const savedOrder = useLiveQuery(async () => ({ value: await getStatsOrder() }))
  const profile = useLiveQuery(getProfile)
  const vo2 = useLiveQuery(getVo2Entries)
  const [arranging, setArranging] = useState(false)
  if (!days || !shoeList || !inbody || !savedOrder || !profile || !vo2) return null
  const order = resolveOrder(savedOrder.value)
  if (!days.length) {
    return (
      <section>
        <h1 className="mb-4 text-2xl font-bold">통계</h1>
        <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold">아직 저장된 기록이 없습니다.</p>
          <p className="mt-1 text-slate-500">⚙️ 설정 → 운동 기록 가져오기에서 기록을 읽고 저장하면 월별 거리, 체지방률 추세, 신발별 거리가 여기에 나옵니다.</p>
        </div>
      </section>
    )
  }

  const s = summary(days, today())
  const months = monthlyKm(days).slice(-24)
  const bodyFat = bodyFatSeries(days, inbody)
  const bp = metricSeries(days, 'systolicBp')
  const shoes = shoeTotals(days, shoeList).filter((sh) => sh.km > 0)
  const crews = crewCounts(days)
  const lastBf = bodyFat.at(-1)
  const age = ageOn(profile.birthYear, today())
  const maxHr = maxHeartRate(runsOf(days), age, profile.maxHr)
  const bfChange = lastBf && bodyFat.length > 1 ? lastBf.value - bodyFat[0].value : undefined

  const sections: Record<StatsSectionId, ReactNode> = {
    summary: (
      <div className="grid grid-cols-2 gap-2">
        <Tile label="누적 러닝" value={km(s.totalKm)} sub={`${s.runDays}일 달림`} />
        <Tile label={`${s.year}년 러닝`} value={km(s.yearKm)} />
        <Tile label="최근 4주 주평균" value={km(s.weeklyAvgKm4w)} />
        <Tile
          label="체지방률"
          value={lastBf ? `${lastBf.value}%` : '-'}
          sub={bfChange != null ? `처음보다 ${bfChange > 0 ? '+' : ''}${bfChange.toFixed(1)}%p` : undefined}
        />
      </div>
    ),
    monthly: (
      <Card title="월별 러닝 거리" note={months.length === 24 ? '최근 24개월' : undefined}>
        <BarChart
          data={months.map((m) => ({ label: m.month, value: m.km }))}
          axisLabel={(m, i) => (m.endsWith('-01') || i === 0 ? `${m.slice(2, 4)}.${m.slice(5)}` : '')}
          format={(d) => `${d.label.replace('-', '년 ')}월 · ${km(d.value)}`}
        />
      </Card>
    ),
    bodyFat: bodyFat.length > 1 && (
      <Card title="체지방률 (%)">
        <LineChart data={bodyFat} format={(d) => `${d.date} · ${d.value}%`} />
      </Card>
    ),
    bp: bp.length > 1 && (
      <Card title="혈압 (수축기, mmHg)">
        <LineChart data={bp} format={(d) => `${d.date} · ${d.value}`} />
      </Card>
    ),
    vo2max: <Vo2Card days={days} entries={vo2} profile={profile} />,
    intensity: <IntensityCard days={days} maxHr={maxHr} fromProfile={!!profile.maxHr} />,
    races: <RaceRecords days={days} />,
    crews: crews.length > 0 && (
      <Card title="크루 활동">
        <ul className="text-sm">
          {crews.map((c) => (
            <li key={c.crew} className="flex justify-between py-1 tabular-nums">
              <span className="font-semibold">{c.crew}</span>
              <span>
                {c.runs}회 · {km(c.km)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    ),
    shoes: shoes.length > 0 && (
      <Card title="신발별 누적 거리">
        <ul className="space-y-2">
          {shoes.map((sh) => (
            <li key={sh.shoe}>
              <div className="flex justify-between text-sm">
                <span className={`font-semibold ${sh.retired ? 'text-slate-400' : ''}`}>
                  {sh.shoe}
                  {sh.retired && <span className="ml-1 text-xs font-normal">(은퇴)</span>}
                </span>
                <span className="tabular-nums">
                  {km(sh.km)} <span className="text-xs text-slate-500">· {sh.runs}회{sh.lastUsed ? ` · 최근 ${sh.lastUsed.slice(5).replace('-', '.')}` : ''}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-teal-700" style={{ width: `${(sh.km / shoes[0].km) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    ),
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">통계</h1>
        <button onClick={() => setArranging(!arranging)} className="text-sm text-teal-700">
          {arranging ? '완료' : '순서 바꾸기'}
        </button>
      </div>
      {arranging ? (
        <ArrangeList order={order} />
      ) : (
        order.map((id) => sections[id] && <div key={id}>{sections[id]}</div>)
      )}
    </section>
  )
}

function ArrangeList({ order }: { order: StatsSectionId[] }) {
  const title = (id: StatsSectionId) => STATS_SECTIONS.find((x) => x.id === id)!.title
  const save = (next: StatsSectionId[]) => setStatsOrder(next)
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm text-slate-500">화살표로 항목 위치를 바꾸세요. 바로 저장됩니다.</p>
      <ol className="divide-y divide-slate-100">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-2 py-2">
            <span className="w-5 text-right text-xs text-slate-400 tabular-nums">{i + 1}</span>
            <span className="flex-1 font-semibold">{title(id)}</span>
            <button
              onClick={() => save(moveSection(order, id, -1))}
              disabled={i === 0}
              aria-label={`${title(id)} 위로`}
              className="h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30"
            >
              ↑
            </button>
            <button
              onClick={() => save(moveSection(order, id, 1))}
              disabled={i === order.length - 1}
              aria-label={`${title(id)} 아래로`}
              className="h-9 w-9 rounded-lg bg-slate-100 text-lg disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button onClick={() => setStatsOrder(undefined)} className="mt-3 w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600">
        기본 순서로 되돌리기
      </button>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500 tabular-nums">{sub}</div>}
    </div>
  )
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {note && <span className="text-xs text-slate-500">{note}</span>}
      </div>
      {children}
    </div>
  )
}
