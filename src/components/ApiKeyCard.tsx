import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getApiKey, setApiKey } from '../db/apiKey'
import { isAuthError } from './PhotoImport'

export default function ApiKeyCard() {
  const saved = useLiveQuery(getApiKey)
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')
  const [checking, setChecking] = useState(false)

  const check = async (key: string) => {
    setChecking(true)
    try {
      // a free call that fails on a wrong key
      const { makeClient } = await import('../inbody/readSheet')
      await makeClient(key).models.retrieve('claude-opus-5-5')
      return true
    } catch (e) {
      setMsg(isAuthError(e) ? '키가 올바르지 않습니다.' : `연결하지 못했습니다: ${e instanceof Error ? e.message : e}`)
      return false
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">사진 인식용 Claude API 키</h2>
      <p className="mb-3 text-sm text-slate-500">
        인바디 결과지 사진을 읽을 때 씁니다. 키는 이 휴대폰에만 저장되고 백업 파일에도 들어가지 않습니다. 키는 console.anthropic.com → API Keys에서 만들 수 있고, 사진 한 장에 몇십 원 정도 듭니다.
      </p>
      {saved ? (
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono">
            {saved.slice(0, 10)}…{saved.slice(-4)}
          </span>
          <span className="flex gap-2">
            <button disabled={checking} onClick={async () => (await check(saved)) && setMsg('연결됐습니다.')} className="rounded-lg bg-slate-200 px-3 py-1 disabled:opacity-40">
              {checking ? '확인 중…' : '연결 확인'}
            </button>
            <button
              onClick={async () => {
                await setApiKey(undefined)
                setMsg('키를 지웠습니다.')
              }}
              className="rounded-lg px-3 py-1 text-red-600"
            >
              지우기
            </button>
          </span>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value.trim())}
            placeholder="sk-ant-..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 font-mono text-sm"
          />
          <button
            disabled={!input || checking}
            onClick={async () => {
              setMsg('')
              if (await check(input)) {
                await setApiKey(input)
                setInput('')
                setMsg('저장했습니다.')
              }
            }}
            className="rounded-lg bg-teal-700 px-4 font-semibold text-white disabled:opacity-40"
          >
            {checking ? '확인 중…' : '저장'}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-teal-700">{msg}</p>}
    </div>
  )
}
