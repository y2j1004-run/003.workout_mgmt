// Suggests next week's training from the last few weeks: how much and on which days the user runs,
// recent races and how runs felt, the weekly distance goal, and the latest InBody segments.
// Plain rules, no external service: hold or build volume by ~10%, back off after races or
// hard weeks, one long run, one quality session, the rest easy, plus strength work.

import type { DayEntry } from '../import/parseLog'
import type { InBodyRecord } from '../inbody/inbody'
import { weekStart } from './home'
import { intensityMix, zoneBounds, type MaxHr } from './fitness'
import { addDays, fmtTime, isRace, runsOf } from './stats'
import { fmtPace, predictSec, referenceRace, trainingPaces } from './vdot'
import { themeOf } from './themes'
import { didStrength } from './workouts'
import type { UpcomingRace } from '../db/upcoming'
import type { SleepNight } from '../shealth/shealth'
import { avgSleep, fmtHours } from '../shealth/sleepStats'

export type PlanKind = 'race' | 'long' | 'quality' | 'easy' | 'strength' | 'rest'

export interface PlanItem {
  kind: PlanKind
  title: string
  km?: number
  detail?: string
}

export interface PlanDay {
  date: string
  /** 월 … 일 */
  dow: string
  items: PlanItem[]
}

export interface WeekPlan {
  start: string
  targetKm: number
  /** why the plan looks the way it does */
  reasons: string[]
  days: PlanDay[]
  /** the next race the plan works toward */
  race?: UpcomingRace
}

export interface PlanInput {
  days: DayEntry[]
  inbody: InBodyRecord[]
  today: string
  weeklyKmGoal?: number
  maxHr?: MaxHr
  /** races the user has signed up for */
  races?: UpcomingRace[]
  /** nights imported from Samsung Health */
  sleep?: SleepNight[]
}

const DOW = ['월', '화', '수', '목', '금', '토', '일']
const dowOf = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
const half = (n: number) => Math.round(n * 2) / 2
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

/** Plans the week starting the Monday after `today`; undefined when there is too little history. */
export function planNextWeek({ days, inbody, today, weeklyKmGoal, maxHr, races = [], sleep = [] }: PlanInput): WeekPlan | undefined {
  const runs = runsOf(days)
  const start = addDays(weekStart(today), 7)
  // the four whole weeks before the current one, newest first
  const weeks = [1, 2, 3, 4].map((w) => {
    const from = addDays(weekStart(today), -7 * w)
    const to = addDays(from, 6)
    const r = runs.filter((x) => x.date >= from && x.date <= to)
    return {
      from,
      km: r.reduce((s, x) => s + x.distanceKm, 0),
      runDays: new Set(r.map((x) => x.date)).size,
      longest: Math.max(0, ...r.map((x) => x.distanceKm)),
      strength: days.filter((d) => d.date >= from && d.date <= to && didStrength(d)).length,
    }
  })
  const avgKm = weeks.reduce((s, w) => s + w.km, 0) / 4
  if (avgKm < 3) return undefined
  const lastKm = weeks[0].km
  const reasons: string[] = [`최근 4주 평균 ${Math.round(avgKm)}km/주, 지난주 ${Math.round(lastKm)}km`]

  // how hard the last stretch was
  // a race in the eight days before the planned week calls for an easier week
  const race = runs.filter((r) => r.date > addDays(start, -9) && r.date <= today && isRace(r)).at(-1)
  const hardFeels = runs.filter((r) => r.date > addDays(today, -7) && r.date <= today && r.feeling === 'hard').length
  const climbing = weeks[0].km > weeks[1].km && weeks[1].km > weeks[2].km && weeks[2].km > weeks[3].km

  // build at most 10% over the average, and at most 30% over a light last week
  let target = Math.min(avgKm * 1.1, Math.max(lastKm * 1.3, avgKm * 0.6))
  let recovery = false
  if (race) {
    target = avgKm * 0.7
    recovery = true
    reasons.push(`${race.date.slice(5).replace('-', '.')} 대회 후라 회복 주간으로 거리를 30% 줄였어요`)
  } else if (hardFeels >= 2) {
    target = avgKm * 0.85
    recovery = true
    reasons.push(`최근 7일에 '힘들었어요'가 ${hardFeels}번이라 거리를 15% 줄였어요`)
  } else if (climbing) {
    target = avgKm * 0.8
    recovery = true
    reasons.push('3주 연속 거리가 늘어서 한 주 쉬어 가는 주로 잡았어요')
  } else if (lastKm > avgKm * 1.2) {
    target = avgKm
    reasons.push('지난주가 평소보다 많아서 평균 수준으로 유지해요')
  } else if (lastKm * 1.3 < avgKm * 1.1) {
    reasons.push('지난주가 평소보다 적어서 지난주의 30% 이내로만 늘렸어요')
  } else {
    reasons.push('컨디션이 괜찮아 평균보다 최대 10% 늘렸어요')
  }
  if (weeklyKmGoal && !recovery) {
    const clamped = Math.min(Math.max(weeklyKmGoal, avgKm * 0.7), avgKm * 1.1)
    if (Math.abs(clamped - target) >= 1) reasons.push(`주간 목표 ${weeklyKmGoal}km에 맞춰 ${weeklyKmGoal > clamped ? '조금씩 늘려 가요' : '조정했어요'}`)
    target = clamped
  }
  // short sleep lately: hold back a little (not on top of a recovery week)
  const sleepMin = avgSleep(sleep, today)
  if (sleepMin != null && sleepMin < 390 && !recovery) {
    target *= 0.9
    reasons.push(`최근 7일 평균 수면이 ${fmtHours(sleepMin)}으로 짧아 거리를 10% 줄였어요. 잠을 먼저 챙기세요`)
  } else if (sleepMin != null && sleepMin >= 420) {
    reasons.push(`최근 7일 평균 수면 ${fmtHours(sleepMin)}으로 회복은 충분해요`)
  }
  // taper toward a race: in its week, and the week (two for a marathon) before
  const nextRace = races.filter((r) => r.date >= start).sort((a, b) => a.date.localeCompare(b.date))[0]
  const weeksOut = nextRace ? Math.floor((Date.parse(nextRace.date) - Date.parse(start)) / (7 * 864e5)) : undefined
  const size = nextRace ? (nextRace.distanceKm >= 30 ? 'full' : nextRace.distanceKm >= 15 ? 'half' : 'short') : undefined
  const TAPER: Record<string, number[]> = { full: [0.5, 0.75, 0.9], half: [0.6, 0.85], short: [0.75] }
  const taper = size && weeksOut != null ? TAPER[size][weeksOut] : undefined
  if (!taper && nextRace && weeksOut != null && weeksOut <= 3) {
    reasons.push(`🏁 ${nextRace.name}(${raceLabel(nextRace.distanceKm)})까지 D-${daysBetween(today, nextRace.date)}`)
  }
  if (taper) {
    target = avgKm * taper
    recovery = false
    // the volume reasons above no longer apply
    reasons.splice(1)
    reasons.push(`🏁 ${nextRace!.name}(${raceLabel(nextRace!.distanceKm)})까지 D-${daysBetween(today, nextRace!.date)}`)
    const pct = Math.round(taper * 100)
    reasons.push(
      weeksOut === 0
        ? `대회 주간이라 대회 말고는 평소의 ${pct}%만 달려요`
        : weeksOut === 1
          ? `대회 전 주라 거리를 평소의 ${pct}%로 줄이고 롱런도 짧게 해요`
          : `대회 2주 전이라 거리를 평소의 ${pct}%로 줄이기 시작해요`,
    )
  }
  target = Math.max(5, Math.round(target))

  const bounds = maxHr ? zoneBounds(maxHr) : undefined
  const easyHr = bounds ? ` · 심박 ${bounds[3]} 미만` : ''
  // paces from the best recent race result
  const ref = referenceRace(days, today)
  const paces = ref ? trainingPaces(ref.vdot) : undefined
  const easyPace = paces ? ` · ${fmtPace(paces.easy[1])}~${perKm(paces.easy[0])}` : ''
  if (ref) reasons.splice(1, 0, `기준 기록: ${ref.date.slice(2).replaceAll('-', '.')} ${ref.name} ${raceLabel(ref.km)} ${fmtTime(ref.sec)} (VDOT ${ref.vdot.toFixed(1)})`)
  let racePace: number | undefined
  if (nextRace && weeksOut != null && weeksOut <= 3) {
    const predicted = ref ? predictSec(ref.vdot, nextRace.distanceKm) : undefined
    racePace = (nextRace.goalSec ?? predicted ?? 0) / nextRace.distanceKm || undefined
    if (predicted) {
      const gap = nextRace.goalSec ? (predicted - nextRace.goalSec) / predicted : 0
      const verdict = !nextRace.goalSec
        ? ''
        : gap > 0.03
          ? ` — 목표 ${fmtTime(nextRace.goalSec)}은 도전적이에요`
          : gap < -0.03
            ? ` — 목표 ${fmtTime(nextRace.goalSec)}은 여유 있어요`
            : ` — 목표 ${fmtTime(nextRace.goalSec)}과 비슷해요`
      reasons.push(`기준 기록으로 본 ${nextRace.name} 예상 기록 ${fmtTime(predicted)}${verdict}`)
    }
  }
  if (nextRace && weeksOut === 0) return raceWeek({ start, race: nextRace, target, reasons, easyHr: easyPace + easyHr, racePace, inbody })

  // which weekdays: the user's usual running days, keeping at least one day off
  const since = addDays(weekStart(today), -56)
  const usual = DOW.map((_, i) => new Set(runs.filter((r) => r.date >= since && dowOf(r.date) === i).map((r) => r.date)).size)
  let runDays = Math.min(6, Math.max(3, median(weeks.map((w) => w.runDays)) || 3))
  if (recovery) runDays = Math.max(3, runDays - 1)
  const runDow = [...DOW.keys()].sort((a, b) => usual[b] - usual[a] || a - b).slice(0, runDays).sort((a, b) => a - b)

  // the long run goes on the weekend day that usually holds the longest run
  const longScore = (i: number) => median(runs.filter((r) => r.date >= since && dowOf(r.date) === i).map((r) => r.distanceKm))
  const longDow = [5, 6].filter((i) => runDow.includes(i)).sort((a, b) => longScore(b) - longScore(a))[0] ?? runDow.at(-1)!
  // the quality session two or three days before it, midweek
  const qualityDow = recovery || runDays < 3 ? undefined : [longDow - 3, longDow - 2, longDow - 4].find((i) => i >= 0 && runDow.includes(i))

  const recentLong = median(weeks.map((w) => w.longest).filter((x) => x > 0))
  const longCap = taper ? recentLong * (weeksOut === 1 ? 0.65 : 0.85) : 35
  const longKm = half(Math.min(recovery ? recentLong * 0.6 : Math.max(recentLong, target * 0.25) * 1.05, target * 0.35, longCap, 35))
  const qualityKm = qualityDow == null ? 0 : half(Math.max(6, target * 0.15))
  const easyDays = runDow.filter((i) => i !== longDow && i !== qualityDow)
  const easyKm = easyDays.length ? half(Math.max(4, (target - longKm - qualityKm) / easyDays.length)) : 0

  const lastQuality = runs.filter((r) => r.date > addDays(today, -14) && ['인터벌', '템포', '지속주', '빌드업'].includes(themeOf(r).theme ?? '')).at(-1)
  // alternate: intervals unless the last hard session was already intervals
  const doIntervals = !lastQuality || themeOf(lastQuality).theme !== '인터벌'

  const plan: PlanDay[] = DOW.map((dow, i) => ({ date: addDays(start, i), dow, items: [] }))
  for (const i of runDow) {
    if (i === longDow) {
      plan[i].items.push({ kind: 'long', title: recovery ? '롱런 (가볍게)' : 'LSD 롱런', km: longKm, detail: `편한 속도로 끝까지${paces ? ` · ${perKm(paces.easy[0])} 안팎` : ''}${easyHr}` })
    } else if (i === qualityDow) {
      const pace = racePace ? ` · ${perKm(racePace)}` : ''
      plan[i].items.push(
        taper && nextRace
          ? { kind: 'quality', title: '레이스 페이스런', km: qualityKm, detail: `워밍업 2km → 대회 페이스 ${half(Math.min(qualityKm * 0.5, nextRace.distanceKm * 0.25))}km → 쿨다운${pace}` }
          : doIntervals
          ? { kind: 'quality', title: '인터벌', km: qualityKm, detail: `워밍업 2km → 1km × 5회(400m 회복조깅) → 쿨다운${paces ? ` · 1km ${perKm(paces.interval)}` : ''}${bounds ? ` · 빠른 구간 심박 ${bounds[4]} 이상` : ''}` }
          : { kind: 'quality', title: '템포런', km: qualityKm, detail: `워밍업 2km → 템포 ${half(qualityKm * 0.5)}km → 쿨다운${paces ? ` · 템포 ${perKm(paces.threshold)}` : ''}${bounds ? ` · 템포 심박 ${bounds[3]}~${bounds[4] - 1}` : ''}` },
      )
    } else {
      plan[i].items.push({ kind: 'easy', title: i === longDow + 1 || i === 0 ? '회복 조깅' : '이지런', km: easyKm, detail: `대화할 수 있는 속도${easyPace}${easyHr}` })
    }
  }

  // strength: as often as lately (at least twice), not the day before the long run or the quality day
  const strengthCount = Math.min(3, Math.max(2, median(weeks.map((w) => w.strength))))
  const avoid = new Set([longDow, longDow - 1, qualityDow == null ? -1 : qualityDow - 1])
  const slots = [...DOW.keys()].filter((i) => !avoid.has(i)).sort((a, b) => Number(runDow.includes(a)) - Number(runDow.includes(b)) || a - b)
  const picked: number[] = []
  for (const i of slots) if (picked.length < strengthCount && picked.every((p) => Math.abs(p - i) > 1)) picked.push(i)
  const sessions = strengthSessions(inbody, reasons)
  picked.sort((a, b) => a - b).forEach((i, n) => plan[i].items.push(sessions[n % sessions.length]))

  for (const d of plan) if (!d.items.length) d.items.push({ kind: 'rest', title: '휴식', detail: '푹 쉬거나 가벼운 걷기·스트레칭' })

  if (maxHr) {
    const mix = intensityMix(days, maxHr, addDays(today, -27), today)
    if (mix.easyShare != null && mix.easyShare < 0.75) reasons.push(`최근 쉬운 러닝 비율이 ${Math.round(mix.easyShare * 100)}%라 이지런은 심박을 꼭 낮게 유지하세요`)
  }
  return { start, targetKm: weekKm(plan), reasons, days: plan, race: nextRace && weeksOut != null && weeksOut <= 3 ? nextRace : undefined }
}

const weekKm = (plan: PlanDay[]) => Math.round(plan.reduce((s, d) => s + d.items.reduce((t, x) => t + (x.kind === 'race' ? 0 : (x.km ?? 0)), 0), 0))
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 864e5)
const perKm = (sec: number) => `${fmtPace(sec)}/km`
function raceLabel(km: number) {
  if (Math.abs(km - 42.195) < 0.5) return '풀코스'
  if (Math.abs(km - 21.0975) < 0.3) return '하프'
  return `${Math.round(km * 10) / 10}km`
}

/**
 * The week with the race in it: sharpen early, rest or shake out the day before, the race,
 * then recovery. No long run; at most one light strength session well before the race.
 */
function raceWeek(o: {
  start: string
  race: UpcomingRace
  target: number
  reasons: string[]
  /** pace and heart rate hint for easy runs */
  easyHr: string
  /** goal pace, or the predicted one */
  racePace?: number
  inbody: InBodyRecord[]
}): WeekPlan {
  const { start, race, target, reasons, easyHr, racePace } = o
  const raceDow = dowOf(race.date)
  const plan: PlanDay[] = DOW.map((dow, i) => ({ date: addDays(start, i), dow, items: [] }))
  const pace = race.goalSec
    ? `목표 ${fmtTime(race.goalSec)} (페이스 ${perKm(race.goalSec / race.distanceKm)})`
    : racePace
      ? `예상 ${fmtTime(racePace * race.distanceKm)} (페이스 ${perKm(racePace)}) · 초반에 무리하지 않기`
      : '초반에 무리하지 말고 후반에 힘 쓰기'
  plan[raceDow].items.push({ kind: 'race', title: `🏁 ${race.name}`, km: Math.round(race.distanceKm * 10) / 10, detail: pace })
  if (raceDow >= 1) plan[raceDow - 1].items.push({ kind: 'easy', title: '가볍게 몸풀기', km: 3, detail: '20분 조깅 + 짧은 가속주 3회, 일찍 자기' })
  // before the race: one sharpening run 3–5 days out, easy runs otherwise, a day off two days out
  const before = [...Array(Math.max(0, raceDow - 1)).keys()]
  const sharpen = before.filter((i) => raceDow - i >= 3 && raceDow - i <= 5).at(-1)
  const easyBefore = before.filter((i) => i !== sharpen && raceDow - i !== 2)
  const sharpenKm = sharpen == null ? 0 : half(Math.min(10, Math.max(6, target * 0.25)))
  const easyKm = easyBefore.length ? half(Math.min(10, Math.max(4, (target - sharpenKm - 3) / easyBefore.length))) : 0
  if (sharpen != null) {
    const reps = race.distanceKm >= 15 ? `대회 페이스 ${race.distanceKm >= 30 ? 5 : 3}km` : '1km × 3회 대회 페이스'
    const goalPace = racePace ? ` · ${perKm(racePace)}` : ''
    plan[sharpen].items.push({ kind: 'quality', title: '레이스 페이스 점검', km: sharpenKm, detail: `워밍업 2km → ${reps} → 쿨다운${goalPace}` })
  }
  for (const i of easyBefore) plan[i].items.push({ kind: 'easy', title: '이지런', km: easyKm, detail: `짧고 편하게${easyHr}` })
  // after the race: a day off, then short recovery jogs
  for (let i = raceDow + 2; i < 7; i++) plan[i].items.push({ kind: 'easy', title: '회복 조깅', km: half(Math.min(easyKm || 5, race.distanceKm * 0.3)), detail: '아주 천천히, 다리가 무거우면 걷기로' })
  const strengthDay = before.find((i) => raceDow - i >= 4)
  if (strengthDay != null) plan[strengthDay].items.push({ ...strengthSessions(o.inbody, [])[0], title: '웨이트 (가볍게)', detail: '평소 무게의 70%, 세트 수 줄이기' })
  for (const d of plan) if (!d.items.length) d.items.push({ kind: 'rest', title: '휴식', detail: '푹 쉬기' })
  reasons.push('대회 전날은 가볍게, 대회 다음 날은 쉬어요')
  return { start, targetKm: weekKm(plan), reasons, days: plan, race }
}

/** Two strength sessions, shaped by the latest InBody segment results. */
function strengthSessions(inbody: InBodyRecord[], reasons: string[]): PlanItem[] {
  const seg = [...inbody].sort((a, b) => a.date.localeCompare(b.date)).reverse().find((r) => r.segments)?.segments
  const armPct = seg?.rightArm?.pct != null && seg.leftArm?.pct != null ? Math.min(seg.rightArm.pct, seg.leftArm.pct) : undefined
  const upper: PlanItem = { kind: 'strength', title: '웨이트 · 상체', detail: '체스트프레스, 숄더프레스, 랫풀다운, 시티드 케이블 로우, 턱걸이' }
  const lower: PlanItem = { kind: 'strength', title: '웨이트 · 하체·코어', detail: '스쿼트, 루마니안 데드리프트, 런지, 레그컬 (롱런 전날은 피하기)' }
  if (seg?.rightArm && seg.leftArm) {
    const weak = seg.rightArm.kg < seg.leftArm.kg ? '오른' : '왼'
    const diff = (Math.abs(seg.rightArm.kg - seg.leftArm.kg) / Math.max(seg.rightArm.kg, seg.leftArm.kg)) * 100
    if (diff >= 2) upper.detail += ` · ${weak}팔 한쪽 운동 1세트 추가`
  }
  if (armPct != null && armPct < 100) {
    reasons.push(`인바디 팔 근육이 표준(100%)보다 낮은 쪽이 있어(${armPct}%) 상체 웨이트를 먼저 넣었어요`)
    return [upper, lower, upper]
  }
  return [lower, upper, lower]
}
