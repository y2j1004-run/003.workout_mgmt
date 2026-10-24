import { db } from './db'

/** A race the user has signed up for; the weekly plan tapers toward it. */
export interface UpcomingRace {
  id: string
  /** YYYY-MM-DD */
  date: string
  name: string
  distanceKm: number
  /** target finish time in seconds */
  goalSec?: number
}

const KEY = 'upcomingRaces'

export async function getUpcomingRaces(): Promise<UpcomingRace[]> {
  return ((await db.meta.get(KEY))?.value as UpcomingRace[] | undefined) ?? []
}

export async function setUpcomingRaces(races: UpcomingRace[]) {
  await db.meta.put({ key: KEY, value: [...races].sort((a, b) => a.date.localeCompare(b.date)) })
}

export async function addUpcomingRace(r: Omit<UpcomingRace, 'id'>) {
  await setUpcomingRaces([...(await getUpcomingRaces()), { ...r, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }])
}

export async function deleteUpcomingRace(id: string) {
  await setUpcomingRaces((await getUpcomingRaces()).filter((r) => r.id !== id))
}

/** Days from `today` to the race (0 on race day). */
export function daysUntil(race: Pick<UpcomingRace, 'date'>, today: string): number {
  return Math.round((Date.parse(race.date) - Date.parse(today)) / 864e5)
}
