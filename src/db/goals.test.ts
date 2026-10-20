import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addCustomGoal, customGoalRatio, deleteCustomGoal, getCustomGoals, updateCustomGoal } from './goals'

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
