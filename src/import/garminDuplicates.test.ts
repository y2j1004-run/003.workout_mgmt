import { describe, expect, it } from 'vitest'
import { parseGarminCsv } from './garminCsv'
import { findDuplicates, mergeGarmin, pairByDistance, repairDay } from './mergeGarmin'
import { parseLog, type DayEntry } from './parseLog'

const empty = (date: string): DayEntry => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] })
const csv = (rows: string) => parseGarminCsv(`Activity Type,Date,Distance,Time\n${rows}`).activities

// a treadmill run logged as 6.4km that the watch measured as 5.1km, plus a road run
const logged = parseLog(`[ 2026년 ]
10.13 : 6.4키로, 웨이트
               10.2키로(동백역-기흥역)
10.15 : 14키로(430*12km)
`).days

describe('pairing runs of the same day', () => {
  it('pairs closest distances one to one within a loose bound', () => {
    expect(pairByDistance([10.3, 5.1], [6.4, 10.2])).toEqual([
      [0, 1],
      [1, 0],
    ])
    expect(pairByDistance([2], [21.1])).toEqual([])
  })
})

describe('mergeGarmin on logged days', () => {
  it('attaches a treadmill reading far from the logged distance instead of adding a second run', () => {
    const { days, stats } = mergeGarmin(logged, csv('Treadmill Running,2026-10-13 06:00:00,5.10,00:35:00\nRunning,2026-10-13 19:00:00,10.31,00:50:00\n'), empty)
    expect(stats).toMatchObject({ matched: 2, added: 0, extras: [] })
    const runs = days.find((d) => d.date === '2026-10-13')!.activities
    expect(runs.map((a) => [a.distanceKm, a.garmin?.distanceKm])).toEqual([
      [6.4, 5.1],
      [10.2, 10.31],
    ])
  })

  it('reports a watch run with no logged partner instead of adding it, unless the user asks', () => {
    const rows = csv('Running,2026-10-15 05:30:00,2.01,00:12:00\nRunning,2026-10-15 06:00:00,14.05,01:01:00\n')
    const first = mergeGarmin(logged, rows, empty)
    expect(first.stats.matched).toBe(1)
    expect(first.stats.extras.map((g) => g.distanceKm)).toEqual([2.01])
    expect(first.days.find((d) => d.date === '2026-10-15')!.activities).toHaveLength(1)

    const chosen = mergeGarmin(logged, rows, empty, new Set([rows[0].startTime]))
    expect(chosen.stats).toMatchObject({ added: 1, extras: [] })
  })

  it('still adds watch runs on days with nothing logged', () => {
    const { stats } = mergeGarmin(logged, csv('Running,2026-10-16 06:00:00,6.50,00:35:00\n'), empty)
    expect(stats).toMatchObject({ added: 1, extras: [] })
  })
})

describe('cleaning up duplicates from earlier imports', () => {
  // what the old rule produced: the treadmill reading was added as a second run
  const broken: DayEntry = {
    ...logged[0],
    activities: [
      ...logged[0].activities.map((a, i) => (i === 1 ? { ...a, garmin: { startTime: 'b', distanceKm: 10.31, durationSec: 3000 } } : a)),
      { kind: 'run', distanceKm: 5.1, source: 'garmin', garmin: { startTime: 'a', distanceKm: 5.1, durationSec: 2100 }, companions: [], details: [], tags: [] },
      { kind: 'run', distanceKm: 1.5, source: 'garmin', garmin: { startTime: 'c', distanceKm: 1.5 }, companions: [], details: [], tags: [] },
    ],
  }

  it('finds the watch copy of a logged run and leftovers', () => {
    const report = findDuplicates([broken])
    expect(report.pairs).toEqual([{ date: '2026-10-13', loggedIndex: 0, garminIndex: 2, loggedKm: 6.4, garminKm: 5.1 }])
    expect(report.extras).toEqual([{ date: '2026-10-13', index: 3, km: 1.5 }])
  })

  it('moves the watch data onto the logged run and hides the copies', () => {
    const report = findDuplicates([broken])
    const fixed = repairDay(broken, report.pairs, [3])
    const live = fixed.activities.filter((a) => !a.deleted)
    expect(live.map((a) => [a.distanceKm, a.garmin?.startTime, a.durationSec])).toEqual([
      [6.4, 'a', 2100],
      [10.2, 'b', undefined],
    ])
    expect(findDuplicates([fixed])).toEqual({ pairs: [], extras: [] })
  })

  it('a later import of the same file does not bring the copies back', () => {
    const fixed = repairDay(broken, findDuplicates([broken]).pairs, [3])
    const again = mergeGarmin([fixed], csv('Treadmill Running,2026-10-13 06:00:00,5.10,00:35:00\n').map((g) => ({ ...g, startTime: 'a' })), empty)
    expect(again.stats).toMatchObject({ updated: 1, added: 0, extras: [] })
  })
})
