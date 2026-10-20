export type Tab = 'home' | 'workout' | 'inbody' | 'stats' | 'settings'

const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: '홈' },
  { id: 'workout', icon: '💪', label: '운동' },
  { id: 'inbody', icon: '⚖️', label: '인바디' },
  { id: 'stats', icon: '📊', label: '통계' },
  { id: 'settings', icon: '⚙️', label: '설정' },
]

export default function TabBar({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
            current === t.id ? 'font-semibold text-teal-700' : 'text-slate-500'
          }`}
        >
          <span className="text-xl">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
