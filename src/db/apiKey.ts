import { db } from './db'

// Stored only in this phone's IndexedDB; excluded from backups so a backup file never carries it.
const KEY = 'anthropicApiKey'

export async function getApiKey(): Promise<string | undefined> {
  return (await db.meta.get(KEY))?.value as string | undefined
}

export async function setApiKey(value: string | undefined) {
  if (value) await db.meta.put({ key: KEY, value })
  else await db.meta.delete(KEY)
}
