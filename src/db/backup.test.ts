import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseLog } from '../import/parseLog'
import { createBackup, lastBackupAt, markBackedUp, readBackup, restoreBackup } from './backup'
import { db, saveDays, saveInBody, updateShoe } from './db'
import { addCustomGoal, getCustomGoals, getGoals, setGoals } from './goals'
import { getProfile, getVo2Entries, saveVo2, setProfile } from './profile'

const log = (body: string) => parseLog(`[ 2026년 ]\n${body}`).days

beforeEach(async () => {
  await Promise.all([db.days.clear(), db.shoes.clear(), db.meta.clear(), db.inbody.clear()])
})

describe('backup', () => {
  it('round-trips days and shoes through JSON', async () => {
    await saveDays(log('06.01 : 10키로(공원, 디나엘4)\n06.02 : 5키로'))
    await updateShoe('디나엘4', { initialKm: 300 })
    await saveInBody([{ date: '2026-06-01', source: 'sheet', weightKg: 60 }])
    await setGoals({ weeklyKm: 50 })
    await setProfile({ name: '러너', sports: ['러닝', '웨이트'], sex: 'male', heightCm: 175, birthYear: 1985 })
    await addCustomGoal({ title: '턱걸이', target: 10, unit: '개' })
    await saveVo2({ date: '2026-06-01', value: 50 })
    const file = JSON.parse(JSON.stringify(await createBackup()))
    await Promise.all([db.days.clear(), db.shoes.clear(), db.inbody.clear(), db.meta.clear()])

    await restoreBackup(readBackup(file), 'replace')
    expect(await db.days.count()).toBe(2)
    expect(await db.shoes.get('디나엘4')).toMatchObject({ initialKm: 300 })
    expect(await db.inbody.get('2026-06-01')).toMatchObject({ weightKg: 60 })
    expect(await getGoals()).toEqual({ weeklyKm: 50 })
    expect(await getProfile()).toEqual({ name: '러너', sports: ['러닝', '웨이트'], sex: 'male', heightCm: 175, birthYear: 1985 })
    expect(await getCustomGoals()).toMatchObject([{ title: '턱걸이', target: 10, unit: '개' }])
    expect(await getVo2Entries()).toEqual([{ date: '2026-06-01', value: 50 }])
  })

  it('merge keeps newer phone data and adds missing days', async () => {
    await saveDays(log('06.01 : 10키로'))
    const backup = await createBackup()
    backup.days.push({ ...backup.days[0], date: '2026-05-31' })
    // the phone's 06.01 changed after the backup was made
    await db.days.update('2026-06-01', { savedAt: Date.now() + 1000, notes: ['수정함'] })

    const r = await restoreBackup(backup, 'merge')
    expect(r.days).toBe(1)
    expect((await db.days.get('2026-06-01'))?.notes).toEqual(['수정함'])
    expect(await db.days.get('2026-05-31')).toBeDefined()
  })

  it('rejects files that are not backups', () => {
    expect(() => readBackup({ hello: 1 })).toThrow('이 앱에서 만든 백업 파일이 아닙니다.')
    expect(() => readBackup({ app: 'workout-mgmt', format: 99, days: [], shoes: [] })).toThrow(/더 새로운 버전/)
  })

  it('remembers when the last backup was made', async () => {
    expect(await lastBackupAt()).toBeUndefined()
    await markBackedUp('2026-10-20T00:00:00.000Z')
    expect(await lastBackupAt()).toBe('2026-10-20T00:00:00.000Z')
  })
})
