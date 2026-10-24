// Jack Daniels' VDOT: a fitness number from a race result, used to predict other race times and
// to set training paces (Daniels' Running Formula; oxygen cost and time-to-exhaustion curves).

import { races } from './stats'
import type { DayEntry } from '../import/parseLog'
import { addDays } from './stats'

/** ml/kg/min needed to run at v metres per minute */
const oxygenCost = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v
/** share of VO2max that can be held for t minutes */
const sustainable = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)

export function vdotOf(km: number, sec: number): number {
  const t = sec / 60
  return oxygenCost((km * 1000) / t) / sustainable(t)
}

/** Seconds per km at a given share of VO2max. */
function paceAt(vdot: number, share: number): number {
  const target = vdot * share
  // solve 0.000104 v² + 0.182258 v − (4.6 + target) = 0
  const v = (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (4.6 + target))) / (2 * 0.000104)
  return 60000 / v
}

/** Predicted finish in seconds for a distance. */
export function predictSec(vdot: number, km: number): number {
  let lo = km * 120
  let hi = km * 900
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (vdotOf(km, mid) > vdot) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

export interface TrainingPaces {
  /** slow and fast end, seconds per km */
  easy: [number, number]
  marathon: number
  threshold: number
  interval: number
}

export function trainingPaces(vdot: number): TrainingPaces {
  return {
    easy: [paceAt(vdot, 0.62), paceAt(vdot, 0.7)].map(Math.round) as [number, number],
    marathon: Math.round(predictSec(vdot, 42.195) / 42.195),
    threshold: Math.round(paceAt(vdot, 0.88)),
    interval: Math.round(paceAt(vdot, 0.975)),
  }
}

export interface ReferenceRace {
  date: string
  name: string
  km: number
  sec: number
  vdot: number
}

/** The best timed race of the last six months (else the last year), 5km or longer. */
export function referenceRace(days: DayEntry[], today: string): ReferenceRace | undefined {
  const timed = races(days).flatMap((r) => {
    const km = r.raceDistanceKm ?? r.distanceKm
    const sec = r.durationSec ?? (r.paceSecPerKm ? r.paceSecPerKm * km : undefined)
    return km >= 5 && sec && r.date <= today ? [{ date: r.date, name: r.event ?? '대회', km, sec: Math.round(sec), vdot: vdotOf(km, sec) }] : []
  })
  for (const months of [6, 12]) {
    const from = addDays(today, -Math.round(months * 30.5))
    const best = timed.filter((r) => r.date >= from).sort((a, b) => b.vdot - a.vdot)[0]
    if (best) return best
  }
  return undefined
}

export const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`
