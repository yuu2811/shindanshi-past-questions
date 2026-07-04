// 演習セッション。URLクエリ契約 (他エージェントも依存する固定インタフェース):
//   ?examId=1ji-2024-B   年度別(試験1回分を問番号順に出題)
//   ?tag=民法            論点タグ別(該当タグの全問題を年度順に出題)
//   ?review=1            今日の復習キュー(db.srs の期日到来アイテム)
// 1問(1設問)ずつ表示 → 選択肢タップで解答 → 即時正誤+自己評価4段階 → 次の問題。
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { QuestionCard } from "../../components/question/QuestionCard";
import { SelfRatingBar } from "../../components/question/SelfRatingBar";
import { buildQueueForExam, buildQueueForTag, type QueueItem } from "../../features/practice/queue";
import { buildQueueForReview } from "../../features/practice/review";
import { applyRating, recordAttempt } from "../../features/practice/recordAttempt";
import { yearLabel } from "../../types/data";
import type { SelfRating } from "../../types/study";

interface SessionResult {
  queueItem: QueueItem;
  selected: string | null;
  correct: boolean;
}

type SessionKind = "exam" | "tag" | "review";

interface SessionSpec {
  kind: SessionKind;
  /** 表示用ラベル (年度別/タグ別/復習) */
  label: string;
  /** キュー取得不能時の戻り先 */
  backTo: string;
}

export default function PracticeSessionPage() {
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId");
  const tag = searchParams.get("tag");
  const isReview = searchParams.get("review") === "1";

  const spec: SessionSpec | null = useMemo(() => {
    if (isReview) return { kind: "review", label: "今日の復習", backTo: "/review" };
    if (examId) return { kind: "exam", label: `${examId}`, backTo: "/practice" };
    if (tag) return { kind: "tag", label: tag, backTo: "/practice" };
    return null;
  }, [isReview, examId, tag]);

  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);

  useEffect(() => {
    if (!spec) return;
    let ignore = false;
    setQueue(null);
    setError(null);
    setIndex(0);
    setSelected(null);
    setAttemptId(null);
    setResults([]);

    const load = async (): Promise<QueueItem[]> => {
      if (spec.kind === "review") return buildQueueForReview(Date.now());
      if (spec.kind === "exam" && examId) return buildQueueForExam(examId);
      if (spec.kind === "tag" && tag) return buildQueueForTag(tag);
      return [];
    };

    load()
      .then((q) => {
        if (!ignore) setQueue(q);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      ignore = true;
    };
  }, [spec, examId, tag]);

  if (!spec) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
          出題パラメータが指定されていません
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          examId / tag / review のいずれかをクエリで指定してください。
        </p>
        <Link to="/practice" className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-white">
          演習選択に戻る
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-bold text-rose-600 dark:text-rose-400">読み込みエラー</p>
        <p className="break-all text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link to={spec.backTo} className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-white">
          戻る
        </Link>
      </div>
    );
  }

  if (queue === null) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 dark:border-slate-700 dark:border-t-slate-200" />
        <p className="text-sm text-slate-500 dark:text-slate-400">問題を読み込み中…</p>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-bold">対象の問題がありません</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {spec.kind === "review"
            ? "現在、復習期日が到来している問題はありません。"
            : "この条件に一致する問題が見つかりませんでした。"}
        </p>
        <Link to={spec.backTo} className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-white">
          戻る
        </Link>
      </div>
    );
  }

  const mode = spec.kind === "review" ? "review" : "practice";

  const handleAnswer = (choice: string) => {
    const current = queue[index];
    if (!current || selected !== null) return;
    setSelected(choice);
    recordAttempt({
      question: current.question,
      item: current.item,
      selected: choice,
      mode,
      now: Date.now(),
    })
      .then(({ attemptId: id, correct }) => {
        setAttemptId(id);
        setResults((prev) => [...prev, { queueItem: current, selected: choice, correct }]);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  };

  const handleRate = (rating: SelfRating) => {
    const current = queue[index];
    if (!current || attemptId === null) return;
    applyRating({
      attemptId,
      question: current.question,
      item: current.item,
      rating,
      now: Date.now(),
    })
      .then(() => {
        setIndex((i) => i + 1);
        setSelected(null);
        setAttemptId(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  };

  if (index >= queue.length) {
    return <SessionSummaryView results={results} backTo={spec.backTo} />;
  }

  const current = queue[index];
  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-bold text-rose-600 dark:text-rose-400">内部エラー</p>
        <Link to={spec.backTo} className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-white">
          戻る
        </Link>
      </div>
    );
  }
  const subLabel = current.question.items.length > 1 ? `設問${current.item.sub ?? ""}` : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-4 pt-2">
        <Link
          to={spec.backTo}
          className="text-sm text-slate-400 hover:text-slate-600 dark:text-slate-500"
          aria-label="演習を終了する"
        >
          ✕ 終了
        </Link>
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${((index + 1) / queue.length) * 100}%` }}
        />
      </div>

      <QuestionCard
        question={current.question}
        item={current.item}
        subLabel={subLabel}
        selected={selected}
        onAnswer={handleAnswer}
      />

      {selected !== null && (
        <div className="px-4 pb-6">
          <SelfRatingBar onRate={handleRate} />
        </div>
      )}
    </div>
  );
}

function SessionSummaryView({
  results,
  backTo,
}: {
  results: SessionResult[];
  backTo: string;
}) {
  const total = results.length;
  const nCorrect = results.filter((r) => r.correct).length;
  const wrong = results.filter((r) => !r.correct);

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-bold">セッション終了</h1>
      <div className="rounded-xl bg-white p-5 text-center dark:bg-slate-900">
        <p className="text-3xl font-bold">
          {nCorrect} <span className="text-lg text-slate-400">/ {total}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">正答数 / 問題数</p>
      </div>

      {wrong.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-300">
            間違えた問題({wrong.length}件)
          </h2>
          <div className="flex flex-col gap-2">
            {wrong.map((r) => {
              const { question, item } = r.queueItem;
              const subLabel = question.items.length > 1 ? `設問${item.sub ?? ""}` : "";
              return (
                <div
                  key={r.queueItem.itemKey}
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-800/60 dark:bg-rose-950/30"
                >
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {question.subject_name} {yearLabel(question.year, question.reexam)}年度 第
                    {question.q}問{subLabel && ` ${subLabel}`}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                    {item.stem}
                  </p>
                  <p className="mt-1 text-rose-700 dark:text-rose-300">
                    あなたの解答: {r.selected ?? "未回答"} / 正解: {item.answer ?? "非公表"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Link
        to={backTo}
        className="mt-2 rounded-xl bg-blue-600 px-4 py-3 text-center font-bold text-white active:bg-blue-700"
      >
        演習選択に戻る
      </Link>
    </div>
  );
}
