import BackupRestore from '../components/BackupRestore'
import GarminImport from '../components/GarminImport'
import ImportLog from '../components/ImportLog'
import GoalsCard from '../components/GoalsCard'

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>
      <ImportLog />
      <GarminImport />
      <BackupRestore />
      <GoalsCard />
      <p className="text-center text-xs text-slate-400 tabular-nums">앱 버전 {new Date(__BUILD_TIME__).toLocaleString('ko-KR')}</p>
    </div>
  )
}
