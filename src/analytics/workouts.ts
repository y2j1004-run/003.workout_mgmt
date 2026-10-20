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
