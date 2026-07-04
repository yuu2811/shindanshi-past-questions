import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CountdownCard } from "../components/stats/CountdownCard";
import { getDueCount } from "../features/practice/review";
import { EXAM_DATE_1JI, EXAM_DATE_2JI, EXAM_DATE_CONFIRMED, jstStartOfDay } from "../lib/jst";
import { db } from "../db/db";

interface HomeSummary {
  dueCount: number;
  todayCount: number;
  hasExamInProgress: boolean;
}

/** 本日(JST)0時以降の解答数・復習期日件数・中断中模試の有無を集計 */
async function loadSummary(): Promise<HomeSummary> {
  const now = Date.now();
  const [dueCount, todayCount, inProgress] = await Promise.all([
    getDueCount(now),
    db.attempts.where("answeredAt").aboveOrEqual(jstStartOfDay(now)).count(),
    db.examSessions.where("status").equals("in_progress").count(),
  ]);
  return { dueCount, todayCount, hasExamInProgress: inProgress > 0 };
}

const MENU: { to: string; icon: string; title: string; desc: string }[] = [
  { to: "/practice", icon: "✏️", title: "演習", desc: "科目・年度・論点から選んで解く" },
  { to: "/exam", icon: "⏱", title: "模試", desc: "本番同一構成+制限時間・合否判定" },
  { to: "/stats/heatmap", icon: "🔥", title: "弱点ヒートマップ", desc: "論点×正答率で弱点を把握" },
  { to: "/niji", icon: "📝", title: "2次事例", desc: "与件文・答案下書き・出題の趣旨" },
  { to: "/search", icon: "🔎", title: "検索", desc: "問題文・選択肢・与件文を全文検索" },
];

export default function HomePage() {
  const [summary, setSummary] = useState<HomeSummary | null>(null);

  useEffect(() => {
    loadSummary()
      .then(setSummary)
      .catch((e: unknown) => {
        console.error("ホーム集計に失敗:", e);
        setSummary({ dueCount: 0, todayCount: 0, hasExamInProgress: false });
      });
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-xl font-extrabold">診断士過去問</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {summary ? `今日の解答数: ${summary.todayCount}問` : "…"}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <CountdownCard
          label="1次試験"
          examEpochMs={EXAM_DATE_1JI}
          sublabel="1日目"
          confirmed={EXAM_DATE_CONFIRMED}
        />
        <CountdownCard
          label="2次筆記"
          examEpochMs={EXAM_DATE_2JI}
          confirmed={EXAM_DATE_CONFIRMED}
        />
      </div>

      <Link
        to="/review"
        className="flex items-center justify-between rounded-2xl bg-blue-600 p-4 text-white shadow-sm active:opacity-80"
      >
        <div>
          <p className="text-sm font-bold">今日の復習</p>
          <p className="mt-0.5 text-xs opacity-80">
            {summary === null
              ? "読み込み中…"
              : summary.dueCount > 0
                ? `${summary.dueCount}問が復習期日です`
                : "期日到来の問題はありません"}
          </p>
        </div>
        <span className="text-2xl">📚</span>
      </Link>

      {summary?.hasExamInProgress && (
        <Link
          to="/exam"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-800 active:opacity-80 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          ⏸ 中断中の模試があります — 再開する
        </Link>
      )}

      <nav className="flex flex-col gap-2">
        {MENU.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
          >
            <span className="text-2xl">{m.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold">{m.title}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.desc}</p>
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
}
