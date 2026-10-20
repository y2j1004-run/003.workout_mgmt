import { describe, expect, it } from 'vitest';
import { assessInBody } from './assess';
import { parseInBodyCsv } from './inbody';
// made-up values in the same shape as a real sheet
const csv = `2026-04-10,07:00,sheet,62.0,30.0,9.0,14.5,21.5,79,34.0,1530,0.372,105,65,70
2026-10-15,07:16,sheet,62.2,30.4,8.2,13.2,21.5,79,30.0,1536,0.374,94,63,81,7.9,6.4,0.79,2.97,2.87,23.7,8.66,8.42,100.4,97.1,100.3,105.2,102.3`;
describe('parse extended columns', () => {
    it('reads SMI, phase angle, waist-hip ratio and segments', () => {
        const r = parseInBodyCsv(csv).records[1];
        expect(r).toMatchObject({ smi: 7.9, phaseAngle: 6.4, abdominalFatRatio: 0.79 });
        expect(r.segments).toEqual({
            rightArm: { kg: 2.97, pct: 100.4 },
            leftArm: { kg: 2.87, pct: 97.1 },
            trunk: { kg: 23.7, pct: 100.3 },
            rightLeg: { kg: 8.66, pct: 105.2 },
            leftLeg: { kg: 8.42, pct: 102.3 },
        });
        expect(parseInBodyCsv(csv).records[0].segments).toBeUndefined();
    });
});
describe('assessInBody', () => {
    const records = parseInBodyCsv(csv).records;
    it('rates each indicator against its reference range', () => {
        const a = assessInBody(records);
        const level = (k) => a.items.find((i) => i.key === k)?.level;
        expect(level('pbf')).toBe('good');
        expect(level('vfa')).toBe('good');
        expect(level('smi')).toBe('good');
        expect(level('ecw')).toBe('good');
        expect(level('bp')).toBe('good');
        expect(level('segments')).toBe('good');
        expect(a.items.find((i) => i.key === 'segments').note).toMatch(/하체가 더 발달한 러너형.*왼쪽이 작음/);
        expect(a.headline).toMatch(/마른 지구력형/);
    });
    it('shows changes since about six months ago and suggests upper-body and balance work', () => {
        const a = assessInBody(records);
        expect(a.trends.find((t) => t.label === '체지방률')).toEqual({ label: '체지방률', from: 14.5, to: 13.2, unit: '%', since: '2026-04-10' });
        expect(a.suggestions.join(' ')).toMatch(/팔 근육/);
        expect(a.suggestions.join(' ')).toMatch(/왼쪽 한쪽 운동/);
    });
    it('flags a measurement after a heavy week or at an unusual time', () => {
        const extra = parseInBodyCsv(`2026-05-01,07:00,manual,62\n2026-06-01,07:00,manual,62\n2026-07-01,07:00,manual,62\n2026-10-16,13:00,manual,61`).records;
        const a = assessInBody([...records, ...extra], (d) => (d === '2026-10-16' ? 140 : 80));
        expect(a.suggestions.join(' ')).toMatch(/평소\(7:00 무렵\)와 시간대가 달라/);
        expect(a.suggestions.join(' ')).toMatch(/140km/);
    });
    it('lists what needs attention in the headline', () => {
        const a = assessInBody(parseInBodyCsv('2026-10-15,07:00,sheet,80,28,22,27.5,27.0,70,110,1500,0.395,135,85').records);
        expect(a.headline).toMatch(/살펴볼 항목 5개/);
    });
});
