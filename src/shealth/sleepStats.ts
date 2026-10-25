// What the imported nights mean for the rest of the app: averages, and sleep goals that check themselves.

import { addDays } from '../analytics/stats'
import { repeatOf, type CustomGoal } from '../db/goals'
import { sleepHoursIn, type SleepNight } from './shealth'

/** Average minutes asleep over the nights woken up on in the `days` days ending `today`, if at least `min` nights. */
export function avgSleep(nights: SleepNight[], today: string, days = 7, min = 4): number | undefined {
  const from = addDays(today, -(days - 1))
  const recent = nights.filter((n) => n.date >= from && n.date <= today)
  return recent.length >= min ? recent.reduce((s, n) => s + n.minutes, 0) / recent.length : undefined
}

/** Dates on which a daily sleep goal ("7시간 이상 자기") was met by the recorded sleep. */
export function sleepGoalDates(goal: CustomGoal, nights: SleepNight[]): Set<string> {
  const hours = goal.category === 'sleep' && repeatOf(goal) === 'daily' ? sleepHoursIn(goal.title) : undefined
  return new Set(hours ? nights.filter((n) => n.minutes >= hours * 60).map((n) => n.date) : [])
}

/** The goal with recorded sleep counted as checks (for display; nothing is saved). */
export function withSleepChecks(goal: CustomGoal, nights: SleepNight[]): CustomGoal {
  const auto = sleepGoalDates(goal, nights)
  return auto.size ? { ...goal, checks: [...new Set([...(goal.checks ?? []), ...auto])].sort() } : goal
}

export const fmtHours = (min: number) => `${Math.floor(min / 60)}시간 ${Math.round(min % 60)}분`
