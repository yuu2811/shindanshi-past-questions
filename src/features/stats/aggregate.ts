// 弱点ヒートマップ・学習統計向けの集計ロジック(純粋関数)。
// db.attempts の生データからページ側で使う形へ変換する。ここでは日付処理を
// 必ず src/lib/jst.ts 経由で行う(JSTバグ防止 / CLAUDE.md 規定)。
import type { Attempt } from "../../types/study";
import type { SubjectCode } from "../../types/data";
import { jstDateString, jstStartOfDay } from "../../lib/jst";

/** 解答数・正答数の集計単位 */
export interface Agg {
  total: number;
  correct: number;
}

function emptyAgg(): Agg {
  return { total: 0, correct: 0 };
}

function bump(agg: Agg, correct: boolean): Agg {
  return { total: agg.total + 1, correct: agg.correct + (correct ? 1 : 0) };
}

/** 正答率(0-1)。未演習(total=0)は null */
export function accuracy(agg: Agg): number | null {
  return agg.total === 0 ? null : agg.correct / agg.total;
}

/**
 * 論点タグ別の集計キー。
 * タグ名は taxonomy_1ji.json の science 内で科目ごとに定義されているため
 * (同名タグが別科目に存在する可能性・"未分類" は全科目共通で出現するため)
 * 科目コードと組にしてキー化する。
 */
export function tagKey(subject: string, tag: string): string {
  return `${subject}::${tag}`;
}

/** attempts を (科目,タグ) 単位で集計する。1件の attempt は tags[] の全タグに加算される */
export function aggregateByTag(attempts: Attempt[]): Map<string, Agg> {
  const map = new Map<string, Agg>();
  for (const a of attempts) {
    for (const tag of a.tags) {
      const key = tagKey(a.subject, tag);
      map.set(key, bump(map.get(key) ?? emptyAgg(), a.correct));
    }
  }
  return map;
}

/** attempts を科目単位で集計する */
export function aggregateBySubject(attempts: Attempt[]): Map<string, Agg> {
  const map = new Map<string, Agg>();
  for (const a of attempts) {
    map.set(a.subject, bump(map.get(a.subject) ?? emptyAgg(), a.correct));
  }
  return map;
}

/** attempts を JST 暦日単位の解答数に集計する(jstDateString キー) */
export function aggregateByDay(attempts: Attempt[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of attempts) {
    const d = jstDateString(a.answeredAt);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return map;
}

/**
 * 直近 n 日分の JST 暦日文字列を古い→新しい順で返す(今日を含む)。
 * jstStartOfDay で "今日 00:00 JST" を基準にすることで、実行時刻に依存せず
 * 常に同じ暦日集合を返す。
 */
export function recentJstDays(n: number, nowEpochMs: number): string[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = jstStartOfDay(nowEpochMs);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(jstDateString(todayStart - i * dayMs));
  }
  return out;
}

/**
 * 指定科目の週別正答率トレンド(直近 weeks 週、古い→新しい順)。
 * 直近 weeks*7 日を JST 暦日で束ね、7日ずつ週バケットに分ける。
 * ウィンドウ外の attempt は無視する。
 */
export function weeklyAccuracyBySubject(
  attempts: Attempt[],
  subject: SubjectCode,
  weeks: number,
  nowEpochMs: number,
): Agg[] {
  const days = recentJstDays(weeks * 7, nowEpochMs);
  const dayIndex = new Map<string, number>();
  days.forEach((d, i) => dayIndex.set(d, i));

  const buckets: Agg[] = Array.from({ length: weeks }, () => emptyAgg());
  for (const a of attempts) {
    if (a.subject !== subject) continue;
    const idx = dayIndex.get(jstDateString(a.answeredAt));
    if (idx === undefined) continue; // 集計ウィンドウ外
    const bucketIdx = Math.floor(idx / 7);
    const bucket = buckets[bucketIdx];
    if (!bucket) continue; // 理論上到達しない(idx < weeks*7 のため)
    buckets[bucketIdx] = bump(bucket, a.correct);
  }
  return buckets;
}
