// 自己評価4段階 (SM-2 品質値へのマッピングは src/lib/sm2.ts 側で行う)。
import type { SelfRating } from "../../types/study";

const RATINGS: { value: SelfRating; label: string; classes: string }[] = [
  {
    value: "again",
    label: "もう一度",
    classes: "bg-rose-600 active:bg-rose-700",
  },
  {
    value: "hard",
    label: "難しい",
    classes: "bg-orange-500 active:bg-orange-600",
  },
  {
    value: "good",
    label: "普通",
    classes: "bg-blue-600 active:bg-blue-700",
  },
  {
    value: "easy",
    label: "簡単",
    classes: "bg-emerald-600 active:bg-emerald-700",
  },
];

export function SelfRatingBar({ onRate }: { onRate: (rating: SelfRating) => void }) {
  return (
    <div>
      <p className="mb-2 text-center text-xs text-slate-500 dark:text-slate-400">
        この問題の手応えは?(次回の出題タイミングに反映されます)
      </p>
      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onRate(r.value)}
            className={`rounded-xl px-2 py-3 text-sm font-bold text-white ${r.classes}`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
