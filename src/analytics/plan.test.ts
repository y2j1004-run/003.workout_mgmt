import { describe, expect, it } from 'vitest'
import type { Activity, DayEntry } from '../import/parseLog'
import type { InBodyRecord } from '../inbody/inbody'
import { planNextWeek } from './plan'
import { addDays } from './stats'

const run = (km: number, extra: Partial<Activity> = {}): Activity => ({ kind: 'run', distanceKm: km, companions: [], details: [], tags: [], ...extra })
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

/** Eight weeks of Mon/Tue/Thu/Sat runs and a Sunday long run, ending the week before 2026-10-26. */
function history(longKm = 16, easyKm = 8): DayEntry[] {
  const out: DayEntry[] = []
  for (let w = 8; w >= 1; w--) {
    const mon = addDays('2026-10-19', -7 * (w - 1))
    out.push(day(mon, [run(easyKm)], true), day(addDays(mon, 1), [run(easyKm)]), day(addDays(mon, 3), [run(easyKm)], true), day(addDays(mon, 5), [run(easyKm)]), day(addDays(mon, 6), [run(longKm)]))
  }
  return out
}

describe('planNextWeek', () => {
  it('keeps the usual days, puts the long run on the weekend and keeps volume near the average', () => {
    const p = planNextWeek({ days: history(), inbody: [], today: '2026-10-24' })!
    expect(p.start).toBe('2026-10-26')
    const kinds = p.days.map((d) => d.items.filter((i) => i.kind !== 'strength').map((i) => i.kind)[0])
    expect(kinds[6]).toBe('long')
    expect(kinds).toContain('quality')
    expect(kinds.filter((k) => k === 'rest').length).toBeGreaterThanOrEqual(1)
    expect(p.targetKm).toBeGreaterThanOrEqual(44)
    expect(p.targetKm).toBeLessThanOrEqual(55)
    expect(p.days.flatMap((d) => d.items).filter((i) => i.kind === 'strength')).toHaveLength(2)
  })

  it('makes an easier week after a race, without a quality session', () => {
    const days = history()
    days.push(day('2026-10-24', [run(21.1, { event: '하프마라톤', race: true })]))
    const p = planNextWeek({ days, inbody: [], today: '2026-10-24' })!
    expect(p.reasons.join()).toContain('대회 후')
    expect(p.days.flatMap((d) => d.items).some((i) => i.kind === 'quality')).toBe(false)
    expect(p.targetKm).toBeLessThan(45)
  })

  it('backs off after runs that felt hard and puts upper body first when an arm is below standard', () => {
    const days = history()
    days.push(day('2026-10-22', [run(8, { feeling: 'hard' })]), day('2026-10-23', [run(8, { feeling: 'hard' })]))
    const inbody: InBodyRecord[] = [{ date: '2026-10-20', source: 'sheet', segments: { rightArm: { kg: 3.1, pct: 101 }, leftArm: { kg: 2.9, pct: 97 } } }]
    const p = planNextWeek({ days, inbody, today: '2026-10-24' })!
    expect(p.reasons.join()).toContain('힘들었어요')
    const strength = p.days.flatMap((d) => d.items).filter((i) => i.kind === 'strength')
    expect(strength[0].title).toContain('상체')
    expect(strength[0].detail).toContain('왼팔')
  })

  it('needs some running history', () => {
    expect(planNextWeek({ days: [], inbody: [], today: '2026-10-24' })).toBeUndefined()
  })

  it('builds the race week around a race in it', () => {
    const races = [{ id: 'r', date: '2026-11-01', name: '가을 하프', distanceKm: 21.0975, goalSec: 6000 }]
    const p = planNextWeek({ days: history(), inbody: [], today: '2026-10-24', races })!
    expect(p.race?.name).toBe('가을 하프')
    const sun = p.days[6].items[0]
    expect(sun).toMatchObject({ kind: 'race', km: 21.1 })
    expect(sun.detail).toContain('4:44/km')
    expect(p.days[5].items[0].title).toBe('가볍게 몸풀기')
    expect(p.days.flatMap((d) => d.items).some((i) => i.kind === 'long')).toBe(false)
    expect(p.days.flatMap((d) => d.items).filter((i) => i.kind === 'quality')).toHaveLength(1)
    expect(p.targetKm).toBeLessThan(40)
  })

  it('tapers the week before a half and two weeks before a marathon', () => {
    const half = planNextWeek({ days: history(), inbody: [], today: '2026-10-24', races: [{ id: 'h', date: '2026-11-08', name: '하프', distanceKm: 21.0975 }] })!
    const base = planNextWeek({ days: history(), inbody: [], today: '2026-10-24' })!
    expect(half.targetKm).toBeLessThan(base.targetKm)
    expect(half.reasons.join()).toContain('대회 전 주')
    expect(half.days.flatMap((d) => d.items).find((i) => i.kind === 'quality')?.title).toBe('레이스 페이스런')
    const full = planNextWeek({ days: history(), inbody: [], today: '2026-10-24', races: [{ id: 'f', date: '2026-11-15', name: '풀', distanceKm: 42.195 }] })!
    expect(full.reasons.join()).toContain('2주 전')
    const far = planNextWeek({ days: history(), inbody: [], today: '2026-10-24', races: [{ id: 'x', date: '2026-12-20', name: '먼 대회', distanceKm: 10 }] })!
    expect(far.race).toBeUndefined()
    expect(far.targetKm).toBe(base.targetKm)
  })
})
