import { describe, expect, it } from 'vitest';
import { moveSection, resolveOrder } from './sectionOrder';
describe('stats section order', () => {
    it('defaults to the standard order with shoes last', () => {
        expect(resolveOrder()).toEqual(['summary', 'monthly', 'bodyFat', 'bp', 'races', 'crews', 'shoes']);
    });
    it('keeps a saved order, drops unknown ids and appends new sections', () => {
        expect(resolveOrder(['shoes', 'old', 'races', 'shoes'])).toEqual(['shoes', 'races', 'summary', 'monthly', 'bodyFat', 'bp', 'crews']);
    });
    it('moves a section up or down and stops at the ends', () => {
        const order = resolveOrder();
        expect(moveSection(order, 'races', -1).slice(3, 5)).toEqual(['races', 'bp']);
        expect(moveSection(order, 'summary', -1)).toEqual(order);
        expect(moveSection(order, 'shoes', 1)).toEqual(order);
    });
});
