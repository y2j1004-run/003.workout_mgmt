import type { Goals } from '../analytics/home'
import { db } from './db'

const KEY = 'goals'

export async function getGoals(): Promise<Goals> {
  return ((await db.meta.get(KEY))?.value as Goals | undefined) ?? {}
}

export async function setGoals(goals: Goals) {
  await db.meta.put({ key: KEY, value: goals })
}
