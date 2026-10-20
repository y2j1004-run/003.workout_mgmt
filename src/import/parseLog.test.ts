import { describe, expect, it } from 'vitest'
import { parseLog, splitTopLevel } from './parseLog'

// Fixtures are made-up examples in the same style as the real log (never commit the real log).
const sample = `* 목표 메모

[ 2024년 ]
10.20 : 2식, 7K 러닝(오전), 7K 산책(저녁)
11.1 : 헬스장 운동 시작 (5키로 러닝)
12.6 : 5키로 러닝, 공복 18시간, 체지방률 24.2

[ 2025년 ]
02.14 : 5키로 러닝, 18시간 공복, 웨이트,
               체지방률 19.2
03.21 : 5키로 러닝, 웨이트, 체지방률 17.2  ** 페이스가 편해짐.
04.20 : 21.1키로 러닝(테스트마라톤), 18시간 공복
               1시간 50분(100등/1,000명)
** 15키로 이후가 힘들었음.
06.02 : 6.2키로 러닝(워,11,12,13,쿨), 웨이트(가슴, 등, 이두)
06.12 : 8 2키로, 땀배출 100g
09.19 : 42.2키로(A동-B동)
- 30키로 넘어가면서 힘이 빠짐,
   35키로 넘어서는 정말 힘들었음.
10.25 : 발목 통증으로 휴식함. 체중증가 65kg
체지방률 14.8, 혈압 125

[ 2026년 ]
01.17 : 10.3키로(A역-B역)
               * VO2 max 경신 (56)
02.06 : 7키로, 웨이트 못함(손목 부상)
02.16 : 5키로(운동장, w/친구A)
03.01 : 6.2키로(하천, 친구A)
03.20 : 30키로(A역~B공원, 평균페이스 5분25초
04.30 : 12키로(빌드업)
               (543/513/448)*10분씩
                체지방률 13.5, 혈압 105, 체중 62.7
05.12 : 11.8키로
  * 408로 5분 버티고 쉼
                6.6키로(업힐 훈련, 언덕)
08 04 : 12.3키로, 빌드업 러닝
06.28 : 39키로(남산, w/크루X, 디나엘4)
09.15 : 11.1키로(510*8키로, 100질주*4회) ※ 338
09.20 : 32키로(테스트백제마라톤, 평페 434)
10.11 : 23키로(테스트레이스, 1시간31분51초)
10.17 : 23키로(2k 워밍업, 하프 / 테스트마라톤)
10.01 : 10.01키로 * 지속주(420*8km)
`

const { days, preamble } = parseLog(sample)
const day = (date: string) => {
  const d = days.find((x) => x.date === date)
  if (!d) throw new Error(`no entry for ${date}`)
  return d
}

describe('parseLog', () => {
  it('reads year headers, dates and the preamble', () => {
    expect(preamble).toEqual(['목표 메모'])
    expect(days[0].date).toBe('2024-10-20')
    expect(day('2026-08-04').activities[0].distanceKm).toBe(12.3)
  })

  it('separates runs and walks with time-of-day tags', () => {
    const d = day('2024-10-20')
    expect(d.meals).toBe(2)
    expect(d.activities.map((a) => [a.kind, a.distanceKm, a.tags])).toEqual([
      ['run', 7, ['오전']],
      ['walk', 7, ['저녁']],
    ])
  })

  it('finds a run written inside a sentence', () => {
    const d = day('2024-11-01')
    expect(d.activities[0]).toMatchObject({ kind: 'run', distanceKm: 5 })
    expect(d.notes).toEqual(['헬스장 운동 시작'])
  })

  it('reads fasting and body fat in both word orders and on continuation lines', () => {
    expect(day('2024-12-06')).toMatchObject({ fastingHours: 18, metrics: { bodyFatPct: 24.2 } })
    expect(day('2025-02-14')).toMatchObject({ fastingHours: 18, strength: { done: true }, metrics: { bodyFatPct: 19.2 } })
  })

  it('keeps inline and block notes, including multi-line ones', () => {
    expect(day('2025-03-21').notes).toEqual(['페이스가 편해짐.'])
    expect(day('2025-09-19').notes).toEqual(['30키로 넘어가면서 힘이 빠짐, 35키로 넘어서는 정말 힘들었음.'])
    expect(day('2025-09-19').activities).toHaveLength(1)
  })

  it('attaches race time to the run and derives pace', () => {
    const run = day('2025-04-20').activities[0]
    expect(run).toMatchObject({ event: '테스트마라톤', durationSec: 6600, paceSecPerKm: 313 })
    expect(run.tags).toEqual(['100등/1,000명'])
  })

  it('reads strength body parts and speed sequences', () => {
    const d = day('2025-06-02')
    expect(d.strength).toEqual({ done: true, parts: ['가슴', '등', '이두'] })
    expect(d.activities[0].details).toEqual(['워,11,12,13,쿨'])
  })

  it('flags a space used as a decimal point', () => {
    const d = day('2025-06-12')
    expect(d.activities[0].distanceKm).toBe(8.2)
    expect(d.issues).toHaveLength(1)
  })

  it('reads weight and vo2max from free text', () => {
    expect(day('2025-10-25')).toMatchObject({ rest: true, metrics: { weightKg: 65, bodyFatPct: 14.8, systolicBp: 125 } })
    expect(day('2026-01-17').metrics.vo2max).toBe(56)
    expect(day('2026-04-30').metrics).toEqual({ bodyFatPct: 13.5, systolicBp: 105, weightKg: 62.7 })
  })

  it('records skipped strength sessions as not done', () => {
    expect(day('2026-02-06').strength?.done).toBe(false)
  })

  it('recognizes companions with and without "w/"', () => {
    expect(day('2026-02-16').activities[0]).toMatchObject({ place: '운동장', companions: ['친구A'] })
    expect(day('2026-03-01').activities[0]).toMatchObject({ place: '하천', companions: ['친구A'] })
  })

  it('reads both pace notations and survives a missing ")"', () => {
    expect(day('2026-03-20').activities[0].paceSecPerKm).toBe(325)
    expect(day('2026-03-20').issues).toEqual(['닫는 괄호 없음'])
    expect(day('2026-09-20').activities[0]).toMatchObject({ event: '테스트백제마라톤', paceSecPerKm: 274 })
  })

  it('attaches parenthesized lines to the previous run', () => {
    expect(day('2026-04-30').activities[0].details).toEqual(['빌드업', '(543/513/448)*10분씩'])
  })

  it('ends a note block when a new run line starts', () => {
    const d = day('2026-05-12')
    expect(d.activities.map((a) => a.distanceKm)).toEqual([11.8, 6.6])
    expect(d.notes).toEqual(['408로 5분 버티고 쉼'])
  })

  it('keeps text after the distance as training detail', () => {
    expect(day('2026-08-04').activities[0].details).toEqual(['빌드업 러닝'])
    expect(day('2026-10-01').activities[0].details).toEqual(['지속주(420*8km)'])
  })
})

describe('dictionary-based fields', () => {
  it('moves shoes and crews out of tags and companions', () => {
    const run = day('2026-06-28').activities[0]
    expect(run).toMatchObject({ shoe: '디나엘4', companions: ['크루X'], tags: [] })
  })

  it('drops bare-number notes', () => {
    expect(day('2026-09-15').notes).toEqual([])
  })

  it('uses the half-marathon distance for race pace when warm-up is included', () => {
    expect(day('2026-10-11').activities[0]).toMatchObject({ raceDistanceKm: 21.0975, paceSecPerKm: 261 })
    expect(day('2026-10-17').activities[0].raceDistanceKm).toBe(21.0975)
  })
})

describe('splitTopLevel', () => {
  it('ignores commas inside parentheses', () => {
    expect(splitTopLevel('8키로(공원, w/친구), 웨이트(가슴,등), 체지방률 14')).toEqual([
      '8키로(공원, w/친구)',
      '웨이트(가슴,등)',
      '체지방률 14',
    ])
  })
})
