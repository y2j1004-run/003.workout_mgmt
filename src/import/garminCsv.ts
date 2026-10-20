// Reads the activity list exported from Garmin Connect (web: 활동 → CSV 내보내기).
// Column names differ by language, so each field accepts several header spellings.

import type { GarminData } from './parseLog'

export type GarminKind = 'run' | 'walk' | 'strength' | 'other'

export interface GarminActivity extends GarminData {
  date: string // YYYY-MM-DD
  kind: GarminKind
  type: string
}

export interface GarminParseResult {
  activities: GarminActivity[]
  /** field -> header found in the file, for showing which columns were recognized */
  columns: Partial<Record<Field, string>>
  skippedRows: number
}

type Field = 'type' | 'date' | 'title' | 'distance' | 'time' | 'avgHr' | 'maxHr' | 'cadence' | 'ascent' | 'calories'

const HEADERS: Record<Field, string[]> = {
  type: ['Activity Type', '활동 종류', '활동 유형', '종류', '유형'],
  date: ['Date', '날짜', '시작 시간', 'Start Time'],
  title: ['Title', '제목', '이름', '활동 이름'],
  distance: ['Distance', '거리'],
  time: ['Time', '시간', 'Moving Time', '이동 시간', 'Elapsed Time', '경과 시간'],
  avgHr: ['Avg HR', '평균 심박', '평균 심박수'],
  maxHr: ['Max HR', '최대 심박', '최대 심박수'],
  cadence: ['Avg Run Cadence', '평균 달리기 케이던스', '평균 러닝 케이던스', '평균 케이던스'],
  ascent: ['Total Ascent', '총 상승', '총 오르막', '상승'],
  calories: ['Calories', '칼로리'],
}

export const FIELD_LABELS: Record<Field, string> = {
  type: '활동 종류',
  date: '날짜',
  title: '제목',
  distance: '거리',
  time: '시간',
  avgHr: '평균 심박',
  maxHr: '최대 심박',
  cadence: '케이던스',
  ascent: '상승 고도',
  calories: '칼로리',
}

const norm = (s: string) => s.toLowerCase().replace(/[\s®.()]/g, '')

export function parseGarminCsv(text: string): GarminParseResult {
  const rows = parseCsv(text.replace(/^﻿/, ''))
  const header = rows.shift() ?? []
  const columns: Partial<Record<Field, string>> = {}
  const index: Partial<Record<Field, number>> = {}
  for (const field of Object.keys(HEADERS) as Field[]) {
    // earlier spellings win, so "Time" is preferred over "Elapsed Time"
    for (const name of HEADERS[field]) {
      const i = header.findIndex((h) => norm(h) === norm(name))
      if (i !== -1) {
        index[field] = i
        columns[field] = header[i]
        break
      }
    }
  }

  const activities: GarminActivity[] = []
  let skippedRows = 0
  for (const row of rows) {
    const get = (f: Field) => (index[f] == null ? undefined : clean(row[index[f]!]))
    const rawDate = get('date')
    const dm = rawDate?.match(/(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/)
    if (!rawDate || !dm) {
      if (row.some((c) => c.trim())) skippedRows++
      continue
    }
    const type = get('type') ?? ''
    activities.push({
      date: `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`,
      startTime: rawDate,
      type,
      kind: kindOf(type),
      title: get('title'),
      distanceKm: num(get('distance')) ?? 0,
      durationSec: duration(get('time')),
      avgHr: num(get('avgHr')),
      maxHr: num(get('maxHr')),
      cadence: num(get('cadence')),
      ascentM: num(get('ascent')),
      calories: num(get('calories')),
    })
  }
  return { activities, columns, skippedRows }
}

function kindOf(type: string): GarminKind {
  const t = type.toLowerCase()
  if (/walk|hik|걷기|하이킹/.test(t)) return 'walk'
  if (/run|러닝|달리기|조깅/.test(t)) return 'run'
  if (/strength|근력|웨이트/.test(t)) return 'strength'
  return 'other'
}

function clean(v: string | undefined): string | undefined {
  const t = v?.trim()
  return !t || t === '--' ? undefined : t
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined
  const n = Number(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}

/** "00:52:13", "52:13", "1:02:03.4" -> seconds */
function duration(v: string | undefined): number | undefined {
  if (!v || !/^\d+(:\d+){1,2}(\.\d+)?$/.test(v)) return undefined
  const parts = v.split(':').map(Number)
  const sec = parts.reduce((acc, p) => acc * 60 + p, 0)
  return Math.round(sec)
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
