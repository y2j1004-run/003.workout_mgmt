// InBody measurements. Values come from a result sheet (read from a photo), from the
// "신체변화" history strip on a sheet (last 8 measurements, fewer fields), or typed in.

export type InBodySource = 'sheet' | 'history' | 'manual'

export interface InBodyRecord {
  date: string // YYYY-MM-DD
  time?: string // HH:MM
  source: InBodySource
  weightKg?: number
  skeletalMuscleKg?: number
  bodyFatKg?: number
  bodyFatPct?: number
  bmi?: number
  score?: number
  visceralFatArea?: number
  bmrKcal?: number
  ecwRatio?: number
  systolicBp?: number
  diastolicBp?: number
  pulse?: number
}

// A full sheet beats a typed entry, which beats the short history strip.
const RANK: Record<InBodySource, number> = { history: 1, manual: 2, sheet: 3 }

/** Combines records for the same date: the better source wins, missing fields are filled from the other. */
export function mergeRecord(existing: InBodyRecord | undefined, incoming: InBodyRecord): InBodyRecord {
  if (!existing) return incoming
  const [hi, lo] = RANK[incoming.source] >= RANK[existing.source] ? [incoming, existing] : [existing, incoming]
  const merged: InBodyRecord = { ...lo, ...stripUndefined(hi) }
  return merged
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

// Paste format (one measurement per line, header optional):
// date,time,source,weight,smm,fatKg,pbf,bmi,score,vfa,bmr,ecw,sys,dia,pulse
export const CSV_COLUMNS = ['date', 'time', 'source', 'weight', 'smm', 'fatKg', 'pbf', 'bmi', 'score', 'vfa', 'bmr', 'ecw', 'sys', 'dia', 'pulse'] as const

export function parseInBodyCsv(text: string): { records: InBodyRecord[]; errors: string[] } {
  const records: InBodyRecord[] = []
  const errors: string[] = []
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('date')) continue
    const c = line.split(',').map((x) => x.trim())
    const date = c[0]?.replace(/\./g, '-')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`${i + 1}번째 줄: 날짜를 읽지 못했습니다 (${c[0]})`)
      continue
    }
    const source = (['sheet', 'history', 'manual'] as const).find((s) => s === c[2]) ?? 'sheet'
    const n = (k: number) => (c[k] === undefined || c[k] === '' ? undefined : Number(c[k]))
    const rec: InBodyRecord = {
      date,
      time: c[1] || undefined,
      source,
      weightKg: n(3),
      skeletalMuscleKg: n(4),
      bodyFatKg: n(5),
      bodyFatPct: n(6),
      bmi: n(7),
      score: n(8),
      visceralFatArea: n(9),
      bmrKcal: n(10),
      ecwRatio: n(11),
      systolicBp: n(12),
      diastolicBp: n(13),
      pulse: n(14),
    }
    const bad = Object.entries(rec).find(([, v]) => typeof v === 'number' && Number.isNaN(v))
    if (bad) errors.push(`${i + 1}번째 줄: 숫자가 아닌 값이 있습니다`)
    else records.push(rec)
  }
  return { records, errors }
}

/** Warnings for values that are probably misread: fat kg and fat % should agree with weight. */
export function checkRecord(r: InBodyRecord): string[] {
  const warn: string[] = []
  if (r.weightKg && r.bodyFatKg && r.bodyFatPct) {
    const pct = (r.bodyFatKg / r.weightKg) * 100
    if (Math.abs(pct - r.bodyFatPct) > 0.6) warn.push(`체지방량/체중 = ${pct.toFixed(1)}%인데 체지방률은 ${r.bodyFatPct}%`)
  }
  if (r.weightKg && (r.weightKg < 30 || r.weightKg > 200)) warn.push('체중 값이 이상합니다')
  if (r.bodyFatPct && (r.bodyFatPct < 2 || r.bodyFatPct > 60)) warn.push('체지방률 값이 이상합니다')
  return warn
}
