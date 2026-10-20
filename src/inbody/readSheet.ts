// Reads an InBody result sheet photo with Claude (vision) using the user's own API key.
// The key and the photo go straight from the phone to the Anthropic API; nothing passes through our servers.

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { InBodyRecord } from './inbody'

const num = z.number().nullable()

export const SheetSchema = z.object({
  is_inbody_sheet: z.boolean(),
  measured_at: z.string().nullable().describe('검사일시, "YYYY-MM-DD HH:MM"'),
  weight_kg: num,
  skeletal_muscle_kg: num,
  body_fat_kg: num,
  body_fat_pct: num,
  bmi: num,
  inbody_score: num,
  visceral_fat_area: num,
  bmr_kcal: num,
  ecw_ratio: num,
  blood_pressure: z
    .object({ systolic: num, diastolic: num, pulse: num })
    .nullable()
    .describe('a separate blood pressure slip, if one is in the photo'),
  history: z
    .array(
      z.object({
        date: z.string().describe('"YYYY-MM-DD"'),
        time: z.string().nullable().describe('"HH:MM"'),
        weight_kg: num,
        skeletal_muscle_kg: num,
        body_fat_pct: num,
        ecw_ratio: num,
      }),
    )
    .describe('신체변화 (Body Composition History) columns, oldest first'),
})

export type SheetReading = z.infer<typeof SheetSchema>

const PROMPT = `This photo should be an InBody body composition result sheet (Korean). Transcribe the printed values exactly.
- If it is not an InBody result sheet, set is_inbody_sheet to false and leave the other fields null or empty.
- measured_at comes from 검사일시 at the top.
- Use the measured values, not the normal ranges in parentheses. Numbers may be printed with a space after the decimal point ("62. 2" is 62.2).
- body_fat_kg is 체지방량 and body_fat_pct is 체지방률.
- history: every column of the 신체변화 table at the bottom. Dates there are written "YY.MM.DD" with the time below (e.g. "26.08.21" over "06:57" is 2026-08-21, 06:57).
- A small blood pressure printout (최고혈압 / 최저혈압 / 맥박수) may be lying on the sheet; put it in blood_pressure, otherwise null.
- Use null for anything you cannot read with confidence; never guess.
- Do not transcribe 회원번호 or any other personal identifier.`

/** Shrinks the photo (keeping its EXIF orientation) so it uploads fast but small digits stay legible. */
export async function preparePhoto(file: Blob, maxSide = 2000): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('사진을 변환하지 못했습니다.'))), 'image/jpeg', 0.88))
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function makeClient(apiKey: string): Anthropic {
  // the key belongs to the person using the app and is kept only on their phone
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export async function readSheet(client: Anthropic, jpegBase64: string): Promise<SheetReading> {
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(SheetSchema) },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })
  if (response.stop_reason === 'refusal') throw new Error('사진을 읽지 못했습니다 (요청이 거절됨).')
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new Error('사진에서 값을 읽지 못했습니다. 다시 시도해 주세요.')
  return response.parsed_output
}

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/
const v = (n: number | null) => n ?? undefined

/** Turns one reading into records: the sheet itself plus its history columns. */
export function toRecords(r: SheetReading): { sheet?: InBodyRecord; history: InBodyRecord[] } {
  if (!r.is_inbody_sheet) return { history: [] }
  const m = r.measured_at?.match(DATE_TIME)
  const sheet: InBodyRecord | undefined = m
    ? {
        date: m[1],
        time: m[2]?.padStart(5, '0'),
        source: 'sheet',
        weightKg: v(r.weight_kg),
        skeletalMuscleKg: v(r.skeletal_muscle_kg),
        bodyFatKg: v(r.body_fat_kg),
        bodyFatPct: v(r.body_fat_pct),
        bmi: v(r.bmi),
        score: v(r.inbody_score),
        visceralFatArea: v(r.visceral_fat_area),
        bmrKcal: v(r.bmr_kcal),
        ecwRatio: v(r.ecw_ratio),
        systolicBp: v(r.blood_pressure?.systolic ?? null),
        diastolicBp: v(r.blood_pressure?.diastolic ?? null),
        pulse: v(r.blood_pressure?.pulse ?? null),
      }
    : undefined
  const history = r.history
    .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.date !== sheet?.date)
    .map(
      (h): InBodyRecord => ({
        date: h.date,
        time: h.time ?? undefined,
        source: 'history',
        weightKg: v(h.weight_kg),
        skeletalMuscleKg: v(h.skeletal_muscle_kg),
        bodyFatPct: v(h.body_fat_pct),
        ecwRatio: v(h.ecw_ratio),
      }),
    )
  return { sheet, history }
}
