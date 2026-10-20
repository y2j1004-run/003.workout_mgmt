import { describe, expect, it } from 'vitest'
import { parseLog } from '../import/parseLog'
import { crewCounts, metricSeries, monthlyKm, races, shoeTotals, summary } from './stats'

const { days } = parseLog(`[ 2026년 ]
01.30 : 8키로, 체지방률 15.0, 혈압 110
02.02 : 10키로(공원, w/크루X, 레벨)
03.01 : 12키로(공원, 레벨5)
03.15 : 3키로(워밍업)
               10키로(테스트마라톤, 42분 58초)
03.20 : 5키로 걷기, 체지방률 14.0
03.28 : 20키로(가우스 LSD)
`)

describe('stats', () => {
  it('sums running distance per month and fills empty months', () => {
    expect(monthlyKm(days)).toEqual([
      { month: '2026-01', km: 8 },
      { month: '2026-02', km: 10 },
      { month: '2026-03', km: 45 },
    ])
  })

  it('merges shoe aliases', () => {
    expect(shoeTotals(days)).toEqual([{ shoe: '레벨5', km: 22, loggedKm: 22, runs: 2, lastUsed: '2026-03-01', retired: false }])
  })

  it('lists races but not warm-ups or crew runs', () => {
    expect(races(days).map((r) => [r.date, r.event, r.paceSecPerKm])).toEqual([['2026-03-15', '테스트마라톤', 258]])
    expect(crewCounts(days)).toEqual([{ crew: '가우스', runs: 1, km: 20 }])
  })

  it('builds metric series oldest first', () => {
    expect(metricSeries(days, 'bodyFatPct').map((p) => p.value)).toEqual([15, 14])
  })

  it('summarizes totals and the last 4 weeks', () => {
    const s = summary(days, '2026-03-28')
    expect(s).toMatchObject({ totalKm: 63, yearKm: 63, weeklyAvgKm4w: 11.3, runDays: 5 })
    expect(s.lastBodyFat?.value).toBe(14)
  })
})

describe('shoeTotals with shoe list', () => {
  it('adds distance from before tracking and lists unused and retired shoes last', () => {
    const shoes = [
      { name: '레벨5', initialKm: 100, retired: false },
      { name: '새신발', initialKm: 0, retired: false },
      { name: '옛신발', initialKm: 800, retired: true },
    ]
    expect(shoeTotals(days, shoes).map((s) => [s.shoe, s.km, s.runs, s.retired])).toEqual([
      ['레벨5', 122, 2, false],
      ['새신발', 0, 0, false],
      ['옛신발', 800, 0, true],
    ])
  })
})
