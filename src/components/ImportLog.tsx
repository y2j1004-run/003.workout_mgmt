import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { fmtTime } from '../analytics/stats'
import { clearDays, db, saveDays } from '../db/db'
import { parseLog, type Activity, type DayEntry, type ParseResult } from '../import/parseLog'

const PAGE = 40

export default function ImportLog() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ParseResult>()
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [saveMsg, setSaveMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const read = (content: string) => {
    setResult(parseLog(content))
    setShown(PAGE)
    setSaveMsg('')
  }

  const loadFile = async (file?: File) => {
    if (!file) return
    const content = await file.text()
    setText(content)
    read(content)
  }

  const updateDay = (date: string, change: (d: DayEntry) => DayEntry) =>
    setResult((r) => r && { ...r, days: r.days.map((d) => (d.date === date ? change(d) : d)) })

  const save = async () => {
    if (!result) return
    setSaving(true)
    try {
      const { added, replaced } = await saveDays(result.days)
      setSaveMsg(`저장했습니다. 새로 ${added}일${replaced ? `, 기존 ${replaced}일은 새 내용으로 바꿈` : ''}.`)
    } catch (e) {
      setSaveMsg(`저장하지 못했습니다: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const days = result ? [...result.days].reverse().filter((d) => !onlyIssues || needsReview(d)) : []

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-semibold">운동 기록 가져오기</h2>
        <p className="mb-3 text-sm text-slate-500">메모장 기록을 붙여넣거나 .txt 파일을 고르면, 날짜별로 어떻게 읽었는지 보여줍니다.</p>
        <textarea
          id="log-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'[ 2025년 ]\n03.21 : 5키로 러닝, 웨이트, 체지방률 17.2'}
          className="h-40 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => read(text)}
            disabled={!text.trim()}
            className="flex-1 rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40"
          >
            읽어보기
          </button>
          <label className="flex-1 cursor-pointer rounded-lg border border-teal-700 py-2 text-center font-semibold text-teal-700">
            파일 선택
            <input id="log-file" type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => loadFile(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      {result && <Summary days={result.days} />}

      {result && (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <button
            onClick={save}
            disabled={saving || !result.days.length}
            className="w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40"
          >
            {saving ? '저장하는 중…' : `${result.days.length}일 기록 저장하기`}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {saveMsg ||
              `노란 테두리 날은 저장 전에 고칠 수 있습니다 (${result.days.filter(needsReview).length}일). 이미 저장된 날짜는 새 내용으로 바뀝니다.`}
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input id="only-issues" type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
            확인이 필요한 날만 보기 ({result.days.filter(needsReview).length}일)
          </label>
          {days.slice(0, shown).map((d) => (
            <DayCard key={d.date} day={d} onChange={(change) => updateDay(d.date, change)} />
          ))}
          {days.length > shown && (
            <button onClick={() => setShown(shown + PAGE)} className="w-full rounded-lg bg-slate-200 py-2 text-sm">
              더 보기 ({days.length - shown}일 남음)
            </button>
          )}
        </div>
      )}
      <SavedData />
    </section>
  )
}

function SavedData() {
  const count = useLiveQuery(() => db.days.count())
  const [confirming, setConfirming] = useState(false)
  if (!count) return null
  return (
    <div className="flex items-center justify-between rounded-xl bg-white p-4 text-sm shadow-sm">
      <span>
        휴대폰에 저장된 기록 <b className="tabular-nums">{count}일</b>
      </span>
      {confirming ? (
        <span className="flex gap-2">
          <button onClick={() => setConfirming(false)} className="rounded-lg bg-slate-200 px-3 py-1">
            취소
          </button>
          <button
            onClick={async () => {
              await clearDays()
              setConfirming(false)
            }}
            className="rounded-lg bg-red-600 px-3 py-1 font-semibold text-white"
          >
            모두 지우기
          </button>
        </span>
      ) : (
        <button onClick={() => setConfirming(true)} className="text-red-600">
          지우기…
        </button>
      )}
    </div>
  )
}

function needsReview(d: DayEntry) {
  return d.issues.length > 0 || (d.activities.length === 0 && !d.rest && !d.strength)
}

function Summary({ days }: { days: DayEntry[] }) {
  const acts = days.flatMap((d) => d.activities)
  const runs = acts.filter((a) => a.kind === 'run')
  const km = (list: Activity[]) => list.reduce((s, a) => s + a.distanceKm, 0)
  const stats = [
    ['기간', days.length ? `${days[0].date} ~ ${days.at(-1)!.date}` : '-'],
    ['기록한 날', `${days.length}일`],
    ['러닝', `${runs.length}회 · ${km(runs).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`],
    ['걷기', `${acts.length - runs.length}회 · ${km(acts.filter((a) => a.kind === 'walk')).toFixed(1)}km`],
    ['웨이트', `${days.filter((d) => d.strength?.done).length}일`],
    ['체지방률 측정', `${days.filter((d) => d.metrics.bodyFatPct).length}회`],
    ['혈압 기록', `${days.filter((d) => d.metrics.systolicBp).length}회`],
    ['공복 기록', `${days.filter((d) => d.fastingHours).length}일`],
  ]
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-4 shadow-sm">
      {stats.map(([label, value]) => (
        <div key={label} className={label === '기간' ? 'col-span-2' : ''}>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="font-semibold tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  )
}

function DayCard({ day, onChange }: { day: DayEntry; onChange: (change: (d: DayEntry) => DayEntry) => void }) {
  const [open, setOpen] = useState(false)
  const [addKm, setAddKm] = useState('')
  const review = needsReview(day)
  const addRun = () => {
    const km = Number(addKm)
    if (!(km > 0)) return
    onChange((d) => ({
      ...d,
      activities: [...d.activities, { kind: 'run', distanceKm: km, companions: [], details: [], tags: ['직접 입력'] }],
      issues: [],
    }))
    setAddKm('')
  }
  const m = day.metrics
  const chips = [
    day.strength && (day.strength.done ? `웨이트${day.strength.parts.length ? ` (${day.strength.parts.join(', ')})` : ''}` : '웨이트 못함'),
    day.fastingHours && `공복 ${day.fastingHours}시간`,
    m.bodyFatPct && `체지방률 ${m.bodyFatPct}%`,
    m.systolicBp && `혈압(수축기) ${m.systolicBp}`,
    m.weightKg && `체중 ${m.weightKg}kg`,
    m.vo2max && `VO2max ${m.vo2max}`,
    m.heartRate && `심박수 ${m.heartRate}`,
    day.meals && `${day.meals}식`,
    day.stretching && '스트레칭',
    day.rest && '휴식',
  ].filter(Boolean) as string[]

  return (
    <div className={`rounded-xl bg-white p-3 shadow-sm ${needsReview(day) ? 'ring-2 ring-amber-400' : ''}`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-baseline justify-between text-left">
        <span className="font-semibold tabular-nums">{day.date}</span>
        <span className="text-xs text-slate-400">{open ? '원문 닫기' : '원문 보기'}</span>
      </button>
      {day.activities.map((a, i) => (
        <div key={i} className="mt-1 text-sm">
          <span className="font-semibold text-teal-700 tabular-nums">
            {a.kind === 'walk' ? '걷기' : '러닝'} {a.distanceKm}km
          </span>
          {a.durationSec ? <span className="tabular-nums"> · {fmtTime(a.durationSec)}</span> : null}
          {a.paceSecPerKm ? <span className="tabular-nums"> · {fmtTime(a.paceSecPerKm)}/km</span> : null}
          {a.raceDistanceKm ? <span className="tabular-nums"> (대회 {a.raceDistanceKm}km)</span> : null}
          {a.event && <span> · 🏁 {a.event}</span>}
          {a.crew && <span> · 🏃 {a.crew} 크루</span>}
          {a.place && <span> · 📍 {a.place}</span>}
          {a.companions.length > 0 && <span> · 👥 {a.companions.join(', ')}</span>}
          {a.shoe && <span> · 👟 {a.shoe}</span>}
          {a.details.length > 0 && <div className="text-xs text-slate-600">훈련: {a.details.join(' / ')}</div>}
          {a.tags.length > 0 && <div className="text-xs text-slate-500">기타: {a.tags.join(', ')}</div>}
        </div>
      ))}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
              {c}
            </span>
          ))}
        </div>
      )}
      {day.notes.map((n, i) => (
        <p key={i} className="mt-1 text-xs text-slate-600">
          📝 {n}
        </p>
      ))}
      {day.issues.map((n, i) => (
        <p key={i} className="mt-1 text-xs text-amber-700">
          ⚠️ {n}
        </p>
      ))}
      {review && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-sm">
          <input
            id={`add-km-${day.date}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            value={addKm}
            onChange={(e) => setAddKm(e.target.value)}
            placeholder="거리(km)"
            className="w-24 rounded-lg border border-slate-300 px-2 py-1"
          />
          <button onClick={addRun} className="rounded-lg bg-teal-700 px-3 py-1 text-white">
            러닝 추가
          </button>
          <button onClick={() => onChange((d) => ({ ...d, issues: [], rest: d.activities.length ? d.rest : true }))} className="rounded-lg bg-slate-200 px-3 py-1">
            이대로 괜찮음
          </button>
        </div>
      )}
      {open && <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap">{day.raw.join('\n')}</pre>}
    </div>
  )
}
