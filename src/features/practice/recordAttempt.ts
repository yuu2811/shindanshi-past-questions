// 解答記録(db.attempts)と自己評価によるSRS更新(db.srs)。
// 採点は必ず src/lib/scoring.ts の isCorrect() を使う (all_correct 対応を一元化)。
import { db } from "../../db/db";
import { isCorrect } from "../../lib/scoring";
import { sm2Next } from "../../lib/sm2";
import type { Question1ji, QuestionItem } from "../../types/data";
import type { Attempt, SelfRating, SrsState } from "../../types/study";
import { itemKey } from "../../types/study";

function tagsOf(question: Question1ji): string[] {
  return question.tagList ?? question.topic_tags.map((t) => t.tag);
}

/** 解答1件を記録する。戻り値の attemptId は自己評価更新(applyRating)に必要。 */
export async function recordAttempt(params: {
  question: Question1ji;
  item: QuestionItem;
  selected: string | null;
  mode: "practice" | "review";
  now: number;
}): Promise<{ attemptId: number; correct: boolean }> {
  const { question, item, selected, mode, now } = params;
  const correct = isCorrect(item, selected);
  const attempt: Attempt = {
    itemKey: itemKey(question.id, item.sub),
    questionId: question.id,
    sub: item.sub,
    subject: question.subject,
    year: question.year,
    reexam: question.reexam,
    tags: tagsOf(question),
    selected,
    correct,
    mode,
    answeredAt: now,
  };
  const newId = await db.attempts.add(attempt);
  // Dexie の型は id が任意フィールドのため number | undefined になるが、
  // auto-increment ("++id") なので実際は必ず発行される。Fail Loud: 発行されなければ例外にする。
  if (newId === undefined) {
    throw new Error("Attempt の保存に失敗しました (id が発行されませんでした)");
  }
  return { attemptId: newId, correct };
}

/** 自己評価を記録し、SM-2 で次回出題日を更新する。 */
export async function applyRating(params: {
  attemptId: number;
  question: Question1ji;
  item: QuestionItem;
  rating: SelfRating;
  now: number;
}): Promise<void> {
  const { attemptId, question, item, rating, now } = params;
  const key = itemKey(question.id, item.sub);
  const prev = await db.srs.get(key);
  const next = sm2Next({
    prev: prev ? { ef: prev.ef, reps: prev.reps, intervalDays: prev.intervalDays } : null,
    rating,
    now,
  });
  const state: SrsState = {
    itemKey: key,
    questionId: question.id,
    sub: item.sub,
    subject: question.subject,
    tags: tagsOf(question),
    ef: next.ef,
    reps: next.reps,
    intervalDays: next.intervalDays,
    dueAt: next.dueAt,
    updatedAt: now,
  };
  await db.transaction("rw", [db.srs, db.attempts], async () => {
    await db.srs.put(state);
    await db.attempts.update(attemptId, { rating });
  });
}
