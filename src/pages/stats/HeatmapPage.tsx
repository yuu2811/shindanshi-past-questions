import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../db/db";
import { fetchTaxonomy } from "../../data/loader";
import { SUBJECT_CODES, SUBJECT_NAMES, type Taxonomy1ji } from "../../types/data";
import type { Attempt } from "../../types/study";
import { accuracy, aggregateByTag, tagKey, type Agg } from "../../features/stats/aggregate";
import { accuracyColor } from "../../features/stats/color";

/** タクソノミに含まれないタグ (keyword_v1 の無一致既定値) */
const UNCLASSIFIED_TAG = "未分類";

export default function HeatmapPage() {
  const [taxonomy, setTaxonomy] = useState<Taxonomy1ji | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchTaxonomy(), db.attempts.toArray()])
      .then(([tax, atts]) => {
        if (!alive) return;
        setTaxonomy(tax);
        setAttempts(atts);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const aggMap = useMemo(() => (attempts ? aggregateByTag(attempts) : null), [attempts]);

  if (error) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">読み込みエラー</p>
        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{error}</p>
      </div>
    );
  }

  if (!taxonomy || !aggMap) {
    return (
      <div className="px-4 py-16 text-center text-sm text-slate-400 dark:text-slate-500">
        読み込み中…
      </div>
    );
  }

  const totalAttempts = attempts?.length ?? 0;

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="text-lg font-bold">弱点ヒートマップ</h1>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        論点タグをタップすると、その論点の演習を開始します。
      </p>

      {totalAttempts === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          まだ解答履歴がありません。演習を重ねると、ここに論点別の得意・不得意が表示されます。
        </div>
      )}

      <div className="mt-4 space-y-6">
        {SUBJECT_CODES.map((code) => {
          const subj = taxonomy.subjects[code];
          if (!subj) return null;
          const unclassified = aggMap.get(tagKey(code, UNCLASSIFIED_TAG));
          return (
            <section key={code}>
              <h2 className="sticky top-0 z-10 -mx-4 bg-slate-100/95 px-4 py-1 text-xs font-bold text-slate-600 backdrop-blur dark:bg-slate-950/95 dark:text-slate-300">
                {code}. {SUBJECT_NAMES[code]}
              </h2>
              <div className="mt-1 divide-y divide-slate-200/70 dark:divide-slate-800">
                {subj.topics.map((t) => (
                  <TagRow key={t.tag} subject={code} tag={t.tag} agg={aggMap.get(tagKey(code, t.tag)) ?? { total: 0, correct: 0 }} />
                ))}
                {unclassified && (
                  <TagRow subject={code} tag={UNCLASSIFIED_TAG} agg={unclassified} muted />
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TagRow({
  subject,
  tag,
  agg,
  muted,
}: {
  subject: string;
  tag: string;
  agg: Agg;
  muted?: boolean;
}) {
  const navigate = useNavigate();
  const ratio = accuracy(agg);
  const color = accuracyColor(ratio);
  const pctLabel = ratio === null ? "未演習" : `${Math.round(ratio * 100)}%`;

  return (
    <button
      type="button"
      onClick={() => navigate(`/practice/session?tag=${encodeURIComponent(tag)}`)}
      className="flex w-full items-center gap-2 px-1 py-2 text-left active:bg-slate-200/60 dark:active:bg-slate-800/60"
      aria-label={`${subject} ${tag} 正答率${pctLabel} ${agg.total}件 演習へ`}
    >
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-800 dark:text-slate-100">
        {muted && <span className="mr-1 text-slate-400 dark:text-slate-500">(他)</span>}
        {tag}
      </span>
      <span className="relative h-4 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        {ratio !== null && (
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.max(8, ratio * 100)}%`, backgroundColor: color }}
          />
        )}
      </span>
      <span
        className="w-10 shrink-0 text-right text-[11px] font-bold tabular-nums"
        style={{ color: ratio === null ? undefined : color }}
      >
        {pctLabel}
      </span>
      <span className="w-8 shrink-0 text-right text-[10px] text-slate-400 dark:text-slate-500">
        {agg.total}件
      </span>
    </button>
  );
}
