// Puts Garmin activities into the stored days: a watch run is attached to the logged run of
// about the same distance that day, otherwise it becomes a run of its own.

import type { GarminActivity } from './garminCsv'
import type { Activity, DayEntry, GarminData } from './parseLog'

export interface GarminMergeStats {
  matched: number
  added: number
  updated: number
  strengthDays: number
  ignored: number
}

/** Same run if the distances differ by at most 0.5km or 5%. */
export function sameRun(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.5, Math.max(a, b) * 0.05)
}

export function mergeGarmin(
  days: DayEntry[],
  garmin: GarminActivity[],
  emptyDay: (date: string) => DayEntry,
): { days: DayEntry[]; stats: GarminMergeStats } {
  const byDate = new Map(days.map((d) => [d.date, structuredClone(d)]))
  const changed = new Set<string>()
  const stats: GarminMergeStats = { matched: 0, added: 0, updated: 0, strengthDays: 0, ignored: 0 }

  for (const g of garmin) {
    if (g.kind === 'other' || ((g.kind === 'run' || g.kind === 'walk') && !(g.distanceKm > 0))) {
      stats.ignored++
      continue
    }
    const day = byDate.get(g.date) ?? emptyDay(g.date)
    byDate.set(g.date, day)

    if (g.kind === 'strength') {
      if (!day.strength?.done) {
        day.strength = { done: true, parts: day.strength?.parts ?? [] }
        stats.strengthDays++
        changed.add(g.date)
      }
      continue
    }

    const data = toData(g)
    const same = day.activities.find((a) => a.garmin?.startTime === g.startTime)
    if (same) {
      same.garmin = data
      fillFromGarmin(same)
      stats.updated++
    } else {
      const match = day.activities.find((a) => !a.garmin && a.kind === g.kind && sameRun(a.distanceKm, g.distanceKm))
      if (match) {
        match.garmin = data
        fillFromGarmin(match)
        stats.matched++
      } else {
        const run: Activity = { kind: g.kind, distanceKm: g.distanceKm, source: 'garmin', garmin: data, companions: [], details: [], tags: [] }
        fillFromGarmin(run)
        day.activities.push(run)
        stats.added++
      }
    }
    changed.add(g.date)
  }

  const out = [...byDate.values()].filter((d) => changed.has(d.date)).sort((a, b) => a.date.localeCompare(b.date))
  return { days: out, stats }
}

function toData(g: GarminActivity): GarminData {
  const { startTime, title, distanceKm, durationSec, avgHr, maxHr, cadence, ascentM, calories } = g
  return { startTime, title, distanceKm, durationSec, avgHr, maxHr, cadence, ascentM, calories }
}

// Logged values win; the watch fills time and pace only where the log has none.
// A race logged with warm-up keeps its own race pace.
function fillFromGarmin(a: Activity) {
  const g = a.garmin!
  if (!a.durationSec && g.durationSec && !a.raceDistanceKm) {
    a.durationSec = g.durationSec
    a.paceSecPerKm = Math.round(g.durationSec / g.distanceKm)
  }
}
