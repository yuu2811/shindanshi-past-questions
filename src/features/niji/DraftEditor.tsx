// 答案下書き用のtextarea + 字数カウンタ。db.drafts へ自動保存する(端末内のみ)。
import { useDraft } from "./useDraft";

export interface DraftEditorProps {
  caseId: string;
  q: number;
  sub: number;
  totalChars: number | null;
}

/** Unicodeのコードポイント単位で文字数を数える(絵文字等のサロゲート対策) */
function countChars(text: string): number {
  return Array.from(text).length;
}

export function DraftEditor({ caseId, q, sub, totalChars }: DraftEditorProps) {
  const { text, setText, loaded } = useDraft(caseId, q, sub);
  const count = countChars(text);
  const overLimit = totalChars !== null && count > totalChars;

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={text}
        disabled={!loaded}
        onChange={(e) => setText(e.target.value)}
        placeholder={loaded ? "答案の下書きを入力…" : "読み込み中…"}
        rows={6}
        className="w-full resize-y rounded-xl border-2 border-slate-300 bg-white p-3 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
      />
      <div className="flex items-center justify-between text-xs">
        <span className={overLimit ? "font-bold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}>
          {count}
          {totalChars !== null ? ` / ${totalChars}字` : "字"}
          {overLimit ? "(字数制約を超えています)" : ""}
        </span>
        <span className="text-slate-400 dark:text-slate-500">端末内にのみ自動保存</span>
      </div>
    </div>
  );
}
