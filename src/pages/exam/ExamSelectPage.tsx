// 模試選択: 科目(A〜G)→年度で試験を選ぶ。中断中セッションがあれば最上部に再開カード。
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listExamsBySubject } from "../../data/queries";
import { db } from "../../db/db";
import {
  createExamSession,
  listInProgressSessions,
  computeRemainingSec,
  abandonExamSession,
} from "../../features/exam/session";
import { formatClock } from "../../features/exam/useExamCountdown";
import {
  SUBJECT_CODES,
  SUBJECT_NAMES,
  yearLabel,
  type Exam1ji,
  type SubjectCode,
} from "../../types/data";
import type { ExamSession } from "../../types/study";

export default function ExamSelectPage() {
  const [subject, setSubject] = useState<SubjectCode | null>(null);

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="mb-3 text-xl font-bold">模試</h1>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        本番同一構成で1科目を通して解きます。制限時間つき。採点まで正誤は表示されません。
      </p>

      <ResumeSection />

      <div className="mb-5 grid grid-cols-4 gap-2">
        {SUBJECT_CODES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setSubject(code)}
            className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-2 text-center ${
              subject === code
                ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <span className="text-base font-bold">{code}</span>
            <span className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
              {SUBJECT_NAMES[code]}
            </span>
          </button>
        ))}
      </div>

      {!subject && (
        <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          科目を選択してください
        </p>
      )}

      {subject && <ExamListBySubject subject={subject} />}
    </div>
  );
}

function ResumeSection() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ExamSession[] | null>(null);
  const [examMap, setExamMap] = useState<Map<string, Exam1ji>>(new Map());

  const reload = useCallback(() => {
    listInProgressSessions()
      .then(async (list) => {
        const map = new Map<string, Exam1ji>();
        for (const s of list) {
          if (!map.has(s.examId)) {
            const exam = await db.exams.get(s.examId);
            if (exam) map.set(s.examId, exam);
          }
        }
        setExamMap(map);
        setSessions(list);
      })
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!sessions || sessions.length === 0) return null;

  const handleDiscard = (id: string) => {
    abandonExamSession(id)
      .then(reload)
      .catch(() => reload());
  };

  return (
    <div className="mb-5 flex flex-col gap-2">
      <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400">中断中の模試</h2>
      {sessions.map((s) => {
        const exam = examMap.get(s.examId);
        const remaining = computeRemainingSec(s, Date.now());
        const label = exam
          ? `${exam.subject_name} ${yearLabel(exam.year, exam.reexam)}年度`
          : s.examId;
        const answered = Object.values(s.answers).filter((v) => v !== null).length;
        return (
          <div
            key={s.id}
            className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800 dark:text-slate-100">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  残り {formatClock(remaining)} / 解答済 {answered}件
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/exam/session/${s.id}`)}
                className="flex-none rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white active:bg-amber-700"
              >
                再開
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleDiscard(s.id)}
              className="mt-2 text-xs text-slate-400 underline active:text-slate-600 dark:text-slate-500"
            >
              破棄する
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ExamListBySubject({ subject }: { subject: SubjectCode }) {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam1ji[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setExams(null);
    setError(null);
    listExamsBySubject(subject)
      .then((result) => {
        if (!ignore) setExams(result);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ignore = true;
    };
  }, [subject]);

  const handleStart = (exam: Exam1ji) => {
    if (starting) return;
    setStarting(exam.exam_id);
    createExamSession(exam, Date.now())
      .then((session) => navigate(`/exam/session/${session.id}`))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setStarting(null);
      });
  };

  if (error) {
    return <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>;
  }
  if (!exams) {
    return <p className="py-6 text-center text-sm text-slate-400">読み込み中…</p>;
  }
  if (exams.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">試験データがありません</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {exams.map((exam) => (
        <button
          key={exam.exam_id}
          type="button"
          disabled={starting !== null}
          onClick={() => handleStart(exam)}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left active:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
        >
          <div>
            <p className="font-semibold">
              {yearLabel(exam.year, exam.reexam)}年度
              {exam.reexam && (
                <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  再試験
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {exam.n_questions}問 / {exam.n_answer_cells}解答欄 / 制限{exam.duration_minutes}分
            </p>
          </div>
          <span className="flex-none rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            {starting === exam.exam_id ? "…" : "開始"}
          </span>
        </button>
      ))}
    </div>
  );
}
