// 全文検索: 1次(問題文・選択肢・タグ)+2次(与件文・設問)を対象とした部分一致検索。
// 検索処理は Web Worker (search.worker.ts) で行い、UIスレッドを塞がない。
// 過去問本文はすべて端末内で処理し、外部へは一切送信しない。
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../db/db";
import type { Question1ji } from "../../types/data";
import { itemKey } from "../../types/study";
import { QuestionCard } from "../../components/question/QuestionCard";
import { useSearchWorker } from "./useSearchWorker";
import type { SearchHit } from "../../workers/search.types";

function Snippet({ hit }: { hit: SearchHit }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-400">
      {hit.before}
      <mark className="rounded bg-yellow-200 px-0.5 text-slate-900 dark:bg-yellow-500/40 dark:text-slate-100">
        {hit.match}
      </mark>
      {hit.after}
    </p>
  );
}

function Question1jiResult({ hit }: { hit: SearchHit }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState<Question1ji | null>(null);
  const [selections, setSelections] = useState<Record<string, string | null>>({});
  const loadedRef = useRef(false);

  function toggle() {
    setOpen((v) => !v);
    if (!loadedRef.current) {
      loadedRef.current = true;
      void db.questions.get(hit.doc.id).then((q) => {
        if (q) setQuestion(q);
      });
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button type="button" onClick={toggle} className="flex w-full flex-col gap-1.5 px-4 py-3 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
            1次
          </span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {hit.doc.badgeMain}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {hit.doc.yearLabel}年度 {hit.doc.badgeSub}
          </span>
        </div>
        <Snippet hit={hit} />
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          {question === null ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">読み込み中…</p>
          ) : (
            <>
              {question.items.map((item) => {
                const key = itemKey(question.id, item.sub);
                return (
                  <QuestionCard
                    key={key}
                    question={question}
                    item={item}
                    subLabel={question.items.length > 1 ? `設問${item.sub ?? ""}` : null}
                    selected={selections[key] ?? null}
                    onAnswer={(choice) =>
                      setSelections((prev) => ({ ...prev, [key]: choice }))
                    }
                  />
                );
              })}
              <div className="px-4 pb-4">
                <Link
                  to={`/practice/session?examId=${encodeURIComponent(question.exam_id)}`}
                  className="text-sm font-semibold text-blue-600 underline dark:text-blue-400"
                >
                  この試験(全問)で演習する →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Case2jiResult({ hit }: { hit: SearchHit }) {
  const caseId = hit.doc.caseId ?? "";
  const to = hit.doc.q > 0 ? `/niji/${caseId}?q=${hit.doc.q}` : `/niji/${caseId}`;
  return (
    <Link
      to={to}
      className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          2次
        </span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {hit.doc.badgeMain}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {hit.doc.yearLabel}年度 {hit.doc.badgeSub}
        </span>
      </div>
      <Snippet hit={hit} />
    </Link>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { status, errorMessage, hits, total, searching } = useSearchWorker(query);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="text-lg font-bold">全文検索</h1>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キーワードを入力(問題文・与件文・タグなど)"
        autoComplete="off"
        className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      {status === "loading" && (
        <p className="text-sm text-slate-500 dark:text-slate-400">検索インデックスを構築中…</p>
      )}
      {status === "error" && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          検索の初期化に失敗しました: {errorMessage}
        </p>
      )}

      {status === "ready" && query.trim() === "" && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          1次問題(問題文・選択肢・タグ)と2次(与件文・設問)を対象に検索します。
        </p>
      )}

      {status === "ready" && query.trim() !== "" && (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {searching ? "検索中…" : `${total}件中 ${hits.length}件を表示`}
          </p>
          <div className="flex flex-col gap-2">
            {hits.map((hit) =>
              hit.doc.kind === "1ji" ? (
                <Question1jiResult key={hit.doc.id} hit={hit} />
              ) : (
                <Case2jiResult key={hit.doc.id} hit={hit} />
              ),
            )}
            {!searching && hits.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                一致する結果がありません。
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
