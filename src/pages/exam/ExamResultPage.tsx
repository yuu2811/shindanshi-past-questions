// 模試結果: 得点/満点・正答率・合否判定(60%合格/40%足切り)を明示。
// 全員正解・採点対象外の注記、問題別正誤一覧(タップで正解と自分の解答を展開)。
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getQuestionsForExam } from "../../data/queries";
import { isCorrect, isScorable } from "../../lib/scoring";
import { getExamSession, createExamSessionByExamId } from "../../features/exam/session";
import { itemKey } from "../../types/study";
import { yearLabel } from "../../types/data";
import type { ExamSession, ExamResult } from "../../types/study";
import type { Question1ji, QuestionItem } from "../../types/data";

type Verdict = "correct" | "wrong" | "unscored";

interface Row {
  key: string;
  question: Question1ji;
  item: QuestionItem;
  subLabel: string | null;
  selected: string | null;
  verdict: Verdict;
}

function buildRows(questions: Question1ji[], answers: Record<string, string | null>): Row[] {
  const rows: Row[] = [];
  for (const q of questions) {
    const multi = q.items.length > 1;
    for (const item of q.items) {
      const key = itemKey(q.id, item.sub);
      const selected = answers[key] ?? null;
      let verdict: Verdict;
      if (!isScorable(item)) verdict = "unscored";
      else if (isCorrect(item, selected)) verdict = "correct";
      else verdict = "wrong";
      rows.push({
        key,
        question: q,
        item,
        subLabel: multi ? `設問${item.sub ?? ""}` : null,
        selected,
        verdict,
      });
    }
  }
  return rows;
}

export default function ExamResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question1ji[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("セッションIDが指定されていません");
      return;
    }
    let ignore = false;
    (async () => {
      const s = await getExamSession(sessionId);
      if (ignore) return;
      if (!s) {
        setError(`模試セッションが見つかりません: ${sessionId}`);
        return;
      }
      if (s.status !== "finished" || !s.result) {
        setError("この模試はまだ採点されていません。");
        return;
      }
      const qs = await getQuestionsForExam(s.examId);
      if (ignore) return;
      setSession(s);
      setQuestions(qs);
    })().catch((e: unknown) => {
      if (!ignore) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      ignore = true;
    };
  }, [sessionId]);

  const rows = useMemo(
    () => (questions && session ? buildRows(questions, session.answers) : []),
    [questions, session],
  );

  const handleRestart = () => {
    if (!session || restarting) return;
    setRestarting(true);
    createExamSessionByExamId(session.examId, Date.now())
      .then((s) => navigate(`/exam/session/${s.id}`))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setRestarting(false);
      });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-bold text-rose-600 dark:text-rose-400">エラー</p>
        <p className="break-all text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link to="/exam" className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-white">
          模試選択に戻る
        </Link>
      </div>
    );
  }

  if (!session || !questions || !session.result) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 dark:border-slate-700 dark:border-t-slate-200" />
        <p className="text-sm text-slate-500 dark:text-slate-400">結果を読み込み中…</p>
      </div>
    );
  }

  const result: ExamResult = session.result;
  const first = questions[0];
  const title = first
    ? `${first.subject_name} ${yearLabel(first.year, first.reexam)}年度`
    : session.examId;

  const allCorrectCount = rows.filter((r) => r.item.all_correct).length;
  const unscoredCount = rows.filter((r) => r.verdict === "unscored").length;

  return (
    <div className="px-4 pb-10 pt-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">模試結果</p>
      <h1 className="mb-4 text-xl font-bold">{title}</h1>

      <ScoreCard result={result} />

      {(allCorrectCount > 0 || unscoredCount > 0) && (
        <div className="mt-3 rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {allCorrectCount > 0 && (
            <p>全員正解問題が {allCorrectCount} 件あります(選択に関わらず加点)。</p>
          )}
          {unscoredCount > 0 && (
            <p>採点対象外の設問が {unscoredCount} 件あります(得点・満点の双方から除外)。</p>
          )}
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-bold text-slate-600 dark:text-slate-300">
        問題別の正誤({result.nCorrect}/{result.nTotal} 正解)
      </h2>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <ResultRow key={r.key} row={r} />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <button
          type="button"
          disabled={restarting}
          onClick={handleRestart}
          className="rounded-xl bg-blue-600 py-3 text-center font-bold text-white active:bg-blue-700 disabled:opacity-60"
        >
          {restarting ? "準備中…" : "もう一度この模試を解く"}
        </button>
        <Link
          to="/exam"
          className="rounded-xl border border-slate-300 py-3 text-center font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          模試選択へ
        </Link>
      </div>
    </div>
  );
}

function ScoreCard({ result }: { result: ExamResult }) {
  const pct = Math.round(result.ratio * 1000) / 10;
  const verdict = result.passed
    ? { label: "科目合格(60%以上)", cls: "bg-emerald-500" }
    : result.belowFloor
      ? { label: "足切り(40%未満)", cls: "bg-rose-600" }
      : { label: "不合格(40%以上60%未満)", cls: "bg-amber-500" };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-end justify-center gap-1">
        <span className="text-5xl font-bold tabular-nums">{result.score}</span>
        <span className="mb-1 text-lg text-slate-400">/ {result.maxScore} 点</span>
      </div>
      <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
        正答率 {pct}%({result.nCorrect} / {result.nTotal} 設問)
      </p>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full ${verdict.cls}`}
          style={{ width: `${Math.min(100, Math.max(0, result.ratio * 100))}%` }}
        />
      </div>
      <p
        className={`mt-4 rounded-xl py-2.5 text-center text-base font-bold text-white ${verdict.cls}`}
      >
        {verdict.label}
      </p>
    </div>
  );
}

function ResultRow({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const { question, item, subLabel, selected, verdict } = row;

  const badge =
    verdict === "correct"
      ? { text: "正解", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" }
      : verdict === "wrong"
        ? { text: "不正解", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" }
        : { text: "対象外", cls: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left active:bg-slate-50 dark:bg-slate-900 dark:active:bg-slate-800"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          第{question.q}問{subLabel ? ` ${subLabel}` : ""}
          {item.all_correct && (
            <span className="ml-2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              全員正解
            </span>
          )}
        </span>
        <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>
          {badge.text}
        </span>
        <span className="flex-none text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          {question.lead && (
            <p className="mb-2 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
              {question.lead}
            </p>
          )}
          <p className="mb-3 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
            {item.stem}
          </p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(item.choices).map(([key, text]) => {
              const isAnswer = item.answer !== null && key === item.answer;
              const isSelected = key === selected;
              let cls =
                "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
              if (isAnswer)
                cls =
                  "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200";
              else if (isSelected)
                cls =
                  "border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200";
              return (
                <div
                  key={key}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}
                >
                  <span className="font-bold">{key}</span>
                  <span className="whitespace-pre-wrap break-words">{text}</span>
                  <span className="ml-auto flex-none text-xs font-bold">
                    {isAnswer ? "正解" : isSelected ? "あなた" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            あなたの解答: {selected ?? "未解答"} / 正解:{" "}
            {item.all_correct ? "全員正解" : (item.answer ?? "非公表")}
          </p>
        </div>
      )}
    </div>
  );
}
