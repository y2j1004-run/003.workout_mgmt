import { describe, expect, it } from 'vitest'
import { checkRecord, mergeRecord, parseInBodyCsv } from './inbody'

describe('parseInBodyCsv', () => {
  it('reads full sheet and history lines, skipping header and comments', () => {
    const { records, errors } = parseInBodyCsv(`date,time,source,weight,smm,fatKg,pbf,bmi,score,vfa,bmr,ecw,sys,dia,pulse
# example
2026-01-15,07:16,sheet,60.0,30.0,8.0,13.3,21.0,80,30,1500,0.370,100,60,70
2026.01.08,07:00,history,60.5,29.9,,14.0,,,,,0.371
`)
    expect(errors).toEqual([])
    expect(records[0]).toMatchObject({ date: '2026-01-15', time: '07:16', source: 'sheet', weightKg: 60, bodyFatKg: 8, systolicBp: 100, pulse: 70 })
    expect(records[1]).toMatchObject({ date: '2026-01-08', source: 'history', bodyFatPct: 14, ecwRatio: 0.371 })
    expect(records[1].bodyFatKg).toBeUndefined()
  })

  it('reports lines it cannot read', () => {
    expect(parseInBodyCsv('어제,07:00,sheet,60').errors).toHaveLength(1)
    expect(parseInBodyCsv('2026-01-01,,sheet,육십').errors).toHaveLength(1)
  })
})

describe('mergeRecord', () => {
  it('lets a full sheet win over the history strip and keeps extra fields', () => {
    const history = { date: '2026-01-08', source: 'history' as const, weightKg: 60.5, ecwRatio: 0.371 }
    const sheet = { date: '2026-01-08', source: 'sheet' as const, weightKg: 60.4, score: 80 }
    expect(mergeRecord(history, sheet)).toMatchObject({ source: 'sheet', weightKg: 60.4, score: 80, ecwRatio: 0.371 })
    expect(mergeRecord(sheet, history)).toMatchObject({ source: 'sheet', weightKg: 60.4 })
  })
})

describe('checkRecord', () => {
  it('flags fat kg and fat % that disagree', () => {
    expect(checkRecord({ date: '2026-01-01', source: 'sheet', weightKg: 60, bodyFatKg: 8, bodyFatPct: 13.3 })).toEqual([])
    expect(checkRecord({ date: '2026-01-01', source: 'sheet', weightKg: 60, bodyFatKg: 8, bodyFatPct: 18 })).toHaveLength(1)
  })
})
