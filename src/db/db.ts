import Dexie, { type EntityTable } from 'dexie'
import type { GarminActivity } from '../import/garminCsv'
import { mergeGarmin, pairByDistance, sameRun, type GarminMergeStats } from '../import/mergeGarmin'
import type { Activity, DayEntry, RaceEdits } from '../import/parseLog'
import { mergeRecord, type InBodyRecord } from '../inbody/inbody'

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
export interface Meta {
  key: string
  value: unknown
}

export const db = new Dexie('workout-mgmt') as Dexie & {
  days: EntityTable<StoredDay, 'date'>
  shoes: EntityTable<Shoe, 'name'>
  meta: EntityTable<Meta, 'key'>
  inbody: EntityTable<InBodyRecord, 'date'>
}

db.version(1).stores({ days: 'date' })
db.version(2).stores({ days: 'date', shoes: 'name' })
db.version(3).stores({ days: 'date', shoes: 'name', meta: 'key' })
db.version(4).stores({ days: 'date', shoes: 'name', meta: 'key', inbody: 'date' })

/** Saves InBody measurements, combining with what is stored for the same date. */
export async function saveInBody(records: InBodyRecord[]): Promise<{ added: number; updated: number }> {
  return db.transaction('rw', db.inbody, async () => {
    let added = 0
    let updated = 0
    for (const r of records) {
      const existing = await db.inbody.get(r.date)
      await db.inbody.put(mergeRecord(existing, r))
      if (existing) updated++
      else added++
    }
    return { added, updated }
  })
}

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

/** Carries what the app added to a day (shoes, app and watch runs) over to the freshly imported log entry. */
function mergeAppEdits(next: DayEntry, prev?: DayEntry): DayEntry {
  if (!prev) return next
  const fromLog = prev.activities.filter((p) => !p.source)
  const activities: Activity[] = next.activities.map((a, i) => {
    const before = fromLog[i]
    if (!before || !sameRun(before.appEdits?.logDistanceKm ?? before.distanceKm, a.distanceKm)) return a
    const carried = { ...a, shoe: a.shoe ?? before.shoe, garmin: before.garmin, durationSec: a.durationSec ?? before.durationSec, paceSecPerKm: a.paceSecPerKm ?? before.paceSecPerKm }
    return before.appEdits ? applyRaceEdits(carried, before.appEdits) : carried
  })
  // a watch run that now also appears in the log joins that run instead of being counted twice
  const extras = prev.activities.filter((p) => p.source)
  const watch = extras.filter((e) => e.source === 'garmin' && !e.deleted)
  const open = activities.filter((a) => !a.garmin && !a.source && !a.deleted)
  const joined = new Set<Activity>()
  for (const [wi, oi] of pairByDistance(
    watch.map((w) => w.distanceKm),
    open.map((a) => a.distanceKm),
  )) {
    const w = watch[wi]
    Object.assign(open[oi], { garmin: w.garmin, shoe: open[oi].shoe ?? w.shoe, durationSec: open[oi].durationSec ?? w.durationSec, paceSecPerKm: open[oi].paceSecPerKm ?? w.paceSecPerKm })
    joined.add(w)
  }
  activities.push(...extras.filter((e) => !joined.has(e)))
  return { ...next, activities }
}

/** Applies the user's corrections and recomputes pace from the race (or run) distance. */
export function applyRaceEdits(a: Activity, edits: RaceEdits): Activity {
  const next: Activity = { ...a, appEdits: { ...a.appEdits, ...edits } }
  if (edits.distanceKm !== undefined && edits.distanceKm !== a.distanceKm) {
    if (!a.source && next.appEdits!.logDistanceKm === undefined) next.appEdits!.logDistanceKm = a.distanceKm
    next.distanceKm = edits.distanceKm
  }
  if (edits.place !== undefined) next.place = edits.place || undefined
  if (edits.deleted !== undefined) next.deleted = edits.deleted || undefined
  if (edits.race !== undefined) next.race = edits.race
  if (edits.event !== undefined) next.event = edits.event || undefined
  if (edits.raceDistanceKm !== undefined) next.raceDistanceKm = edits.raceDistanceKm ?? undefined
  if (edits.durationSec !== undefined) next.durationSec = edits.durationSec ?? undefined
  if (next.durationSec && (edits.durationSec !== undefined || edits.distanceKm !== undefined || edits.raceDistanceKm !== undefined)) next.paceSecPerKm = Math.round(next.durationSec / (next.raceDistanceKm ?? next.distanceKm))
  else if (edits.durationSec === null) next.paceSecPerKm = undefined
  // otherwise keep a pace written in the log ("평페 434")
  return next
}

/** Corrects the race fields of the index-th activity of a day (or marks it as a race / not a race). */
export async function editRace(date: string, index: number, edits: RaceEdits) {
  await db.transaction('rw', db.days, async () => {
    const day = await db.days.get(date)
    if (!day?.activities[index]) return
    const activities = day.activities.map((a, i) => (i === index ? applyRaceEdits(a, edits) : a))
    await db.days.put({ ...day, activities, savedAt: Date.now() })
  })
}

export interface RunChanges {
  date: string
  distanceKm: number
  place?: string
  durationSec?: number
}

/**
 * Edits a run. Changing the date moves it: the run becomes an app-entered run on the new day,
 * and the original is marked deleted so a re-import of the log doesn't put it back.
 */
export async function editRun(date: string, index: number, c: RunChanges) {
  await db.transaction('rw', db.days, async () => {
    const day = await db.days.get(date)
    const run = day?.activities[index]
    if (!day || !run) return
    const edits: RaceEdits = { distanceKm: c.distanceKm, place: c.place ?? null, durationSec: c.durationSec ?? null }
    if (c.date === date) {
      const activities = day.activities.map((a, i) => (i === index ? applyRaceEdits(a, edits) : a))
      await db.days.put({ ...day, activities, savedAt: Date.now() })
      return
    }
    const moved = applyRaceEdits({ ...run, source: 'app', appEdits: undefined }, edits)
    await db.days.put({ ...day, activities: removeRun(day.activities, index), savedAt: Date.now() })
    const target = (await db.days.get(c.date)) ?? emptyDay(c.date)
    await db.days.put({ ...target, activities: [...target.activities, moved], savedAt: Date.now() })
  })
}

/** Deletes a run: app-entered runs are removed, logged or watch runs are marked deleted. */
export async function deleteRun(date: string, index: number) {
  await db.transaction('rw', db.days, async () => {
    const day = await db.days.get(date)
    if (!day?.activities[index]) return
    await db.days.put({ ...day, activities: removeRun(day.activities, index), savedAt: Date.now() })
  })
}

function removeRun(activities: Activity[], index: number): Activity[] {
  return activities[index].source === 'app'
    ? activities.filter((_, i) => i !== index)
    : activities.map((a, i) => (i === index ? applyRaceEdits(a, { deleted: true }) : a))
}

/** Adds a race that is not in the log as a run of its own. */
export async function addRace(date: string, event: string, distanceKm: number, durationSec?: number) {
  await db.transaction('rw', db.days, async () => {
    const day = (await db.days.get(date)) ?? emptyDay(date)
    const base: Activity = { kind: 'run', distanceKm, source: 'app', companions: [], details: [], tags: [] }
    const run = applyRaceEdits(base, { race: true, event, durationSec: durationSec ?? null })
    await db.days.put({ ...day, activities: [...day.activities, run], savedAt: Date.now() })
  })
}

/** Merges a Garmin Connect export into the stored days. */
export async function saveGarmin(activities: GarminActivity[], addAnyway?: Set<string>): Promise<GarminMergeStats> {
  return db.transaction('rw', db.days, async () => {
    const dates = [...new Set(activities.map((a) => a.date))]
    const existing = (await db.days.bulkGet(dates)).filter((d) => !!d)
    const { days, stats } = mergeGarmin(existing, activities, emptyDay, addAnyway)
    const savedAt = Date.now()
    await db.days.bulkPut(days.map((d) => ({ ...d, savedAt })))
    return stats
  })
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
