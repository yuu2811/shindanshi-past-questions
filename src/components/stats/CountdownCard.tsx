import { useEffect, useState } from "react";
import { daysUntil } from "../../lib/jst";

interface CountdownCardProps {
  /** 試験名 (例: "1次試験") */
  label: string;
  /** 試験日 epoch ms (src/lib/jst.ts の EXAM_DATE_1JI / EXAM_DATE_2JI を渡す) */
  examEpochMs: number;
  /** ラベル下に添える補足 (例: "1日目") */
  sublabel?: string;
  /** false の場合「予定・未確定」バッジを表示する (公式未発表の推定日程用) */
  confirmed?: boolean;
}

const JST_TZ = "Asia/Tokyo";

function formatExamDate(epochMs: number): string {
  // 表示専用の整形。カウントダウンの日数計算自体は必ず daysUntil() を使う
  // (端末タイムゾーンに依存させない = JSTバグ防止)。
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: JST_TZ,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(epochMs));
}

/**
 * 試験日カウントダウンカード。再利用可能(統計ページ・ホーム画面で使用予定)。
 * 日付をまたいでも表示が更新されるよう、1分おきに現在時刻を再取得する。
 */
export function CountdownCard({
  label,
  examEpochMs,
  sublabel,
  confirmed = true,
}: CountdownCardProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const days = daysUntil(examEpochMs, now);
  const passed = days < 0;
  const urgent = !passed && days <= 7;

  return (
    <div
      className={`rounded-2xl border p-3 ${
        urgent
          ? "border-red-300 bg-red-50 dark:border-red-800/70 dark:bg-red-950/40"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center gap-1">
        <p className="truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {!confirmed && (
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            予定・未確定
          </span>
        )}
      </div>
      <p
        className={`mt-0.5 text-2xl font-extrabold tabular-nums ${
          urgent ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-50"
        }`}
      >
        {passed ? "終了" : `残り${days}日`}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
        {formatExamDate(examEpochMs)}
        {sublabel ? ` ・ ${sublabel}` : ""}
      </p>
    </div>
  );
}
