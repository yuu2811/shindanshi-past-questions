// 演習: 出題選択。科目(A〜G)を選び、「年度別」または「論点タグ別」で問題群を選ぶ。
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTagCountsForSubject } from "../../features/practice/tagCounts";
import { listExamsBySubject } from "../../data/queries";
import { fetchTaxonomy } from "../../data/loader";
import {
  SUBJECT_CODES,
  SUBJECT_NAMES,
  yearLabel,
  type SubjectCode,
} from "../../types/data";
import type { Exam1ji, Taxonomy1ji } from "../../types/data";

type SelectMode = "year" | "tag";

const UNCLASSIFIED_TAG = "未分類";

export default function PracticeSelectPage() {
  const [mode, setMode] = useState<SelectMode>("year");
  const [subject, setSubject] = useState<SubjectCode | null>(null);

  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="mb-3 text-xl font-bold">演習</h1>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
        {(
          [
            { key: "year", label: "年度別" },
            { key: "tag", label: "論点タグ別" },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === m.key
                ? "bg-white text-slate-900 shadow dark:bg-slate-950 dark:text-white"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

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

      {subject && mode === "year" && <ExamListBySubject subject={subject} />}
      {subject && mode === "tag" && <TagListBySubject subject={subject} />}
    </div>
  );
}

function ExamListBySubject({ subject }: { subject: SubjectCode }) {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam1ji[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          onClick={() =>
            navigate(`/practice/session?examId=${encodeURIComponent(exam.exam_id)}`)
          }
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
        >
          <span className="font-semibold">{yearLabel(exam.year, exam.reexam)}年度</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {exam.n_questions}問
          </span>
        </button>
      ))}
    </div>
  );
}

function TagListBySubject({ subject }: { subject: SubjectCode }) {
  const navigate = useNavigate();
  const [taxonomy, setTaxonomy] = useState<Taxonomy1ji | null>(null);
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchTaxonomy()
      .then((t) => {
        if (!ignore) setTaxonomy(t);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setCounts(null);
    getTagCountsForSubject(subject)
      .then((c) => {
        if (!ignore) setCounts(c);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ignore = true;
    };
  }, [subject]);

  if (error) {
    return <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>;
  }
  if (!taxonomy || !counts) {
    return <p className="py-6 text-center text-sm text-slate-400">読み込み中…</p>;
  }

  const subjectTaxonomy = taxonomy.subjects[subject];
  const tags = [...(subjectTaxonomy?.topics.map((t) => t.tag) ?? []), UNCLASSIFIED_TAG];

  return (
    <div className="flex flex-col gap-2">
      {tags.map((tag) => {
        const count = counts.get(tag) ?? 0;
        const disabled = count === 0;
        return (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            onClick={() => navigate(`/practice/session?tag=${encodeURIComponent(tag)}`)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
              disabled
                ? "border-slate-100 bg-slate-50 text-slate-400 dark:border-slate-900 dark:bg-slate-900/40 dark:text-slate-600"
                : "border-slate-200 bg-white active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
            }`}
          >
            <span className="font-medium">{tag}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{count}問</span>
          </button>
        );
      })}
    </div>
  );
}
