import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { WORKOUT_TYPES } from '../analytics/workouts'
import { getProfile, setProfile } from '../db/profile'

const SPORTS = WORKOUT_TYPES.filter((t) => !t.custom).map((t) => t.label)

export default function MyProfileCard() {
  const saved = useLiveQuery(getProfile)
  const [name, setName] = useState('')
  const [sports, setSports] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!saved) return
    setName(saved.name ?? '')
    setSports(saved.sports ?? [])
  }, [saved])

  const options = [...new Set([...SPORTS, ...sports])]
  const toggle = (x: string) => setSports(sports.includes(x) ? sports.filter((s) => s !== x) : [...sports, x])
  const addCustom = () => {
    const x = custom.trim()
    if (x && !sports.includes(x)) setSports([...sports, x])
    setCustom('')
  }
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">내 프로필</h2>
      <p className="mb-3 text-sm text-slate-500">이름(닉네임)은 홈 화면 맨 위에 보입니다.</p>
      <label className="block text-xs text-slate-500">
        성명 또는 닉네임
        <input
          id="profile-name"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
        />
      </label>
      <p className="mt-3 mb-1 text-xs text-slate-500">운동 분야 (여러 개 고를 수 있어요)</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((x) => (
          <button key={x} type="button" onClick={() => toggle(x)} className={chip(sports.includes(x))}>
            {x}
          </button>
        ))}
        <input
          id="profile-sport-custom"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          onBlur={addCustom}
          placeholder="직접 입력"
          className="w-24 rounded-full border border-slate-300 px-3 py-1 text-xs"
        />
      </div>
      <button
        onClick={async () => {
          const p = { ...(await getProfile()), name: name.trim() || undefined, sports: sports.length ? sports : undefined }
          await setProfile(p)
          setMsg('저장했습니다.')
        }}
        className="mt-3 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white"
      >
        저장
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}
