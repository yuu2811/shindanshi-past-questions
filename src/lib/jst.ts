// 日付処理はすべて JST 前提 (CLAUDE.md 規定)。端末タイムゾーンに依存しない。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** epoch ms → JST の暦日文字列 "YYYY-MM-DD" */
export function jstDateString(epochMs: number): string {
  const d = new Date(epochMs + JST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** JST の暦日 "YYYY-MM-DD" の 00:00 (JST) を epoch ms で返す */
export function jstStartOfDay(epochMs: number): number {
  const d = new Date(epochMs + JST_OFFSET_MS);
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return utcMidnight - JST_OFFSET_MS;
}

/** 1次試験初日 2026-08-01 00:00 JST */
export const EXAM_DATE_1JI = Date.UTC(2026, 7, 1) - JST_OFFSET_MS;

/** 2次筆記 2026-10-25 00:00 JST */
export const EXAM_DATE_2JI = Date.UTC(2026, 9, 25) - JST_OFFSET_MS;

/** 試験日までの残日数 (JST暦日ベース、当日=0) */
export function daysUntil(examEpochMs: number, now: number): number {
  const diff = jstStartOfDay(examEpochMs) - jstStartOfDay(now);
  return Math.round(diff / (24 * 60 * 60 * 1000));
}
