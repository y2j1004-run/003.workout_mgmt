// Reads the CSV files from Samsung Health's "개인 데이터 다운로드". Each file starts with a line naming
// its data type, then a header row. Times are stored in UTC with a separate offset ("UTC+0900").
// Only sleep stages, meals and daily steps are read; other files (settings, devices, accounts) are ignored.

import { parseCsv } from '../import/garminCsv'

export interface SleepNight {
  /** the date woken up on, local time */
  date: string
  /** local "YYYY-MM-DD HH:MM" */
  start: string
  end: string
  /** minutes asleep (light + deep + REM) */
  minutes: number
  awake: number
  light: number
  deep: number
  rem: number
  /** which app recorded it, e.g. Garmin Connect via Samsung Health */
  source: string
}

export interface NutritionDay {
  date: string
  kcal: number
  protein: number
  carb: number
  fat: number
  sodium: number
  meals: number
}

export interface StepDay {
  date: string
  steps: number
  km: number
}

export type ShealthKind = 'sleep' | 'nutrition' | 'steps'

export interface ShealthFile {
  kind: ShealthKind
  sleep?: SleepNight[]
  nutrition?: NutritionDay[]
  steps?: StepDay[]
}

const TYPES: Record<string, ShealthKind> = {
  'com.samsung.health.sleep_stage': 'sleep',
  'com.samsung.health.nutrition': 'nutrition',
  'com.samsung.shealth.step_daily_trend': 'steps',
}

/** Which kind of file this is, from its first line; undefined for files the app doesn't read. */
export function shealthKind(text: string): ShealthKind | undefined {
  return TYPES[text.slice(0, text.indexOf(',')).trim()]
}

export function parseShealth(text: string): ShealthFile | undefined {
  const kind = shealthKind(text)
  if (!kind) return undefined
  const [, header, ...rows] = parseCsv(text)
  const col = (name: string) => header.indexOf(name)
  const get = (r: string[], name: string) => r[col(name)] ?? ''
  const data = rows.filter((r) => r.length >= header.length - 1)
  if (kind === 'sleep') return { kind, sleep: sleepNights(data, get) }
  if (kind === 'nutrition') return { kind, nutrition: nutritionDays(data, get) }
  return { kind, steps: stepDays(data, get) }
}

/** "2026-10-18 13:51:00.000" in UTC plus "UTC+0900" → local Date (as UTC fields). */
function local(utc: string, offset: string): Date {
  const m = offset.match(/UTC([+-])(\d{2})(\d{2})/)
  const mins = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 9 * 60
  return new Date(Date.parse(`${utc.slice(0, 19).replace(' ', 'T')}Z`) + mins * 60000)
}
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const ymdhm = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ')
const num = (s: string) => (s.trim() ? Number(s) : 0)

const STAGE: Record<string, 'awake' | 'light' | 'deep' | 'rem'> = { '40001': 'awake', '40002': 'light', '40003': 'deep', '40004': 'rem' }
const SOURCE: Record<string, string> = { 'com.garmin.android.apps.connectmobile': '가민', 'com.sec.android.app.shealth': '삼성' }

type Get = (r: string[], name: string) => string

function sleepNights(rows: string[][], get: Get): SleepNight[] {
  const sessions = new Map<string, { start: Date; end: Date; awake: number; light: number; deep: number; rem: number; source: string }>()
  for (const r of rows) {
    const stage = STAGE[get(r, 'stage')]
    if (!stage) continue
    const off = get(r, 'time_offset')
    const s = local(get(r, 'start_time'), off)
    const e = local(get(r, 'end_time'), off)
    const id = get(r, 'sleep_id')
    const x = sessions.get(id) ?? { start: s, end: e, awake: 0, light: 0, deep: 0, rem: 0, source: SOURCE[get(r, 'pkg_name')] ?? '기타' }
    if (s < x.start) x.start = s
    if (e > x.end) x.end = e
    x[stage] += (e.getTime() - s.getTime()) / 60000
    sessions.set(id, x)
  }
  // one night per wake-up date: the longest sleep (naps and duplicate devices lose)
  const byDate = new Map<string, SleepNight>()
  for (const x of sessions.values()) {
    const n: SleepNight = {
      date: ymd(x.end),
      start: ymdhm(x.start),
      end: ymdhm(x.end),
      minutes: Math.round(x.light + x.deep + x.rem),
      awake: Math.round(x.awake),
      light: Math.round(x.light),
      deep: Math.round(x.deep),
      rem: Math.round(x.rem),
      source: x.source,
    }
    const prev = byDate.get(n.date)
    if (n.minutes > 0 && (!prev || n.minutes > prev.minutes)) byDate.set(n.date, n)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function nutritionDays(rows: string[][], get: Get): NutritionDay[] {
  const byDate = new Map<string, NutritionDay>()
  const seen = new Set<string>()
  for (const r of rows) {
    // the same meal can be exported twice with different ids; skip exact repeats
    const key = [get(r, 'start_time'), get(r, 'meal_type'), get(r, 'title'), get(r, 'calorie')].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    const date = ymd(local(get(r, 'start_time'), get(r, 'time_offset')))
    const d = byDate.get(date) ?? { date, kcal: 0, protein: 0, carb: 0, fat: 0, sodium: 0, meals: 0 }
    d.kcal += num(get(r, 'calorie'))
    d.protein += num(get(r, 'protein'))
    d.carb += num(get(r, 'carbohydrate'))
    d.fat += num(get(r, 'total_fat'))
    d.sodium += num(get(r, 'sodium'))
    d.meals++
    byDate.set(date, d)
  }
  return [...byDate.values()].map((d) => ({ ...d, kcal: Math.round(d.kcal), protein: Math.round(d.protein), carb: Math.round(d.carb), fat: Math.round(d.fat), sodium: Math.round(d.sodium) })).sort((a, b) => a.date.localeCompare(b.date))
}

function stepDays(rows: string[][], get: Get): StepDay[] {
  // several sources report the same day (phone, combined); keep the highest count
  const byDate = new Map<string, StepDay>()
  for (const r of rows) {
    const date = get(r, 'day_time').slice(0, 10)
    const steps = num(get(r, 'count'))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !steps) continue
    const prev = byDate.get(date)
    if (!prev || steps > prev.steps) byDate.set(date, { date, steps, km: Math.round(num(get(r, 'distance')) / 100) / 10 })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Hours of sleep a goal asks for, read from its title ("7시간 이상 자기" → 7). */
export function sleepHoursIn(title: string): number | undefined {
  const m = title.match(/(\d+(?:\.\d+)?)\s*시간/)
  return m ? Number(m[1]) : undefined
}
