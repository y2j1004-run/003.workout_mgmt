import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getProfile, setProfile, type Profile, type Sex } from '../db/profile'

export default function ProfileCard() {
  const saved = useLiveQuery(getProfile)
  const [sex, setSex] = useState<Sex>()
  const [height, setHeight] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!saved) return
    setSex(saved.sex)
    setHeight(saved.heightCm ? String(saved.heightCm) : '')
    setBirthYear(saved.birthYear ? String(saved.birthYear) : '')
  }, [saved])

  const year = new Date().getFullYear()
  const h = Number(height)
  const y = Number(birthYear)
  const heightOk = !height.trim() || (h >= 100 && h <= 230)
  const yearOk = !birthYear.trim() || (Number.isInteger(y) && y >= year - 100 && y <= year - 10)

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">내 정보</h2>
      <p className="mb-3 text-sm text-slate-500">인바디 해석 기준, VO2max 나이대 비교, 러닝 강도(최대 심박 추정)에 씁니다. 이 휴대폰과 백업 파일에만 저장됩니다.</p>
      <div className="mb-2 flex gap-2" role="radiogroup" aria-label="성별">
        {(
          [
            ['male', '남성'],
            ['female', '여성'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="radio"
            aria-checked={sex === v}
            onClick={() => setSex(v)}
            className={`flex-1 rounded-lg border py-2 text-sm ${sex === v ? 'border-teal-700 bg-teal-50 font-semibold text-teal-800' : 'border-slate-300 text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          키 (cm)
          <input
            id="profile-height"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-500">
          출생 연도
          <input
            id="profile-birth-year"
            type="number"
            inputMode="numeric"
            placeholder="예: 1980"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base text-slate-900"
          />
        </label>
      </div>
      {!heightOk && <p className="mt-2 text-xs text-amber-700">키는 100~230cm 사이로 넣어 주세요.</p>}
      {!yearOk && <p className="mt-2 text-xs text-amber-700">출생 연도를 네 자리로 넣어 주세요.</p>}
      <button
        disabled={!heightOk || !yearOk}
        onClick={async () => {
          const p: Profile = {}
          if (sex) p.sex = sex
          if (height.trim()) p.heightCm = h
          if (birthYear.trim()) p.birthYear = y
          await setProfile(p)
          setMsg('저장했습니다.')
        }}
        className="mt-3 w-full rounded-lg bg-teal-700 py-2 font-semibold text-white disabled:opacity-40"
      >
        저장
      </button>
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}
