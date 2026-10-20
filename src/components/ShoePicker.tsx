import { useState } from 'react'

interface Props {
  id: string
  options: string[]
  value?: string
  onPick: (shoe: string | undefined) => void
  /** show a "신발 없음" chip to clear the choice */
  allowNone?: boolean
}

// Chips for the shoes in rotation, plus a field to type a new one.
export default function ShoePicker({ id, options, value, onPick, allowNone }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm ${active ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`

  const addNew = () => {
    const n = name.trim()
    if (!n) return
    onPick(n)
    setName('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onPick(o)} className={chip(o === value)}>
          {o}
        </button>
      ))}
      {value && !options.includes(value) && (
        <button type="button" className={chip(true)}>
          {value}
        </button>
      )}
      {allowNone && (
        <button type="button" onClick={() => onPick(undefined)} className={chip(!value)}>
          신발 없음
        </button>
      )}
      {adding ? (
        <span className="flex gap-1">
          <input
            id={`${id}-new`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNew()}
            placeholder="신발 이름"
            className="w-28 rounded-full border border-slate-300 px-3 py-1 text-sm"
          />
          <button type="button" onClick={addNew} className="rounded-full bg-teal-700 px-3 text-sm text-white">
            추가
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-600">
          + 새 신발
        </button>
      )}
    </div>
  )
}
