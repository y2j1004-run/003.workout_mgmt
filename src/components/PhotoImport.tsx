import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getApiKey } from '../db/apiKey'
import { saveInBody } from '../db/db'
import { checkRecord, type InBodyRecord } from '../inbody/inbody'

interface Item {
  id: number
  name: string
  url: string
  status: 'waiting' | 'reading' | 'done' | 'skipped' | 'error'
  error?: string
  sheet?: InBodyRecord
  history: InBodyRecord[]
  include: boolean
}

export const isAuthError = (e: unknown) => (e as { status?: number })?.status === 401

const EDITABLE: [keyof InBodyRecord, string][] = [
  ['weightKg', '체중'],
  ['skeletalMuscleKg', '골격근량'],
  ['bodyFatKg', '체지방량'],
  ['bodyFatPct', '체지방률'],
]

export default function PhotoImport() {
  const apiKey = useLiveQuery(getApiKey)
  const [items, setItems] = useState<Item[]>([])
  const [msg, setMsg] = useState('')
  const busy = items.some((i) => i.status === 'waiting' || i.status === 'reading')
  const update = (id: number, change: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)))

  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), [items])

  const pick = async (files: FileList | null) => {
    if (!files?.length || !apiKey) return
    setMsg('')
    const queue: Item[] = [...files].map((f, n) => ({ id: Date.now() + n, name: f.name, url: URL.createObjectURL(f), status: 'waiting', history: [], include: true }))
    setItems(queue)
    // the SDK is loaded only when photos are read, keeping the app itself small
    const { makeClient, preparePhoto, readSheet, toRecords } = await import('../inbody/readSheet')
    const client = makeClient(apiKey)
    // one at a time keeps memory low on the phone and stays well under rate limits
    for (const [n, item] of queue.entries()) {
      update(item.id, { status: 'reading' })
      try {
        const reading = await readSheet(client, await preparePhoto(files[n]))
        const { sheet, history } = toRecords(reading)
        update(item.id, sheet || history.length ? { status: 'done', sheet, history } : { status: 'skipped', include: false })
      } catch (e) {
        const error = isAuthError(e) ? 'API 키가 올바르지 않습니다. 설정에서 다시 넣어 주세요.' : e instanceof Error ? e.message : String(e)
        update(item.id, { status: 'error', error, include: false })
      }
    }
  }

  const save = async () => {
    const chosen = items.filter((i) => i.include && i.status === 'done')
    // history first so a full sheet for the same date (from another photo) wins
    const records = [...chosen.flatMap((i) => i.history), ...chosen.flatMap((i) => (i.sheet ? [i.sheet] : []))]
    const r = await saveInBody(records)
    setMsg(`저장했습니다. 새로 ${r.added}회, 기존 날짜 보완 ${r.updated}회.`)
    setItems([])
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">사진으로 입력</h2>
      {!apiKey ? (
        <p className="text-sm text-slate-500">⚙️ 설정 → "사진 인식용 Claude API 키"를 먼저 넣어 주세요.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">결과지 사진을 여러 장 골라도 됩니다. 결과지가 아닌 사진은 건너뜁니다. 저장 전에 읽은 값을 확인하고 고칠 수 있습니다.</p>
          <label className={`block rounded-lg py-2.5 text-center font-semibold text-white ${busy ? 'bg-slate-400' : 'cursor-pointer bg-teal-700'}`}>
            {busy ? `읽는 중… (${items.filter((i) => i.status !== 'waiting' && i.status !== 'reading').length}/${items.length})` : '결과지 사진 고르기'}
            <input id="inbody-photos" type="file" accept="image/*" multiple disabled={busy} className="hidden" onChange={(e) => pick(e.target.files)} />
          </label>
        </>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-3">
          {items.map((i) => (
            <li key={i.id} className="flex gap-3 border-t border-slate-100 pt-3">
              <img src={i.url} alt="" className="h-20 w-16 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1 text-sm">
                {i.status === 'waiting' && <p className="text-slate-400">대기 중</p>}
                {i.status === 'reading' && <p className="text-teal-700">읽는 중…</p>}
                {i.status === 'skipped' && <p className="text-slate-500">인바디 결과지가 아니어서 건너뜁니다.</p>}
                {i.status === 'error' && <p className="text-red-700">{i.error}</p>}
                {i.status === 'done' && (
                  <>
                    <label className="flex items-center gap-2 font-semibold tabular-nums">
                      <input id={`include-${i.id}`} type="checkbox" checked={i.include} onChange={(e) => update(i.id, { include: e.target.checked })} />
                      {i.sheet ? `${i.sheet.date} ${i.sheet.time ?? ''}` : '측정일을 못 읽음'}
                    </label>
                    {i.sheet && (
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        {EDITABLE.map(([k, label]) => (
                          <label key={k} className="flex items-center gap-1 text-xs text-slate-500">
                            <span className="w-12 shrink-0">{label}</span>
                            <input
                              id={`edit-${i.id}-${k}`}
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              value={(i.sheet![k] as number | undefined) ?? ''}
                              onChange={(e) => update(i.id, { sheet: { ...i.sheet!, [k]: e.target.value === '' ? undefined : Number(e.target.value) } })}
                              className="w-full min-w-0 rounded border border-slate-300 px-1 py-0.5 text-sm text-slate-900 tabular-nums"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    {i.sheet &&
                      checkRecord(i.sheet).map((w) => (
                        <p key={w} className="mt-1 text-xs text-amber-700">
                          ⚠️ {w}
                        </p>
                      ))}
                    {i.history.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        신체변화 {i.history.length}회 ({i.history[0].date.slice(2)} ~ {i.history.at(-1)!.date.slice(2)})
                      </p>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!busy && items.some((i) => i.include && i.status === 'done') && (
        <button onClick={save} className="mt-3 w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white">
          확인한 값 저장
        </button>
      )}
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}
