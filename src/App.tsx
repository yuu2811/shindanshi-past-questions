import { useEffect, useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { ensureDataLoaded } from "./data/loader";
import { AppShell } from "./components/layout/AppShell";
import HomePage from "./pages/HomePage";
import PracticeSelectPage from "./pages/practice/PracticeSelectPage";
import PracticeSessionPage from "./pages/practice/PracticeSessionPage";
import ReviewPage from "./pages/practice/ReviewPage";
import ExamSelectPage from "./pages/exam/ExamSelectPage";
import ExamSessionPage from "./pages/exam/ExamSessionPage";
import ExamResultPage from "./pages/exam/ExamResultPage";
import StatsPage from "./pages/stats/StatsPage";
import HeatmapPage from "./pages/stats/HeatmapPage";
import NijiListPage from "./pages/niji/NijiListPage";
import NijiCasePage from "./pages/niji/NijiCasePage";
import SearchPage from "./pages/search/SearchPage";

// HashRouter: PWA/オフライン/Capacitor で file 配信でも壊れないように
const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/practice", element: <PracticeSelectPage /> },
      { path: "/practice/session", element: <PracticeSessionPage /> },
      { path: "/review", element: <ReviewPage /> },
      { path: "/exam", element: <ExamSelectPage /> },
      { path: "/exam/session/:sessionId", element: <ExamSessionPage /> },
      { path: "/exam/result/:sessionId", element: <ExamResultPage /> },
      { path: "/stats", element: <StatsPage /> },
      { path: "/stats/heatmap", element: <HeatmapPage /> },
      { path: "/niji", element: <NijiListPage /> },
      { path: "/niji/:caseId", element: <NijiCasePage /> },
      { path: "/search", element: <SearchPage /> },
    ],
  },
]);

export default function App() {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState("起動中…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureDataLoaded(setProgress)
      .then(() => setReady(true))
      .catch((e: unknown) => {
        // Fail Loud: データ欠損・スキーマ不一致は隠さず表示する
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-bold text-red-600">データ読み込みエラー</p>
        <p className="break-all text-sm text-slate-600 dark:text-slate-300">{error}</p>
        <button
          className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-white"
          onClick={() => location.reload()}
        >
          再読み込み
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800 dark:border-slate-700 dark:border-t-slate-200" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{progress}</p>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
