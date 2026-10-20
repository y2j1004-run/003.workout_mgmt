import { db } from './db'

export type Sex = 'male' | 'female'

/** Used to pick reference ranges; stays on the phone (and in backups). */
export interface Profile {
  sex?: Sex
  heightCm?: number
  /** the birth year is enough for age-based ranges */
  birthYear?: number
  /** max heart rate as set in Garmin's heart rate zones */
  maxHr?: number
}

export interface Vo2Entry {
  date: string
  value: number
}

const PROFILE = 'profile'
const VO2 = 'vo2max'

export async function getProfile(): Promise<Profile> {
  return ((await db.meta.get(PROFILE))?.value as Profile | undefined) ?? {}
}

export async function setProfile(p: Profile) {
  await db.meta.put({ key: PROFILE, value: p })
}

export async function getVo2Entries(): Promise<Vo2Entry[]> {
  return ((await db.meta.get(VO2))?.value as Vo2Entry[] | undefined) ?? []
}

export async function setVo2Entries(entries: Vo2Entry[]) {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  await db.meta.put({ key: VO2, value: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) })
}

/** Adds or replaces the value for a date. */
export async function saveVo2(entry: Vo2Entry) {
  await setVo2Entries([...(await getVo2Entries()).filter((e) => e.date !== entry.date), entry])
}

export async function deleteVo2(date: string) {
  await setVo2Entries((await getVo2Entries()).filter((e) => e.date !== date))
}
