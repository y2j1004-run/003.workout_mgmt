import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { runsOf } from '../analytics/stats'
import { parseGarminCsv } from '../import/garminCsv'
import { parseLog } from '../import/parseLog'
import { addRun, db, deleteRun, editRun, saveDays, saveGarmin } from './db'

const LOG = `[ 2026년 ]
10.18 : 4키로(공원)
10.19 : 8키로, 웨이트
10.20 : 12키로(527*10km)
               5키로
`
const log = () => parseLog(LOG).days
const runs = async () => runsOf(await db.days.orderBy('date').toArray()).map((r) => [r.date, r.distanceKm, r.place])

beforeEach(async () => {
  await db.days.clear()
  await saveDays(log())
})

describe('editing and deleting runs', () => {
  it('edits distance, place and time, and keeps the edit after re-importing the log', async () => {
    await editRun('2026-10-20', 0, { date: '2026-10-20', distanceKm: 12.3, place: '탄천', durationSec: 3600 })
    await saveDays(log())
    const day = await db.days.get('2026-10-20')
    expect(day?.activities[0]).toMatchObject({ distanceKm: 12.3, place: '탄천', durationSec: 3600, paceSecPerKm: 293, details: ['527*10km'] })
    expect(day?.activities).toHaveLength(2)
  })

  it('deletes a logged run for good and removes an app run outright', async () => {
    await addRun('2026-10-19', 3)
    await deleteRun('2026-10-20', 1)
    await deleteRun('2026-10-19', 1)
    await saveDays(log())
    expect(await runs()).toEqual([
      ['2026-10-18', 4, '공원'],
      ['2026-10-19', 8, undefined],
      ['2026-10-20', 12, undefined],
    ])
    expect((await db.days.get('2026-10-19'))?.activities).toHaveLength(1)
  })

  it('moves a run to another date', async () => {
    await editRun('2026-10-18', 0, { date: '2026-10-17', distanceKm: 4, place: '공원' })
    await saveDays(log())
    expect(await runs()).toEqual([
      ['2026-10-17', 4, '공원'],
      ['2026-10-19', 8, undefined],
      ['2026-10-20', 12, undefined],
      ['2026-10-20', 5, undefined],
    ])
  })

  it('does not bring a deleted run back through a Garmin import', async () => {
    await deleteRun('2026-10-20', 1)
    await saveGarmin(parseGarminCsv('Activity Type,Date,Distance,Time\nRunning,2026-10-20 18:00:00,5.02,00:27:00\n').activities)
    expect((await runs()).filter((r) => r[0] === '2026-10-20')).toEqual([['2026-10-20', 12, undefined]])
  })
})

describe('run themes and Garmin places', () => {
  it('keeps a chosen theme after re-importing the log', async () => {
    await editRun('2026-10-19', 0, { date: '2026-10-19', distanceKm: 8, theme: '지속주' })
    await saveDays(log())
    expect((await db.days.get('2026-10-19'))?.activities[0].theme).toBe('지속주')
  })

  it('uses the Garmin title as the place when the run has none', async () => {
    await saveGarmin(
      parseGarminCsv('Activity Type,Date,Title,Distance,Time\nRunning,2026-10-19 06:00:00,용인시 러닝,8.05,00:40:00\nRunning,2026-10-21 06:00:00,수원시 러닝,10.0,00:50:00\n').activities,
    )
    expect((await db.days.get('2026-10-19'))?.activities[0].place).toBe('용인시')
    expect((await db.days.get('2026-10-21'))?.activities[0].place).toBe('수원시')
    expect((await db.days.get('2026-10-18'))?.activities[0].place).toBe('공원')
  })
})
