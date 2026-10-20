import { addDays, round1, runsOf } from './stats';
/** Monday of the week containing `date` (weeks run Monday to Sunday). */
export function weekStart(date) {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return addDays(date, -((dow + 6) % 7));
}
export function weekSummary(days, today) {
    const start = weekStart(today);
    const runs = runsOf(days);
    const inRange = (from, to) => runs.filter((r) => r.date >= from && r.date <= to);
    const thisWeek = inRange(start, today);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const elapsed = dates.indexOf(today);
    const lastStart = addDays(start, -7);
    return {
        start,
        byDay: dates.map((d) => round1(thisWeek.filter((r) => r.date === d).reduce((s, r) => s + r.distanceKm, 0))),
        km: round1(thisWeek.reduce((s, r) => s + r.distanceKm, 0)),
        runs: thisWeek.length,
        runDays: new Set(thisWeek.map((r) => r.date)).size,
        strengthDays: days.filter((d) => d.date >= start && d.date <= today && d.strength?.done).length,
        lastWeekKmSoFar: round1(inRange(lastStart, addDays(lastStart, elapsed)).reduce((s, r) => s + r.distanceKm, 0)),
    };
}
/** Consecutive days with a run, ending today (or yesterday if today has no run yet). */
export function runStreak(days, today) {
    const ran = new Set(runsOf(days).map((r) => r.date));
    let d = ran.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (ran.has(d)) {
        n++;
        d = addDays(d, -1);
    }
    return n;
}
export function kmBetween(days, from, to) {
    return round1(runsOf(days).filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + r.distanceKm, 0));
}
/** Distance goals fill up toward the target; body goals count as done once at or below the target. */
export function goalProgress(goals, days, today, body) {
    const out = [];
    const distance = (key, label, from) => {
        const target = goals[key];
        if (!target)
            return;
        const current = kmBetween(days, from, today);
        out.push({ key, label, current, target, unit: 'km', ratio: Math.min(1, current / target), done: current >= target });
    };
    distance('weeklyKm', '이번 주 거리', weekStart(today));
    distance('monthlyKm', '이번 달 거리', `${today.slice(0, 7)}-01`);
    distance('yearlyKm', `${today.slice(0, 4)}년 거리`, `${today.slice(0, 4)}-01-01`);
    const lower = (key, label, unit, current, start) => {
        const target = goals[key];
        if (!target)
            return;
        // progress from the first measurement toward the target
        const ratio = current == null ? 0 : current <= target ? 1 : start != null && start > target ? Math.max(0, (start - current) / (start - target)) : 0;
        out.push({ key, label, current, target, unit, ratio, done: current != null && current <= target });
    };
    lower('bodyFatPct', '체지방률', '%', body.bodyFatPct, body.startBodyFatPct);
    lower('weightKg', '체중', 'kg', body.weightKg, body.startWeightKg);
    return out;
}
