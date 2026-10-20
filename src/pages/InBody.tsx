import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import LineChart from '../components/charts/LineChart'
import InBodyLevel from '../components/InBodyLevel'
import { db, saveInBody } from '../db/db'
import { checkRecord, parseInBodyCsv, withLogRecords, type InBodyRecord } from '../inbody/inbody'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const SOURCE_LABEL = { sheet: '결과지', history: '결과지 추이', manual: '직접 입력', log: '운동 기록' } as const

export default function InBody() {
  const records = useLiveQuery(() => db.inbody.orderBy('date').toArray())
  const days = useLiveQuery(() => db.days.toArray())
  if (!records || !days) return null
  const latest = records.at(-1)
  // charts and the history list also show what the workout log recorded
  const all = withLogRecords(records, days)
  const series = (key: keyof InBodyRecord) => all.filter((r) => typeof r[key] === 'number').map((r) => ({ date: r.date, value: r[key] as number }))
  const charts = [
    { title: '체중 (kg)', data: series('weightKg'), unit: 'kg' },
    { title: '골격근량 (kg)', data: series('skeletalMuscleKg'), unit: 'kg' },
    { title: '체지방률 (%)', data: series('bodyFatPct'), unit: '%' },
  ]

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">인바디</h1>
      {latest ? (
        <>
          <Latest latest={latest} prev={records.at(-2)} />
          <InBodyLevel records={records} />
        </>
      ) : (
        <Card title="아직 인바디 기록이 없습니다">
          <p className="text-sm text-slate-500">{all.length > 0 && '운동 기록의 체지방률·혈압은 아래 측정 기록에 보입니다. '}아래에서 측정값을 직접 입력하거나, 결과지를 읽은 값을 붙여넣어 가져오세요.</p>
        </Card>
      )}
      {charts.map(
        (c) =>
          c.data.length > 1 && (
            <Card key={c.title} title={c.title}>
              <LineChart data={c.data} format={(d) => `${d.date} · ${d.value}${c.unit}`} />
            </Card>
          ),
      )}
      <ManualEntry />
      <PasteImport />
      {all.length > 0 && <History records={all} />}
    </section>
  )
}

function Latest({ latest: r, prev }: { latest: InBodyRecord; prev?: InBodyRecord }) {
  const delta = (key: keyof InBodyRecord, unit: string) => {
    const a = r[key]
    const b = prev?.[key]
    if (typeof a !== 'number' || typeof b !== 'number') return undefined
    const d = Math.round((a - b) * 10) / 10
    return `${d > 0 ? '+' : ''}${d}${unit}`
  }
  const tiles: [string, number | undefined, string, string | undefined][] = [
    ['체중', r.weightKg, 'kg', delta('weightKg', 'kg')],
    ['골격근량', r.skeletalMuscleKg, 'kg', delta('skeletalMuscleKg', 'kg')],
    ['체지방률', r.bodyFatPct, '%', delta('bodyFatPct', '%p')],
    ['체지방량', r.bodyFatKg, 'kg', delta('bodyFatKg', 'kg')],
  ]
  const extra = [
    r.score != null && `인바디 점수 ${r.score}`,
    r.visceralFatArea != null && `내장지방 ${r.visceralFatArea}cm²`,
    r.bmi != null && `BMI ${r.bmi}`,
    r.bmrKcal != null && `기초대사량 ${r.bmrKcal}kcal`,
    r.systolicBp != null && `혈압 ${r.systolicBp}${r.diastolicBp ? `/${r.diastolicBp}` : ''}`,
    r.pulse != null && `맥박 ${r.pulse}`,
  ].filter(Boolean) as string[]

  return (
    <Card title={`최근 측정 · ${r.date}${r.time ? ` ${r.time}` : ''}`}>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(([label, v, unit, d]) => (
          <div key={label}>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-bold tabular-nums">{v != null ? `${v}${unit}` : '-'}</div>
            {d && <div className="text-xs text-slate-500 tabular-nums">지난번보다 {d}</div>}
          </div>
        ))}
      </div>
      {extra.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {extra.map((e) => (
            <span key={e} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums">
              {e}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function ManualEntry() {
  const [date, setDate] = useState(today)
  const [v, setV] = useState({ weightKg: '', skeletalMuscleKg: '', bodyFatPct: '', bodyFatKg: '' })
  const [msg, setMsg] = useState('')
  const fields: [keyof typeof v, string][] = [
    ['weightKg', '체중(kg)'],
    ['skeletalMuscleKg', '골격근량(kg)'],
    ['bodyFatPct', '체지방률(%)'],
    ['bodyFatKg', '체지방량(kg)'],
  ]
  const num = (s: string) => (s.trim() ? Number(s) : undefined)
  const rec: InBodyRecord = { date, source: 'manual', weightKg: num(v.weightKg), skeletalMuscleKg: num(v.skeletalMuscleKg), bodyFatPct: num(v.bodyFatPct), bodyFatKg: num(v.bodyFatKg) }
  const valid = Object.values(v).some((x) => x.trim()) && Object.values(v).every((x) => !x.trim() || Number.isFinite(Number(x)))
  const warnings = valid ? checkRecord(rec) : []

  return (
    <Card title="측정값 입력">
      <label className="block text-xs text-slate-500">
        측정일
        <input id="inbody-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {fields.map(([k, label]) => (
          <label key={k} className="text-xs text-slate-500">
            {label}
            <input
              id={`inbody-${k}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={v[k]}
              onChange={(e) => setV({ ...v, [k]: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
            />
          </label>
        ))}
      </div>
      {warnings.map((w) => (
        <p key={w} className="mt-2 text-xs text-amber-700">
          ⚠️ {w}
        </p>
      ))}
      <button
        disabled={!valid}
        onClick={async () => {
          await saveInBody([rec])
          setMsg(`${date} 측정값을 저장했습니다.`)
          setV({ weightKg: '', skeletalMuscleKg: '', bodyFatPct: '', bodyFatKg: '' })
        }}
        className="mt-3 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-40"
      >
        저장
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </Card>
  )
}

function PasteImport() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ReturnType<typeof parseInBodyCsv>>()
  const [msg, setMsg] = useState('')

  return (
    <Card title="결과지 값 붙여넣기">
      <p className="mb-2 text-sm text-slate-500">결과지 사진을 Claude 채팅에 올리면 읽은 값을 줄 단위로 돌려 드립니다. 그 내용을 복사해서 여기에 붙여넣으세요.</p>
      <textarea
        id="inbody-paste"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'2026-10-15,07:16,sheet,62.2,30.4,8.2,13.2,...'}
        className="h-28 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs"
      />
      <button
        onClick={() => {
          setResult(parseInBodyCsv(text))
          setMsg('')
        }}
        disabled={!text.trim()}
        className="mt-2 w-full rounded-lg border border-teal-700 py-2 font-semibold text-teal-700 disabled:opacity-40"
      >
        읽어보기
      </button>
      {result && (
        <div className="mt-3 space-y-1 text-sm">
          {result.errors.map((e) => (
            <p key={e} className="text-xs text-red-700">
              {e}
            </p>
          ))}
          {result.records.map((r) => (
            <div key={r.date + r.source} className="tabular-nums">
              <span className="font-semibold">{r.date}</span> <span className="text-xs text-slate-500">{SOURCE_LABEL[r.source]}</span> · {r.weightKg ?? '-'}kg · 골격근 {r.skeletalMuscleKg ?? '-'} · 체지방 {r.bodyFatPct ?? '-'}%
              {checkRecord(r).map((w) => (
                <div key={w} className="text-xs text-amber-700">
                  ⚠️ {w}
                </div>
              ))}
            </div>
          ))}
          {result.records.length > 0 && (
            <button
              onClick={async () => {
                const s = await saveInBody(result.records)
                setMsg(`저장했습니다. 새로 ${s.added}회, 기존 날짜 보완 ${s.updated}회.`)
                setResult(undefined)
                setText('')
              }}
              className="mt-2 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white"
            >
              {result.records.length}회 저장
            </button>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </Card>
  )
}

const HISTORY_TAG = { history: '추이', manual: '입력', log: '기록' } as const

function History({ records }: { records: InBodyRecord[] }) {
  const [limit, setLimit] = useState(10)
  const rows = [...records].reverse()
  return (
    <Card title={`측정 기록 (${records.length}회)`}>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="font-normal">날짜</th>
            <th className="text-right font-normal">체중</th>
            <th className="text-right font-normal">골격근</th>
            <th className="text-right font-normal">체지방률</th>
            <th className="text-right font-normal">혈압</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => (
            <tr key={r.date} className="border-t border-slate-100">
              <td className="py-1.5">
                {r.date.slice(2).replaceAll('-', '.')}
                {r.source !== 'sheet' && <span className="ml-1 text-xs text-slate-400">{HISTORY_TAG[r.source]}</span>}
              </td>
              <td className="text-right">{r.weightKg ?? '-'}</td>
              <td className="text-right">{r.skeletalMuscleKg ?? '-'}</td>
              <td className="text-right">{r.bodyFatPct ?? '-'}</td>
              <td className="text-right">{r.systolicBp ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button onClick={() => setLimit(limit + 20)} className="mt-2 w-full rounded-lg bg-slate-100 py-2 text-sm">
          더 보기
        </button>
      )}
    </Card>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  )
}
