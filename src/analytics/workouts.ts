// The kinds of workout the 운동 tab can record, besides runs.

import type { Activity, ActivityKind, DayEntry } from '../import/parseLog'

export interface WorkoutType {
  /** menu label, also the sport name for kind 'sport' */
  label: string
  kind: ActivityKind
  /** fields the form asks for */
  distance?: boolean
  place?: boolean
  /** '기타': the sport name is typed in */
  custom?: boolean
}

export const WORKOUT_TYPES: WorkoutType[] = [
  { label: '러닝', kind: 'run' },
  { label: '걷기', kind: 'walk', distance: true, place: true },
  { label: '등산', kind: 'hike', distance: true, place: true },
  { label: '웨이트', kind: 'strength' },
  { label: '축구', kind: 'sport', place: true },
  { label: '농구', kind: 'sport', place: true },
  { label: '탁구', kind: 'sport', place: true },
  { label: '배드민턴', kind: 'sport', place: true },
  { label: '기타', kind: 'sport', place: true, custom: true },
]

const NAMED_SPORTS = WORKOUT_TYPES.filter((t) => t.kind === 'sport' && !t.custom).map((t) => t.label)

export const STRENGTH_EXERCISES = [
  '스쿼트',
  '루마니안 데드리프트',
  '런지',
  '턱걸이',
  '체스트프레스',
  '시티드 케이블 로우',
  '숄더프레스',
  '랫풀다운',
  '레그 익스텐션',
  '레그컬',
]

/** Whether an activity belongs under a menu entry; ball sports are told apart by name. */
export function isOfType(a: Activity, t: WorkoutType): boolean {
  if (a.kind !== t.kind) return false
  if (t.kind !== 'sport') return true
  return t.custom ? !NAMED_SPORTS.includes(a.sport ?? '') : a.sport === t.label
}

/** Strength work on a day, from the log ("웨이트"), a Garmin strength activity or an app entry. */
export function didStrength(d: DayEntry): boolean {
  return !!d.strength?.done || d.activities.some((a) => a.kind === 'strength' && !a.deleted)
}

export interface DatedWorkout extends Activity {
  date: string
  index: number
}

/** Activities of one menu entry, newest first, with their position in the day for deleting. */
export function workoutsOf(days: DayEntry[], t: WorkoutType): DatedWorkout[] {
  return days
    .flatMap((d) => d.activities.map((a, index) => ({ ...a, date: d.date, index })))
    .filter((a) => !a.deleted && isOfType(a, t))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export const KIND_ICON: Record<ActivityKind, string> = { run: '🏃', walk: '🚶', hike: '⛰️', strength: '🏋️', sport: '⚽' }
const SPORT_ICON: Record<string, string> = { 축구: '⚽', 농구: '🏀', 탁구: '🏓', 배드민턴: '🏸' }

/** The menu name of an activity: 러닝, 걷기, 등산, 웨이트, or the sport's name. */
export function typeLabelOf(a: Activity): string {
  if (a.kind === 'sport') return a.sport || '기타'
  return WORKOUT_TYPES.find((t) => t.kind === a.kind)!.label
}

export const iconOf = (a: Pick<Activity, 'kind' | 'sport'>) => (a.kind === 'sport' && a.sport && SPORT_ICON[a.sport]) || KIND_ICON[a.kind]

/** Time spent, from the entry or the watch. */
export const durationOf = (a: Activity): number | undefined => a.durationSec ?? a.garmin?.durationSec

/** One line in the all-workouts list: an activity, or a log day that only says 웨이트. */
export interface Entry {
  date: string
  label: string
  icon: string
  act?: DatedWorkout
  /** body parts from the log, for strength days without an activity */
  parts?: string[]
}

/** Every workout, newest first. */
export function allEntries(days: DayEntry[]): Entry[] {
  const out: Entry[] = []
  for (const d of days) {
    d.activities.forEach((a, index) => {
      if (!a.deleted) out.push({ date: d.date, label: typeLabelOf(a), icon: iconOf(a), act: { ...a, date: d.date, index } })
    })
    if (d.strength?.done && !d.activities.some((a) => a.kind === 'strength' && !a.deleted)) {
      out.push({ date: d.date, label: '웨이트', icon: KIND_ICON.strength, parts: d.strength.parts })
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || (a.act?.index ?? 99) - (b.act?.index ?? 99))
}

export interface TypeStats {
  label: string
  icon: string
  count: number
  km: number
  sec: number
}

export interface WorkoutStats {
  activeDays: number
  sessions: number
  sec: number
  byType: TypeStats[]
}

/** Sessions, time and distance per workout type between two dates (inclusive). */
export function workoutStats(days: DayEntry[], from: string, to: string): WorkoutStats {
  const entries = allEntries(days).filter((e) => e.date >= from && e.date <= to)
  const map = new Map<string, TypeStats>()
  for (const e of entries) {
    const t = map.get(e.label) ?? { label: e.label, icon: e.icon, count: 0, km: 0, sec: 0 }
    t.count++
    t.km += e.act?.distanceKm ?? 0
    t.sec += (e.act && durationOf(e.act)) ?? 0
    map.set(e.label, t)
  }
  const byType = [...map.values()].map((t) => ({ ...t, km: Math.round(t.km * 10) / 10 })).sort((a, b) => b.count - a.count)
  return {
    activeDays: new Set(entries.map((e) => e.date)).size,
    sessions: entries.length,
    sec: byType.reduce((s, t) => s + t.sec, 0),
    byType,
  }
}
