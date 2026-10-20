import type { Goals } from '../analytics/home'
import type { InBodyRecord } from '../inbody/inbody'
import { getGoals, setGoals } from './goals'
import { getStatsOrder, setStatsOrder } from './layout'
import { db, type Shoe, type StoredDay } from './db'

const APP = 'workout-mgmt'
const FORMAT = 1

export interface Backup {
  app: typeof APP
  format: number
  exportedAt: string
  days: StoredDay[]
  shoes: Shoe[]
  /** added later; older backups don't have these */
  inbody?: InBodyRecord[]
  goals?: Goals
  statsOrder?: string[]
}

export async function createBackup(): Promise<Backup> {
  const [days, shoes, inbody, goals, statsOrder] = await Promise.all([
    db.days.orderBy('date').toArray(),
    db.shoes.toArray(),
    db.inbody.orderBy('date').toArray(),
    getGoals(),
    getStatsOrder(),
  ])
  return { app: APP, format: FORMAT, exportedAt: new Date().toISOString(), days, shoes, inbody, goals, statsOrder }
}

export function backupFileName(b: Backup) {
  return `운동기록-백업-${b.exportedAt.slice(0, 10)}.json`
}

/** Call after the user has actually saved or shared the file. */
export async function markBackedUp(at = new Date().toISOString()) {
  await db.meta.put({ key: 'lastBackupAt', value: at })
}

export async function lastBackupAt(): Promise<string | undefined> {
  return (await db.meta.get('lastBackupAt'))?.value as string | undefined
}

/** Checks that a parsed JSON file is one of our backups; throws a message for the user otherwise. */
export function readBackup(json: unknown): Backup {
  const b = json as Partial<Backup>
  if (!b || b.app !== APP || !Array.isArray(b.days) || !Array.isArray(b.shoes)) {
    throw new Error('이 앱에서 만든 백업 파일이 아닙니다.')
  }
  if ((b.format ?? 0) > FORMAT) throw new Error('더 새로운 버전의 앱에서 만든 백업입니다. 앱을 업데이트한 뒤 다시 시도하세요.')
  if (b.days.some((d) => typeof d?.date !== 'string' || !Array.isArray(d.activities))) {
    throw new Error('백업 파일의 내용이 손상되었습니다.')
  }
  return b as Backup
}

export type RestoreMode = 'merge' | 'replace'

/**
 * merge: keeps what is on the phone and adds the backup; for a date in both, the more recently saved one wins.
 * replace: deletes everything on the phone first.
 */
export async function restoreBackup(b: Backup, mode: RestoreMode): Promise<{ days: number; shoes: number; inbody: number }> {
  return db.transaction('rw', db.days, db.shoes, db.inbody, db.meta, async () => {
    if (b.goals && (mode === 'replace' || !Object.keys(await getGoals()).length)) await setGoals(b.goals)
    if (b.statsOrder && (mode === 'replace' || !(await getStatsOrder()))) await setStatsOrder(b.statsOrder)
    if (mode === 'replace') {
      await db.days.clear()
      await db.shoes.clear()
      await db.inbody.clear()
    }
    // InBody records carry no save time; the backup copy wins for the same date
    await db.inbody.bulkPut(b.inbody ?? [])
    const current = new Map((await db.days.bulkGet(b.days.map((d) => d.date))).filter((d) => !!d).map((d) => [d.date, d]))
    const days = b.days.filter((d) => {
      const mine = current.get(d.date)
      return !mine || (d.savedAt ?? 0) >= (mine.savedAt ?? 0)
    })
    await db.days.bulkPut(days)
    await db.shoes.bulkPut(b.shoes)
    return { days: days.length, shoes: b.shoes.length, inbody: b.inbody?.length ?? 0 }
  })
}
