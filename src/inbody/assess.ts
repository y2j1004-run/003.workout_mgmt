// Turns InBody records into a plain-language "current level" summary.
// Reference values: the standard ranges printed on the InBody 970 sheet, the InBody visceral fat
// threshold (100cm²), the Asian BMI bands, the AWGS 2019 low-muscle cutoffs (SMI < 7.0 men, < 5.7 women, BIA),
// the age bands for healthy body fat from Gallagher et al. 2000 and the Mifflin-St Jeor BMR equation.
// Without a profile the ranges assume an adult man.

import type { Profile, Sex } from '../db/profile'
import type { InBodyRecord } from './inbody'

export interface Person {
  sex?: Sex
  age?: number
  heightCm?: number
}

export type Level = 'good' | 'ok' | 'watch'

export interface AssessItem {
  key: string
  label: string
  value: string
  level: Level
  note: string
}

export interface Trend {
  label: string
  from: number
  to: number
  unit: string
  /** date of the record the change is measured from */
  since: string
}

export interface Assessment {
  date: string
  headline: string
  items: AssessItem[]
  trends: Trend[]
  suggestions: string[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * `kmBefore` gives the running distance in the 7 days before a date, used to flag measurements
 * taken after a heavy week (water and glycogen loss lower weight and the ECW ratio).
 */
export function assessInBody(records: InBodyRecord[], kmBefore?: (date: string) => number, person: Person = {}): Assessment | undefined {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const r = sorted.at(-1)
  if (!r) return undefined
  const items: AssessItem[] = []
  const suggestions: string[] = []
  const add = (key: string, label: string, value: string, level: Level, note: string) => items.push({ key, label, value, level, note })
  const female = person.sex === 'female'

  if (r.bodyFatPct != null) {
    const p = r.bodyFatPct
    const [lo, hi] = female ? [18, 28] : [10, 20]
    const std = `표준(${lo}~${hi}%)`
    const band = person.age != null ? ageFatBand(person.age, female) : undefined
    const ageNote = band ? ` · ${band.group} 건강 범위 ${band.lo}~${band.hi}%${p < band.lo ? '보다 낮음' : p > band.hi ? '보다 높음' : ' 안'}` : ''
    if (p < lo) add('pbf', '체지방률', `${p}%`, 'watch', `${std}보다 낮음. 에너지가 부족하지 않은지 살펴보세요.${ageNote}`)
    else if (p <= (lo + hi) / 2) add('pbf', '체지방률', `${p}%`, 'good', `${std} 안에서도 낮은 편. 운동선수에 가까운 수준${ageNote}`)
    else if (p <= hi) add('pbf', '체지방률', `${p}%`, 'ok', `${std} 범위${ageNote}`)
    else add('pbf', '체지방률', `${p}%`, 'watch', `${std}보다 높음${ageNote}`)
  }
  if (r.visceralFatArea != null) {
    const v = r.visceralFatArea
    add('vfa', '내장지방 단면적', `${v}cm²`, v < 100 ? 'good' : 'watch', v < 100 ? `기준(100cm²)보다 ${v < 50 ? '훨씬 ' : ''}낮음` : '기준(100cm²) 이상')
  }
  if (r.abdominalFatRatio != null) {
    const w = r.abdominalFatRatio
    const [lo, hi] = female ? [0.75, 0.85] : [0.8, 0.9]
    const std = `표준(${lo.toFixed(2)}~${hi.toFixed(2)})`
    add('whr', '복부지방률', `${w}`, w <= hi ? 'good' : 'watch', w < lo ? `${std}보다 낮음. 뱃살이 적음` : w <= hi ? `${std} 범위` : `${std}보다 높음`)
  }
  if (r.bmi != null) {
    const b = r.bmi
    add('bmi', 'BMI', `${b}`, b >= 18.5 && b < 23 ? 'good' : b < 25 ? 'ok' : 'watch', b < 18.5 ? '저체중 범위' : b < 23 ? '정상(18.5~23)' : b < 25 ? '과체중 경계(23~25)' : '비만 범위(25 이상)')
  }
  if (r.smi != null) {
    const s = r.smi
    const cut = female ? 5.7 : 7.0
    add('smi', '골격근지수(SMI)', `${s}kg/m²`, s >= cut ? 'good' : 'watch', s >= cut ? `근감소 기준(${cut})보다 ${r1(s - cut)} 높음` : `근감소 기준(${cut})보다 낮음`)
  } else if (r.skeletalMuscleKg != null) {
    add('smm', '골격근량', `${r.skeletalMuscleKg}kg`, 'ok', '키 대비 지수(SMI)가 있으면 더 정확히 판단합니다')
  }
  if (r.ecwRatio != null) {
    const e = r.ecwRatio
    add('ecw', '세포외수분비', `${e}`, e < 0.36 ? 'ok' : e <= 0.39 ? 'good' : 'watch', e < 0.36 ? '표준(0.360~0.390)보다 낮음. 수분이 빠진 상태일 수 있음' : e <= 0.39 ? '표준(0.360~0.390). 체수분 균형 정상' : '표준보다 높음. 붓기·염증·피로 누적 가능성')
  }
  if (r.phaseAngle != null) {
    add('phase', '위상각', `${r.phaseAngle}°`, 'ok', '세포 상태를 보여 주는 값. 높을수록 좋고, 같은 사람의 변화로 봅니다')
  }
  if (r.systolicBp != null && r.diastolicBp != null) {
    const sys = r.systolicBp
    const dia = r.diastolicBp
    const level: Level = sys < 120 && dia < 80 ? 'good' : sys < 130 && dia < 80 ? 'ok' : 'watch'
    add('bp', '혈압', `${sys}/${dia}`, level, level === 'good' ? '정상(120/80 미만)' : level === 'ok' ? '주의 혈압(수축기 120~129)' : '높음(130/80 이상). 반복되면 확인해 보세요')
  }
  if (r.bmrKcal != null && r.weightKg != null && person.age != null && person.heightCm) {
    const expected = Math.round(10 * r.weightKg + 6.25 * person.heightCm - 5 * person.age + (female ? -161 : 5))
    const diff = Math.round(((r.bmrKcal - expected) / expected) * 100)
    add(
      'bmr',
      '기초대사량',
      `${r.bmrKcal}kcal`,
      diff >= -3 ? 'good' : 'ok',
      `같은 성별·나이·키·체중의 예상치(약 ${expected}kcal)보다 ${Math.abs(diff)}% ${diff >= 0 ? '높음' : '낮음'}${diff >= 3 ? '. 근육이 많은 편' : ''}`,
    )
  }
  if (r.score != null) {
    add('score', '인바디 점수', `${r.score}점`, r.score >= 80 ? 'good' : 'ok', '근육량 비중이 큰 점수. 근육이 늘면 오릅니다')
  }

  const seg = r.segments
  if (seg?.rightArm && seg.leftArm && seg.rightLeg && seg.leftLeg) {
    const armPct = avg([seg.rightArm.pct, seg.leftArm.pct])
    const legPct = avg([seg.rightLeg.pct, seg.leftLeg.pct])
    const diff = (a: number, b: number) => (Math.abs(a - b) / Math.max(a, b)) * 100
    const armDiff = diff(seg.rightArm.kg, seg.leftArm.kg)
    const legDiff = diff(seg.rightLeg.kg, seg.leftLeg.kg)
    const weakerArm = seg.rightArm.kg < seg.leftArm.kg ? '오른' : '왼'
    const weakerLeg = seg.rightLeg.kg < seg.leftLeg.kg ? '오른' : '왼'
    const shape = armPct != null && legPct != null ? (legPct - armPct >= 3 ? '하체가 더 발달한 러너형' : armPct - legPct >= 3 ? '상체가 더 발달한 형' : '상·하체 고른 편') : ''
    add(
      'segments',
      '부위별 근육',
      `팔 ${armPct != null ? r1(armPct) + '%' : '-'} · 다리 ${legPct != null ? r1(legPct) + '%' : '-'}`,
      Math.max(armDiff, legDiff) >= 5 ? 'watch' : 'good',
      `${shape}. 좌우 차이 팔 ${r1(armDiff)}%(${weakerArm}쪽이 작음), 다리 ${r1(legDiff)}%(${weakerLeg}쪽이 작음)`,
    )
    if (armPct != null && armPct < 100) suggestions.push('팔 근육이 표준(100%)보다 조금 낮습니다. 상체·코어 근력 운동을 주 2회 정도 넣으면 인바디 점수도 오릅니다.')
    if (Math.max(armDiff, legDiff) >= 2.5) suggestions.push(`좌우 차이가 있어 ${weakerArm === weakerLeg ? `${weakerArm}쪽` : '작은 쪽'} 한쪽 운동(런지, 한 팔 덤벨 등)을 조금 더 하면 균형에 도움이 됩니다.`)
  } else if (r.score != null && r.score < 80) {
    suggestions.push('인바디 점수를 올리려면 근육을 늘리는 게 가장 효과적입니다. 상체·코어 근력 운동을 더해 보세요.')
  }

  const trends: Trend[] = []
  // compare with the measurement nearest to six months ago (or the first one, if the history is shorter)
  const cutoff = monthsBefore(r.date, 6)
  const base = [...sorted].reverse().find((x) => x.date <= cutoff) ?? sorted[0]
  if (base !== r) {
    const t = (label: string, key: 'weightKg' | 'skeletalMuscleKg' | 'bodyFatPct' | 'visceralFatArea', unit: string) => {
      const from = base[key]
      const to = r[key]
      if (from != null && to != null) trends.push({ label, from, to, unit, since: base.date })
    }
    t('체중', 'weightKg', 'kg')
    t('골격근량', 'skeletalMuscleKg', 'kg')
    t('체지방률', 'bodyFatPct', '%')
    t('내장지방', 'visceralFatArea', 'cm²')
  }

  // measurement conditions
  const times = sorted.map((x) => minutes(x.time)).filter((m): m is number => m != null)
  const usual = median(times)
  const now = minutes(r.time)
  if (usual != null && now != null && Math.abs(now - usual) >= 180) {
    suggestions.push(`이번 측정(${r.time})은 평소(${fmtMin(usual)} 무렵)와 시간대가 달라 비교가 덜 정확할 수 있습니다. 같은 시간대·공복에 재는 게 좋습니다.`)
  }
  if (kmBefore) {
    const loads = sorted.map((x) => kmBefore(x.date))
    const mean = loads.reduce((a, b) => a + b, 0) / loads.length
    const last = kmBefore(r.date)
    if (loads.length >= 4 && last > mean * 1.25) {
      suggestions.push(`측정 전 7일에 ${Math.round(last)}km를 달려 평소(${Math.round(mean)}km)보다 많았습니다. 수분·글리코겐이 빠져 체중·세포외수분비가 낮게 나왔을 수 있습니다.`)
    }
    if (r.bodyFatPct != null && r.bodyFatPct < 12 && mean >= 80) {
      suggestions.push('체지방이 낮고 훈련량이 많습니다. 피로나 부상이 잦아지면 먹는 양부터 점검해 보세요.')
    }
  }

  const watch = items.filter((i) => i.level === 'watch')
  const lean = r.bodyFatPct != null && r.bodyFatPct <= 15 && (r.visceralFatArea == null || r.visceralFatArea < 50)
  const headline = watch.length
    ? `살펴볼 항목 ${watch.length}개: ${watch.map((w) => w.label).join(', ')}`
    : lean
      ? '체지방과 내장지방이 적은 마른 지구력형 체형입니다. 주요 지표가 모두 정상 범위입니다.'
      : '주요 지표가 모두 정상 범위입니다.'

  return { date: r.date, headline, items, trends, suggestions }
}

/** Healthy body fat by age group (Gallagher et al. 2000). */
function ageFatBand(age: number, female: boolean): { group: string; lo: number; hi: number } {
  const [lo, hi] = age < 40 ? (female ? [21, 32] : [8, 19]) : age < 60 ? (female ? [23, 33] : [11, 21]) : female ? [24, 35] : [13, 24]
  return { group: age < 40 ? '20~39세' : age < 60 ? '40~59세' : '60세 이상', lo, hi }
}

export interface LongTerm {
  from: string
  to: string
  weightKg: [number, number]
  fatKg: [number, number]
  leanKg: [number, number]
  bmi?: [number, number]
}

/**
 * First and last measurements that have both weight and body fat %, to split the weight change
 * into fat and lean mass. A body fat reading without weight borrows the weight taken a day before
 * or after. Height comes from the profile, or from a sheet's BMI.
 */
export function longTermChange(records: InBodyRecord[], profile: Profile = {}): LongTerm | undefined {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const weightNear = (r: InBodyRecord) =>
    r.weightKg ?? sorted.find((x) => x.weightKg != null && Math.abs(Date.parse(x.date) - Date.parse(r.date)) <= 864e5)?.weightKg
  const pairs = sorted.flatMap((r) => {
    const w = weightNear(r)
    return r.bodyFatPct != null && w != null ? [{ date: r.date, w, pbf: r.bodyFatPct }] : []
  })
  const a = pairs[0]
  const b = pairs.at(-1)
  if (!a || !b || a === b) return undefined
  const withBmi = [...sorted].reverse().find((x) => x.bmi && x.weightKg)
  const h = profile.heightCm ? profile.heightCm / 100 : withBmi ? Math.sqrt(withBmi.weightKg! / withBmi.bmi!) : undefined
  const fat = (p: typeof a) => r1((p.w * p.pbf) / 100)
  return {
    from: a.date,
    to: b.date,
    weightKg: [a.w, b.w],
    fatKg: [fat(a), fat(b)],
    leanKg: [r1(a.w - fat(a)), r1(b.w - fat(b))],
    bmi: h ? [r1(a.w / h / h), r1(b.w / h / h)] : undefined,
  }
}

function avg(xs: (number | undefined)[]): number | undefined {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}

function monthsBefore(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - n)
  return d.toISOString().slice(0, 10)
}

function minutes(t?: string): number | undefined {
  const m = t?.match(/^(\d{1,2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const fmtMin = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
