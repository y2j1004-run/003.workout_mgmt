import type { Feeling } from '../import/parseLog'

export const FEELINGS: { id: Feeling; icon: string; label: string }[] = [
  { id: 'good', icon: '😀', label: '좋았어요' },
  { id: 'ok', icon: '🙂', label: '보통' },
  { id: 'hard', icon: '😮‍💨', label: '힘들었어요' },
]

export const feelingIcon = (f?: Feeling) => FEELINGS.find((x) => x.id === f)?.icon

// How the workout felt (tap again to clear) and a few words about it.
export default function MemoInput({
  id,
  memo,
  feeling,
  onMemo,
  onFeeling,
}: {
  id: string
  memo: string
  feeling?: Feeling
  onMemo: (memo: string) => void
  onFeeling: (f: Feeling | undefined) => void
}) {
  return (
    <div className="text-xs text-slate-500">
      소감 (선택)
      <div className="mt-1 flex gap-1.5">
        {FEELINGS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFeeling(feeling === f.id ? undefined : f.id)}
            aria-pressed={feeling === f.id}
            className={`rounded-full border px-3 py-1 text-xs ${feeling === f.id ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        value={memo}
        onChange={(e) => onMemo(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="예: 후반에 다리가 무거웠지만 페이스 유지 성공!"
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
      />
    </div>
  )
}

/** The note under a workout in a list. */
export function MemoLine({ memo, feeling }: { memo?: string; feeling?: Feeling }) {
  if (!memo && !feeling) return null
  return (
    <p className="mt-0.5 text-xs whitespace-pre-line text-slate-600">
      {feelingIcon(feeling)} {memo}
    </p>
  )
}
