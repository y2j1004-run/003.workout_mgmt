import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { weekSummary } from '../analytics/home'
import { runsOf } from '../analytics/stats'
import { allEntries, didStrength, workoutStats, workoutsOf, WORKOUT_TYPES } from '../analytics/workouts'
import { parseLog } from '../import/parseLog'
import { addWorkout, db, deleteRun, editRun, saveDays } from './db'

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

  it('edits an app workout: exercises, sport name, time, place and date', async () => {
    await addWorkout('2026-10-20', { kind: 'strength', exercises: ['스쿼트'] })
    await addWorkout('2026-10-20', { kind: 'sport', sport: '수영', durationSec: 1800 })
    let [s] = workoutsOf(await db.days.toArray(), type('웨이트'))
    await editRun(s.date, s.index, { date: '2026-10-20', distanceKm: 0, exercises: ['스쿼트', '런지'], durationSec: 2400, memo: '하체 위주' })
    ;[s] = workoutsOf(await db.days.toArray(), type('웨이트'))
    expect(s).toMatchObject({ exercises: ['스쿼트', '런지'], durationSec: 2400, memo: '하체 위주', distanceKm: 0 })
    const [w] = workoutsOf(await db.days.toArray(), type('기타'))
    await editRun(w.date, w.index, { date: '2026-10-21', distanceKm: 0, sport: '요가', place: '집' })
    const days = await db.days.orderBy('date').toArray()
    expect(workoutsOf(days, type('기타'))).toMatchObject([{ date: '2026-10-21', sport: '요가', place: '집' }])
    expect(days[0].activities).toHaveLength(1)
  })

  it('lists every workout and sums them by type', async () => {
    await saveDays(log())
    await addWorkout('2026-10-20', { kind: 'hike', distanceKm: 8, durationSec: 7200 })
    await addWorkout('2026-10-21', { kind: 'sport', sport: '탁구', durationSec: 3600 })
    const days = await db.days.orderBy('date').toArray()
    const entries = allEntries(days)
    expect(entries.map((e) => `${e.date} ${e.label}`)).toEqual(['2026-10-21 탁구', '2026-10-20 러닝', '2026-10-20 등산', '2026-10-19 러닝', '2026-10-19 웨이트'])
    expect(entries.at(-1)!.act).toBeUndefined()
    const s = workoutStats(days, '2026-10-19', '2026-10-21')
    expect(s).toMatchObject({ activeDays: 3, sessions: 5, sec: 10800 })
    expect(s.byType.find((t) => t.label === '러닝')).toMatchObject({ count: 2, km: 13 })
    expect(s.byType.find((t) => t.label === '등산')).toMatchObject({ count: 1, km: 8, sec: 7200 })
  })
})
