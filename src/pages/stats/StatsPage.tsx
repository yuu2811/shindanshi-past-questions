import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../db/db";
import { EXAM_DATE_1JI, EXAM_DATE_2JI, EXAM_DATE_CONFIRMED } from "../../lib/jst";
import { SUBJECT_CODES, SUBJECT_NAMES, type SubjectCode } from "../../types/data";
import type { Attempt } from "../../types/study";
import { CountdownCard } from "../../components/stats/CountdownCard";
import {
  accuracy,
  aggregateByDay,
  aggregateBySubject,
  recentJstDays,
  weeklyAccuracyBySubject,
  type Agg,
} from "../../features/stats/aggregate";
import { accuracyColor } from "../../features/stats/color";

const DAILY_WINDOW_DAYS = 30;
const TREND_WEEKS = 6;

export default function StatsPage() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ページ表示中は固定し、集計対象ウィンドウがレンダー中にずれないようにする
  const [now] = useState<number>(() => Date.now());

  useEffect(() => {
    let alive = true;
    db.attempts
      .toArray()
      .then((a) => {
        if (alive) setAttempts(a);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const days = useMemo(() => recentJstDays(DAILY_WINDOW_DAYS, now), [now]);
  const dayCounts = useMemo(() => (attempts ? aggregateByDay(attempts) : null), [attempts]);
  const subjectAgg = useMemo(() => (attempts ? aggregateBySubject(attempts) : null), [attempts]);

  const hasData = (attempts?.length ?? 0) > 0;

  return (
    <div className="px-4 pb-6 pt-4">
      <h1 className="text-lg font-bold">学習統計</h1>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <CountdownCard
          label="1次試験"
          examEpochMs={EXAM_DATE_1JI}
          sublabel="1日目"
          confirmed={EXAM_DATE_CONFIRMED}
        />
        <CountdownCard
          label="2次筆記試験"
          examEpochMs={EXAM_DATE_2JI}
          confirmed={EXAM_DATE_CONFIRMED}
        />
      </div>

      <Link
        to="/stats/heatmap"
        className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:active:bg-slate-800"
      >
        弱点ヒートマップを見る
        <span aria-hidden="true">›</span>
      </Link>

      {error && (
        <p className="mt-4 break-all text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {attempts !== null && !hasData && !error && (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            まだ演習履歴がありません。演習を始めましょう。
          </p>
          <Link
            to="/practice"
            className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white active:bg-blue-700"
          >
            演習を始める
          </Link>
        </div>
      )}

      {attempts === null && !error && (
        <p className="mt-6 text-center text-sm text-slate-400 dark:text-slate-500">
          読み込み中…
        </p>
      )}

      {hasData && dayCounts && (
        <section className="mt-6">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            日別解答数(直近{DAILY_WINDOW_DAYS}日)
          </h2>
          <DailyBarChart days={days} counts={dayCounts} />
        </section>
      )}

      {hasData && subjectAgg && attempts && (
        <section className="mt-6">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            科目別正答率(累計・直近{TREND_WEEKS}週の推移)
          </h2>
          <div className="mt-2 space-y-2">
            {SUBJECT_CODES.map((code) => (
              <SubjectRow
                key={code}
                code={code}
                agg={subjectAgg.get(code) ?? { total: 0, correct: 0 }}
                trend={weeklyAccuracyBySubject(attempts, code, TREND_WEEKS, now)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DailyBarChart({ days, counts }: { days: string[]; counts: Map<string, number> }) {
  const bars = days.map((d) => ({ d, v: counts.get(d) ?? 0 }));
  const n = bars.length;
  const max = Math.max(1, ...bars.map((b) => b.v));
  const total = bars.reduce((s, b) => s + b.v, 0);

  const chartW = 350;
  const chartH = 70;
  const labelH = 16;
  const gap = 1.5;
  const barW = n > 0 ? (chartW - gap * (n - 1)) / n : 0;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <svg viewBox={`0 0 ${chartW} ${chartH + labelH}`} className="h-24 w-full" role="img" aria-label="日別解答数の棒グラフ">
        {bars.map((b, i) => {
          const h = (b.v / max) * chartH;
          const x = i * (barW + gap);
          const isToday = i === n - 1;
          return (
            <rect
              key={b.d}
              x={x}
              y={chartH - h}
              width={barW}
              height={h}
              rx={1}
              className={isToday ? "fill-blue-500 dark:fill-blue-400" : "fill-slate-300 dark:fill-slate-600"}
            />
          );
        })}
        <text x={0} y={chartH + 12} fontSize={9} className="fill-slate-400 dark:fill-slate-500">
          {formatShortDate(bars[0]?.d)}
        </text>
        <text x={chartW} y={chartH + 12} fontSize={9} textAnchor="end" className="fill-slate-400 dark:fill-slate-500">
          今日
        </text>
      </svg>
      <p className="mt-1 text-right text-[11px] text-slate-400 dark:text-slate-500">
        合計 {total}件 / 直近{n}日
      </p>
    </div>
  );
}

function formatShortDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return dateStr;
  return `${Number(m)}/${Number(d)}`;
}

function SubjectRow({ code, agg, trend }: { code: SubjectCode; agg: Agg; trend: Agg[] }) {
  const ratio = accuracy(agg);
  const color = accuracyColor(ratio);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">
            {code}. {SUBJECT_NAMES[code]}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">{agg.total}問解答</p>
        </div>
        <Sparkline trend={trend} />
        <span
          className="w-12 shrink-0 text-right text-sm font-extrabold tabular-nums"
          style={{ color: ratio === null ? undefined : color }}
        >
          {ratio === null ? "―" : `${Math.round(ratio * 100)}%`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {ratio !== null && (
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(2, ratio * 100)}%`, backgroundColor: color }}
          />
        )}
      </div>
    </div>
  );
}

/** 週別正答率の推移をミニ折れ線で表示。データがない週はプロットしない */
function Sparkline({ trend }: { trend: Agg[] }) {
  const w = 64;
  const h = 24;
  const pad = 3;
  const n = trend.length;

  const present = trend
    .map((agg, i) => ({ i, r: accuracy(agg) }))
    .filter((p): p is { i: number; r: number } => p.r !== null);

  if (present.length === 0) {
    return (
      <span className="w-16 shrink-0 text-center text-[9px] text-slate-300 dark:text-slate-600">
        データ不足
      </span>
    );
  }

  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const y = (r: number) => pad + (1 - r) * (h - 2 * pad);
  const points = present.map((p) => `${x(p.i)},${y(p.r)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className="shrink-0 text-blue-500 dark:text-blue-400"
      role="img"
      aria-label="週別正答率の推移"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {present.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.r)} r={1.6} fill="currentColor" />
      ))}
    </svg>
  );
}
