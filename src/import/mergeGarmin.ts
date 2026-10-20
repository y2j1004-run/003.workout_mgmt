// Puts Garmin activities into the stored days. On a day that already has logged runs, each watch
// run is paired with the closest logged run (one to one) and only adds its watch data; watch runs
// left over on such a day are reported instead of added, because they are usually the same run
// measured differently (treadmill, rounding). On a day with nothing logged, watch runs are added.

import type { GarminActivity } from './garminCsv'
import type { Activity, DayEntry, GarminData } from './parseLog'

export interface GarminMergeStats {
  matched: number
  added: number
  updated: number
  strengthDays: number
  ignored: number
  /** watch runs not added because the day already has logged runs they did not pair with */
  extras: GarminActivity[]
}

/** Same run if the distances differ by at most 0.5km or 5%. Used when re-importing the text log. */
export function sameRun(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.5, Math.max(a, b) * 0.05)
}

/** Loose bound for pairing runs of the same day: treadmill and GPS readings can differ a lot. */
export function couldBeSameRun(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(2, Math.max(a, b) * 0.35)
}

/** One-to-one pairing, closest distances first. Returns [leftIndex, rightIndex] pairs. */
export function pairByDistance(left: number[], right: number[]): [number, number][] {
  const candidates = left
    .flatMap((l, i) => right.map((r, j) => ({ i, j, diff: Math.abs(l - r) / Math.max(l, r) })))
    .filter(({ i, j }) => couldBeSameRun(left[i], right[j]))
    .sort((a, b) => a.diff - b.diff)
  const usedL = new Set<number>()
  const usedR = new Set<number>()
  const pairs: [number, number][] = []
  for (const { i, j } of candidates) {
    if (usedL.has(i) || usedR.has(j)) continue
    usedL.add(i)
    usedR.add(j)
    pairs.push([i, j])
  }
  return pairs
}

const isMove = (a: Activity) => a.kind === 'run' || a.kind === 'walk'

export function mergeGarmin(
  days: DayEntry[],
  garmin: GarminActivity[],
  emptyDay: (date: string) => DayEntry,
  /** start times of reported extras the user chose to add anyway */
  addAnyway: Set<string> = new Set(),
): { days: DayEntry[]; stats: GarminMergeStats } {
  const byDate = new Map(days.map((d) => [d.date, structuredClone(d)]))
  const changed = new Set<string>()
  const stats: GarminMergeStats = { matched: 0, added: 0, updated: 0, strengthDays: 0, ignored: 0, extras: [] }
  const moves = new Map<string, GarminActivity[]>()

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
    moves.set(g.date, [...(moves.get(g.date) ?? []), g])
  }

  for (const [date, list] of moves) {
    const day = byDate.get(date)!
    changed.add(date)
    // the same file imported again: refresh the watch data
    const fresh = list.filter((g) => {
      const same = day.activities.find((a) => a.garmin?.startTime === g.startTime)
      if (!same) return true
      same.garmin = toData(g)
      // a run that came from the watch takes the corrected reading (e.g. a distance first read in the wrong unit),
      // unless the user set the distance by hand
      if (same.source === 'garmin' && same.appEdits?.distanceKm === undefined) {
        same.distanceKm = g.distanceKm
        same.durationSec = undefined
        same.paceSecPerKm = undefined
      }
      fillFromGarmin(same)
      stats.updated++
      return false
    })
    // logged or app runs still without watch data; a deleted one still pairs, so a run the user removed stays removed
    const open = day.activities.filter((a) => isMove(a) && !a.garmin && a.source !== 'garmin')
    const hasLogged = day.activities.some((a) => isMove(a) && a.source !== 'garmin')
    const paired = new Set<number>()
    for (const kind of ['run', 'walk'] as const) {
      const gs = fresh.filter((g) => g.kind === kind)
      const os = open.filter((a) => a.kind === kind)
      for (const [gi, oi] of pairByDistance(
        gs.map((g) => g.distanceKm),
        os.map((a) => a.distanceKm),
      )) {
        os[oi].garmin = toData(gs[gi])
        fillFromGarmin(os[oi])
        paired.add(fresh.indexOf(gs[gi]))
        stats.matched++
      }
    }
    fresh.forEach((g, i) => {
      if (paired.has(i)) return
      if (hasLogged && !addAnyway.has(g.startTime)) {
        stats.extras.push(g)
        return
      }
      const run: Activity = { kind: g.kind as 'run' | 'walk', distanceKm: g.distanceKm, source: 'garmin', garmin: toData(g), companions: [], details: [], tags: [] }
      fillFromGarmin(run)
      day.activities.push(run)
      stats.added++
    })
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
