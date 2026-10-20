import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, repairDuplicates } from '../db/db'
import { findDuplicates } from '../import/mergeGarmin'

// Shown only when earlier Garmin imports left watch runs next to the logged runs they duplicate.
export default function DuplicateCleanup() {
  const report = useLiveQuery(async () => findDuplicates(await db.days.toArray()))
  const [skipPairs, setSkipPairs] = useState<Set<string>>(new Set())
  const [deleteExtras, setDeleteExtras] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  if (!report) return null
  if (!report.pairs.length && !report.extras.length) return msg ? <p className="text-center text-sm text-teal-700">{msg}</p> : null

  const key = (date: string, i: number) => `${date}#${i}`
  const toggle = (set: Set<string>, k: string, on: boolean) => {
    const next = new Set(set)
    if (on) next.add(k)
    else next.delete(k)
    return next
  }
  const pairs = report.pairs.filter((p) => !skipPairs.has(key(p.date, p.garminIndex)))
  const extras = report.extras.filter((e) => deleteExtras.has(key(e.date, e.index)))

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-2 ring-amber-400">
      <h2 className="mb-1 font-semibold">중복 러닝 정리</h2>
      <p className="mb-3 text-sm text-slate-600">
        가민 기록을 가져올 때 이미 있던 러닝이 한 번 더 들어간 것으로 보이는 날이 있습니다. 정리하면 시계 기록(시간·심박 등)은 원래 러닝에 붙이고, 중복은 통계에서 빠집니다.
      </p>
      {report.pairs.length > 0 && (
        <>
          <p className="mb-1 text-xs font-semibold text-slate-500">같은 러닝으로 보이는 것 ({report.pairs.length}개)</p>
          <ul className="mb-3 max-h-60 space-y-1 overflow-y-auto text-sm">
            {report.pairs.map((p) => {
              const k = key(p.date, p.garminIndex)
              return (
                <li key={k}>
                  <label className="flex items-center gap-2 tabular-nums">
                    <input type="checkbox" checked={!skipPairs.has(k)} onChange={(e) => setSkipPairs(toggle(skipPairs, k, !e.target.checked))} />
                    {p.date} · 기록 {p.loggedKm}km ↔ 가민 {p.garminKm}km
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {report.extras.length > 0 && (
        <>
          <p className="mb-1 text-xs font-semibold text-slate-500">짝은 없지만 기록이 있는 날의 가민 러닝 ({report.extras.length}개) — 중복이면 체크</p>
          <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto text-sm">
            {report.extras.map((e) => {
              const k = key(e.date, e.index)
              return (
                <li key={k}>
                  <label className="flex items-center gap-2 tabular-nums">
                    <input type="checkbox" checked={deleteExtras.has(k)} onChange={(ev) => setDeleteExtras(toggle(deleteExtras, k, ev.target.checked))} />
                    {e.date} · 가민 {e.km}km
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}
      <button
        disabled={!pairs.length && !extras.length}
        onClick={async () => {
          await repairDuplicates({ pairs, extras: [] }, extras)
          setMsg(`정리했습니다. 합침 ${pairs.length}개, 삭제 ${extras.length}개.`)
          setSkipPairs(new Set())
          setDeleteExtras(new Set())
        }}
        className="w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40"
      >
        체크한 {pairs.length + extras.length}개 정리하기
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}
