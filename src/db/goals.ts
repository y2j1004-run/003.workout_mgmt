import { weekStart, type Goals } from '../analytics/home'
import { addDays, fmtTime } from '../analytics/stats'
import { db } from './db'

const KEY = 'goals'

export async function getGoals(): Promise<Goals> {
  return ((await db.meta.get(KEY))?.value as Goals | undefined) ?? {}
}

export async function setGoals(goals: Goals) {
  await db.meta.put({ key: KEY, value: goals })
}

/** A goal the user writes themselves: one-off (with a number target or just a check), or a daily/weekly habit. */
export interface CustomGoal {
  id: string
  title: string
  /** one of GOAL_CATEGORIES */
  category?: string
  /** missing means 'once' (goals made before habits existed) */
  repeat?: GoalRepeat
  target?: number
  current?: number
  unit?: string
  /** a record to beat downwards, like a 10k time */
  lower?: boolean
  /** target and current are seconds, shown as m:ss */
  time?: boolean
  /** YYYY-MM-DD */
  due?: string
  done?: boolean
  /** habits: the days (daily) or week starts (weekly) checked off */
  checks?: string[]
}

export type GoalRepeat = 'once' | 'daily' | 'weekly'

export const GOAL_CATEGORIES = [
  { id: 'exercise', label: '운동', icon: '🏃' },
  { id: 'diet', label: '식단', icon: '🥗' },
  { id: 'water', label: '수분', icon: '💧' },
  { id: 'supplement', label: '영양제', icon: '💊' },
  { id: 'sleep', label: '수면', icon: '😴' },
  { id: 'etc', label: '기타', icon: '⭐' },
] as const

export const categoryIcon = (id?: string) => GOAL_CATEGORIES.find((c) => c.id === id)?.icon ?? '⭐'

/** Ready-made goals to add with one tap (then adjusted if needed). */
export const GOAL_TEMPLATES: Omit<CustomGoal, 'id'>[] = [
  { title: '매일 물 2L 마시기', category: 'water', repeat: 'daily' },
  { title: '마그네슘·비타민 챙기기', category: 'supplement', repeat: 'daily' },
  { title: '오늘 식단 지키기', category: 'diet', repeat: 'daily' },
  { title: '이번 주 식단 지키기', category: 'diet', repeat: 'weekly' },
  { title: '10k TT 45:00 이내', category: 'exercise', repeat: 'once', target: 2700, lower: true, time: true },
  { title: '7시간 이상 자기', category: 'sleep', repeat: 'daily' },
]

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

/** Checks or unchecks a habit for the period containing `today`. */
export async function toggleHabit(id: string, today: string) {
  const g = (await getCustomGoals()).find((x) => x.id === id)
  if (!g) return
  const key = periodKey(g, today)
  const checks = g.checks ?? []
  await updateCustomGoal(id, { checks: checks.includes(key) ? checks.filter((c) => c !== key) : [...checks, key].sort() })
}

export const repeatOf = (g: CustomGoal): GoalRepeat => g.repeat ?? 'once'

/** The day (daily) or Monday of the week (weekly) a check for `date` is stored under. */
export function periodKey(g: CustomGoal, date: string): string {
  return repeatOf(g) === 'weekly' ? weekStart(date) : date
}

export function checkedNow(g: CustomGoal, today: string): boolean {
  return !!g.checks?.includes(periodKey(g, today))
}

/** Periods in a row checked, ending now (or the period before, if this one isn't checked yet). */
export function habitStreak(g: CustomGoal, today: string): number {
  const step = repeatOf(g) === 'weekly' ? 7 : 1
  const done = new Set(g.checks ?? [])
  let key = periodKey(g, today)
  if (!done.has(key)) key = addDays(key, -step)
  let n = 0
  while (done.has(key)) {
    n++
    key = addDays(key, -step)
  }
  return n
}

/** Days checked this week, for daily habits. */
export function daysThisWeek(g: CustomGoal, today: string): number {
  const start = weekStart(today)
  return (g.checks ?? []).filter((c) => c >= start && c <= today).length
}

/** 0..1 for one-off goals; a goal reached by its numbers counts as done too. */
export function customGoalRatio(g: CustomGoal): number {
  if (g.done) return 1
  if (!g.target || g.current == null) return 0
  if (g.lower) return g.current <= g.target ? 1 : Math.max(0, Math.min(1, g.target / g.current))
  return Math.max(0, Math.min(1, g.current / g.target))
}

/** Reads "45:00" or "1:40:00" as seconds, a plain number as itself. */
export function parseGoalValue(text: string): { value: number; time: boolean } | undefined {
  const t = text.trim()
  if (!t) return undefined
  if (t.includes(':')) {
    const parts = t.split(':').map(Number)
    if (parts.some((x) => !Number.isFinite(x) || x < 0) || parts.length > 3) return undefined
    return { value: parts.reduce((s, x) => s * 60 + x, 0), time: true }
  }
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? { value: n, time: false } : undefined
}

export function formatGoalValue(g: Pick<CustomGoal, 'time' | 'unit'>, v: number | undefined): string {
  if (v == null) return '-'
  return g.time ? fmtTime(v) : `${v}${g.unit ?? ''}`
}
