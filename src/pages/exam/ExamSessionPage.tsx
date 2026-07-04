// 模試セッション: 本番同一構成で全問を問番号順に出題。制限時間カウントダウン、
// 解答の随時永続化、問題ナビ、時間切れ自動採点、終了→採点→結果画面へ。
// 採点前に正誤・正解は一切見せない(ExamQuestionView が保証)。
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getQuestionsForExam } from "../../data/queries";
import { isScorable } from "../../lib/scoring";
import {
  getExamSession,
  finishExamSession,
  persistProgress,
  computeElapsedSec,
} from "../../features/exam/session";
import { ExamQuestionView } from "../../features/exam/ExamQuestionView";
import { useExamCountdown, formatClock } from "../../features/exam/useExamCountdown";
import { itemKey } from "../../types/study";
import type { ExamSession } from "../../types/study";
import type { Question1ji } from "../../types/data";

const WARN_THRESHOLD_SEC = 300; // 残り5分で警告色
const PERSIST_INTERVAL_MS = 5000;

type Answers = Record<string, string | null>;

/** 1問の解答状況(グリッド色分け用)。 */
function questionState(q: Question1ji, answers: Answers): "none" | "partial" | "done" {
  let answered = 0;
  for (const item of q.items) {
    if ((answers[itemKey(q.id, item.sub)] ?? null) !== null) answered += 1;
  }
  if (answered === 0) return "none";
  if (answered === q.items.length) return "done";
  return "partial";
}

/** 未解答(得点に影響する = 採点対象かつ全員正解でない設問のうち未選択)の件数。 */
function countUnanswered(questions: Question1ji[], answers: Answers): number {
  let n = 0;
  for (const q of questions) {
    for (const item of q.items) {
      if (!isScorable(item) || item.all_correct) continue;
      if ((answers[itemKey(q.id, item.sub)] ?? null) === null) n += 1;
    }
  }
  return n;
}

export default function ExamSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question1ji[] | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showNav, setShowNav] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // イベントハンドラ(pagehide/visibilitychange)から最新値を参照するための ref。
  const answersRef = useRef<Answers>({});
  const sessionRef = useRef<ExamSession | null>(null);
  const questionsRef = useRef<Question1ji[] | null>(null);
  const finishingRef = useRef(false);
  answersRef.current = answers;
  sessionRef.current = session;
  questionsRef.current = questions;

  // --- ロード ---------------------------------------------------------------
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
      if (s.status === "finished") {
        navigate(`/exam/result/${sessionId}`, { replace: true });
        return;
      }
      if (s.status === "abandoned") {
        setError("この模試は破棄されています。");
        return;
      }
      const qs = await getQuestionsForExam(s.examId);
      if (ignore) return;
      setSession(s);
      setAnswers(s.answers ?? {});
      setQuestions(qs);
    })().catch((e: unknown) => {
      if (!ignore) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      ignore = true;
    };
  }, [sessionId, navigate]);

  // --- 採点して結果へ -------------------------------------------------------
  const doFinish = useCallback(() => {
    const s = sessionRef.current;
    const qs = questionsRef.current;
    if (!s || !qs || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    // 最新の解答をマージしたセッションで採点する。
    const merged: ExamSession = { ...s, answers: answersRef.current };
    finishExamSession(merged, qs, Date.now())
      .then(() => {
        navigate(`/exam/result/${s.id}`, { replace: true });
      })
      .catch((e: unknown) => {
        finishingRef.current = false;
        setFinishing(false);
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [navigate]);

  // --- タイマー(時間切れで自動採点) --------------------------------------
  const { remainingSec } = useExamCountdown(
    session ? session.startedAt : null,
    session ? session.durationSec : 0,
    doFinish,
  );

  // --- 経過秒の定期永続化 + バックグラウンド遷移時の保存 --------------------
  const saveNow = useCallback(() => {
    const s = sessionRef.current;
    if (!s || finishingRef.current) return;
    const elapsed = computeElapsedSec(s.startedAt, s.durationSec, Date.now());
    void persistProgress(s.id, answersRef.current, elapsed);
  }, []);

  useEffect(() => {
    if (!session) return;
    const iv = window.setInterval(saveNow, PERSIST_INTERVAL_MS);
    const onHide = () => saveNow();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      saveNow();
    };
  }, [session, saveNow]);

  // --- 解答 -----------------------------------------------------------------
  const handleSelect = useCallback(
    (key: string, choice: string | null) => {
      setAnswers((prev) => {
        const next = { ...prev, [key]: choice };
        const s = sessionRef.current;
        if (s && !finishingRef.current) {
          const elapsed = computeElapsedSec(s.startedAt, s.durationSec, Date.now());
          void persistProgress(s.id, next, elapsed);
        }
        return next;
      });
    },
    [],
  );

  // --- 描画 -----------------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-lg font-bold text-rose-600 dark:text-rose-400">読み込みエラー</p>
        <p className="break-all text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Link to="/exam" className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-white">
          模試選択に戻る
        </Link>
      </div>
    );
  }

  if (!session || !questions) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 dark:border-slate-700 dark:border-t-slate-200" />
        <p className="text-sm text-slate-500 dark:text-slate-400">模試を読み込み中…</p>
      </div>
    );
  }

  const current = questions[index];
  const unanswered = countUnanswered(questions, answers);
  const warn = remainingSec <= WARN_THRESHOLD_SEC;

  return (
    <div className="flex flex-col">
      {/* ヘッダ: タイマー + ナビ切替 */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          第{current ? current.q : "-"}問 <span className="text-slate-400">/ {questions.length}問</span>
        </span>
        <div
          className={`rounded-lg px-3 py-1 font-mono text-lg font-bold tabular-nums ${
            warn
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          }`}
          aria-label="残り時間"
        >
          {formatClock(remainingSec)}
        </div>
        <button
          type="button"
          onClick={() => setShowNav((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          一覧
        </button>
      </div>

      {/* 問題ナビ・グリッド */}
      {showNav && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            タップでジャンプ。<span className="text-blue-600 dark:text-blue-400">■</span>解答済{" "}
            <span className="text-amber-500">■</span>一部{" "}
            <span className="text-slate-400">■</span>未解答
          </p>
          <div className="grid grid-cols-8 gap-1.5">
            {questions.map((q, i) => {
              const st = questionState(q, answers);
              const cls =
                st === "done"
                  ? "bg-blue-600 text-white"
                  : st === "partial"
                    ? "bg-amber-400 text-amber-950"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setShowNav(false);
                  }}
                  className={`aspect-square rounded-md text-xs font-bold ${cls} ${
                    i === index ? "ring-2 ring-slate-900 dark:ring-white" : ""
                  }`}
                >
                  {q.q}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 問題本体 */}
      {current ? (
        <ExamQuestionView question={current} answers={answers} onSelect={handleSelect} />
      ) : (
        <p className="px-4 py-16 text-center text-sm text-slate-500">問題がありません</p>
      )}

      {/* フッタ: 前/次 + 採点 */}
      <div className="mt-2 flex flex-col gap-2 px-4 pb-8">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            ← 前の問題
          </button>
          <button
            type="button"
            disabled={index >= questions.length - 1}
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            次の問題 →
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="rounded-xl bg-emerald-600 py-3 text-center font-bold text-white active:bg-emerald-700"
        >
          終了して採点
        </button>
      </div>

      {/* 採点確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-slate-900">
            <h2 className="text-lg font-bold">模試を終了して採点しますか?</h2>
            {unanswered > 0 ? (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                未解答が {unanswered} 件あります。未解答は不正解として採点されます。
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                すべての設問に解答済みです。
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold dark:border-slate-700"
              >
                戻る
              </button>
              <button
                type="button"
                disabled={finishing}
                onClick={doFinish}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {finishing ? "採点中…" : "採点する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
