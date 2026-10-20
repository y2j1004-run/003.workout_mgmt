import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseLog } from '../import/parseLog'
import { addRun, db, saveDays, setRunShoe, updateShoe } from './db'

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
    await addRun('2026-06-02', 8)
    const d1 = await db.days.get('2026-06-01')
    expect(d1?.activities.map((a) => [a.distanceKm, a.shoe, a.source])).toEqual([
      [10, undefined, undefined],
      [5, '새신발', 'app'],
    ])
    expect((await db.days.get('2026-06-02'))?.activities[0].distanceKm).toBe(8)
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
