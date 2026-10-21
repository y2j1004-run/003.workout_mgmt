import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addCustomGoal, checkedNow, customGoalRatio, daysThisWeek, deleteCustomGoal, formatGoalValue, getCustomGoals, habitStreak, parseGoalValue, toggleHabit, updateCustomGoal } from './goals'

beforeEach(async () => {
  await db.meta.clear()
})

describe('custom goals', () => {
  it('adds, updates and deletes goals', async () => {
    await addCustomGoal({ title: '턱걸이 10개', target: 10, unit: '개' })
    await addCustomGoal({ title: '하프 완주' })
    const [a, b] = await getCustomGoals()
    await updateCustomGoal(a.id, { current: 6 })
    await updateCustomGoal(b.id, { done: true })
    const [a2, b2] = await getCustomGoals()
    expect(customGoalRatio(a2)).toBeCloseTo(0.6)
    expect(customGoalRatio(b2)).toBe(1)
    expect(customGoalRatio({ id: 'x', title: '체크만' })).toBe(0)
    expect(customGoalRatio({ id: 'x', title: '초과', target: 10, current: 12 })).toBe(1)
    await deleteCustomGoal(a.id)
    expect((await getCustomGoals()).map((g) => g.title)).toEqual(['하프 완주'])
  })
})

describe('habits and time goals', () => {
  it('checks a daily habit per day and counts the streak', async () => {
    await addCustomGoal({ title: '물 2L', repeat: 'daily' })
    const [g] = await getCustomGoals()
    for (const d of ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21']) await toggleHabit(g.id, d)
    await toggleHabit(g.id, '2026-10-21') // unchecked again
    const [g2] = await getCustomGoals()
    expect(checkedNow(g2, '2026-10-21')).toBe(false)
    expect(habitStreak(g2, '2026-10-21')).toBe(3)
    expect(daysThisWeek(g2, '2026-10-21')).toBe(2) // Mon 19th and Tue 20th
  })

  it('checks a weekly habit once per week', async () => {
    await addCustomGoal({ title: '주간 식단', repeat: 'weekly' })
    const [g] = await getCustomGoals()
    await toggleHabit(g.id, '2026-10-14')
    await toggleHabit(g.id, '2026-10-22')
    const [g2] = await getCustomGoals()
    expect(g2.checks).toEqual(['2026-10-12', '2026-10-19'])
    expect(checkedNow(g2, '2026-10-25')).toBe(true)
    expect(habitStreak(g2, '2026-10-25')).toBe(2)
  })

  it('reads times and rates lower-is-better goals', () => {
    expect(parseGoalValue('45:00')).toEqual({ value: 2700, time: true })
    expect(parseGoalValue('1:40:00')).toEqual({ value: 6000, time: true })
    expect(parseGoalValue('10')).toEqual({ value: 10, time: false })
    expect(parseGoalValue('ab')).toBeUndefined()
    const tt = { id: 'x', title: '10k', target: 2700, lower: true, time: true }
    expect(customGoalRatio({ ...tt, current: 3000 })).toBeCloseTo(0.9)
    expect(customGoalRatio({ ...tt, current: 2650 })).toBe(1)
    expect(formatGoalValue(tt, 2850)).toBe('47:30')
  })
})
