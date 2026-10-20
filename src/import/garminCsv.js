// Reads the activity list exported from Garmin Connect (web: 활동 → CSV 내보내기).
// Column names differ by language, so each field accepts several header spellings.
const HEADERS = {
    type: ['Activity Type', '활동 종류', '활동 유형', '종류', '유형'],
    date: ['Date', '날짜', '시작 시간', 'Start Time'],
    title: ['Title', '제목', '이름', '활동 이름'],
    distance: ['Distance', '거리'],
    time: ['Time', '시간', 'Moving Time', '이동 시간', 'Elapsed Time', '경과 시간'],
    avgHr: ['Avg HR', '평균 심박', '평균 심박수'],
    maxHr: ['Max HR', '최대 심박', '최대 심박수'],
    cadence: ['Avg Run Cadence', '평균 달리기 케이던스', '평균 러닝 케이던스', '평균 케이던스'],
    ascent: ['Total Ascent', '총 상승', '총 오르막', '상승'],
    calories: ['Calories', '칼로리'],
};
export const FIELD_LABELS = {
    type: '활동 종류',
    date: '날짜',
    title: '제목',
    distance: '거리',
    time: '시간',
    avgHr: '평균 심박',
    maxHr: '최대 심박',
    cadence: '케이던스',
    ascent: '상승 고도',
    calories: '칼로리',
};
const norm = (s) => s.toLowerCase().replace(/[\s®.()]/g, '');
/** "Distance (m)" -> { base: "Distance", unit: "m" } */
function splitUnit(h) {
    const m = h.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    return m ? { base: m[1], unit: m[2].trim().toLowerCase() } : { base: h };
}
export function parseGarminCsv(text) {
    const rows = parseCsv(text.replace(/^﻿/, ''));
    const header = rows.shift() ?? [];
    const columns = {};
    const index = {};
    for (const field of Object.keys(HEADERS)) {
        // earlier spellings win, so "Time" is preferred over "Elapsed Time"
        for (const name of HEADERS[field]) {
            // a unit in parentheses ("Distance (m)") still matches; the unit is read below
            const i = header.findIndex((h) => norm(h) === norm(name) || norm(splitUnit(h).base) === norm(name));
            if (i !== -1) {
                index[field] = i;
                columns[field] = header[i];
                break;
            }
        }
    }
    const distanceUnit = columns.distance ? splitUnit(columns.distance).unit : undefined;
    const activities = [];
    let skippedRows = 0;
    for (const row of rows) {
        const get = (f) => (index[f] == null ? undefined : clean(row[index[f]]));
        const rawDate = get('date');
        const dm = rawDate?.match(/(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/);
        if (!rawDate || !dm) {
            if (row.some((c) => c.trim()))
                skippedRows++;
            continue;
        }
        const type = get('type') ?? '';
        const durationSec = duration(get('time'));
        const dist = parseDistance(get('distance'), distanceUnit, durationSec);
        activities.push({
            date: `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`,
            startTime: rawDate,
            type,
            kind: kindOf(type),
            title: get('title'),
            distanceKm: dist.km,
            convertedFrom: dist.from,
            durationSec,
            avgHr: num(get('avgHr')),
            maxHr: num(get('maxHr')),
            cadence: num(get('cadence')),
            ascentM: num(get('ascent')),
            calories: num(get('calories')),
        });
    }
    return { activities, columns, skippedRows };
}
function kindOf(type) {
    const t = type.toLowerCase();
    if (/walk|hik|걷기|하이킹/.test(t))
        return 'walk';
    if (/run|러닝|달리기|조깅/.test(t))
        return 'run';
    if (/strength|근력|웨이트/.test(t))
        return 'strength';
    return 'other';
}
// Faster than this per km is impossible on foot, so the number must be meters.
const FASTEST_SEC_PER_KM = 100;
/**
 * Garmin writes most distances in km but some activities (track, treadmill intervals, pool) in meters,
 * and a few exports carry a unit. Order: unit in the cell or header, then the size of the number
 * (no single run is over 100km), then the pace it would imply.
 */
export function parseDistance(raw, headerUnit, durationSec) {
    if (!raw)
        return { km: 0 };
    const m = raw.trim().match(/^([\d.,]+)\s*([a-zA-Z]*)$/);
    const value = num(m?.[1] ?? raw);
    if (value == null)
        return { km: 0 };
    const unit = (m?.[2] || headerUnit || '').toLowerCase();
    if (unit === 'm' || unit === 'meters' || unit === '미터')
        return { km: round2(value / 1000), from: 'm' };
    if (unit === 'mi' || unit === 'miles')
        return { km: round2(value * 1.609344), from: 'mi' };
    if (unit === 'km')
        return { km: value };
    if (value > 100)
        return { km: round2(value / 1000), from: 'm' };
    if (durationSec && value > 0 && durationSec / value < FASTEST_SEC_PER_KM)
        return { km: round2(value / 1000), from: 'm' };
    return { km: value };
}
const round2 = (n) => Math.round(n * 100) / 100;
function clean(v) {
    const t = v?.trim();
    return !t || t === '--' ? undefined : t;
}
function num(v) {
    if (!v)
        return undefined;
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
}
/** "00:52:13", "52:13", "1:02:03.4" -> seconds */
function duration(v) {
    if (!v || !/^\d+(:\d+){1,2}(\.\d+)?$/.test(v))
        return undefined;
    const parts = v.split(':').map(Number);
    const sec = parts.reduce((acc, p) => acc * 60 + p, 0);
    return Math.round(sec);
}
/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else if (ch === '"')
                quoted = false;
            else
                cell += ch;
        }
        else if (ch === '"')
            quoted = true;
        else if (ch === ',') {
            row.push(cell);
            cell = '';
        }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n')
                i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += ch;
    }
    if (cell || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}
