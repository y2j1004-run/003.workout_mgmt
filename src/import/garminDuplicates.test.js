import { describe, expect, it } from 'vitest';
import { parseGarminCsv } from './garminCsv';
import { mergeGarmin, pairByDistance } from './mergeGarmin';
import { parseLog } from './parseLog';
const empty = (date) => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] });
const csv = (rows) => parseGarminCsv(`Activity Type,Date,Distance,Time\n${rows}`).activities;
// a treadmill run logged as 6.4km that the watch measured as 5.1km, plus a road run
const logged = parseLog(`[ 2026년 ]
10.13 : 6.4키로, 웨이트
               10.2키로(동백역-기흥역)
10.15 : 14키로(430*12km)
`).days;
describe('pairing runs of the same day', () => {
    it('pairs closest distances one to one within a loose bound', () => {
        expect(pairByDistance([10.3, 5.1], [6.4, 10.2])).toEqual([
            [0, 1],
            [1, 0],
        ]);
        expect(pairByDistance([2], [21.1])).toEqual([]);
    });
});
describe('mergeGarmin, watch first', () => {
    it('pairs a treadmill reading with the logged run and takes the watch distance', () => {
        const { days, stats } = mergeGarmin(logged, csv('Treadmill Running,2026-10-13 06:00:00,5.10,00:35:00\nRunning,2026-10-13 19:00:00,10.31,00:50:00\n'), empty);
        expect(stats).toMatchObject({ matched: 2, added: 0 });
        const runs = days.find((d) => d.date === '2026-10-13').activities;
        expect(runs.map((a) => [a.distanceKm, a.durationSec, a.place, a.appEdits?.logDistanceKm])).toEqual([
            [5.1, 2100, undefined, 6.4],
            [10.31, 3000, '동백역-기흥역', 10.2],
        ]);
    });
    it('adds every watch run with no logged partner, on logged days too', () => {
        const { days, stats } = mergeGarmin(logged, csv('Running,2026-10-15 05:30:00,2.01,00:12:00\nRunning,2026-10-15 06:00:00,14.05,01:01:00\n'), empty);
        expect(stats).toMatchObject({ matched: 1, added: 1 });
        expect(days.find((d) => d.date === '2026-10-15').activities.map((a) => a.distanceKm)).toEqual([14.05, 2.01]);
    });
    it('keeps a logged run with no watch partner as it is', () => {
        const { days } = mergeGarmin(logged, csv('Running,2026-10-13 19:00:00,10.31,00:50:00\n'), empty);
        expect(days[0].activities.map((a) => [a.distanceKm, a.garmin?.distanceKm])).toEqual([
            [6.4, undefined],
            [10.31, 10.31],
        ]);
    });
    it('keeps a distance or time the user set by hand', () => {
        const edited = structuredClone(logged);
        edited[1].activities[0].appEdits = { distanceKm: 14, durationSec: 3600 };
        edited[1].activities[0].durationSec = 3600;
        const { days } = mergeGarmin(edited, csv('Running,2026-10-15 06:00:00,14.05,01:01:00\n'), empty);
        expect(days[0].activities[0]).toMatchObject({ distanceKm: 14, durationSec: 3600, garmin: { distanceKm: 14.05 } });
    });
});
