// SearchPage <-> search.worker 間の通信メッセージ型。
// 過去問本文はメインスレッド(=同一デバイス)内の Worker とやり取りするだけで、
// ネットワークには一切送出しない(著作権上の制約: CLAUDE.md「やらないこと」)。

export type SearchDocKind = "1ji" | "2ji";

/** 検索インデックス1件分(検索対象テキストは事前に結合済み) */
export interface SearchDoc {
  /** 結果表示・遷移に使う一意キー */
  id: string;
  kind: SearchDocKind;
  year: number;
  /** 表示用年度 (2023年度再試験は "2023S" 等) */
  yearLabel: string;
  /** 1次: 科目名 / 2次: 事例名 */
  badgeMain: string;
  /** 1次: 試験ID(exam_id) / 2次: 事例年度表記など補助情報 */
  badgeSub: string;
  /** 2次のみ意味を持つ設問番号。1次は 0 固定 */
  q: number;
  /** 1次: 演習セッションへの遷移用 */
  examId?: string;
  /** 2次: 事例ページへの遷移用 */
  caseId?: string;
  /** 検索対象テキスト(結合済み) */
  text: string;
}

export interface IndexRequest {
  type: "index";
  docs: SearchDoc[];
}

export interface SearchRequestMsg {
  type: "search";
  requestId: number;
  query: string;
  limit: number;
}

export type WorkerRequest = IndexRequest | SearchRequestMsg;

export interface SearchHit {
  doc: SearchDoc;
  /** マッチ箇所の前後文脈(ハイライト用に分割済み) */
  before: string;
  match: string;
  after: string;
}

export interface IndexedResponse {
  type: "indexed";
  count: number;
}

export interface ResultsResponse {
  type: "results";
  requestId: number;
  hits: SearchHit[];
  total: number;
}

export interface ErrorResponse {
  type: "error";
  message: string;
}

export type WorkerResponse = IndexedResponse | ResultsResponse | ErrorResponse;
