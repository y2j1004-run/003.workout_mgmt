import { describe, expect, it } from 'vitest'
import { SheetSchema, toRecords, type SheetReading } from './readSheet'

const reading: SheetReading = {
  is_inbody_sheet: true,
  measured_at: '2026-01-15 07:16',
  weight_kg: 60,
  skeletal_muscle_kg: 30,
  body_fat_kg: 8,
  body_fat_pct: 13.3,
  bmi: 21,
  inbody_score: 80,
  visceral_fat_area: 30,
  bmr_kcal: 1500,
  ecw_ratio: 0.37,
  blood_pressure: { systolic: 100, diastolic: 60, pulse: 70 },
  history: [
    { date: '2026-01-08', time: '06:57', weight_kg: 60.5, skeletal_muscle_kg: 29.9, body_fat_pct: 14, ecw_ratio: 0.371 },
    { date: '2026-01-15', time: '07:16', weight_kg: 60, skeletal_muscle_kg: 30, body_fat_pct: 13.3, ecw_ratio: 0.37 },
    { date: '26.01.01', time: null, weight_kg: 61, skeletal_muscle_kg: null, body_fat_pct: null, ecw_ratio: null },
  ],
}

describe('toRecords', () => {
  it('maps the sheet and its history, dropping the duplicate of the sheet date and bad dates', () => {
    const { sheet, history } = toRecords(SheetSchema.parse(reading))
    expect(sheet).toMatchObject({ date: '2026-01-15', time: '07:16', source: 'sheet', weightKg: 60, bodyFatKg: 8, systolicBp: 100, pulse: 70 })
    expect(history).toEqual([
      { date: '2026-01-08', time: '06:57', source: 'history', weightKg: 60.5, skeletalMuscleKg: 29.9, bodyFatPct: 14, ecwRatio: 0.371 },
    ])
  })

  it('returns nothing for a photo that is not a result sheet', () => {
    expect(toRecords({ ...reading, is_inbody_sheet: false })).toEqual({ history: [] })
  })

  it('keeps history even when the sheet date cannot be read', () => {
    const r = toRecords({ ...reading, measured_at: null })
    expect(r.sheet).toBeUndefined()
    expect(r.history).toHaveLength(2)
  })
})

describe('readSheet request', () => {
  it('sends the photo with structured output and fallbacks, and parses the reply', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const { readSheet } = await import('./readSheet')
    let sent: { url: string; headers: Headers; body: Record<string, unknown> } | undefined
    const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
      sent = { url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) }
      const message = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(reading) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }
      return new Response(JSON.stringify(message), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const client = new Anthropic({ apiKey: 'test-key', fetch: fakeFetch, dangerouslyAllowBrowser: true })

    const out = await readSheet(client, 'BASE64DATA')

    expect(out.weight_kg).toBe(60)
    expect(sent!.url).toContain('/v1/messages')
    expect(sent!.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
    expect(sent!.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true')
    expect(sent!.body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema' } } })
    const content = (sent!.body.messages as { content: { type: string; source?: { data: string } }[] }[])[0].content
    expect(content[0]).toMatchObject({ type: 'image', source: { data: 'BASE64DATA' } })
  })
})
