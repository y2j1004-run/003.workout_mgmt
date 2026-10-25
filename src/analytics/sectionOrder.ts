// Order of the cards on the stats tab, which the user can rearrange.

export const STATS_SECTIONS = [
  { id: 'summary', title: '요약' },
  { id: 'allWorkouts', title: '전체 운동' },
  { id: 'monthly', title: '월별 러닝 거리' },
  { id: 'bodyFat', title: '체지방률' },
  { id: 'bp', title: '혈압' },
  { id: 'vo2max', title: '체력 (VO2max)' },
  { id: 'intensity', title: '러닝 강도' },
  { id: 'sleep', title: '수면' },
  { id: 'nutrition', title: '식단' },
  { id: 'steps', title: '걸음 수' },
  { id: 'races', title: '대회 기록' },
  { id: 'crews', title: '크루 활동' },
  { id: 'shoes', title: '신발별 누적 거리' },
] as const

export type StatsSectionId = (typeof STATS_SECTIONS)[number]['id']

const DEFAULT: StatsSectionId[] = STATS_SECTIONS.map((s) => s.id)

/** The saved order, dropping unknown ids and appending sections added in later versions. */
export function resolveOrder(saved?: string[]): StatsSectionId[] {
  const known = (saved ?? []).filter((id, i, all): id is StatsSectionId => DEFAULT.includes(id as StatsSectionId) && all.indexOf(id) === i)
  return [...known, ...DEFAULT.filter((id) => !known.includes(id))]
}

/** Moves a section one step up (-1) or down (+1). */
export function moveSection(order: StatsSectionId[], id: StatsSectionId, delta: -1 | 1): StatsSectionId[] {
  const i = order.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= order.length) return order
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
