import type { Activity, DayEntry } from '../import/parseLog'

export interface DatedActivity extends Activity {
  date: string
}

export const runsOf = (days: DayEntry[]): DatedActivity[] =>
  days.flatMap((d) => d.activities.filter((a) => a.kind === 'run' && !a.deleted).map((a) => ({ ...a, date: d.date })))

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

/** A run is a race when the user said so; otherwise when its event looks official (not a crew run or a warm-up). */
export function isRace(a: Activity): boolean {
  return a.race ?? (!!a.event && RACE_RE.test(a.event) && !a.crew && !/워밍업/.test(a.event))
}

export interface RaceRow extends DatedActivity {
  /** position of the run within its day, used to edit it */
  index: number
}

export function races(days: DayEntry[]): RaceRow[] {
  return days
    .flatMap((d) => d.activities.map((a, index) => ({ ...a, date: d.date, index })))
    .filter((a) => a.kind === 'run' && !a.deleted && isRace(a))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export const RACE_DISTANCES = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: '하프', km: 21.0975 },
  { label: '풀', km: 42.195 },
]

/** Fastest finish per standard distance (within 1% of it). */
export function personalBests(list: RaceRow[]): { label: string; race: RaceRow }[] {
  return RACE_DISTANCES.flatMap(({ label, km }) => {
    const timed = list.filter((r) => r.durationSec && Math.abs((r.raceDistanceKm ?? r.distanceKm) - km) <= km * 0.01)
    const best = timed.sort((a, b) => a.durationSec! - b.durationSec!)[0]
    return best ? [{ label, race: best }] : []
  })
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
