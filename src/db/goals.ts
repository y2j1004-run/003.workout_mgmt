import type { Goals } from '../analytics/home'
import { db } from './db'

const KEY = 'goals'

export async function getGoals(): Promise<Goals> {
  return ((await db.meta.get(KEY))?.value as Goals | undefined) ?? {}
}

export async function setGoals(goals: Goals) {
  await db.meta.put({ key: KEY, value: goals })
}

/** A goal the user writes themselves; with a target number it shows progress, otherwise it is a checklist item. */
export interface CustomGoal {
  id: string
  title: string
  target?: number
  current?: number
  unit?: string
  /** YYYY-MM-DD */
  due?: string
  done?: boolean
}

const CUSTOM = 'customGoals'

export async function getCustomGoals(): Promise<CustomGoal[]> {
  return ((await db.meta.get(CUSTOM))?.value as CustomGoal[] | undefined) ?? []
}

export async function setCustomGoals(goals: CustomGoal[]) {
  await db.meta.put({ key: CUSTOM, value: goals })
}

export async function addCustomGoal(g: Omit<CustomGoal, 'id'>) {
  await setCustomGoals([...(await getCustomGoals()), { ...g, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }])
}

export async function updateCustomGoal(id: string, change: Partial<Omit<CustomGoal, 'id'>>) {
  await setCustomGoals((await getCustomGoals()).map((g) => (g.id === id ? { ...g, ...change } : g)))
}

export async function deleteCustomGoal(id: string) {
  await setCustomGoals((await getCustomGoals()).filter((g) => g.id !== id))
}

/** 0..1; a goal reached by its numbers counts as done too. */
export function customGoalRatio(g: CustomGoal): number {
  if (g.done) return 1
  if (g.target && g.current != null) return Math.max(0, Math.min(1, g.current / g.target))
  return 0
}
