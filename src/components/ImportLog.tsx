import { useMemo, useState } from 'react'
import { parseLog, type Activity, type DayEntry } from '../import/parseLog'

const PAGE = 40

export default function ImportLog() {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const result = useMemo(() => (submitted ? parseLog(submitted) : undefined), [submitted])

  const loadFile = async (file?: File) => {
    if (!file) return
    const content = await file.text()
    setText(content)
    setSubmitted(content)
    setShown(PAGE)
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
            onClick={() => {
              setSubmitted(text)
              setShown(PAGE)
            }}
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
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input id="only-issues" type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
            확인이 필요한 날만 보기 ({result.days.filter(needsReview).length}일)
          </label>
          {days.slice(0, shown).map((d) => (
            <DayCard key={d.date} day={d} />
          ))}
          {days.length > shown && (
            <button onClick={() => setShown(shown + PAGE)} className="w-full rounded-lg bg-slate-200 py-2 text-sm">
              더 보기 ({days.length - shown}일 남음)
            </button>
          )}
          <p className="text-center text-xs text-slate-400">저장 기능은 다음 단계에서 추가됩니다. 지금은 읽기 결과만 확인합니다.</p>
        </div>
      )}
    </section>
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

function DayCard({ day }: { day: DayEntry }) {
  const [open, setOpen] = useState(false)
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
      {open && <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs whitespace-pre-wrap">{day.raw.join('\n')}</pre>}
    </div>
  )
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
