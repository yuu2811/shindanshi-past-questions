// 図表フラグ問題(468問, 21%)の頁画像表示。
// REQUIREMENTS §5.3: 該当頁画像を遅延ロードで併載。scripts/extract_figures.py が
// public/figures/{qid}_p{page:02d}.png を生成する想定だが、未生成環境では404になるため
// フォールバックで原本PDFへの外部リンクを出す(データ欠損を隠さない = Fail Loud)。
import { useMemo, useState } from "react";

export interface FigureBlockProps {
  qid: string;
  pages: number[];
  sourcePdfUrl?: string;
}

function pageRange(pages: number[]): number[] {
  if (pages.length === 0) return [];
  const start = pages[0];
  const end = pages[pages.length - 1];
  if (start === undefined || end === undefined || end < start) return [];
  const out: number[] = [];
  for (let p = start; p <= end; p++) out.push(p);
  return out;
}

function FigureImage({
  src,
  alt,
  onError,
}: {
  src: string;
  alt: string;
  onError: () => void;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-full rounded-lg border border-amber-200 bg-white dark:border-amber-800/60"
      onError={() => {
        setBroken(true);
        onError();
      }}
    />
  );
}

export function FigureBlock({ qid, pages, sourcePdfUrl }: FigureBlockProps) {
  const pageNumbers = useMemo(() => pageRange(pages), [pages]);
  const [brokenCount, setBrokenCount] = useState(0);
  const allBroken = pageNumbers.length === 0 || brokenCount >= pageNumbers.length;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/60 dark:bg-amber-950/30">
      <p className="mb-2 font-semibold text-amber-800 dark:text-amber-300">
        図表あり — この問題には図・グラフ・表が含まれます
      </p>
      {!allBroken && (
        <div className="space-y-2">
          {pageNumbers.map((p) => (
            <FigureImage
              key={p}
              src={`/figures/${qid}_p${String(p).padStart(2, "0")}.png`}
              alt={`${qid} ${p}ページ目の図表`}
              onError={() => setBrokenCount((c) => c + 1)}
            />
          ))}
        </div>
      )}
      {allBroken && (
        <p className="text-amber-800 dark:text-amber-300">
          図表画像は未生成です。
          {sourcePdfUrl ? (
            <>
              {" "}
              <a
                href={sourcePdfUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                原本PDFを参照
              </a>
            </>
          ) : (
            "原本PDFのリンクがありません。"
          )}
        </p>
      )}
    </div>
  );
}
