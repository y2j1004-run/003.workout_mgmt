import { useState } from 'react'
import { THEMES } from '../analytics/themes'

// One-tap theme chips plus a field for any other theme; tapping the chosen chip clears it.
export default function ThemePicker({ id, value, onPick }: { id: string; value?: string; onPick: (theme: string | undefined) => void }) {
  const [custom, setCustom] = useState(value && !THEMES.includes(value) ? value : '')
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {THEMES.map((t) => (
        <button key={t} type="button" onClick={() => onPick(value === t ? undefined : t)} className={chip(value === t)}>
          {t}
        </button>
      ))}
      <input
        id={`${id}-custom`}
        value={custom}
        onChange={(e) => {
          setCustom(e.target.value)
          onPick(e.target.value.trim() || undefined)
        }}
        placeholder="직접 입력"
        className={`w-24 rounded-full border px-3 py-1 text-xs ${custom && value === custom.trim() ? 'border-teal-700' : 'border-slate-300'}`}
      />
    </div>
  )
}
