// Dexie (IndexedDB) スキーマ。全機能はこの DB 経由で永続化する。
import Dexie, { type EntityTable } from "dexie";
import type { Question1ji, Exam1ji, Case2ji } from "../types/data";
import type {
  Attempt,
  SrsState,
  ExamSession,
  Draft2ji,
  MetaRecord,
} from "../types/study";

export class ShindanshiDB extends Dexie {
  questions!: EntityTable<Question1ji, "id">;
  exams!: EntityTable<Exam1ji, "exam_id">;
  cases!: EntityTable<Case2ji, "id">;
  attempts!: EntityTable<Attempt, "id">;
  srs!: EntityTable<SrsState, "itemKey">;
  examSessions!: EntityTable<ExamSession, "id">;
  drafts!: EntityTable<Draft2ji, "key">;
  meta!: EntityTable<MetaRecord, "key">;

  constructor() {
    super("shindanshi");
    this.version(1).stores({
      questions: "id, exam_id, year, subject, [subject+year], *tagList",
      exams: "exam_id, year, subject",
      cases: "id, year, case",
      attempts: "++id, itemKey, questionId, subject, answeredAt, mode, sessionId",
      srs: "itemKey, questionId, subject, dueAt",
      examSessions: "id, examId, status, startedAt",
      drafts: "key, caseId, updatedAt",
      meta: "key",
    });
  }
}

export const db = new ShindanshiDB();
