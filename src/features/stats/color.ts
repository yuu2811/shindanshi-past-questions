// 正答率 → 色 のマッピング(ヒートマップ・統計ページ共通)。
// HSL の色相を 0(赤)〜120(緑) で線形に振ることで赤黄緑のグラデーションを作る。
// 外部チャート/カラースケールライブラリは使わず自前実装。

/** 正答率(0-1) を CSS 色文字列に変換する。未演習(null)はグレー */
export function accuracyColor(ratio: number | null): string {
  if (ratio === null) return "rgb(148, 163, 184)"; // slate-400
  const clamped = Math.min(1, Math.max(0, ratio));
  const hue = Math.round(clamped * 120); // 0=赤(低) 60=黄 120=緑(高)
  return `hsl(${hue}, 70%, 45%)`;
}
