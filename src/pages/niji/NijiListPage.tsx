// 2次事例一覧: 年度降順 × 事例I〜IV。タップで /niji/:caseId へ。
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../db/db";
import type { Case2ji } from "../../types/data";

const CASE_ORDER = ["A", "B", "C", "D"];

function groupByYear(cases: Case2ji[]): [number, Case2ji[]][] {
  const map = new Map<number, Case2ji[]>();
  for (const c of cases) {
    const list = map.get(c.year) ?? [];
    list.push(c);
    map.set(c.year, list);
  }
  const years = [...map.keys()].sort((a, b) => b - a);
  return years.map((y) => {
    const list = [...(map.get(y) ?? [])].sort(
      (a, b) => CASE_ORDER.indexOf(a.case) - CASE_ORDER.indexOf(b.case),
    );
    return [y, list];
  });
}

export default function NijiListPage() {
  const [cases, setCases] = useState<Case2ji[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    db.cases
      .toArray()
      .then((list) => {
        if (active) setCases(list);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">2次試験 事例一覧</h1>
        <Link
          to="/search"
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 active:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:active:bg-slate-800"
        >
          🔎 検索
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          読み込みエラー: {error}
        </p>
      )}

      {!error && cases === null && (
        <p className="text-sm text-slate-500 dark:text-slate-400">読み込み中…</p>
      )}

      {cases !== null && cases.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          事例データが見つかりません。
        </p>
      )}

      {cases !== null &&
        groupByYear(cases).map(([year, list]) => (
          <section key={year} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400">{year}年度</h2>
            <div className="grid grid-cols-2 gap-2">
              {list.map((c) => (
                <Link
                  key={c.id}
                  to={`/niji/${c.id}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:active:bg-slate-800"
                >
                  {c.case_name}
                </Link>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
