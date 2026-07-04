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

// ── 令和9年度(2027年度)試験日程 ──────────────────────────────────
// 2026年度(令和8年度)試験は終了。次回=令和9年度の日程は本稿執筆時点で
// 中小企業庁・J-SMECAともに未発表(公式発表は例年3月上旬、官報告示は4月上旬)。
// 下記は過去の実施パターン(1次=8月最初の土日、2次筆記=10月第4日曜)からの
// **社内推定値**であり、確定日程ではない。UI側は必ず「予定・未確定」を明示すること
// (EXAM_DATE_CONFIRMED を見て CountdownCard 等がバッジを出す)。
// 公式発表後は日付とこのフラグを更新する。
export const EXAM_DATE_CONFIRMED = false;

/** 1次試験初日(推定) 2027-07-31 00:00 JST */
export const EXAM_DATE_1JI = Date.UTC(2027, 6, 31) - JST_OFFSET_MS;

/** 2次筆記(推定) 2027-10-24 00:00 JST */
export const EXAM_DATE_2JI = Date.UTC(2027, 9, 24) - JST_OFFSET_MS;

/** 試験日までの残日数 (JST暦日ベース、当日=0) */
export function daysUntil(examEpochMs: number, now: number): number {
  const diff = jstStartOfDay(examEpochMs) - jstStartOfDay(now);
  return Math.round(diff / (24 * 60 * 60 * 1000));
}
