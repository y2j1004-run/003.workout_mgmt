// Age-based running numbers: VO2max level for the age group and run intensity from heart rate.
// VO2max bands: the Cooper Institute table Garmin uses for its fitness levels.
// Max heart rate: Tanaka (208 − 0.7 × age), raised to the highest max HR the watch has recorded.

import type { DayEntry } from '../import/parseLog'
import type { Sex, Vo2Entry } from '../db/profile'
import { runsOf, type DatedActivity } from './stats'

/** Age in the year of `date`, from the birth year alone (may be one more than the exact age). */
export function ageOn(birthYear: number | undefined, date: string): number | undefined {
  return birthYear ? Number(date.slice(0, 4)) - birthYear : undefined
}

/** VO2max values written in the text log, plus typed-in ones (which win on the same date). */
export function vo2Series(days: DayEntry[], entries: Vo2Entry[]): { date: string; value: number }[] {
  const byDate = new Map<string, number>()
  for (const d of days) if (d.metrics.vo2max != null) byDate.set(d.date, d.metrics.vo2max)
  for (const e of entries) byDate.set(e.date, e.value)
  return [...byDate].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date))
}

export const VO2_LEVELS = ['낮음', '보통', '좋음', '우수', '최상'] as const
export type Vo2Level = (typeof VO2_LEVELS)[number]

// lower bounds of 보통, 좋음, 우수, 최상 for ages 20s … 70s
const VO2_TABLE: Record<Sex, number[][]> = {
  male: [
    [41.7, 45.4, 51.1, 55.5],
    [40.5, 44.0, 48.3, 54.1],
    [38.5, 42.4, 46.4, 52.6],
    [35.6, 39.2, 43.4, 49.0],
    [32.3, 35.5, 39.5, 45.8],
    [29.4, 32.3, 36.7, 42.2],
  ],
  female: [
    [36.1, 39.5, 43.9, 49.7],
    [34.4, 37.8, 42.4, 47.5],
    [33.0, 36.3, 39.7, 45.4],
    [30.1, 33.0, 36.7, 41.2],
    [27.5, 30.0, 32.9, 37.9],
    [25.9, 28.1, 31.0, 36.8],
  ],
}

const decade = (age: number) => Math.min(5, Math.max(0, Math.floor(age / 10) - 2))

export function vo2Level(value: number, age: number, sex: Sex = 'male'): { level: Vo2Level; group: string; next?: { level: Vo2Level; value: number } } {
  const row = VO2_TABLE[sex][decade(age)]
  const i = row.filter((min) => value >= min).length
  const group = `${(decade(age) + 2) * 10}대`
  return { level: VO2_LEVELS[i], group, next: i < row.length ? { level: VO2_LEVELS[i + 1], value: row[i] } : undefined }
}

/** The youngest age group in which the value still rates 좋음 or better — a rough "fitness age". */
export function vo2FitnessGroup(value: number, sex: Sex = 'male'): string | undefined {
  const i = VO2_TABLE[sex].findIndex((row) => value >= row[1])
  return i < 0 ? undefined : `${(i + 2) * 10}대`
}

export type Intensity = 'easy' | 'tempo' | 'hard'
export const INTENSITY_LABEL: Record<Intensity, string> = { easy: '쉬움', tempo: '템포', hard: '고강도' }

export interface MaxHr {
  bpm: number
  /** how it was found, for the user */
  basis: string
}

/** Tanaka estimate from age, or the watch's highest recorded max HR if that is higher. */
export function maxHeartRate(runs: DatedActivity[], age?: number): MaxHr | undefined {
  const seen = Math.max(0, ...runs.map((r) => r.garmin?.maxHr ?? 0).filter((v) => v <= 220))
  const est = age != null ? Math.round(208 - 0.7 * age) : 0
  if (!seen && !est) return undefined
  return seen > est ? { bpm: seen, basis: '시계에 기록된 최고 심박' } : { bpm: est, basis: `나이(${age}세)로 추정` }
}

/** Average HR below 80% of max is easy, below 88% tempo, above that hard. */
export function intensityOf(run: DatedActivity, max: MaxHr | undefined): Intensity | undefined {
  const hr = run.garmin?.avgHr
  if (!hr || !max) return undefined
  const p = hr / max.bpm
  return p < 0.8 ? 'easy' : p < 0.88 ? 'tempo' : 'hard'
}

export interface IntensityMix {
  km: Record<Intensity, number>
  /** runs in the window without heart rate (typed or text-log runs) */
  noHrKm: number
  easyShare?: number
}

export function intensityMix(days: DayEntry[], max: MaxHr | undefined, from: string, to: string): IntensityMix {
  const km: Record<Intensity, number> = { easy: 0, tempo: 0, hard: 0 }
  let noHrKm = 0
  for (const r of runsOf(days)) {
    if (r.date < from || r.date > to) continue
    const i = intensityOf(r, max)
    if (i) km[i] += r.distanceKm
    else noHrKm += r.distanceKm
  }
  for (const k of Object.keys(km) as Intensity[]) km[k] = Math.round(km[k] * 10) / 10
  const total = km.easy + km.tempo + km.hard
  return { km, noHrKm: Math.round(noHrKm * 10) / 10, easyShare: total ? km.easy / total : undefined }
}
