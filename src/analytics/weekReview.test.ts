import { describe, expect, it } from 'vitest'
import type { Activity, DayEntry } from '../import/parseLog'
import { addDays } from './stats'
import { reviewWeek } from './weekReview'

const run = (km: number): Activity => ({ kind: 'run', distanceKm: km, companions: [], details: [], tags: [] })
const day = (date: string, activities: Activity[], strength = false): DayEntry => ({
  date,
  activities,
  metrics: {},
  stretching: false,
  rest: false,
  notes: [],
  issues: [],
  raw: [],
  strength: strength ? { done: true, parts: [] } : undefined,
})

/** Eight weeks of Mon/Tue/Thu/Sat runs and a Sunday long run, ending Sunday 2026-10-25. */
function history(): DayEntry[] {
  const out: DayEntry[] = []
  for (let w = 8; w >= 1; w--) {
    const mon = addDays('2026-10-19', -7 * (w - 1))
    out.push(day(mon, [run(8)], true), day(addDays(mon, 1), [run(8)]), day(addDays(mon, 3), [run(8)], true), day(addDays(mon, 5), [run(8)]), day(addDays(mon, 6), [run(16)]))
  }
  return out
}

describe('reviewWeek', () => {
  it("compares this week's plan from last Sunday with what was done so far", () => {
    const days = [...history(), day('2026-10-26', [run(8)], true), day('2026-10-27', [run(3)])]
    const r = reviewWeek({ days, inbody: [], today: '2026-10-28' })!
    expect(r.plan.start).toBe('2026-10-26')
    expect(r.days.map((d) => d.status)).toEqual(['done', 'partial', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(r.actualKm).toBe(11)
    expect(r.doneSessions).toBe(2)
    expect(r.plannedSessions).toBeGreaterThanOrEqual(6)
    expect(r.plannedKmSoFar).toBe(r.days[0].plannedKm + r.days[1].plannedKm)
  })

  it('marks missed and extra days once they are past, and ignores records made after Sunday for the plan', () => {
    const base = history()
    const days = [...base, day('2026-10-28', [{ ...run(0), kind: 'sport', sport: '탁구' }])]
    const r = reviewWeek({ days, inbody: [], today: '2026-10-30' })!
    const before = reviewWeek({ days: base, inbody: [], today: '2026-10-30' })!
    expect(r.plan).toEqual(before.plan)
    expect(r.days[0].status).toBe('missed')
    expect(r.days[2].status).toBe('extra')
  })
})
