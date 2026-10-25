import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, saveShealth } from '../db/db'
import { parseShealth, type ShealthFile } from '../shealth/shealth'

const LABEL = { sleep: '😴 수면', nutrition: '🍱 식단', steps: '👣 걸음 수' } as const

/** Imports the sleep, meal and step CSV files from Samsung Health's personal data download. */
export default function ShealthImport() {
  const counts = useLiveQuery(async () => ({ sleep: await db.sleep.count(), nutrition: await db.nutrition.count(), steps: await db.steps.count() }))
  const [files, setFiles] = useState<ShealthFile[]>()
  const [skipped, setSkipped] = useState(0)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const read = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    setMsg('')
    const parsed: ShealthFile[] = []
    let skip = 0
    for (const f of Array.from(list)) {
      const p = parseShealth(await f.text())
      if (p) parsed.push(p)
      else skip++
    }
    setFiles(parsed)
    setSkipped(skip)
    setBusy(false)
  }

  const range = (dates: string[]) => (dates.length ? `${dates[0].slice(2).replaceAll('-', '.')} ~ ${dates.at(-1)!.slice(2).replaceAll('-', '.')}` : '')
  const summary = (f: ShealthFile) => {
    const rows = f.sleep ?? f.nutrition ?? f.steps ?? []
    const unit = f.kind === 'sleep' ? '밤' : '일'
    return `${rows.length}${unit} · ${range(rows.map((r) => r.date))}`
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">삼성 헬스 가져오기</h2>
      <p className="mb-2 text-sm text-slate-500">
        삼성 헬스 → 설정 → 개인 데이터 다운로드로 받은 파일 중 아래 3개를 고르세요. 여러 개를 한 번에 골라도 되고, 다른 파일은 자동으로 건너뛰어요.
      </p>
      <ul className="mb-3 space-y-0.5 text-xs text-slate-600">
        <li>😴 <code>com.samsung.health.sleep_stage….csv</code> — 수면 (가민 수면도 여기로 들어와요)</li>
        <li>🍱 <code>com.samsung.health.nutrition….csv</code> — 식단</li>
        <li>👣 <code>com.samsung.shealth.step_daily_trend….csv</code> — 걸음 수 (휴대폰 걸음)</li>
      </ul>
      <label className="block w-full cursor-pointer rounded-lg border border-teal-700 py-2 text-center font-semibold text-teal-700">
        {busy ? '읽는 중…' : '파일 고르기'}
        <input id="shealth-files" type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => read(e.target.files)} />
      </label>
      {files && (
        <div className="mt-3 space-y-1 text-sm">
          {files.map((f, i) => (
            <p key={i} className="tabular-nums">
              {LABEL[f.kind]} <span className="text-slate-600">{summary(f)}</span>
            </p>
          ))}
          {skipped > 0 && <p className="text-xs text-slate-500">읽지 않는 파일 {skipped}개는 건너뛰었어요.</p>}
          {files.length > 0 ? (
            <button
              onClick={async () => {
                const s = await saveShealth(files)
                setMsg(`저장했습니다. 수면 ${s.sleep}밤, 식단 ${s.nutrition}일, 걸음 수 ${s.steps}일.`)
                setFiles(undefined)
              }}
              className="mt-2 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white"
            >
              저장
            </button>
          ) : (
            <p className="text-xs text-amber-700">수면·식단·걸음 수 파일이 없어요. 파일 이름을 확인해 주세요.</p>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
      {counts && (counts.sleep || counts.nutrition || counts.steps) ? (
        <p className="mt-2 text-xs text-slate-400 tabular-nums">
          저장된 기록: 수면 {counts.sleep}밤 · 식단 {counts.nutrition}일 · 걸음 수 {counts.steps}일. 다시 가져오면 같은 날짜는 새 값으로 바뀌어요.
        </p>
      ) : null}
    </div>
  )
}
