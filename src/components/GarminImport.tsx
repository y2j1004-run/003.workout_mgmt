import { useState } from 'react'
import { db, saveGarmin } from '../db/db'
import { FIELD_LABELS, parseGarminCsv, type GarminParseResult } from '../import/garminCsv'
import { mergeGarmin, type GarminMergeStats } from '../import/mergeGarmin'

const REQUIRED = ['date', 'type', 'distance'] as const

export default function GarminImport() {
  const [result, setResult] = useState<GarminParseResult>()
  const [preview, setPreview] = useState<GarminMergeStats>()
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [addAnyway, setAddAnyway] = useState<Set<string>>(new Set())

  const load = async (file?: File) => {
    if (!file) return
    setMsg('')
    setAddAnyway(new Set())
    const r = parseGarminCsv(await file.text())
    setResult(r)
    // dry run against what is stored, so the numbers below match what saving will do
    const dates = [...new Set(r.activities.map((a) => a.date))]
    const existing = (await db.days.bulkGet(dates)).filter((d) => !!d)
    setPreview(mergeGarmin(existing, r.activities, (date) => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] })).stats)
  }

  const save = async () => {
    if (!result) return
    setSaving(true)
    try {
      const s = await saveGarmin(result.activities, addAnyway)
      setMsg(
        `저장했습니다. 기존 러닝에 합침 ${s.matched}개, 새 러닝 ${s.added}개, 다시 읽어 갱신 ${s.updated}개${s.extras.length ? `, 중복으로 보고 건너뜀 ${s.extras.length}개` : ''}.`,
      )
      setResult(undefined)
      setPreview(undefined)
    } catch (e) {
      setMsg(`저장하지 못했습니다: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const missing = result ? REQUIRED.filter((f) => !result.columns[f]) : []
  const acts = result?.activities ?? []
  const count = (k: string) => acts.filter((a) => a.kind === k).length
  const dates = acts.map((a) => a.date).sort()

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">가민 기록 가져오기</h2>
      <p className="mb-3 text-sm text-slate-500">
        PC에서 가민 커넥트 웹 → 활동 → 목록 위의 <b>CSV 내보내기</b>로 받은 파일을 고르세요. 같은 날 비슷한 거리의 러닝이 있으면 그 러닝에 시간·심박·케이던스를 붙이고, 없으면 새 러닝으로 넣습니다.
      </p>
      <label className="block cursor-pointer rounded-lg border border-teal-700 py-2 text-center font-semibold text-teal-700">
        CSV 파일 선택
        <input id="garmin-file" type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
      </label>

      {result && (
        <div className="mt-3 space-y-3 text-sm">
          {missing.length > 0 ? (
            <p className="rounded-lg bg-amber-50 p-2 text-amber-800">
              {missing.map((f) => FIELD_LABELS[f]).join(', ')} 열을 찾지 못했습니다. 파일 첫 줄(열 이름)을 알려주시면 맞춰 드릴게요.
            </p>
          ) : (
            <>
              <p className="tabular-nums">
                {dates[0]} ~ {dates.at(-1)} · 활동 {acts.length}개 (러닝 {count('run')}, 걷기 {count('walk')}, 근력 {count('strength')}, 기타 {count('other')})
              </p>
              {preview && (
                <p className="tabular-nums text-slate-600">
                  저장하면: 기존 러닝에 합침 {preview.matched} · 새 러닝 {preview.added + addAnyway.size} · 이미 가져온 활동 갱신 {preview.updated} · 웨이트 표시{' '}
                  {preview.strengthDays}일 · 건너뜀 {preview.ignored}
                </p>
              )}
              {preview && preview.extras.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                  <p className="mb-1">
                    아래 {preview.extras.length}개는 그날 기록된 러닝과 짝이 맞지 않아 <b>중복일 수 있어서 넣지 않습니다</b>. 실제로 따로 달린 거면 체크하세요.
                  </p>
                  <ul className="space-y-0.5">
                    {preview.extras.map((g) => (
                      <li key={g.startTime}>
                        <label className="flex items-center gap-2 tabular-nums">
                          <input
                            type="checkbox"
                            checked={addAnyway.has(g.startTime)}
                            onChange={(e) => {
                              const next = new Set(addAnyway)
                              if (e.target.checked) next.add(g.startTime)
                              else next.delete(g.startTime)
                              setAddAnyway(next)
                            }}
                          />
                          {g.startTime} · {g.type} {g.distanceKm}km
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <details className="text-xs text-slate-500">
            <summary>알아본 열</summary>
            <ul className="mt-1 grid grid-cols-2 gap-x-2">
              {Object.entries(FIELD_LABELS).map(([f, label]) => (
                <li key={f}>
                  {result.columns[f as keyof typeof FIELD_LABELS] ? '✓' : '–'} {label}
                </li>
              ))}
            </ul>
          </details>
          <button onClick={save} disabled={saving || missing.length > 0 || !acts.length} className="w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40">
            {saving ? '저장하는 중…' : '합쳐서 저장'}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}
