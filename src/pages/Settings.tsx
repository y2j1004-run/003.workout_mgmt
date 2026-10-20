import ApiKeyCard from '../components/ApiKeyCard'
import BackupRestore from '../components/BackupRestore'
import GarminImport from '../components/GarminImport'
import ImportLog from '../components/ImportLog'
import Placeholder from '../components/Placeholder'

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>
      <ImportLog />
      <GarminImport />
      <BackupRestore />
      <ApiKeyCard />
      <Placeholder title="" items={['목표 설정']} />
      <p className="text-center text-xs text-slate-400 tabular-nums">앱 버전 {new Date(__BUILD_TIME__).toLocaleString('ko-KR')}</p>
    </div>
  )
}
