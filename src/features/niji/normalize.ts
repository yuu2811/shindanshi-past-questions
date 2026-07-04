// master_2ji.json の実データを表示しやすい形へ正規化する。
//
// ── 既知の型不整合(重要) ─────────────────────────────────────────
//   src/types/data.ts の `Question2ji` 型 (sub / chars フィールド) は、実際の
//   data/master_2ji.json の構造と一致していない。実データは以下の形:
//     - 分割なし設問: { q, points, stem, char_limits?: number[] }
//     - 共通リード付き: 上記 + lead?: string
//     - 設問分割あり : { q, points, lead?, setsumon: { sub, stem, char_limits? }[] }
//   さらに setsumon には OCR 起因で「設問ラベルのみ・本文が空文字」の
//   ダミー要素が混入し(44事例中で11件)、しかも sub 番号が重複するケースがある
//   (例: 2ji-2015-D の設問1で sub:1 が2回出現)。よってラベリングは元データの
//   sub 値を信用せず、空文字要素を除外した後の出現順で振り直す。
//   → types/data.ts を実データに合わせて修正することを統合担当に推奨(本タスクでは
//      types/ 変更禁止のため、ここでは実データ形をローカル型で受けてキャストする)。
//
// data/ 自体は書き換えない(読み取り専用)。ここは表示用の正規化のみ。
import type { Case2ji } from "../../types/data";

interface RawSetsumon {
  sub?: number;
  stem?: string;
  char_limits?: number[];
}

interface RawQuestion2ji {
  q: number;
  points: number | null;
  stem?: string;
  char_limits?: number[];
  lead?: string;
  setsumon?: RawSetsumon[];
}

export interface NormalizedSubQuestion {
  /** 表示・下書きキー用の設問番号。分割なしは 0 */
  sub: number;
  /** 表示ラベル。分割なしは null (見出し自体を出さない) */
  label: string | null;
  stem: string;
  /** 字数制約一覧(複数欄ある設問は複数要素) */
  charLimits: number[];
  /** 字数制約の合計。制約なしは null */
  totalChars: number | null;
}

export interface NormalizedQuestion {
  q: number;
  points: number | null;
  /** 設問群共通のリード文(状況設定等)。無ければ null */
  lead: string | null;
  subQuestions: NormalizedSubQuestion[];
}

function sumCharLimits(limits: number[]): number | null {
  return limits.length > 0 ? limits.reduce((a, b) => a + b, 0) : null;
}

function normalizeOne(raw: RawQuestion2ji): NormalizedQuestion {
  const lead = typeof raw.lead === "string" && raw.lead.trim() !== "" ? raw.lead : null;

  if (Array.isArray(raw.setsumon) && raw.setsumon.length > 0) {
    const cleaned = raw.setsumon.filter(
      (s): s is RawSetsumon & { stem: string } =>
        typeof s.stem === "string" && s.stem.trim() !== "",
    );
    const subQuestions: NormalizedSubQuestion[] = cleaned.map((s, i) => {
      const charLimits = Array.isArray(s.char_limits) ? s.char_limits : [];
      return {
        sub: i + 1,
        label: `設問${i + 1}`,
        stem: s.stem,
        charLimits,
        totalChars: sumCharLimits(charLimits),
      };
    });
    return { q: raw.q, points: raw.points, lead, subQuestions };
  }

  const charLimits = Array.isArray(raw.char_limits) ? raw.char_limits : [];
  const stem =
    typeof raw.stem === "string" && raw.stem.trim() !== ""
      ? raw.stem
      : "(問題文を取得できませんでした。原本PDFをご確認ください)";
  return {
    q: raw.q,
    points: raw.points,
    lead,
    subQuestions: [
      { sub: 0, label: null, stem, charLimits, totalChars: sumCharLimits(charLimits) },
    ],
  };
}

/** Case2ji.questions (実データ形) を表示用に正規化する */
export function normalizeCaseQuestions(questions: Case2ji["questions"]): NormalizedQuestion[] {
  // 既知の型不整合(上記コメント)によりここでキャストする。data自体は書き換えない。
  const raw = questions as unknown as RawQuestion2ji[];
  return raw.map(normalizeOne);
}

/** Draft2ji.key と同じ規約 (`${caseId}#${q}#${sub ?? 0}`) */
export function draftKey(caseId: string, q: number, sub: number): string {
  return `${caseId}#${q}#${sub}`;
}
