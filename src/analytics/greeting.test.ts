import { describe, expect, it } from 'vitest'
import { greetingsFor, pickGreeting } from './greeting'

describe('greeting', () => {
  it('adds greetings for the time of day', () => {
    expect(greetingsFor(7)).toContain('좋은 아침이에요.')
    expect(greetingsFor(19)).toContain('편안한 저녁 보내세요.')
    expect(greetingsFor(2)).toContain('좋은 꿈 꾸세요.')
    expect(greetingsFor(14)).not.toContain('좋은 아침이에요.')
  })

  it('does not repeat the last greeting', () => {
    for (let i = 0; i < 20; i++) expect(pickGreeting(9, '안녕하세요.')).not.toBe('안녕하세요.')
    expect(pickGreeting(9, undefined, () => 0)).toBe('안녕하세요.')
  })
})
