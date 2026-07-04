/** 実装前ページの仮表示。各機能担当エージェントがページ本体で置き換える。 */
export function Placeholder({ title, task }: { title: string; task: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">実装中 ({task})</p>
    </div>
  );
}
