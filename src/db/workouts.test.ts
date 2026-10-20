import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { weekSummary } from '../analytics/home'
import { runsOf } from '../analytics/stats'
import { didStrength, workoutsOf, WORKOUT_TYPES } from '../analytics/workouts'
import { parseLog } from '../import/parseLog'
import { addWorkout, db, deleteRun, saveDays } from './db'

const log = () => parseLog('[ 2026년 ]\n10.19 : 8키로, 웨이트\n10.20 : 5키로\n').days
const type = (label: string) => WORKOUT_TYPES.find((t) => t.label === label)!

beforeEach(async () => {
  await db.days.clear()
})

describe('other workouts', () => {
  it('saves walks, hikes, strength and sports apart from runs and keeps them on log re-import', async () => {
    await saveDays(log())
    await addWorkout('2026-10-20', { kind: 'strength', exercises: ['스쿼트', '랫풀다운'], durationSec: 3000 })
    await addWorkout('2026-10-20', { kind: 'sport', sport: '탁구', durationSec: 3600, place: ' 체육관 ' })
    await addWorkout('2026-10-21', { kind: 'hike', distanceKm: 8.2, place: '광교산' })
    await addWorkout('2026-10-21', { kind: 'sport', sport: '수영' })
    await saveDays(log())
    const days = await db.days.orderBy('date').toArray()

    expect(runsOf(days).map((r) => r.distanceKm)).toEqual([8, 5])
    expect(workoutsOf(days, type('웨이트'))[0]).toMatchObject({ exercises: ['스쿼트', '랫풀다운'], distanceKm: 0, durationSec: 3000 })
    expect(workoutsOf(days, type('탁구'))[0]).toMatchObject({ place: '체육관' })
    expect(workoutsOf(days, type('축구'))).toEqual([])
    expect(workoutsOf(days, type('기타')).map((w) => w.sport)).toEqual(['수영'])
    expect(workoutsOf(days, type('등산'))[0]).toMatchObject({ date: '2026-10-21', distanceKm: 8.2 })
    expect(days.map(didStrength)).toEqual([true, true, false])
    expect(weekSummary(days, '2026-10-21').strengthDays).toBe(2)
  })

  it('deletes an app-entered workout', async () => {
    await addWorkout('2026-10-20', { kind: 'walk', distanceKm: 3 })
    const [w] = workoutsOf(await db.days.toArray(), type('걷기'))
    await deleteRun(w.date, w.index)
    expect(workoutsOf(await db.days.toArray(), type('걷기'))).toEqual([])
  })
})
