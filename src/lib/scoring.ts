// 採点エンジン (REQUIREMENTS §3.2 / §4-3)。
//
// ── 業務ルール ─────────────────────────────────────────────
//   - all_correct: true → 選択に関わらず正答扱い。**加点する**(未回答でも加点)。
//                         正答未公表(answer:null)でも満点対象に含める。
//   - no_scoring: true  → 得点計算から完全に除外(得点にも満点にも含めない)。
//   - 合否: 総点数(科目内比率)60%以上で科目合格、40%未満で足切り。
//           60%ちょうど=合格、40%ちょうど=足切りではない、39.9%=足切り。
//
// ── エッジケースの扱い(本実装で確定) ─────────────────────────
//   A. answer:null かつ all_correct:false の設問(正答未公表)
//      → **採点対象外**として maxScore・score の双方から除外する(no_scoring と同等扱い)。
//        正解が存在しない以上、誰も加点され得ず満点に含めるのは不当なため。
//        実データでは 1ji-2021-G-Q22(sub2, 3点) と 1ji-2023S-C-Q33(3点)の2件が該当。
//        この2試験のみ maxScore が公式 total_points(100)より 3 点少なくなる
//        (整合性テスト scoring.test.ts で既知の差分として固定・報告)。
//   B. points:null の設問
//      → 配点不明。採点対象(scorable)であれば配点 0 として扱い、得点・満点に 0 を加算する
//        (Fail Loud の観点では例外にもし得るが、模試採点を止めないため 0 とする)。
//        実データでは 1ji-2021-G-Q24(no_scoring:true, points:null)の1件のみで、
//        これは no_scoring により先に除外される。
//   C. answer:null かつ all_correct:true(全員正解・正答未公表)
//      → all_correct が優先。isCorrect は常に true、満点対象に含める(規則どおり加点)。
//
// ※ 正誤判定・除外判定のみを行い、data/ の内容は一切書き換えない(CLAUDE.md: 読み取り専用)。
import type { Question1ji, QuestionItem } from "../types/data";
import type { ExamResult, ItemKey } from "../types/study";
import { itemKey } from "../types/study";

/**
 * 1設問が採点対象(scorable)か。
 *   - no_scoring:true は対象外。
 *   - answer:null かつ all_correct:false(正答未公表)は対象外。
 *   - all_correct:true は answer:null でも対象(全員加点)。
 */
export function isScorable(item: QuestionItem): boolean {
  if (item.no_scoring) return false;
  if (item.answer === null && !item.all_correct) return false;
  return true;
}

/** 1設問の正誤判定。all_correct は選択に関わらず常に true。 */
export function isCorrect(item: QuestionItem, selected: string | null): boolean {
  if (item.all_correct) return true;
  if (selected === null || item.answer === null) return false;
  return selected === item.answer;
}

export interface ScoreExamInput {
  questions: Question1ji[];
  /** itemKey → ユーザー選択記号 (未回答は null または欠落) */
  answers: Record<ItemKey, string | null>;
}

/**
 * 模試1科目の採点。
 * 採点対象(isScorable)の設問のみで score / maxScore / 比率 / 合否を算出する。
 */
export function scoreExam(input: ScoreExamInput): ExamResult {
  let score = 0;
  let maxScore = 0;
  let nCorrect = 0;
  let nTotal = 0;

  for (const q of input.questions) {
    for (const item of q.items) {
      if (!isScorable(item)) continue;
      // 配点不明(points:null)は 0 点として扱う(冒頭コメント B)。
      const pts = item.points ?? 0;
      maxScore += pts;
      nTotal += 1;
      const selected = input.answers[itemKey(q.id, item.sub)] ?? null;
      if (isCorrect(item, selected)) {
        score += pts;
        nCorrect += 1;
      }
    }
  }

  // maxScore が 0 の場合(採点対象設問なし)は比率 0 とする。
  const ratio = maxScore > 0 ? score / maxScore : 0;
  return {
    score,
    maxScore,
    ratio,
    passed: ratio >= 0.6,
    belowFloor: ratio < 0.4,
    nCorrect,
    nTotal,
  };
}
