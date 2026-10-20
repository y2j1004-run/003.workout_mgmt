// Order of the cards on the stats tab, which the user can rearrange.
export const STATS_SECTIONS = [
    { id: 'summary', title: '요약' },
    { id: 'monthly', title: '월별 러닝 거리' },
    { id: 'bodyFat', title: '체지방률' },
    { id: 'bp', title: '혈압' },
    { id: 'races', title: '대회 기록' },
    { id: 'crews', title: '크루 활동' },
    { id: 'shoes', title: '신발별 누적 거리' },
];
const DEFAULT = STATS_SECTIONS.map((s) => s.id);
/** The saved order, dropping unknown ids and appending sections added in later versions. */
export function resolveOrder(saved) {
    const known = (saved ?? []).filter((id, i, all) => DEFAULT.includes(id) && all.indexOf(id) === i);
    return [...known, ...DEFAULT.filter((id) => !known.includes(id))];
}
/** Moves a section one step up (-1) or down (+1). */
export function moveSection(order, id, delta) {
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length)
        return order;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}
