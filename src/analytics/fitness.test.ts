import { describe, expect, it } from 'vitest'
import type { DayEntry } from '../import/parseLog'
import { ageOn, intensityMix, maxHeartRate, vo2FitnessGroup, vo2Level, vo2Series, zoneBounds, zoneOf } from './fitness'
import { runsOf } from './stats'

const day = (date: string, extra: Partial<DayEntry> = {}): DayEntry => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [], ...extra })
const run = (date: string, km: number, avgHr?: number, maxHr?: number) =>
  day(date, {
    activities: [{ kind: 'run', distanceKm: km, companions: [], details: [], tags: [], garmin: avgHr ? { distanceKm: km, avgHr, maxHr, startTime: `${date} 06:00:00` } as never : undefined }],
  })

describe('fitness', () => {
  it('works out age from the birth year', () => {
    expect(ageOn(1980, '2026-10-20')).toBe(46)
    expect(ageOn(undefined, '2026-10-20')).toBeUndefined()
  })

  it('merges log and typed VO2max values, typed ones winning', () => {
    const s = vo2Series([day('2025-06-01', { metrics: { vo2max: 46 } }), day('2026-01-17', { metrics: { vo2max: 56 } })], [{ date: '2026-01-17', value: 55 }, { date: '2026-10-01', value: 54 }])
    expect(s).toEqual([
      { date: '2025-06-01', value: 46 },
      { date: '2026-01-17', value: 55 },
      { date: '2026-10-01', value: 54 },
    ])
  })

  it('rates VO2max for the age group', () => {
    expect(vo2Level(56, 46)).toMatchObject({ level: '최상', group: '40대', next: undefined })
    expect(vo2Level(47, 46)).toMatchObject({ level: '우수', next: { level: '최상', value: 52.6 } })
    expect(vo2Level(40, 33, 'female').level).toBe('좋음')
    expect(vo2FitnessGroup(47)).toBe('20대')
    expect(vo2FitnessGroup(30)).toBeUndefined()
  })

  it('takes the higher of the age estimate and the recorded max HR', () => {
    expect(maxHeartRate(runsOf([run('2026-10-01', 10, 150, 180)]), 46)).toEqual({ bpm: 180, basis: '시계에 기록된 최고 심박' })
    expect(maxHeartRate(runsOf([run('2026-10-01', 10, 150, 170)]), 46)?.bpm).toBe(176)
    expect(maxHeartRate([], undefined)).toBeUndefined()
    expect(maxHeartRate(runsOf([run('2026-10-01', 10, 150, 190)]), 46, 178)).toEqual({ bpm: 178, basis: '내 정보에 넣은 값' })
  })

  it('uses Garmin zone bounds', () => {
    const max = { bpm: 178, basis: '' }
    expect(zoneBounds(max)).toEqual([89, 107, 125, 142, 160])
    const zone = (hr: number) => zoneOf(runsOf([run('2026-10-01', 5, hr)])[0], max)
    expect([80, 124, 125, 141, 142, 159, 160].map(zone)).toEqual([1, 2, 3, 3, 4, 4, 5])
  })

  it('splits distance by intensity', () => {
    const days = [run('2026-10-01', 10, 141), run('2026-10-03', 8, 150), run('2026-10-05', 5, 160), run('2026-10-06', 6), run('2026-08-01', 20, 140)]
    const mix = intensityMix(days, { bpm: 178, basis: '' }, '2026-09-23', '2026-10-20')
    expect(mix.km).toEqual({ easy: 10, tempo: 8, hard: 5 })
    expect(mix.noHrKm).toBe(6)
    expect(mix.easyShare).toBeCloseTo(10 / 23)
  })
})
