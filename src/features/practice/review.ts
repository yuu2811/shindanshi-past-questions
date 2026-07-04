// 「今日の復習」対象の抽出。JST暦日の終わりまでを期日到来とする(CLAUDE.md: 日付はJST前提)。
import { db } from "../../db/db";
import { jstStartOfDay } from "../../lib/jst";
import type { Question1ji } from "../../types/data";
import type { SrsState } from "../../types/study";
import type { QueueItem } from "./queue";

/** 「今日」の終わり(=翌日0時JST)の epoch ms。dueAt がこれより前なら期日到来。 */
function startOfTomorrow(now: number): number {
  return jstStartOfDay(now) + 24 * 60 * 60 * 1000;
}

/** 期日到来の SrsState 一覧 (dueAt <= 本日の終わり) */
export async function getDueSrsStates(now: number): Promise<SrsState[]> {
  const threshold = startOfTomorrow(now);
  return db.srs.where("dueAt").below(threshold).toArray();
}

/** 期日到来件数のみ (件数表示用の軽量クエリ) */
export async function getDueCount(now: number): Promise<number> {
  const threshold = startOfTomorrow(now);
  return db.srs.where("dueAt").below(threshold).count();
}

/** 今日の復習キューを構築。参照先の問題/設問が見つからない場合は Fail Loud せず
 *  そのアイテムだけ読み飛ばす(データ更新等で srs が古いキーを指す可能性があるため、
 *  復習セッション全体を落とすのは体験上望ましくない)。 */
export async function buildQueueForReview(now: number): Promise<QueueItem[]> {
  const states = await getDueSrsStates(now);
  const out: QueueItem[] = [];
  const cache = new Map<string, Question1ji | null>();
  for (const s of states) {
    let q = cache.get(s.questionId);
    if (q === undefined) {
      q = (await db.questions.get(s.questionId)) ?? null;
      cache.set(s.questionId, q);
    }
    if (!q) {
      console.error(`復習キュー: 問題が見つかりません questionId=${s.questionId}`);
      continue;
    }
    const item = q.items.find((i) => (i.sub ?? 0) === (s.sub ?? 0));
    if (!item) {
      console.error(`復習キュー: 設問が見つかりません itemKey=${s.itemKey}`);
      continue;
    }
    out.push({ question: q, item, itemKey: s.itemKey });
  }
  return out;
}
