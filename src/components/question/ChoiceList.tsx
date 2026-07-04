// 選択肢一覧。縦積みボタン(片手操作・タップ領域確保)。
// 解答後は選択済み/正解/不正解を色分けして全選択肢の正誤を明示する。
import type { Choices } from "../../types/data";

export interface ChoiceListProps {
  choices: Choices;
  /** 正解記号。未公表(all_correct 等)は null */
  answer: string | null;
  /** 全員正解問題: どれを選んでも正答扱い */
  allCorrect: boolean;
  /** 正解が非公表 (no_scoring 等で answer が null): 正誤の色分けをせず選択のみ示す */
  answerUnknown: boolean;
  selected: string | null;
  onSelect: (choice: string) => void;
}

export function ChoiceList({
  choices,
  answer,
  allCorrect,
  answerUnknown,
  selected,
  onSelect,
}: ChoiceListProps) {
  const answered = selected !== null;

  return (
    <div className="flex flex-col gap-2">
      {Object.entries(choices).map(([key, text]) => {
        const isSelected = key === selected;
        const isAnswer = allCorrect ? isSelected : answer !== null && key === answer;

        let stateClasses =
          "border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
        if (answered) {
          if (isAnswer) {
            stateClasses =
              "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200";
          } else if (isSelected && answerUnknown) {
            stateClasses =
              "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200";
          } else if (isSelected) {
            stateClasses =
              "border-rose-500 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200";
          } else {
            stateClasses =
              "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-500";
          }
        }

        return (
          <button
            key={key}
            type="button"
            disabled={answered}
            onClick={() => onSelect(key)}
            className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] leading-relaxed transition-colors active:scale-[0.99] disabled:active:scale-100 ${stateClasses}`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${
                answered && isAnswer
                  ? "bg-emerald-500 text-white"
                  : answered && isSelected && answerUnknown
                    ? "bg-blue-500 text-white"
                    : answered && isSelected
                      ? "bg-rose-500 text-white"
                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {key}
            </span>
            <span className="whitespace-pre-wrap break-words">{text}</span>
            {answered && isAnswer && (
              <span className="ml-auto flex-none text-xs font-bold text-emerald-600 dark:text-emerald-400">
                正解
              </span>
            )}
            {answered && !isAnswer && isSelected && (
              <span
                className={`ml-auto flex-none text-xs font-bold ${
                  answerUnknown
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                選択
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
