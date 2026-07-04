// 採点エンジン (REQUIREMENTS §3.2 / §4-3)。
// 業務ルール:
//   - all_correct: true → 選択に関わらず正答扱い (加点する)
//   - no_scoring: true  → 得点計算から除外 (満点にも含めない)
//   - 合否: 総点数60%以上かつ各科目40%以上 (科目単位では 60%=合格ライン, 40%未満=足切り)
//
// ※ このファイルはドメインロジック担当エージェント (Task #2) が本実装+ユニットテストを行う。
//    現状は暫定実装 (インターフェースは確定、他エージェントはこのシグネチャに依存してよい)。
import type { Question1ji, QuestionItem } from "../types/data";
import type { ExamResult, ItemKey } from "../types/study";
import { itemKey } from "../types/study";

/** 1設問の正誤判定。all_correct は常に true。 */
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
 * 模試1科目の採点。暫定実装 — Task #2 で本実装+テストに置き換える。
 */
export function scoreExam(input: ScoreExamInput): ExamResult {
  let score = 0;
  let maxScore = 0;
  let nCorrect = 0;
  let nTotal = 0;
  for (const q of input.questions) {
    for (const item of q.items) {
      if (item.no_scoring) continue;
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
