import type { Activity, DayEntry } from '../import/parseLog'

export interface DatedActivity extends Activity {
  date: string
}

export const runsOf = (days: DayEntry[]): DatedActivity[] =>
  days.flatMap((d) => d.activities.filter((a) => a.kind === 'run').map((a) => ({ ...a, date: d.date })))

const sumKm = (acts: Activity[]) => round1(acts.reduce((s, a) => s + a.distanceKm, 0))
export const round1 = (n: number) => Math.round(n * 10) / 10

/** Running distance per calendar month, including months with no runs. */
export function monthlyKm(days: DayEntry[]): { month: string; km: number }[] {
  const runs = runsOf(days)
  if (!runs.length) return []
  const byMonth = new Map<string, number>()
  for (const r of runs) byMonth.set(r.date.slice(0, 7), (byMonth.get(r.date.slice(0, 7)) ?? 0) + r.distanceKm)
  const months = [...byMonth.keys()].sort()
  const out: { month: string; km: number }[] = []
  for (let m = months[0]; m <= months.at(-1)!; m = nextMonth(m)) out.push({ month: m, km: round1(byMonth.get(m) ?? 0) })
  return out
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}

/** Points for a day-level metric, oldest first. */
export function metricSeries(days: DayEntry[], key: 'bodyFatPct' | 'systolicBp' | 'weightKg'): { date: string; value: number }[] {
  return days
    .filter((d) => d.metrics[key] != null)
    .map((d) => ({ date: d.date, value: d.metrics[key]! }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface ShoeTotal {
  shoe: string
  /** distance before logging started + logged runs */
  km: number
  loggedKm: number
  runs: number
  lastUsed?: string
  retired: boolean
}

/** Body fat % from the text log and InBody records together; InBody wins on the same date. */
export function bodyFatSeries(days: DayEntry[], inbody: { date: string; bodyFatPct?: number }[]): { date: string; value: number }[] {
  const byDate = new Map(metricSeries(days, 'bodyFatPct').map((p) => [p.date, p.value]))
  for (const r of inbody) if (r.bodyFatPct != null) byDate.set(r.date, r.bodyFatPct)
  return [...byDate].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date))
}

export function shoeTotals(days: DayEntry[], shoes: { name: string; initialKm: number; retired: boolean }[] = []): ShoeTotal[] {
  const map = new Map<string, DatedActivity[]>()
  for (const r of runsOf(days)) if (r.shoe) map.set(r.shoe, [...(map.get(r.shoe) ?? []), r])
  const names = new Set([...shoes.map((s) => s.name), ...map.keys()])
  return [...names]
    .map((shoe) => {
      const rs = map.get(shoe) ?? []
      const info = shoes.find((s) => s.name === shoe)
      const loggedKm = sumKm(rs)
      return {
        shoe,
        km: round1(loggedKm + (info?.initialKm ?? 0)),
        loggedKm,
        runs: rs.length,
        lastUsed: rs.map((r) => r.date).sort().at(-1),
        retired: info?.retired ?? false,
      }
    })
    .sort((a, b) => Number(a.retired) - Number(b.retired) || b.km - a.km)
}

const RACE_RE = /마라톤|레이스|대회|서킷런/

/** Races: events that look official, excluding crew runs. */
export function races(days: DayEntry[]): DatedActivity[] {
  return runsOf(days)
    .filter((r) => r.event && RACE_RE.test(r.event) && !r.crew && !/워밍업/.test(r.event))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function crewCounts(days: DayEntry[]): { crew: string; runs: number; km: number }[] {
  const map = new Map<string, DatedActivity[]>()
  for (const r of runsOf(days)) if (r.crew) map.set(r.crew, [...(map.get(r.crew) ?? []), r])
  return [...map].map(([crew, rs]) => ({ crew, runs: rs.length, km: sumKm(rs) })).sort((a, b) => b.runs - a.runs)
}

export interface Summary {
  totalKm: number
  yearKm: number
  year: string
  weeklyAvgKm4w: number
  runDays: number
  strengthDays: number
  lastBodyFat?: { date: string; value: number }
  firstBodyFat?: { date: string; value: number }
}

/** `today` is YYYY-MM-DD; the 4-week average covers the 28 days ending today. */
export function summary(days: DayEntry[], today: string): Summary {
  const runs = runsOf(days)
  const year = today.slice(0, 4)
  const from = addDays(today, -27)
  const bf = metricSeries(days, 'bodyFatPct')
  return {
    totalKm: sumKm(runs),
    yearKm: sumKm(runs.filter((r) => r.date.startsWith(year))),
    year,
    weeklyAvgKm4w: round1(sumKm(runs.filter((r) => r.date >= from && r.date <= today)) / 4),
    runDays: new Set(runs.map((r) => r.date)).size,
    strengthDays: days.filter((d) => d.strength?.done).length,
    lastBodyFat: bf.at(-1),
    firstBodyFat: bf[0],
  }
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(Math.round(sec % 60)).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
