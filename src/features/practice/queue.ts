// 演習セッションの出題キュー構築。
// examId / tag / 復習(review.ts) の3系統いずれも同じ QueueItem[] に正規化する。
// 「設問分割あり」の問題は items[] を個別の QueueItem として展開する
// (1問題内の設問ごとに解答させる要件のため)。
import { getQuestionsByTag, getQuestionsForExam } from "../../data/queries";
import type { Question1ji, QuestionItem } from "../../types/data";
import type { ItemKey } from "../../types/study";
import { itemKey } from "../../types/study";

export interface QueueItem {
  question: Question1ji;
  item: QuestionItem;
  itemKey: ItemKey;
}

function flatten(questions: Question1ji[]): QueueItem[] {
  const out: QueueItem[] = [];
  for (const q of questions) {
    for (const item of q.items) {
      out.push({ question: q, item, itemKey: itemKey(q.id, item.sub) });
    }
  }
  return out;
}

/** 年度別(試験単位): 問番号順 */
export async function buildQueueForExam(examId: string): Promise<QueueItem[]> {
  const questions = await getQuestionsForExam(examId);
  return flatten(questions);
}

/** タグ別: 年度→問番号順 (出題順に近い並び) */
export async function buildQueueForTag(tag: string): Promise<QueueItem[]> {
  const questions = await getQuestionsByTag(tag);
  const sorted = [...questions].sort(
    (a, b) => a.year - b.year || Number(a.reexam) - Number(b.reexam) || a.q - b.q,
  );
  return flatten(sorted);
}
