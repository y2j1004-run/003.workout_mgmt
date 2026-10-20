import ImportLog from '../components/ImportLog'
import Placeholder from '../components/Placeholder'

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>
      <ImportLog />
      <Placeholder title="" items={['인바디 사진 일괄 가져오기', '백업 · 복원', '목표 설정 · 운동 종목 관리']} />
    </div>
  )
}
