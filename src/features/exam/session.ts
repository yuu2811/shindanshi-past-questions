// 模試セッションのライフサイクル(作成・保存・採点・記録)。
// 採点は必ず src/lib/scoring.ts の scoreExam/isCorrect を使う(採点ロジックの重複実装禁止)。
//
// ── タイマー/再開の設計判断(重要) ─────────────────────────────
//   残り時間の計算は **startedAt 基準** を単一の真実とする:
//       remaining = durationSec - floor((now - startedAt)/1000)
//   理由:
//     1. 本番同一構成 = 開始したら時計は止まらない。バックグラウンド/中断中も
//        経過させるのが正しい(REQUIREMENTS §4-3「制限時間タイマー」)。
//     2. 保存漏れ(クラッシュ・強制終了)があっても startedAt から再計算でき、
//        リロード/再開で残り時間が必ず正しく続く(elapsedSec の欠損に強い)。
//   elapsedSec は「記録・中断表示用」として定期保存するが、残り時間の計算には
//   使わない(startedAt から都度算出する)。elapsedSec は durationSec で上限クランプする。
import { db } from "../../db/db";
import { scoreExam, isCorrect } from "../../lib/scoring";
import type { Exam1ji, Question1ji } from "../../types/data";
import type { Attempt, ExamResult, ExamSession, ItemKey } from "../../types/study";
import { itemKey } from "../../types/study";

/** セッションID採番。secure context では randomUUID、無ければフォールバック。 */
export function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 経過秒を startedAt から算出(durationSec で上限クランプ)。 */
export function computeElapsedSec(startedAt: number, durationSec: number, now: number): number {
  const raw = Math.floor((now - startedAt) / 1000);
  if (raw < 0) return 0;
  return Math.min(durationSec, raw);
}

/** 残り秒。0 未満は 0。 */
export function computeRemainingSec(session: ExamSession, now: number): number {
  const elapsed = Math.floor((now - session.startedAt) / 1000);
  return Math.max(0, session.durationSec - elapsed);
}

export async function createExamSession(exam: Exam1ji, now: number): Promise<ExamSession> {
  const session: ExamSession = {
    id: newSessionId(),
    examId: exam.exam_id,
    startedAt: now,
    durationSec: exam.duration_minutes * 60,
    elapsedSec: 0,
    answers: {},
    status: "in_progress",
  };
  await db.examSessions.add(session);
  return session;
}

/** examId から試験メタを引いてセッションを作成(「もう一度」導線用)。 */
export async function createExamSessionByExamId(examId: string, now: number): Promise<ExamSession> {
  const exam = await db.exams.get(examId);
  if (!exam) throw new Error(`試験メタが見つかりません: ${examId}`);
  return createExamSession(exam, now);
}

export async function getExamSession(id: string): Promise<ExamSession | undefined> {
  return db.examSessions.get(id);
}

/** 中断中(in_progress)セッション一覧。開始が新しい順。 */
export async function listInProgressSessions(): Promise<ExamSession[]> {
  const list = await db.examSessions.where("status").equals("in_progress").toArray();
  return list.sort((a, b) => b.startedAt - a.startedAt);
}

/** 解答と経過秒を永続化(in_progress のときのみ)。 */
export async function persistProgress(
  id: string,
  answers: Record<ItemKey, string | null>,
  elapsedSec: number,
): Promise<void> {
  await db.examSessions
    .where("id")
    .equals(id)
    .and((s) => s.status === "in_progress")
    .modify({ answers, elapsedSec });
}

/**
 * 採点して finished 化。各設問(item)を db.attempts に記録(mode:"exam", sessionId付き)。
 * 二重採点を避けるため、in_progress のセッションだけを finished に遷移させる。
 * すでに finished のセッションに対しては既存 result を返し、attempts は追加しない。
 */
export async function finishExamSession(
  session: ExamSession,
  questions: Question1ji[],
  now: number,
): Promise<ExamResult> {
  const result = scoreExam({ questions, answers: session.answers });

  const attempts: Attempt[] = [];
  for (const q of questions) {
    const tags = q.tagList ?? q.topic_tags.map((t) => t.tag);
    for (const item of q.items) {
      const key = itemKey(q.id, item.sub);
      const selected = session.answers[key] ?? null;
      attempts.push({
        itemKey: key,
        questionId: q.id,
        sub: item.sub,
        subject: q.subject,
        year: q.year,
        reexam: q.reexam,
        tags,
        selected,
        correct: isCorrect(item, selected),
        mode: "exam",
        sessionId: session.id,
        answeredAt: now,
      });
    }
  }

  const elapsedSec = computeElapsedSec(session.startedAt, session.durationSec, now);

  await db.transaction("rw", [db.attempts, db.examSessions], async () => {
    // in_progress のときだけ遷移させ、attempts を記録する(冪等性: 二重採点防止)。
    const changed = await db.examSessions
      .where("id")
      .equals(session.id)
      .and((s) => s.status === "in_progress")
      .modify({
        status: "finished",
        finishedAt: now,
        elapsedSec,
        answers: session.answers,
        result,
      });
    if (changed > 0) {
      await db.attempts.bulkAdd(attempts);
    }
  });

  // 既に finished 済みなら DB 上の確定 result を優先して返す。
  const fresh = await db.examSessions.get(session.id);
  return fresh?.result ?? result;
}

/** セッションを中断(abandoned)にする。 */
export async function abandonExamSession(id: string): Promise<void> {
  await db.examSessions
    .where("id")
    .equals(id)
    .and((s) => s.status === "in_progress")
    .modify({ status: "abandoned" });
}
