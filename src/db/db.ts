import Dexie, { type EntityTable } from 'dexie'
import type { DayEntry } from '../import/parseLog'

export interface StoredDay extends DayEntry {
  savedAt: number
}

// All health data lives only in this browser's IndexedDB.
export const db = new Dexie('workout-mgmt') as Dexie & {
  days: EntityTable<StoredDay, 'date'>
}

db.version(1).stores({
  days: 'date',
})

/** Saves parsed days; a day that already exists is replaced by the new one. */
export async function saveDays(days: DayEntry[]): Promise<{ added: number; replaced: number }> {
  const existing = new Set(await db.days.bulkGet(days.map((d) => d.date)).then((r) => r.filter(Boolean).map((d) => d!.date)))
  const savedAt = Date.now()
  await db.days.bulkPut(days.map((d) => ({ ...d, savedAt })))
  // ask the browser not to evict our data when storage runs low
  await navigator.storage?.persist?.().catch(() => false)
  return { added: days.length - existing.size, replaced: existing.size }
}

export function clearDays() {
  return db.days.clear()
}
