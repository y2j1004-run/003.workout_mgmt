import { describe, expect, it } from 'vitest';
import { parseLog } from '../import/parseLog';
import { goalProgress, runStreak, weekStart, weekSummary } from './home';
const { days } = parseLog(`[ 2026년 ]
10.05 : 10키로
10.12 : 6키로, 웨이트
10.13 : 8키로
10.14 : 웨이트
10.17 : 20키로
10.18 : 4키로
10.19 : 웨이트
10.20 : 12키로
               5키로
`);
describe('home summaries', () => {
    it('starts weeks on Monday', () => {
        expect(weekStart('2026-10-20')).toBe('2026-10-19'); // Tuesday -> Monday
        expect(weekStart('2026-10-19')).toBe('2026-10-19');
        expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Sunday
    });
    it('sums this week and compares with last week up to the same weekday', () => {
        const w = weekSummary(days, '2026-10-20');
        expect(w).toMatchObject({ start: '2026-10-19', km: 17, runs: 2, runDays: 1, strengthDays: 1, lastWeekKmSoFar: 14 });
        expect(w.byDay).toEqual([0, 17, 0, 0, 0, 0, 0]);
    });
    it('counts consecutive running days, allowing today to be still open', () => {
        expect(runStreak(days, '2026-10-20')).toBe(1);
        expect(runStreak(days, '2026-10-19')).toBe(2); // 10.17, 10.18
        expect(runStreak(days, '2026-10-21')).toBe(1);
        expect(runStreak(days, '2026-10-22')).toBe(0);
    });
    it('reports goal progress for distance and body goals', () => {
        const g = goalProgress({ weeklyKm: 50, monthlyKm: 60, bodyFatPct: 13, weightKg: 63 }, days, '2026-10-20', {
            bodyFatPct: 14,
            startBodyFatPct: 28,
            weightKg: 62.2,
        });
        expect(g.map((x) => [x.key, x.current, Math.round(x.ratio * 100), x.done])).toEqual([
            ['weeklyKm', 17, 34, false],
            ['monthlyKm', 65, 100, true],
            ['bodyFatPct', 14, 93, false],
            ['weightKg', 62.2, 100, true],
        ]);
    });
});
