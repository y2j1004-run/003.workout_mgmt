import { useState } from 'react'
import TabBar, { type Tab } from './components/TabBar'
import Home from './pages/Home'
import Workout from './pages/Workout'
import InBody from './pages/InBody'
import Stats from './pages/Stats'
import Settings from './pages/Settings'

const pages: Record<Tab, () => React.ReactNode> = {
  home: Home,
  workout: Workout,
  inbody: InBody,
  stats: Stats,
  settings: Settings,
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const Page = pages[tab]

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <main className="flex-1 overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <Page />
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  )
}
