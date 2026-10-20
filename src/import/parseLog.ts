// Parses the free-form workout log text ("MM.DD : 8키로(장소), 웨이트, 체지방률 14.5 ...")
// into one structured entry per day. Anything the rules don't understand is kept, never dropped.
//
// Log conventions: "500", "436" are paces per km (5'00", 4'36"); "10k/h", "(워,11,12,13,쿨)" are
// treadmill speeds in km/h; "혈압" is the systolic value.

import { CREWS, HALF_MARATHON_KM, SHOES } from './dictionary'

export type ActivityKind = 'run' | 'walk'

export interface Activity {
  kind: ActivityKind
  distanceKm: number
  place?: string
  /** race or group run: "경기마라톤", "가우스 달벙" */
  event?: string
  /** running crew the run was with */
  crew?: string
  /** official distance when the logged distance includes warm-up (e.g. half marathon in a 23km day) */
  raceDistanceKm?: number
  shoe?: string
  companions: string[]
  /** training content such as "인터벌", "500*5km, 436*5km" */
  details: string[]
  /** other words attached to the run */
  tags: string[]
  durationSec?: number
  paceSecPerKm?: number
}

export interface Metrics {
  bodyFatPct?: number
  /** systolic blood pressure */
  systolicBp?: number
  weightKg?: number
  vo2max?: number
  heartRate?: number
}

export interface DayEntry {
  date: string // YYYY-MM-DD
  activities: Activity[]
  strength?: { done: boolean; parts: string[] }
  metrics: Metrics
  fastingHours?: number
  meals?: number
  stretching: boolean
  rest: boolean
  /** free text: "**" notes, unknown items */
  notes: string[]
  /** things the parser was unsure about, shown for review */
  issues: string[]
  raw: string[]
}

export interface ParseResult {
  days: DayEntry[]
  preamble: string[]
  /** lines that could not be attached to any day */
  orphanLines: string[]
}

const YEAR_RE = /^\s*\[\s*(\d{4})년\s*\]/
const DATE_RE = /^(\d{1,2})[.\s](\d{1,2})\s*:\s*(.*)$/
const NOTE_RE = /^\s*(\*+|※|-)\s*/
const DIST = String.raw`(\d+(?:[.\s]\d+)?)\s*(?:키로|km|K)`
// an item that starts with a distance: "8키로", "7.5키로 러닝(장소)", "7K 산책(저녁)"
const ACTIVITY_RE = new RegExp(String.raw`^${DIST}\s*(러닝|걷기|산책)?\s*(?=$|[(,+*]|\s*\()`)
const DETAIL_HINT_RE =
  /인터벌|템포|빌드업|지속주|회복|조깅|워밍업|웜업|쿨다운|업힐|근신경|질주|페이스|\d+\s*[*×/]|\*\d|\d+\s*(분|초)|k\/h|^\d{3}([-,/]\d{3})+$/i
const EVENT_RE = /마라톤|레이스|런$|\bRun\b|서킷런|달벙|급벙|LSD|강습|트레일러닝|대회/i
const TIME_OF_DAY_RE = /^(오전|오후|아침|저녁|새벽|밤)$/
const PACE_RE = /(?:평균페이스|평페|페이스)\s*(?:(\d+)\s*분\s*(\d+)\s*초?|(\d)(\d{2}))/
const DURATION_RE = /^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?\s*(?:(\d+)\s*초)?(?:\s*\(.*\))?$/

export function parseLog(text: string): ParseResult {
  const result: ParseResult = { days: [], preamble: [], orphanLines: [] }
  const byDate = new Map<string, DayEntry>()
  let year: number | undefined
  let day: DayEntry | undefined
  let inNote = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const ym = line.match(YEAR_RE)
    if (ym) {
      year = Number(ym[1])
      day = undefined
      inNote = false
      continue
    }

    const dm = line.match(DATE_RE)
    if (dm) {
      if (!year) {
        result.orphanLines.push(line)
        continue
      }
      const date = `${year}-${dm[1].padStart(2, '0')}-${dm[2].padStart(2, '0')}`
      day = byDate.get(date)
      if (!day) {
        day = emptyDay(date)
        byDate.set(date, day)
        result.days.push(day)
      } else {
        day.issues.push('같은 날짜가 두 번 나옴 (합침)')
      }
      day.raw.push(rawLine)
      inNote = false
      parseItems(day, dm[3])
      continue
    }

    if (!day) {
      if (year) result.orphanLines.push(line)
      else result.preamble.push(line.replace(NOTE_RE, ''))
      continue
    }
    day.raw.push(rawLine)

    // a new run on its own line ends a note block
    if (ACTIVITY_RE.test(line)) {
      inNote = false
      parseItems(day, line)
      continue
    }
    if (NOTE_RE.test(line)) {
      inNote = true
      addNote(day, line.replace(NOTE_RE, ''))
      continue
    }
    if (inNote) {
      appendToLastNote(day, line)
      continue
    }
    if (line.startsWith('(')) {
      const last = day.activities.at(-1)
      if (last) last.details.push(stripOuterParens(line))
      else addNote(day, line)
      continue
    }
    parseItems(day, line)
  }

  for (const d of result.days) finalize(d)
  resolveCompanions(result.days)
  return result
}

function emptyDay(date: string): DayEntry {
  return { date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] }
}

function parseItems(day: DayEntry, text: string) {
  // inline "** note" at the end of a date line
  const inlineNote = text.match(/\s(\*\*|※)\s*(.*)$/)
  if (inlineNote) {
    text = text.slice(0, inlineNote.index)
    addNote(day, inlineNote[2])
  }
  for (const item of splitTopLevel(text)) parseItem(day, item)
}

function parseItem(day: DayEntry, item: string) {
  item = item.trim().replace(/\+$/, '').trim()
  if (!item) return

  const am = item.match(ACTIVITY_RE)
  if (am) {
    const distanceKm = Number(am[1].replace(/\s+/, '.'))
    const kind: ActivityKind = am[2] === '걷기' || am[2] === '산책' ? 'walk' : 'run'
    const act: Activity = { kind, distanceKm, companions: [], details: [], tags: [] }
    if (/\d\s+\d/.test(am[1])) day.issues.push(`"${am[1]}키로"를 ${distanceKm}km로 해석`)
    day.activities.push(act)
    let rest = item.slice(am[0].length).trim()
    const paren = rest.match(/^\((.*)\)?$/s)
    if (paren && rest.startsWith('(')) {
      const close = matchingParen(rest)
      const inside = close === -1 ? rest.slice(1) : rest.slice(1, close)
      if (close === -1) day.issues.push('닫는 괄호 없음')
      if (/^워\s*,/.test(inside)) act.details.push(inside)
      else parseActivityParts(act, inside)
      rest = close === -1 ? '' : rest.slice(close + 1).trim()
    }
    rest = rest.replace(/^\*\s*/, '').trim()
    if (rest) act.details.push(stripOuterParens(rest))
    return
  }

  // "헬스장 운동 시작 (5키로 러닝)"
  const embedded = item.match(/\((\d+(?:\.\d+)?)\s*키로\s*(러닝|걷기)\)/)
  if (embedded) {
    day.activities.push({
      kind: embedded[2] === '걷기' ? 'walk' : 'run',
      distanceKm: Number(embedded[1]),
      companions: [],
      details: [],
      tags: [],
    })
    addNote(day, item.replace(embedded[0], '').trim())
    return
  }

  if (/^웨이트/.test(item)) {
    const parts = item.match(/\((.*)\)/)?.[1]
    const done = !/못함/.test(item)
    day.strength = {
      done,
      parts: done && parts ? splitList(parts) : day.strength?.parts ?? [],
    }
    if (!done) addNote(day, item)
    return
  }

  if (parseMetric(day, item)) return

  const fasting = item.match(/(\d+)\s*(?:시간|H)\s*공복/i) ?? item.match(/공복\s*(\d+)\s*시간/)
  if (fasting) {
    day.fastingHours = Number(fasting[1])
    return
  }
  const meals = item.match(/^(\d)식$/)
  if (meals) {
    day.meals = Number(meals[1])
    return
  }
  if (/스트레칭/.test(item)) {
    day.stretching = true
    if (item !== '스트레칭') addNote(day, item)
    return
  }
  if (/휴식/.test(item)) {
    day.rest = true
    addNote(day, item)
    findWeight(day, item)
    return
  }

  const last = day.activities.at(-1)
  if (last) {
    const dur = parseDuration(item)
    if (dur && !last.durationSec) {
      last.durationSec = dur
      const extra = item.match(/\((.*)\)/)?.[1]
      if (extra) last.tags.push(extra)
      return
    }
    if (EVENT_RE.test(item) && !last.event) last.event = item
    else if (DETAIL_HINT_RE.test(item)) last.details.push(item)
    else last.tags.push(item)
    return
  }
  addNote(day, item)
}

/** "(광교호수공원, w/친구, 인터벌)" -> place, companions, details, duration */
function parseActivityParts(act: Activity, inside: string) {
  for (let part of splitTopLevel(inside)) {
    part = part.trim()
    if (!part) continue
    const w = part.match(/^(.*?)\s*w\/\s*(.*)$/)
    if (w) {
      act.companions.push(...splitList(w[2], /[,/]/))
      part = w[1].trim()
      if (!part) continue
    }
    const pace = parsePace(part)
    if (pace) {
      act.paceSecPerKm = pace
      continue
    }
    const dur = parseDuration(part)
    if (dur) {
      act.durationSec = dur
      continue
    }
    if (EVENT_RE.test(part) && !act.event) act.event = part
    else if (DETAIL_HINT_RE.test(part) || /^\d+$/.test(part)) act.details.push(part)
    else if (TIME_OF_DAY_RE.test(part)) act.tags.push(part)
    else if (!act.place) act.place = part
    else act.tags.push(part)
  }
}

function parsePace(s: string): number | undefined {
  const m = s.match(PACE_RE)
  if (!m) return undefined
  return m[1] ? Number(m[1]) * 60 + Number(m[2]) : Number(m[3]) * 60 + Number(m[4])
}

function parseMetric(day: DayEntry, item: string): boolean {
  const m = day.metrics
  const patterns: [RegExp, keyof Metrics][] = [
    [/체지방률\s*(\d+(?:\.\d+)?)/, 'bodyFatPct'],
    [/혈압\s*(\d+)/, 'systolicBp'],
    [/체중\s*(\d+(?:\.\d+)?)/, 'weightKg'],
    [/(?:최대산소섭취량|최대산소|VO2\s*max)\D*(\d+(?:\.\d+)?)/i, 'vo2max'],
    [/심박수\s*(\d+)/, 'heartRate'],
  ]
  for (const [re, key] of patterns) {
    const hit = item.match(re)
    if (hit && item.replace(re, '').replace(/[\s,]/g, '') === '') {
      m[key] = Number(hit[1])
      return true
    }
  }
  const pace = /^(?:평균페이스|평페|페이스)/.test(item) ? parsePace(item) : undefined
  const last = day.activities.at(-1)
  if (pace && last) {
    last.paceSecPerKm = pace
    return true
  }
  return false
}

function finalize(day: DayEntry) {
  // pick up metrics written inside notes ("63.8kg 달성", "VO2 max 경신 (56)")
  for (const note of day.notes) {
    findWeight(day, note)
    const vo2 = note.match(/VO2\s*max\D*(\d+(?:\.\d+)?)/i)
    if (vo2 && !day.metrics.vo2max) day.metrics.vo2max = Number(vo2[1])
  }
  // a bare number like "338" carries no meaning on its own
  day.notes = day.notes.filter((n) => !/^\d+$/.test(n))
  for (const a of day.activities) {
    pickShoe(a)
    pickCrew(a)
    pickRaceDistance(a)
    if (a.durationSec && !a.paceSecPerKm && a.distanceKm > 0) {
      a.paceSecPerKm = Math.round(a.durationSec / (a.raceDistanceKm ?? a.distanceKm))
    }
  }
}

function pickShoe(a: Activity) {
  const isShoe = (t: string) => SHOES.includes(t)
  const fromTags = a.tags.find(isShoe)
  if (fromTags) {
    a.shoe = fromTags
    a.tags = a.tags.filter((t) => t !== fromTags)
  } else if (a.place && isShoe(a.place)) {
    a.shoe = a.place
    a.place = undefined
  }
}

function pickCrew(a: Activity) {
  const crew = a.companions.find((c) => CREWS.includes(c))
  if (crew) {
    a.crew = crew
    a.companions = a.companions.filter((c) => c !== crew)
  }
  const prefix = a.event && CREWS.find((c) => a.event!.toLowerCase().startsWith(c.toLowerCase()))
  if (prefix) a.crew = prefix
}

// "23키로(서울레이스, 1시간31분51초)": the day includes warm-up, the time is for the half marathon
function pickRaceDistance(a: Activity) {
  const text = [a.event, ...a.details].join(' ')
  const isRace = !!a.event && /마라톤|레이스|대회/.test(a.event) && !a.crew
  const halfLike = /하프|21K/i.test(text) || (isRace && !!a.durationSec && a.distanceKm > 21.1 && a.distanceKm <= 25)
  if (halfLike && Math.abs(a.distanceKm - HALF_MARATHON_KM) > 0.1) a.raceDistanceKm = HALF_MARATHON_KM
}

/** names seen after "w/" are also recognized when written without it: "(광교호수공원, 친구)" */
function resolveCompanions(days: DayEntry[]) {
  const acts = days.flatMap((d) => d.activities)
  const known = new Set(acts.flatMap((a) => a.companions))
  const names = (s: string) => s.replace(/과 함께$|와 함께$/, '').split(/[,/]/).map((x) => x.trim())
  const isNames = (s: string) => names(s).every((n) => known.has(n))
  for (const a of acts) {
    a.tags = a.tags.filter((t) => {
      if (!isNames(t)) return true
      a.companions.push(...names(t))
      return false
    })
    if (a.place && isNames(a.place)) {
      a.companions.push(...names(a.place))
      a.place = undefined
    }
  }
}

function findWeight(day: DayEntry, text: string) {
  const kg = text.match(/(\d{2}(?:\.\d)?)\s*kg/)
  if (kg && !day.metrics.weightKg) day.metrics.weightKg = Number(kg[1])
}

function parseDuration(s: string): number | undefined {
  const m = s.trim().match(DURATION_RE)
  if (!m || (!m[1] && !m[2])) return undefined
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

function addNote(day: DayEntry, text: string) {
  text = text.trim()
  if (text) day.notes.push(text)
}

function appendToLastNote(day: DayEntry, text: string) {
  if (day.notes.length) day.notes[day.notes.length - 1] += ' ' + text
  else addNote(day, text)
}

/** split by commas that are not inside parentheses */
export function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

function splitList(s: string, sep: RegExp = /,/): string[] {
  return s.split(sep).map((x) => x.trim()).filter(Boolean)
}

function matchingParen(s: string): number {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    if (s[i] === ')' && --depth === 0) return i
  }
  return -1
}

function stripOuterParens(s: string): string {
  return s.startsWith('(') && matchingParen(s) === s.length - 1 ? s.slice(1, -1) : s
}
