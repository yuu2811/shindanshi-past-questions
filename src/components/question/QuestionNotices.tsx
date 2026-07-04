// データ品質に関する注記ブロック群 (REQUIREMENTS §6 / CLAUDE.md「データの扱い」)。
// 原文確認の導線は必ず外部リンクへ — アプリ側で問題文を書き換えない方針の裏返し。

/** parse_status: "needs_review" (1次72問) — 原文確認ボタンを必ず表示 */
export function NeedsReviewNotice({ sourcePdfUrl }: { sourcePdfUrl?: string }) {
  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm dark:border-rose-700/60 dark:bg-rose-950/30">
      <p className="mb-2 font-semibold text-rose-800 dark:text-rose-300">
        この問題は自動抽出の要確認項目です(内容の正確性を原本と照合してください)
      </p>
      {sourcePdfUrl ? (
        <a
          href={sourcePdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white active:bg-rose-700"
        >
          原文を確認する(原本PDF)
        </a>
      ) : (
        <p className="text-rose-700 dark:text-rose-300">原本PDFのリンクがありません。</p>
      )}
    </div>
  );
}

/** 本文中の未解決グリフ「〓」の注記 */
export function GlyphNotice({ sourcePdfUrl }: { sourcePdfUrl?: string }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
      <p>〓 は原本の図中記号等です。原文を確認してください。</p>
      {sourcePdfUrl && (
        <a href={sourcePdfUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block underline">
          原本PDFを見る
        </a>
      )}
    </div>
  );
}

/** 全員正解問題バッジ */
export function AllCorrectBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      全員正解問題
    </span>
  );
}
