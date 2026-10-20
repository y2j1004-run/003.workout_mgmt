import { describe, expect, it } from 'vitest';
import { parseCsv, parseGarminCsv } from './garminCsv';
import { mergeGarmin, sameRun } from './mergeGarmin';
import { parseLog } from './parseLog';
// Made-up rows in the shape of a Garmin Connect "Export CSV" file.
const english = `﻿Activity Type,Date,Favorite,Title,Distance,Calories,Time,Avg HR,Max HR,Avg Run Cadence,Total Ascent
Running,2026-10-20 06:31:12,false,"Yongin Running",12.03,"1,021",01:03:10,148,171,178,45
Treadmill Running,2026-10-19 07:00:00,false,Treadmill,6.40,420,00:35:20,140,160,176,--
Strength Training,2026-10-19 07:40:00,false,Strength,0.00,200,00:30:00,110,130,--,--
Cycling,2026-10-18 08:00:00,false,Bike,20.00,500,01:00:00,120,150,--,100
`;
const korean = `활동 종류,날짜,즐겨찾기,제목,거리,칼로리,시간,평균 심박,최대 심박,평균 달리기 케이던스,총 상승
달리기,2026.10.17 06:00:00,false,경주 하프,23.10,1500,01:40:00,160,180,182,120
`;
describe('parseCsv', () => {
    it('handles quotes, escaped quotes and CRLF', () => {
        expect(parseCsv('a,"b,c","d ""e"""\r\n1,2,3')).toEqual([
            ['a', 'b,c', 'd "e"'],
            ['1', '2', '3'],
        ]);
    });
});
describe('parseGarminCsv', () => {
    it('reads English headers, numbers with commas and "--"', () => {
        const r = parseGarminCsv(english);
        expect(r.activities.map((a) => [a.date, a.kind])).toEqual([
            ['2026-10-20', 'run'],
            ['2026-10-19', 'run'],
            ['2026-10-19', 'strength'],
            ['2026-10-18', 'other'],
        ]);
        expect(r.activities[0]).toMatchObject({ distanceKm: 12.03, durationSec: 3790, avgHr: 148, maxHr: 171, cadence: 178, calories: 1021, ascentM: 45 });
        expect(r.activities[1].ascentM).toBeUndefined();
        expect(r.columns.distance).toBe('Distance');
    });
    it('reads Korean headers and dotted dates', () => {
        const r = parseGarminCsv(korean);
        expect(r.activities[0]).toMatchObject({ date: '2026-10-17', kind: 'run', distanceKm: 23.1, durationSec: 6000, avgHr: 160 });
        expect(r.columns.avgHr).toBe('평균 심박');
    });
});
describe('mergeGarmin', () => {
    const empty = (date) => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] });
    const logged = parseLog(`[ 2026년 ]
10.17 : 23키로(2k 워밍업, 하프 / 테스트마라톤)
10.19 : 6.4키로(트레드밀), 웨이트
10.20 : 12키로(527*10km)
`).days;
    it('gives the logged run the watch distance and time, keeping what only the log has', () => {
        const { days, stats } = mergeGarmin(logged, parseGarminCsv(english + korean.split('\n').slice(1).join('\n')).activities, empty);
        const run = (date) => days.find((d) => d.date === date).activities[0];
        expect(run('2026-10-20')).toMatchObject({ distanceKm: 12.03, durationSec: 3790, paceSecPerKm: 315, garmin: { avgHr: 148 }, details: ['527*10km'] });
        expect(run('2026-10-19').garmin?.durationSec).toBe(2120);
        // race with warm-up keeps its own pace basis
        expect(run('2026-10-17')).toMatchObject({ raceDistanceKm: 21.0975, garmin: { durationSec: 6000 } });
        expect(run('2026-10-17').durationSec).toBeUndefined();
        expect(stats).toEqual({ matched: 3, added: 0, updated: 0, strengthDays: 0, ignored: 1 });
    });
    it('adds unmatched watch runs and recognizes a re-imported file', () => {
        const first = mergeGarmin([], parseGarminCsv(english).activities, empty);
        expect(first.stats).toMatchObject({ added: 2, strengthDays: 1, ignored: 1 });
        const again = mergeGarmin(first.days, parseGarminCsv(english).activities, empty);
        expect(again.stats).toMatchObject({ added: 0, updated: 2 });
        expect(again.days.find((d) => d.date === '2026-10-20').activities).toHaveLength(1);
    });
    it('treats small distance differences as the same run', () => {
        expect(sameRun(12, 12.03)).toBe(true);
        expect(sameRun(21.1, 21.6)).toBe(true);
        expect(sameRun(6, 10)).toBe(false);
    });
});
describe('distance units', () => {
    it('reads meters, miles and km from the number, the cell or the header', async () => {
        const { parseDistance } = await import('./garminCsv');
        expect(parseDistance('10.02')).toEqual({ km: 10.02 });
        expect(parseDistance('5,010')).toEqual({ km: 5.01, from: 'm' });
        expect(parseDistance('800.00')).toEqual({ km: 0.8, from: 'm' });
        expect(parseDistance('800 m')).toEqual({ km: 0.8, from: 'm' });
        expect(parseDistance('3.1 mi')).toEqual({ km: 4.99, from: 'mi' });
        expect(parseDistance('400', 'm')).toEqual({ km: 0.4, from: 'm' });
        expect(parseDistance('12', 'km')).toEqual({ km: 12 });
        // 60 "km" in 15 minutes is impossible, so it is 60m
        expect(parseDistance('60', undefined, 900)).toEqual({ km: 0.06, from: 'm' });
        expect(parseDistance('42.2', undefined, 13000)).toEqual({ km: 42.2 });
    });
    it('reads a file mixing km and meters, and a unit in the header', () => {
        const mixed = parseGarminCsv('Activity Type,Date,Distance,Time\nRunning,2026-10-20 06:00:00,12.03,01:03:10\nTrack Running,2026-10-19 06:00:00,"8,000",00:36:00\n');
        expect(mixed.activities.map((a) => [a.distanceKm, a.convertedFrom])).toEqual([
            [12.03, undefined],
            [8, 'm'],
        ]);
        const header = parseGarminCsv('Activity Type,Date,Distance (m),Time\nRunning,2026-10-20 06:00:00,6400,00:35:00\n');
        expect(header.columns.distance).toBe('Distance (m)');
        expect(header.activities[0].distanceKm).toBe(6.4);
    });
    it('fixes a watch run first stored with meters read as km when the file is imported again', () => {
        const wrong = parseGarminCsv('Activity Type,Date,Distance,Time\nRunning,2026-10-16 06:00:00,6.5,00:35:00\n').activities.map((g) => ({ ...g, distanceKm: 6500 }));
        const first = mergeGarmin([], wrong, (date) => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] }));
        expect(first.days[0].activities[0].distanceKm).toBe(6500);
        const right = parseGarminCsv('Activity Type,Date,Distance,Time\nRunning,2026-10-16 06:00:00,"6,500",00:35:00\n').activities;
        const again = mergeGarmin(first.days, right, (date) => ({ date, activities: [], metrics: {}, stretching: false, rest: false, notes: [], issues: [], raw: [] }));
        expect(again.days[0].activities[0]).toMatchObject({ distanceKm: 6.5, durationSec: 2100, paceSecPerKm: 323 });
    });
});
