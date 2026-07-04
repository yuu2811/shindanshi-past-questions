// 2次学習ビュー: 与件文/設問の対面表示(モバイルはタブ切替)。
// 答案下書きは端末内(IndexedDB)にのみ自動保存し、外部送信は行わない。
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../../db/db";
import { ATTRIBUTION } from "../../types/data";
import type { Case2ji, SourcesShushi } from "../../types/data";
import { fetchSourcesShushi } from "../../data/loader";
import { normalizeCaseQuestions, type NormalizedQuestion } from "../../features/niji/normalize";
import { findJikenBodyStart } from "../../features/niji/jikenBoundary";
import { DraftEditor } from "../../features/niji/DraftEditor";
import { GlyphNotice } from "../../components/question/QuestionNotices";

type Tab = "jiken" | "questions";

const GLYPH_RE = /〓/;

function getSourcePdfUrl(c: Case2ji): string | undefined {
  const v = c.source_pdf;
  return typeof v === "string" ? v : undefined;
}

function charLimitLabel(limits: number[]): string {
  if (limits.length === 0) return "";
  if (limits.length === 1) return `${limits[0] ?? 0}字以内`;
  const total = limits.reduce((a, b) => a + b, 0);
  return `${limits.join("字+")}字(合計${total}字以内)`;
}

function QuestionGroup({
  caseId,
  group,
  registerRef,
}: {
  caseId: string;
  group: NormalizedQuestion;
  registerRef: (q: number, el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={(el) => registerRef(group.q, el)}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          第{group.q}問
        </span>
        {group.points !== null && (
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
            配点 {group.points}点
          </span>
        )}
      </div>

      {group.lead && (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          {group.lead}
        </p>
      )}

      {group.subQuestions.map((sub) => (
        <div key={sub.sub} className="flex flex-col gap-2">
          {sub.label && (
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{sub.label}</p>
          )}
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {sub.stem}
          </p>
          {sub.charLimits.length > 0 && (
            <span className="self-start rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {charLimitLabel(sub.charLimits)}
            </span>
          )}
          <DraftEditor caseId={caseId} q={group.q} sub={sub.sub} totalChars={sub.totalChars} />
        </div>
      ))}
    </div>
  );
}

export default function NijiCasePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams] = useSearchParams();
  const targetQ = searchParams.get("q");

  const [caseData, setCaseData] = useState<Case2ji | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [shushi, setShushi] = useState<SourcesShushi | null>(null);
  const [tab, setTab] = useState<Tab>(targetQ ? "questions" : "jiken");
  const [noticeOpen, setNoticeOpen] = useState(false);

  const questionRefs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    if (!caseId) return;
    let active = true;
    db.cases
      .get(caseId)
      .then((c) => {
        if (active) setCaseData(c ?? null);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      active = false;
    };
  }, [caseId]);

  useEffect(() => {
    let active = true;
    fetchSourcesShushi()
      .then((data) => {
        if (active) setShushi(data);
      })
      .catch(() => {
        // 出題の趣旨リンクは付加情報のため、取得失敗時はリンクを出さないだけに留める
        if (active) setShushi(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (tab === "questions" && targetQ !== null) {
      const el = questionRefs.current.get(Number(targetQ));
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // caseData がロードされてからDOMが揃うので依存に含める
  }, [tab, targetQ, caseData]);

  const bodyStart = useMemo(() => {
    if (!caseData) return null;
    return findJikenBodyStart(caseData.jiken, caseData.case);
  }, [caseData]);

  const normalizedQuestions = useMemo(() => {
    if (!caseData) return [];
    return normalizeCaseQuestions(caseData.questions);
  }, [caseData]);

  if (error) {
    return (
      <div className="px-4 py-8">
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          読み込みエラー: {error}
        </p>
      </div>
    );
  }

  if (caseData === undefined) {
    return <p className="px-4 py-8 text-sm text-slate-500 dark:text-slate-400">読み込み中…</p>;
  }

  if (caseData === null) {
    return (
      <div className="flex flex-col gap-3 px-4 py-8">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          事例が見つかりません({caseId})。
        </p>
        <Link to="/niji" className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          事例一覧へ戻る
        </Link>
      </div>
    );
  }

  const sourcePdfUrl = getSourcePdfUrl(caseData);
  const shushiEntry = shushi?.[String(caseData.year)];
  const hasGlyph = GLYPH_RE.test(caseData.jiken);
  const noticeText = bodyStart !== null ? caseData.jiken.slice(0, bodyStart) : null;
  const bodyText = bodyStart !== null ? caseData.jiken.slice(bodyStart) : caseData.jiken;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link to="/niji" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            ← 事例一覧
          </Link>
          <h1 className="text-lg font-bold">
            {caseData.year}年度 {caseData.case_name}
          </h1>
        </div>
        <Link
          to="/search"
          className="flex-none rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 active:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:active:bg-slate-800"
        >
          🔎 検索
        </Link>
      </div>

      {shushiEntry && (
        <a
          href={shushiEntry.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 active:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
        >
          公式「出題の趣旨」を見る(外部リンク) ↗
        </a>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setTab("jiken")}
          className={`rounded-lg py-2 text-sm font-bold transition-colors ${
            tab === "jiken"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          与件文
        </button>
        <button
          type="button"
          onClick={() => setTab("questions")}
          className={`rounded-lg py-2 text-sm font-bold transition-colors ${
            tab === "questions"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          設問({normalizedQuestions.length})
        </button>
      </div>

      {tab === "jiken" && (
        <div className="flex flex-col gap-3">
          {hasGlyph && <GlyphNotice sourcePdfUrl={sourcePdfUrl} />}

          {noticeText !== null ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => setNoticeOpen((v) => !v)}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                {noticeOpen ? "▼ 試験の注意事項を隠す" : "▶ 試験の注意事項(タップで表示)"}
              </button>
              {noticeOpen && (
                <p className="whitespace-pre-wrap break-words border-t border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {noticeText}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              (注意事項の自動判定に失敗したため全文を表示しています)
            </p>
          )}

          <p className="whitespace-pre-wrap break-words text-[15.5px] leading-[1.9] text-slate-800 dark:text-slate-100">
            {bodyText}
          </p>

          {sourcePdfUrl && (
            <a
              href={sourcePdfUrl}
              target="_blank"
              rel="noreferrer"
              className="self-start text-xs font-semibold text-blue-600 underline dark:text-blue-400"
            >
              原本PDFを見る
            </a>
          )}
        </div>
      )}

      {tab === "questions" && (
        <div className="flex flex-col gap-3">
          {normalizedQuestions.map((g) => (
            <QuestionGroup
              key={g.q}
              caseId={caseData.id}
              group={g}
              registerRef={(q, el) => {
                if (el) questionRefs.current.set(q, el);
                else questionRefs.current.delete(q);
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-1 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
        <p>{ATTRIBUTION}</p>
        <p>答案の下書きはこの端末内にのみ保存されます。外部への送信は行われません。</p>
      </div>
    </div>
  );
}
