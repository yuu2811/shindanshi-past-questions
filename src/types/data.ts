// data/*.json のスキーマ型定義(REQUIREMENTS §3.1 + 実データ準拠)。
// 正本データは読み取り専用 — アプリ側で問題文・正解・配点を書き換えない。

/** 科目コード A〜G */
export type SubjectCode = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** 選択肢記号 → 本文 */
export type Choices = Record<string, string>;

/** 設問(設問分割がない問題も items 1件として正規化されている) */
export interface QuestionItem {
  /** 設問番号。分割なしの場合 null */
  sub: number | null;
  stem: string;
  choices: Choices;
  /** 正解記号。不明・未公表の場合 null */
  answer: string | null;
  points: number | null;
  /** 全員正解問題: 選択に関わらず正答扱い */
  all_correct: boolean;
  /** 採点対象外: 得点計算から除外 */
  no_scoring: boolean;
}

export interface FigureInfo {
  flag: boolean;
  reasons: string[];
}

export interface TopicTag {
  tag: string;
  method: string;
  confidence: "low" | "mid" | "high" | string;
}

export interface SourceInfo {
  mondai_pdf?: string;
  seikai_pdf?: string;
  local_mondai?: string;
  local_seikai?: string;
}

/** 1次試験の1問 (master_1ji.json の要素) */
export interface Question1ji {
  id: string; // 例: "1ji-2024-B-Q05"
  exam_id: string; // 例: "1ji-2024-B"
  exam: "1ji";
  year: number;
  /** 2023年度再試験 (2023S) は true */
  reexam: boolean;
  subject: SubjectCode;
  subject_name: string;
  q: number;
  /** (設問1)(設問2)形式の共通リード文 */
  lead: string | null;
  items: QuestionItem[];
  topic_tags: TopicTag[];
  figure: FigureInfo;
  /** 原本PDF内の頁範囲 [start, end] */
  pages: [number, number] | number[];
  /** "ok" | "needs_review" — needs_review は原文確認導線を必ず付ける */
  parse_status: "ok" | "needs_review" | string;
  issues: string[];
  source: SourceInfo;
  /** アプリ側の非正規化フィールド: topic_tags のタグ名のみ (Dexie multiEntry index 用)。取込時に付与 */
  tagList?: string[];
}

/** 試験メタ (exams_1ji.json の要素) */
export interface Exam1ji {
  exam_id: string;
  exam: "1ji";
  year: number;
  reexam: boolean;
  subject: SubjectCode;
  subject_name: string;
  duration_minutes: number;
  total_points: number;
  n_questions: number;
  n_answer_cells: number;
  official_notes: string[];
  source: SourceInfo;
}

/** 論点タクソノミ (taxonomy_1ji.json) */
export interface Taxonomy1ji {
  version: string;
  note: string;
  subjects: Record<
    string,
    {
      name: string;
      topics: { tag: string; keywords: string[] }[];
    }
  >;
}

/** 2次設問の分割枝 (設問1/設問2)。OCR起因で stem 空のダミー要素や sub 重複がある */
export interface Setsumon2ji {
  sub?: number;
  stem?: string;
  /** 字数制約 (複数解答欄は複数要素) */
  char_limits?: number[];
}

/** 2次事例の設問 (master_2ji.json 実データ準拠) */
export interface Question2ji {
  q: number;
  points: number | null;
  /** 分割なし設問の本文 (setsumon がある場合は無いことがある) */
  stem?: string;
  /** 設問群共通のリード文 */
  lead?: string;
  /** 字数制約 (分割なし設問用) */
  char_limits?: number[];
  /** 設問分割 (設問1/設問2形式) の枝一覧 */
  setsumon?: Setsumon2ji[];
  /** 原本PDF内の頁範囲 */
  pages?: number[];
}

/** 2次事例 (master_2ji.json cases[] の要素) */
export interface Case2ji {
  id: string; // 例: "2ji-2015-A"
  year: number;
  case: string; // "A" | "B" | "C" | "D"
  case_name: string; // 例: "事例I(組織・人事)"
  jiken: string; // 与件文 (冒頭に試験注意事項が混入していることがある)
  jiken_pages?: number[];
  questions: Question2ji[];
  source_pdf?: string;
  [key: string]: unknown;
}

export interface Master2ji {
  cases: Case2ji[];
}

/** 出題の趣旨URL (sources_shushi.json): 年度 → 検証済URL */
export type SourcesShushi = Record<
  string,
  { url: string; http: string; bytes: number; verified: boolean }
>;

/** 科目コード→名称(表示用) */
export const SUBJECT_NAMES: Record<SubjectCode, string> = {
  A: "経済学・経済政策",
  B: "財務・会計",
  C: "企業経営理論",
  D: "運営管理",
  E: "経営法務",
  F: "経営情報システム",
  G: "中小企業経営・政策",
};

export const SUBJECT_CODES: SubjectCode[] = ["A", "B", "C", "D", "E", "F", "G"];

/** 年度表示: 2023年度再試験は "2023S" */
export function yearLabel(year: number, reexam: boolean): string {
  return reexam ? `${year}S` : String(year);
}

/** 出典表記(アプリ内常設) */
export const ATTRIBUTION =
  "出典: 一般社団法人 中小企業診断協会 中小企業診断士試験問題";
