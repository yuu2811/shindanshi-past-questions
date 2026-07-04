// 学習履歴・SRS・模試セッションなどアプリ側で生成するレコードの型定義。

/** 自己評価 4段階 (SM-2 の品質評価にマップ) */
export type SelfRating = "again" | "hard" | "good" | "easy";

/** 1設問(item)単位の解答記録キー: `${questionId}#${sub ?? 0}` */
export type ItemKey = string;

export function itemKey(questionId: string, sub: number | null): ItemKey {
  return `${questionId}#${sub ?? 0}`;
}

/** 解答履歴 1件 (演習・模試共通) */
export interface Attempt {
  id?: number; // Dexie auto-increment
  itemKey: ItemKey;
  questionId: string;
  sub: number | null;
  subject: string;
  year: number;
  reexam: boolean;
  tags: string[];
  /** ユーザー選択記号。未回答は null */
  selected: string | null;
  correct: boolean;
  mode: "practice" | "exam" | "review";
  /** 模試セッションID (模試のみ) */
  sessionId?: string;
  /** epoch ms (JST考慮は表示層で行う) */
  answeredAt: number;
  /** 自己評価 (演習/復習のみ) */
  rating?: SelfRating;
}

/** SM-2 の問題ごとの状態 */
export interface SrsState {
  itemKey: ItemKey;
  questionId: string;
  sub: number | null;
  subject: string;
  tags: string[];
  /** Easiness Factor (初期2.5、下限1.3) */
  ef: number;
  /** 連続正答回数 (repetition) */
  reps: number;
  /** 現在の間隔(日) */
  intervalDays: number;
  /** 次回出題日 epoch ms */
  dueAt: number;
  updatedAt: number;
}

/** 模試セッション (中断復帰のため永続化) */
export interface ExamSession {
  id: string; // uuid
  examId: string; // 例: "1ji-2024-B"
  startedAt: number;
  /** 制限時間(秒) */
  durationSec: number;
  /** 経過秒 (中断時に保存) */
  elapsedSec: number;
  /** itemKey → 選択記号 */
  answers: Record<ItemKey, string | null>;
  status: "in_progress" | "finished" | "abandoned";
  finishedAt?: number;
  /** 採点結果 (finished時) */
  result?: ExamResult;
}

/** 模試の採点結果 */
export interface ExamResult {
  /** 得点 (all_correct は加点、no_scoring は除外) */
  score: number;
  /** 採点対象の満点 */
  maxScore: number;
  /** 正答率 (score / maxScore) */
  ratio: number;
  /** 科目合格 (60%以上) */
  passed: boolean;
  /** 足切り (40%未満) */
  belowFloor: boolean;
  nCorrect: number;
  nTotal: number;
}

/** 2次答案下書き (端末内保存のみ・外部送信禁止) */
export interface Draft2ji {
  /** `${caseId}#${q}#${sub ?? 0}` */
  key: string;
  caseId: string;
  q: number;
  sub: number | null;
  text: string;
  updatedAt: number;
}

/** アプリメタ情報 (データ取込バージョン等) */
export interface MetaRecord {
  key: string;
  value: string | number;
}
