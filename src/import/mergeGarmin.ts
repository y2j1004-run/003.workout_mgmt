// Puts Garmin activities into the stored days. The watch is the source of truth for distance and
// time: on each day, every watch run is kept. A logged run that is the same run (paired one to one,
// closest distance first) takes the watch's distance and time and keeps what only the log knows
// (place, theme, shoe, crew, notes). Logged runs with no watch partner stay as they are.

import type { GarminActivity } from './garminCsv'
import type { Activity, DayEntry, GarminData } from './parseLog'

export interface GarminMergeStats {
  matched: number
  added: number
  updated: number
  strengthDays: number
  ignored: number
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
): { days: DayEntry[]; stats: GarminMergeStats } {
  const byDate = new Map(days.map((d) => [d.date, structuredClone(d)]))
  const changed = new Set<string>()
  const stats: GarminMergeStats = { matched: 0, added: 0, updated: 0, strengthDays: 0, ignored: 0 }
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
      // also corrects a reading stored earlier with a wrong unit
      same.garmin = toData(g)
      applyGarmin(same)
      stats.updated++
      return false
    })
    // logged or app runs still without watch data; a deleted one still pairs, so a run the user removed stays removed
    const open = day.activities.filter((a) => isMove(a) && !a.garmin && a.source !== 'garmin')
    const paired = new Set<number>()
    for (const kind of ['run', 'walk'] as const) {
      const gs = fresh.filter((g) => g.kind === kind)
      const os = open.filter((a) => a.kind === kind)
      for (const [gi, oi] of pairByDistance(
        gs.map((g) => g.distanceKm),
        os.map((a) => a.distanceKm),
      )) {
        os[oi].garmin = toData(gs[gi])
        os[oi].place ??= placeFromTitle(gs[gi].title)
        applyGarmin(os[oi])
        paired.add(fresh.indexOf(gs[gi]))
        stats.matched++
      }
    }
    fresh.forEach((g, i) => {
      if (paired.has(i)) return
      const run: Activity = {
        kind: g.kind as 'run' | 'walk',
        distanceKm: g.distanceKm,
        place: placeFromTitle(g.title),
        source: 'garmin',
        garmin: toData(g),
        companions: [],
        details: [],
        tags: [],
      }
      applyGarmin(run)
      day.activities.push(run)
      stats.added++
    })
  }

  const out = [...byDate.values()].filter((d) => changed.has(d.date)).sort((a, b) => a.date.localeCompare(b.date))
  return { days: out, stats }
}

// Garmin names activities "<city> <activity>" ("용인시 러닝", "Yongin Running") unless renamed.
const ACTIVITY_WORDS =
  /\s*(트레드밀|실내|트랙|트레일|러닝|달리기|조깅|걷기|하이킹|treadmill|indoor|track|trail|street|virtual|running|run|walking|walk|hiking)\s*$/i

/** The place part of a Garmin activity title, or undefined when the title is only the activity type. */
export function placeFromTitle(title?: string): string | undefined {
  let t = title?.trim() ?? ''
  for (let prev = ''; prev !== t; ) {
    prev = t
    t = t.replace(ACTIVITY_WORDS, '').trim()
  }
  return t || undefined
}

function toData(g: GarminActivity): GarminData {
  const { startTime, title, distanceKm, durationSec, avgHr, maxHr, cadence, ascentM, calories } = g
  return { startTime, title, distanceKm, durationSec, avgHr, maxHr, cadence, ascentM, calories }
}

/**
 * Takes distance and time from the watch, except what the user set by hand in the app.
 * A logged run remembers its logged distance so a re-import of the text log still recognizes it.
 * A race logged with warm-up keeps its own time and race pace.
 */
export function applyGarmin(a: Activity) {
  const g = a.garmin
  if (!g) return
  if (a.appEdits?.distanceKm === undefined && g.distanceKm > 0 && g.distanceKm !== a.distanceKm) {
    if (!a.source) a.appEdits = { ...a.appEdits, logDistanceKm: a.appEdits?.logDistanceKm ?? a.distanceKm }
    a.distanceKm = g.distanceKm
  }
  if (a.raceDistanceKm || a.appEdits?.durationSec !== undefined || !g.durationSec) return
  a.durationSec = g.durationSec
  a.paceSecPerKm = Math.round(g.durationSec / a.distanceKm)
}
