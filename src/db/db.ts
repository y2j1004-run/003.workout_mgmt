import Dexie, { type EntityTable } from 'dexie'
import type { Activity, DayEntry } from '../import/parseLog'

export interface StoredDay extends DayEntry {
  savedAt: number
}

export interface Shoe {
  name: string
  /** distance run before this app started tracking the shoe */
  initialKm: number
  retired: boolean
  createdAt: number
}

// All health data lives only in this browser's IndexedDB.
export const db = new Dexie('workout-mgmt') as Dexie & {
  days: EntityTable<StoredDay, 'date'>
  shoes: EntityTable<Shoe, 'name'>
}

db.version(1).stores({ days: 'date' })
db.version(2).stores({ days: 'date', shoes: 'name' })

/**
 * Saves days read from the text log. A day that already exists is replaced, but what was
 * entered in the app survives: runs added in the app, and shoes picked for a run of the same distance.
 */
export async function saveDays(days: DayEntry[]): Promise<{ added: number; replaced: number }> {
  const old = new Map((await db.days.bulkGet(days.map((d) => d.date))).filter((d) => !!d).map((d) => [d.date, d]))
  const savedAt = Date.now()
  await db.transaction('rw', db.days, db.shoes, async () => {
    await db.days.bulkPut(days.map((d) => ({ ...mergeAppEdits(d, old.get(d.date)), savedAt })))
    await ensureShoes(days.flatMap((d) => d.activities.map((a) => a.shoe)))
  })
  // ask the browser not to evict our data when storage runs low
  await navigator.storage?.persist?.().catch(() => false)
  return { added: days.length - old.size, replaced: old.size }
}

function mergeAppEdits(next: DayEntry, prev?: DayEntry): DayEntry {
  if (!prev) return next
  const activities: Activity[] = next.activities.map((a, i) => {
    const before = prev.activities.filter((p) => p.source !== 'app')[i]
    return !a.shoe && before?.shoe && before.distanceKm === a.distanceKm ? { ...a, shoe: before.shoe } : a
  })
  activities.push(...prev.activities.filter((p) => p.source === 'app'))
  return { ...next, activities }
}

async function ensureShoes(names: (string | undefined)[]) {
  const unique = [...new Set(names.filter((n): n is string => !!n))]
  const existing = new Set((await db.shoes.bulkGet(unique)).filter((s) => !!s).map((s) => s.name))
  await db.shoes.bulkAdd(unique.filter((n) => !existing.has(n)).map((name) => newShoe(name)))
}

const newShoe = (name: string): Shoe => ({ name, initialKm: 0, retired: false, createdAt: Date.now() })

/** Adds a run entered in the app to the day (creating the day if needed). */
export async function addRun(date: string, distanceKm: number, shoe?: string) {
  await db.transaction('rw', db.days, db.shoes, async () => {
    const day = (await db.days.get(date)) ?? emptyDay(date)
    const run: Activity = { kind: 'run', distanceKm, shoe, source: 'app', companions: [], details: [], tags: [] }
    await db.days.put({ ...day, activities: [...day.activities, run], savedAt: Date.now() })
    await ensureShoes([shoe])
  })
}

/** Sets (or clears) the shoe of the index-th activity of a day. */
export async function setRunShoe(date: string, index: number, shoe: string | undefined) {
  await db.transaction('rw', db.days, db.shoes, async () => {
    const day = await db.days.get(date)
    if (!day?.activities[index]) return
    const activities = day.activities.map((a, i) => (i === index ? { ...a, shoe } : a))
    await db.days.put({ ...day, activities, savedAt: Date.now() })
    await ensureShoes([shoe])
  })
}

export async function updateShoe(name: string, change: Partial<Pick<Shoe, 'initialKm' | 'retired'>>) {
  const shoe = (await db.shoes.get(name)) ?? newShoe(name)
  await db.shoes.put({ ...shoe, ...change })
}

function emptyDay(date: string): StoredDay {
  return { date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [], savedAt: Date.now() }
}

export async function clearDays() {
  await db.days.clear()
}
