// よく使う読み取りクエリの共通ヘルパー。書き込み系は各機能モジュールが担当。
import { db } from "../db/db";
import type { Exam1ji, Question1ji, SubjectCode } from "../types/data";

/** 科目の試験一覧 (年度降順、再試験は通常の後) */
export async function listExamsBySubject(subject: SubjectCode): Promise<Exam1ji[]> {
  const exams = await db.exams.where("subject").equals(subject).toArray();
  return exams.sort((a, b) => b.year - a.year || Number(a.reexam) - Number(b.reexam));
}

/** 試験1回分の問題 (問番号順) */
export async function getQuestionsForExam(examId: string): Promise<Question1ji[]> {
  const qs = await db.questions.where("exam_id").equals(examId).toArray();
  if (qs.length === 0) throw new Error(`問題が見つかりません: ${examId}`);
  return qs.sort((a, b) => a.q - b.q);
}

/** 論点タグに紐づく問題 */
export async function getQuestionsByTag(tag: string): Promise<Question1ji[]> {
  return db.questions.where("tagList").equals(tag).toArray();
}

export async function getQuestion(id: string): Promise<Question1ji> {
  const q = await db.questions.get(id);
  if (!q) throw new Error(`問題が見つかりません: ${id}`);
  return q;
}
