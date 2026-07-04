// 模試用の問題表示。演習の QuestionCard とは別実装:
//   **採点前に正誤・正解を一切見せない**(選択の反映のみ。全員正解/採点対象外の
//   メタ情報も本番同一性のため試験中は表示しない)。図表・〓・要確認の導線は
//   解答に必要なので表示する。既存の表示コンポーネントは変更せず import のみ再利用。
import type { Question1ji, QuestionItem, Choices } from "../../types/data";
import { yearLabel } from "../../types/data";
import { itemKey } from "../../types/study";
import { FigureBlock } from "../../components/question/FigureBlock";
import { GlyphNotice, NeedsReviewNotice } from "../../components/question/QuestionNotices";

const GLYPH_RE = /〓/;

function itemHasGlyph(question: Question1ji, item: QuestionItem): boolean {
  if (question.lead && GLYPH_RE.test(question.lead)) return true;
  if (GLYPH_RE.test(item.stem)) return true;
  return Object.values(item.choices).some((c) => GLYPH_RE.test(c));
}

/** 選択の反映のみ。正解・正誤は出さない。タップで選択、同じものを再タップで選択解除。 */
function ExamChoiceList({
  choices,
  selected,
  onSelect,
}: {
  choices: Choices;
  selected: string | null;
  onSelect: (choice: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(choices).map(([key, text]) => {
        const isSelected = key === selected;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isSelected ? null : key)}
            aria-pressed={isSelected}
            className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] leading-relaxed transition-colors active:scale-[0.99] ${
              isSelected
                ? "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100"
                : "border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
                isSelected
                  ? "bg-blue-500 text-white"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {key}
            </span>
            <span className="whitespace-pre-wrap break-words">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface ExamQuestionViewProps {
  question: Question1ji;
  answers: Record<string, string | null>;
  onSelect: (key: string, choice: string | null) => void;
}

export function ExamQuestionView({ question, answers, onSelect }: ExamQuestionViewProps) {
  const multi = question.items.length > 1;
  const sourcePdfUrl = question.source.mondai_pdf;
  const needsReview = question.parse_status === "needs_review";

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {question.subject_name} {yearLabel(question.year, question.reexam)}年度 第{question.q}問
        </span>
      </div>

      {question.lead && (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          {question.lead}
        </p>
      )}

      {question.figure.flag && (
        <FigureBlock qid={question.id} pages={question.pages} sourcePdfUrl={sourcePdfUrl} />
      )}

      {needsReview && <NeedsReviewNotice sourcePdfUrl={sourcePdfUrl} />}

      {question.items.map((item) => {
        const key = itemKey(question.id, item.sub);
        const selected = answers[key] ?? null;
        return (
          <div key={key} className="flex flex-col gap-3">
            {multi && (
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                設問{item.sub ?? ""}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {item.stem}
            </p>
            {itemHasGlyph(question, item) && <GlyphNotice sourcePdfUrl={sourcePdfUrl} />}
            <ExamChoiceList
              choices={item.choices}
              selected={selected}
              onSelect={(choice) => onSelect(key, choice)}
            />
          </div>
        );
      })}
    </div>
  );
}
