// This week's plan next to what was actually done. The plan is the one the home tab showed last
// Sunday: planNextWeek run as of that day, with only the records up to it.

import type { Activity, DayEntry } from '../import/parseLog'
import type { InBodyRecord } from '../inbody/inbody'
import type { SleepNight } from '../shealth/shealth'
import type { UpcomingRace } from '../db/upcoming'
import type { MaxHr } from './fitness'
import { weekStart } from './home'
import { planNextWeek, type PlanItem, type WeekPlan } from './plan'
import { addDays, round1 } from './stats'
import { didStrength } from './workouts'

/** done: as planned; partial: ran less than 80%; missed: past day, nothing done; extra: not planned; upcoming: today or later */
export type DayStatus = 'done' | 'partial' | 'missed' | 'rested' | 'extra' | 'upcoming'

export interface ReviewDay {
  date: string
  dow: string
  planned: PlanItem[]
  /** non-deleted activities of the day */
  actual: Activity[]
  strength: boolean
  plannedKm: number
  actualKm: number
  status: DayStatus
}

export interface WeekReview {
  plan: WeekPlan
  days: ReviewDay[]
  plannedKm: number
  /** planned km for the days up to today, to compare fairly mid-week */
  plannedKmSoFar: number
  actualKm: number
  plannedSessions: number
  doneSessions: number
}

export interface ReviewInput {
  days: DayEntry[]
  inbody: InBodyRecord[]
  today: string
  sleep?: SleepNight[]
  races?: UpcomingRace[]
  weeklyKmGoal?: number
  maxHr?: MaxHr
}

const runKm = (acts: Activity[]) => round1(acts.filter((a) => a.kind === 'run').reduce((s, a) => s + a.distanceKm, 0))
const plannedRunKm = (items: PlanItem[]) => items.reduce((s, i) => s + (i.kind === 'strength' || i.kind === 'rest' ? 0 : (i.km ?? 0)), 0)

export function reviewWeek({ days, inbody, today, sleep = [], races = [], weeklyKmGoal, maxHr }: ReviewInput): WeekReview | undefined {
  const start = weekStart(today)
  const asOf = addDays(start, -1)
  const plan = planNextWeek({
    days: days.filter((d) => d.date <= asOf),
    inbody: inbody.filter((r) => r.date <= asOf),
    sleep: sleep.filter((n) => n.date <= asOf),
    today: asOf,
    races,
    weeklyKmGoal,
    maxHr,
  })
  if (!plan) return undefined
  const byDate = new Map(days.map((d) => [d.date, d]))

  const rows: ReviewDay[] = plan.days.map((p) => {
    const day = byDate.get(p.date)
    const actual = (day?.activities ?? []).filter((a) => !a.deleted)
    const strength = !!day && didStrength(day)
    const plannedKm = round1(plannedRunKm(p.items))
    const actualKm = runKm(actual)
    const wantsRun = plannedKm > 0
    const wantsStrength = p.items.some((i) => i.kind === 'strength')
    const future = p.date >= today
    let status: DayStatus
    if (wantsRun) {
      status = actualKm >= plannedKm * 0.8 ? 'done' : actualKm > 0 ? 'partial' : future ? 'upcoming' : 'missed'
      if (status === 'done' && wantsStrength && !strength && !future) status = 'partial'
    } else if (wantsStrength) {
      status = strength ? 'done' : future ? 'upcoming' : 'missed'
    } else {
      status = actual.length || strength ? 'extra' : future ? 'upcoming' : 'rested'
    }
    // today still counts as upcoming until something is recorded
    if (p.date === today && (status === 'missed' || status === 'rested')) status = 'upcoming'
    return { date: p.date, dow: p.dow, planned: p.items, actual, strength, plannedKm, actualKm, status }
  })

  const sessions = rows.flatMap((r) => r.planned.filter((i) => i.kind !== 'rest').map((i) => ({ r, i })))
  const isDone = ({ r, i }: { r: ReviewDay; i: PlanItem }) =>
    i.kind === 'strength' ? r.strength : r.actualKm >= (i.km ?? 0) * 0.8 && r.actualKm > 0
  return {
    plan,
    days: rows,
    plannedKm: round1(rows.reduce((s, r) => s + r.plannedKm, 0)),
    plannedKmSoFar: round1(rows.filter((r) => r.date <= today).reduce((s, r) => s + r.plannedKm, 0)),
    actualKm: round1(rows.reduce((s, r) => s + r.actualKm, 0)),
    plannedSessions: sessions.length,
    doneSessions: sessions.filter(isDone).length,
  }
}
