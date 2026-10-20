import type { Activity } from '../import/parseLog'
import { isRace } from './stats'

/** Themes offered as one-tap choices; anything else can be typed in. */
export const THEMES = ['조깅', '회복', '지속주', '템포', '인터벌', '빌드업', 'LSD', '언덕', '트레일', '대회', '크루']

const RULES: [RegExp, string][] = [
  [/LSD/i, 'LSD'],
  [/인터벌|\d+\s*m?\s*[*×]\s*\d+\s*회|\/\d+\s*\*\s*\d+회/, '인터벌'],
  [/빌드업/, '빌드업'],
  [/템포/, '템포'],
  [/지속주/, '지속주'],
  [/업힐|언덕/, '언덕'],
  [/트레일/, '트레일'],
  [/회복/, '회복'],
  [/조깅/, '조깅'],
]

/** The run's theme: the one the user chose, otherwise a guess from the log's words. */
export function themeOf(a: Activity): { theme?: string; inferred: boolean } {
  if (a.theme) return { theme: a.theme, inferred: false }
  const text = [a.event, ...a.details].filter(Boolean).join(' ')
  for (const [re, theme] of RULES) if (re.test(text)) return { theme, inferred: true }
  if (isRace(a)) return { theme: '대회', inferred: true }
  if (a.crew) return { theme: '크루', inferred: true }
  return { inferred: true }
}
