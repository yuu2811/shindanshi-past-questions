// 今日の復習: SM-2 で期日到来した設問の件数を表示し、演習セッション(?review=1)へ導く。
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDueCount } from "../../features/practice/review";

export default function ReviewPage() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getDueCount(Date.now())
      .then((c) => {
        if (!ignore) setCount(c);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <h1 className="text-xl font-bold">今日の復習</h1>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {!error && count === null && (
        <p className="text-sm text-slate-500 dark:text-slate-400">読み込み中…</p>
      )}

      {!error && count !== null && count > 0 && (
        <>
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-white px-8 py-6 dark:bg-slate-900">
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{count}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">件、復習期日が到来しています</p>
          </div>
          <Link
            to="/practice/session?review=1"
            className="mt-2 w-full max-w-xs rounded-xl bg-blue-600 px-4 py-3 text-center text-lg font-bold text-white active:bg-blue-700"
          >
            復習を始める
          </Link>
        </>
      )}

      {!error && count === 0 && (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-3xl">🎉</p>
          <p className="font-semibold">今日の復習はありません</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            演習を進めると、SM-2アルゴリズムで最適な復習タイミングが提示されます。
          </p>
          <Link
            to="/practice"
            className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900"
          >
            演習をする
          </Link>
        </div>
      )}
    </div>
  );
}
