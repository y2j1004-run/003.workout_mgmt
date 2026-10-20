import { describe, expect, it } from 'vitest'
import { placeFromTitle } from '../import/mergeGarmin'
import { parseLog } from '../import/parseLog'
import { themeOf } from './themes'

const runs = parseLog(`[ 2026년 ]
09.01 : 11.5키로(인터벌: 800m*8회)
09.02 : 25키로(가우스 LSD 7회차, 광교호수공원)
09.03 : 12키로(빌드업)
09.04 : 6.4키로(회복러닝)
09.05 : 10키로(동아마라톤, 42분 58초)
09.06 : 11키로(가우스 달벙, 광교호수공원)
09.07 : 6.6키로(업힐 훈련, 언덕)
09.08 : 10키로(동백역-기흥역)
`).days.map((d) => d.activities[0])

describe('run themes', () => {
  it('infers a theme from the log words, races and crews', () => {
    expect(runs.map((a) => themeOf(a).theme)).toEqual(['인터벌', 'LSD', '빌드업', '회복', '대회', '크루', '언덕', undefined])
    expect(themeOf(runs[0]).inferred).toBe(true)
  })

  it('prefers the theme the user chose', () => {
    expect(themeOf({ ...runs[7], theme: '지속주' })).toEqual({ theme: '지속주', inferred: false })
  })
})

describe('place from a Garmin title', () => {
  it('keeps the city and drops the activity words', () => {
    expect(placeFromTitle('용인시 러닝')).toBe('용인시')
    expect(placeFromTitle('Yongin Running')).toBe('Yongin')
    expect(placeFromTitle('수원시 트레드밀 러닝')).toBe('수원시')
    expect(placeFromTitle('Treadmill Running')).toBeUndefined()
    expect(placeFromTitle('광교호수공원 LSD')).toBe('광교호수공원 LSD')
    expect(placeFromTitle(undefined)).toBeUndefined()
  })
})
