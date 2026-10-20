import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { backupFileName, createBackup, lastBackupAt, markBackedUp, readBackup, restoreBackup, type Backup, type RestoreMode } from '../db/backup'
import { db } from '../db/db'

export const BACKUP_REMIND_DAYS = 7

export function daysSince(iso: string | undefined, now = Date.now()) {
  return iso ? Math.floor((now - Date.parse(iso)) / 86_400_000) : undefined
}

export default function BackupRestore() {
  const last = useLiveQuery(lastBackupAt)
  const count = useLiveQuery(() => db.days.count())
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState<Backup>()
  const [confirmReplace, setConfirmReplace] = useState(false)
  const age = daysSince(last)
  const overdue = !!count && (age == null || age >= BACKUP_REMIND_DAYS)

  const makeFile = async () => {
    const b = await createBackup()
    return new File([JSON.stringify(b)], backupFileName(b), { type: 'application/json' })
  }

  const share = async () => {
    const file = await makeFile()
    try {
      await navigator.share({ files: [file], title: file.name })
      await markBackedUp()
      setMsg('공유했습니다. 저장한 곳(예: Google Drive)을 기억해 두세요.')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg('공유하지 못했습니다. "파일로 저장"을 써 보세요.')
    }
  }

  const download = async () => {
    const file = await makeFile()
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    await markBackedUp()
    setMsg(`${file.name} 파일을 다운로드 폴더에 저장했습니다.`)
  }

  const pick = async (file?: File) => {
    if (!file) return
    setMsg('')
    setConfirmReplace(false)
    try {
      setPending(readBackup(JSON.parse(await file.text())))
    } catch (e) {
      setPending(undefined)
      setMsg(e instanceof SyntaxError ? '백업 파일을 읽지 못했습니다.' : (e as Error).message)
    }
  }

  const restore = async (mode: RestoreMode) => {
    if (!pending) return
    const r = await restoreBackup(pending, mode)
    setMsg(`복원했습니다. 기록 ${r.days}일, 신발 ${r.shoes}켤레, 인바디 ${r.inbody}회.`)
    setPending(undefined)
    setConfirmReplace(false)
  }

  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">백업 · 복원</h2>
      <p className={`mb-3 text-sm ${overdue ? 'text-amber-700' : 'text-slate-500'}`}>
        {last ? `마지막 백업: ${last.slice(0, 10)} (${age === 0 ? '오늘' : `${age}일 전`})` : '아직 백업한 적이 없습니다.'}
        {overdue && ' 기기를 바꾸거나 앱을 지우면 기록이 사라지니 백업해 두세요.'}
      </p>
      <div className="flex gap-2">
        {canShare && (
          <button onClick={share} disabled={!count} className="flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40">
            Drive 등에 저장
          </button>
        )}
        <button
          onClick={download}
          disabled={!count}
          className={`flex-1 rounded-lg py-2 font-semibold disabled:opacity-40 ${canShare ? 'border border-teal-700 text-teal-700' : 'bg-teal-700 text-white'}`}
        >
          파일로 저장
        </button>
      </div>

      <label className="mt-3 block cursor-pointer rounded-lg border border-slate-300 py-2 text-center text-sm text-slate-700">
        백업 파일에서 복원
        <input id="restore-file" type="file" accept=".json,application/json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      {pending && (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="tabular-nums">
            {pending.exportedAt.slice(0, 10)}에 만든 백업 · 기록 {pending.days.length}일 · 신발 {pending.shoes.length}켤레 · 인바디 {pending.inbody?.length ?? 0}회
          </p>
          <button onClick={() => restore('merge')} className="w-full rounded-lg bg-teal-700 py-2 font-semibold text-white">
            지금 기록에 합치기
          </button>
          <p className="text-xs text-slate-500">같은 날짜는 더 나중에 저장된 쪽을 남깁니다.</p>
          {confirmReplace ? (
            <div className="flex gap-2">
              <button onClick={() => setConfirmReplace(false)} className="flex-1 rounded-lg bg-slate-200 py-2">
                취소
              </button>
              <button onClick={() => restore('replace')} className="flex-1 rounded-lg bg-red-600 py-2 font-semibold text-white">
                지우고 바꾸기
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmReplace(true)} className="w-full rounded-lg border border-red-300 py-2 text-red-700">
              지금 기록을 모두 지우고 백업으로 바꾸기…
            </button>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}
