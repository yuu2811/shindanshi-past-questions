// 科目内の論点タグ別出題数。taxonomy にない「未分類」も含めて集計する。
import { db } from "../../db/db";
import type { SubjectCode } from "../../types/data";

/** 科目に属する全問題の tagList を集計し、タグ名→問題数 の Map を返す。 */
export async function getTagCountsForSubject(
  subject: SubjectCode,
): Promise<Map<string, number>> {
  const questions = await db.questions.where("subject").equals(subject).toArray();
  const counts = new Map<string, number>();
  for (const q of questions) {
    for (const tag of q.tagList ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}
