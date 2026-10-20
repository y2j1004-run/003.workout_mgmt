import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { bodyFatSeries, crewCounts, metricSeries, monthlyKm, shoeTotals, summary } from '../analytics/stats'
import BarChart from '../components/charts/BarChart'
import LineChart from '../components/charts/LineChart'
import RaceRecords from '../components/RaceRecords'
import { db } from '../db/db'

const km = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export default function Stats() {
  const days = useLiveQuery(() => db.days.orderBy('date').toArray())
  const shoeList = useLiveQuery(() => db.shoes.toArray())
  const inbody = useLiveQuery(() => db.inbody.toArray())
  if (!days || !shoeList || !inbody) return null
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
  const bfChange = lastBf && bodyFat.length > 1 ? lastBf.value - bodyFat[0].value : undefined

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">통계</h1>

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

      <Card title="월별 러닝 거리" note={months.length === 24 ? '최근 24개월' : undefined}>
        <BarChart
          data={months.map((m) => ({ label: m.month, value: m.km }))}
          axisLabel={(m, i) => (m.endsWith('-01') || i === 0 ? `${m.slice(2, 4)}.${m.slice(5)}` : '')}
          format={(d) => `${d.label.replace('-', '년 ')}월 · ${km(d.value)}`}
        />
      </Card>

      {bodyFat.length > 1 && (
        <Card title="체지방률 (%)">
          <LineChart data={bodyFat} format={(d) => `${d.date} · ${d.value}%`} />
        </Card>
      )}

      {bp.length > 1 && (
        <Card title="혈압 (수축기, mmHg)">
          <LineChart data={bp} format={(d) => `${d.date} · ${d.value}`} />
        </Card>
      )}

      {shoes.length > 0 && (
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
      )}

      <RaceRecords days={days} />

      {crews.length > 0 && (
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
      )}
    </section>
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
