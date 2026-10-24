import { describe, expect, it } from 'vitest'
import { fmtPace, predictSec, trainingPaces, vdotOf } from './vdot'

describe('vdot', () => {
  it('matches Daniels tables', () => {
    // Daniels' table for VDOT 50: 5K 19:57, 10K 41:21, half 1:31:35, marathon 3:10:49
    for (const [km, sec] of [[5, 1197], [10, 2481], [21.0975, 5495], [42.195, 11449]]) expect(vdotOf(km, sec)).toBeCloseTo(50, 0)
    expect(Math.abs(predictSec(50, 42.195) - (3 * 3600 + 10 * 60 + 49))).toBeLessThan(120)
    const p = trainingPaces(50)
    expect(fmtPace(p.threshold)).toMatch(/^4:1\d$/)
    expect(fmtPace(p.interval)).toMatch(/^3:5\d$/)
    expect(p.easy[0]).toBeGreaterThan(p.easy[1])
    expect(p.easy[1]).toBeGreaterThan(p.marathon)
  })
})
