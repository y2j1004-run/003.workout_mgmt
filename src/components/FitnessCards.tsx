import { useState, type ReactNode } from 'react'
import {
  ageOn,
  INTENSITY_LABEL,
  intensityMix,
  vo2FitnessGroup,
  vo2Level,
  vo2Series,
  type Intensity,
  type MaxHr,
} from '../analytics/fitness'
import { addDays } from '../analytics/stats'
import { deleteVo2, saveVo2, type Profile, type Vo2Entry } from '../db/profile'
import type { DayEntry } from '../import/parseLog'
import LineChart from './charts/LineChart'

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const km = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}km`

export const INTENSITY_COLOR: Record<Intensity, string> = { easy: 'bg-teal-600', tempo: 'bg-amber-500', hard: 'bg-rose-600' }
export const INTENSITY_CHIP: Record<Intensity, string> = {
  easy: 'bg-teal-50 text-teal-800',
  tempo: 'bg-amber-100 text-amber-800',
  hard: 'bg-rose-100 text-rose-800',
}

export function Vo2Card({ days, entries, profile }: { days: DayEntry[]; entries: Vo2Entry[]; profile: Profile }) {
  const series = vo2Series(days, entries)
  const last = series.at(-1)
  const age = last ? ageOn(profile.birthYear, last.date) : undefined
  const rated = last && age != null ? vo2Level(last.value, age, profile.sex) : undefined
  const young = last ? vo2FitnessGroup(last.value, profile.sex) : undefined

  return (
    <Card title="체력 (VO2max)">
      {last ? (
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-3xl font-bold tabular-nums">{last.value}</div>
            <div className="text-xs text-slate-500 tabular-nums">ml/kg/분 · {last.date}</div>
          </div>
          {rated && (
            <div className="text-right text-sm">
              <div>
                {rated.group} {profile.sex === 'female' ? '여성' : '남성'} 기준 <b className="text-teal-700">{rated.level}</b>
              </div>
              {rated.next && <div className="text-xs text-slate-500 tabular-nums">{rated.next.level}까지 +{Math.round((rated.next.value - last.value) * 10) / 10}</div>}
              {young && <div className="text-xs text-slate-500">{young}에서도 '좋음' 이상</div>}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">가민 시계나 앱에 나오는 VO2max(최대산소섭취량)를 아래에 넣으세요.</p>
      )}
      {last && age == null && <p className="mt-2 text-xs text-slate-500">⚙️ 설정 → 내 정보에 출생 연도를 넣으면 나이대 기준으로 평가합니다.</p>}
      {series.length > 1 && (
        <div className="mt-3">
          <LineChart data={series} format={(d) => `${d.date} · ${d.value}`} />
        </div>
      )}
      <Vo2Entries entries={entries} />
      <p className="mt-2 text-xs text-slate-400">등급은 가민이 쓰는 Cooper Institute 표 기준입니다.</p>
    </Card>
  )
}

function Vo2Entries({ entries }: { entries: Vo2Entry[] }) {
  const [date, setDate] = useState(today)
  const [value, setValue] = useState('')
  const [showAll, setShowAll] = useState(false)
  const v = Number(value)
  const ok = value.trim() !== '' && v >= 15 && v <= 95
  const rows = [...entries].reverse()

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex items-end gap-2">
        <label className="flex-1 text-xs text-slate-500">
          측정일
          <input id="vo2-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900" />
        </label>
        <label className="w-24 text-xs text-slate-500">
          VO2max
          <input
            id="vo2-value"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
          />
        </label>
        <button
          disabled={!ok}
          onClick={async () => {
            await saveVo2({ date, value: v })
            setValue('')
          }}
          className="shrink-0 whitespace-nowrap rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
      {value.trim() !== '' && !ok && <p className="mt-1 text-xs text-amber-700">15~95 사이 값을 넣어 주세요.</p>}
      {rows.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {rows.slice(0, showAll ? undefined : 3).map((e) => (
            <li key={e.date} className="flex items-center justify-between py-1 tabular-nums">
              <span>
                {e.date} · <b>{e.value}</b>
              </span>
              <button onClick={() => deleteVo2(e.date)} aria-label={`${e.date} VO2max 삭제`} className="px-2 text-xs text-slate-400">
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 3 && (
        <button onClick={() => setShowAll(!showAll)} className="mt-1 text-xs text-teal-700">
          {showAll ? '접기' : `입력한 값 ${rows.length}개 모두 보기`}
        </button>
      )}
    </div>
  )
}

export function IntensityCard({ days, maxHr, hasAge }: { days: DayEntry[]; maxHr?: MaxHr; hasAge: boolean }) {
  const now = today()
  const windows = [
    { label: '최근 4주', mix: intensityMix(days, maxHr, addDays(now, -27), now) },
    { label: '최근 12주', mix: intensityMix(days, maxHr, addDays(now, -83), now) },
  ]
  const share = windows[0].mix.easyShare ?? windows[1].mix.easyShare

  return (
    <Card title="러닝 강도" note={maxHr ? `최대 심박 ${maxHr.bpm}` : undefined}>
      {!maxHr ? (
        <p className="text-sm text-slate-500">⚙️ 설정 → 내 정보에 출생 연도를 넣거나, 심박이 담긴 가민 CSV를 가져오면 러닝마다 강도를 나눕니다.</p>
      ) : (
        <>
          <div className="space-y-3">
            {windows.map(({ label, mix }) => {
              const total = mix.km.easy + mix.km.tempo + mix.km.hard
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{label}</span>
                    <span className="tabular-nums">
                      {km(total)}
                      {mix.noHrKm > 0 && ` (심박 없는 ${km(mix.noHrKm)} 제외)`}
                    </span>
                  </div>
                  {total > 0 ? (
                    <>
                      <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-slate-100">
                        {(Object.keys(INTENSITY_LABEL) as Intensity[]).map((k) =>
                          mix.km[k] > 0 ? <div key={k} className={INTENSITY_COLOR[k]} style={{ width: `${(mix.km[k] / total) * 100}%` }} /> : null,
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
                        {(Object.keys(INTENSITY_LABEL) as Intensity[]).map((k) => (
                          <span key={k} className="flex items-center gap-1 whitespace-nowrap">
                            <span className={`inline-block h-2 w-2 rounded-full ${INTENSITY_COLOR[k]}`} />
                            {INTENSITY_LABEL[k]} {km(mix.km[k])} ({Math.round((mix.km[k] / total) * 100)}%)
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">이 기간에 심박이 기록된 러닝이 없습니다.</p>
                  )}
                </div>
              )
            })}
          </div>
          {share != null && (
            <p className="mt-3 text-sm text-slate-700">
              {share >= 0.75
                ? `쉬운 러닝이 ${Math.round(share * 100)}%로, 권장(약 80%)에 가깝습니다. 지금처럼 쉬운 날은 확실히 천천히 달리세요.`
                : `쉬운 러닝이 ${Math.round(share * 100)}%입니다. 권장은 약 80%라, 쉬운 날의 페이스를 조금 늦추면 회복과 지구력 향상에 도움이 됩니다.`}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-400">
            평균 심박이 최대 심박의 80% 미만이면 쉬움, 88% 미만이면 템포, 그 이상이면 고강도로 봅니다. 최대 심박은 {maxHr.basis}
            {!hasAge && ' (출생 연도를 넣으면 나이로 추정한 값과 비교합니다)'}입니다.
          </p>
        </>
      )}
    </Card>
  )
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {note && <span className="text-xs text-slate-500 tabular-nums">{note}</span>}
      </div>
      {children}
    </div>
  )
}
