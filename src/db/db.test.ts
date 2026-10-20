import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseLog } from '../import/parseLog'
import { addRun, db, saveDays, saveGarmin, setRunShoe, updateShoe } from './db'

const log = (body: string) => parseLog(`[ 2026년 ]\n${body}`).days

beforeEach(async () => {
  await db.days.clear()
  await db.shoes.clear()
})

describe('db', () => {
  it('registers shoes found in the log', async () => {
    await saveDays(log('06.01 : 10키로(공원, 디나엘4)'))
    expect((await db.shoes.toArray()).map((s) => s.name)).toEqual(['디나엘4'])
  })

  it('adds an app run with a shoe to a new or existing day', async () => {
    await saveDays(log('06.01 : 10키로'))
    await addRun('2026-06-01', 5, '새신발')
    await addRun('2026-06-02', 8, undefined, undefined, ' 광교호수공원 ')
    const d1 = await db.days.get('2026-06-01')
    expect(d1?.activities.map((a) => [a.distanceKm, a.shoe, a.source])).toEqual([
      [10, undefined, undefined],
      [5, '새신발', 'app'],
    ])
    expect((await db.days.get('2026-06-02'))?.activities[0]).toMatchObject({ distanceKm: 8, place: '광교호수공원' })
    expect(await db.shoes.get('새신발')).toBeDefined()
  })

  it('keeps app edits when the same day is imported again', async () => {
    await saveDays(log('06.01 : 10키로'))
    await setRunShoe('2026-06-01', 0, '레벨5')
    await addRun('2026-06-01', 3, '레벨5')
    await saveDays(log('06.01 : 10키로, 웨이트'))
    const day = await db.days.get('2026-06-01')
    expect(day?.strength?.done).toBe(true)
    expect(day?.activities.map((a) => [a.distanceKm, a.shoe])).toEqual([
      [10, '레벨5'],
      [3, '레벨5'],
    ])
  })

  it('stores the distance a shoe had before tracking', async () => {
    await updateShoe('디나엘4', { initialKm: 300 })
    expect(await db.shoes.get('디나엘4')).toMatchObject({ initialKm: 300, retired: false })
  })
})

describe('garmin', () => {
  it('keeps watch data when the text log is imported again', async () => {
    const { parseGarminCsv } = await import('../import/garminCsv')
    await saveGarmin(parseGarminCsv('Activity Type,Date,Distance,Time,Avg HR\nRunning,2026-06-01 06:00:00,10.05,00:50:00,150\n').activities)
    // watch-only run first, then the log for the same day arrives
    await saveDays(log('06.01 : 10키로(공원), 웨이트'))
    const day = await db.days.get('2026-06-01')
    expect(day?.activities).toHaveLength(1)
    expect(day?.activities[0]).toMatchObject({ distanceKm: 10.05, place: '공원', garmin: { avgHr: 150 }, durationSec: 3000 })
  })
})

describe('garmin then log re-import', () => {
  it('joins a watch-only treadmill run to the logged run that arrives later', async () => {
    const { parseGarminCsv } = await import('../import/garminCsv')
    await saveGarmin(parseGarminCsv('Activity Type,Date,Distance,Time\nTreadmill Running,2026-06-03 06:00:00,5.10,00:35:00\n').activities)
    await saveDays(log('06.03 : 6.4키로, 웨이트'))
    const day = await db.days.get('2026-06-03')
    expect(day?.activities.map((a) => [a.distanceKm, a.garmin?.distanceKm])).toEqual([[5.1, 5.1]])
  })

  it('keeps the watch distance when the text log is imported again after pairing', async () => {
    const { parseGarminCsv } = await import('../import/garminCsv')
    await saveDays(log('06.04 : 8키로(공원)'))
    await saveGarmin(parseGarminCsv('Activity Type,Date,Distance,Time\nRunning,2026-06-04 06:00:00,8.62,00:43:00\n').activities)
    await saveDays(log('06.04 : 8키로(공원)'))
    await saveDays(log('06.04 : 8키로(공원)'))
    const day = await db.days.get('2026-06-04')
    expect(day?.activities.map((a) => [a.distanceKm, a.place, a.durationSec])).toEqual([[8.62, '공원', 2580]])
  })
})
