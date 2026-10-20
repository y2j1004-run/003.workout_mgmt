import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { personalBests, races } from '../analytics/stats'
import { parseLog } from '../import/parseLog'
import { addRace, db, editRace, saveDays } from './db'

const LOG = `[ 2026년 ]
03.15 : 3키로(워밍업)
               10키로(테스트마라톤, 42분 58초)
06.07 : 30키로(성남-원효대교, 114 도킹마라톤)
06.14 : 11.7키로(고래런, 공원)
09.20 : 32키로(백제마라톤, 평페 434)
`
const log = () => parseLog(LOG).days
const all = async () => db.days.orderBy('date').toArray()

beforeEach(async () => {
  await db.days.clear()
  await saveDays(log())
})

describe('race editing', () => {
  it('starts from the automatic detection', async () => {
    expect(races(await all()).map((r) => r.event)).toEqual(['백제마라톤', '114 도킹마라톤', '테스트마라톤'])
  })

  it('fixes distance and time and recomputes pace', async () => {
    const r = races(await all()).find((x) => x.event === '백제마라톤')!
    await editRace(r.date, r.index, { raceDistanceKm: 32, durationSec: 2 * 3600 + 26 * 60 + 8 })
    expect(races(await all())[0]).toMatchObject({ raceDistanceKm: 32, durationSec: 8768, paceSecPerKm: 274 })
  })

  it('keeps a pace from the log when only the name changes', async () => {
    const r = races(await all()).find((x) => x.event === '백제마라톤')!
    await editRace(r.date, r.index, { event: '공주백제마라톤' })
    expect(races(await all())[0]).toMatchObject({ event: '공주백제마라톤', paceSecPerKm: 274 })
  })

  it('removes a training run from the list and adds a missed race', async () => {
    const training = races(await all()).find((x) => x.event === '114 도킹마라톤')!
    await editRace(training.date, training.index, { race: false })
    const day = await db.days.get('2026-06-14')
    await editRace('2026-06-14', 0, { race: true, raceDistanceKm: 10, durationSec: 2700 })
    await addRace('2026-10-26', '춘천마라톤', 42.195, 3 * 3600 + 30 * 60)
    expect(day?.activities[0].event).toBe('고래런')
    expect(races(await all()).map((r) => r.event)).toEqual(['춘천마라톤', '백제마라톤', '고래런', '테스트마라톤'])
  })

  it('keeps corrections when the text log is imported again', async () => {
    await editRace('2026-06-07', 0, { race: false })
    await editRace('2026-03-15', 1, { durationSec: 2570 })
    await saveDays(log())
    const list = races(await all())
    expect(list.map((r) => r.event)).toEqual(['백제마라톤', '테스트마라톤'])
    expect(list[1]).toMatchObject({ durationSec: 2570, paceSecPerKm: 257 })
  })

  it('finds the best time per standard distance', async () => {
    await addRace('2026-04-05', '하프 대회', 21.1, 5913)
    await editRace('2026-06-14', 0, { race: true, raceDistanceKm: 10, durationSec: 2500 })
    const pbs = personalBests(races(await all()))
    expect(pbs.map((p) => [p.label, p.race.event, p.race.durationSec])).toEqual([
      ['10K', '고래런', 2500],
      ['하프', '하프 대회', 5913],
    ])
  })
})
