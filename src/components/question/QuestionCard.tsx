// 問題1問(1設問)分の表示。演習・復習・模試いずれからも使える純粋な表示コンポーネント。
// 実データの落とし穴(lead/items分割・figure・needs_review・〓・all_correct)に対応する。
import type { Question1ji, QuestionItem } from "../../types/data";
import { yearLabel } from "../../types/data";
import { isCorrect } from "../../lib/scoring";
import { ChoiceList } from "./ChoiceList";
import { FigureBlock } from "./FigureBlock";
import { AllCorrectBadge, GlyphNotice, NeedsReviewNotice } from "./QuestionNotices";

export interface QuestionCardProps {
  question: Question1ji;
  item: QuestionItem;
  /** items.length > 1 の場合の設問ラベル (例: "設問1") */
  subLabel?: string | null;
  selected: string | null;
  onAnswer: (choice: string) => void;
}

const GLYPH_RE = /〓/;

function containsGlyph(question: Question1ji, item: QuestionItem): boolean {
  if (question.lead && GLYPH_RE.test(question.lead)) return true;
  if (GLYPH_RE.test(item.stem)) return true;
  return Object.values(item.choices).some((c) => GLYPH_RE.test(c));
}

export function QuestionCard({
  question,
  item,
  subLabel,
  selected,
  onAnswer,
}: QuestionCardProps) {
  const answered = selected !== null;
  const correct = answered ? isCorrect(item, selected) : null;
  const answerUnknown = item.answer === null && !item.all_correct;
  const hasGlyph = containsGlyph(question, item);
  const needsReview = question.parse_status === "needs_review";
  const sourcePdfUrl = question.source.mondai_pdf;

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {question.subject_name} {yearLabel(question.year, question.reexam)}年度 第{question.q}問
          {subLabel ? ` ${subLabel}` : ""}
        </span>
        {item.all_correct && <AllCorrectBadge />}
      </div>

      {question.lead && (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          {question.lead}
        </p>
      )}

      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{item.stem}</p>

      {question.figure.flag && (
        <FigureBlock qid={question.id} pages={question.pages} sourcePdfUrl={sourcePdfUrl} />
      )}

      {hasGlyph && <GlyphNotice sourcePdfUrl={sourcePdfUrl} />}

      {needsReview && <NeedsReviewNotice sourcePdfUrl={sourcePdfUrl} />}

      {item.no_scoring && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          採点対象外の設問です{item.answer === null ? "(正解は公表されていません)" : ""}。
        </p>
      )}

      {answered && (
        <div
          className={`rounded-xl p-3 text-sm font-bold ${
            answerUnknown
              ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
              : correct
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {answerUnknown
            ? "この設問は正解が公表されていません(採点対象外)"
            : correct
              ? "正解です"
              : `不正解 — 正解は ${item.answer ?? "?"}`}
        </div>
      )}

      <ChoiceList
        choices={item.choices}
        answer={item.answer}
        allCorrect={item.all_correct}
        answerUnknown={answerUnknown}
        selected={selected}
        onSelect={onAnswer}
      />
    </div>
  );
}
