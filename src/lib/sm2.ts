// SuperMemo SM-2 間隔反復アルゴリズム (REQUIREMENTS §4-2)。
// EF初期値 2.5、下限 1.3。自己評価4段階 (again/hard/good/easy) を品質値にマップする。
//
// 参考: Wozniak, P.A. (1990) "Optimization of learning" (SuperMemo SM-2)。
//
// ── 実装上の設計判断(本実装で確定) ─────────────────────────────
// 1. 品質値マッピング: again=1, hard=3, good=4, easy=5 (ratingToQuality、既存どおり)。
// 2. EF 更新式: EF' = EF + (0.1 − (5−q)(0.08 + (5−q)×0.02))、下限 MIN_EF(1.3)でクランプ。
//    上限は設けない(good/easy を繰り返せば EF は増加し続ける)。
// 3. EF 更新のタイミング: 原典の「q<3 のときは EF を変えずに最初からやり直す」という記述に
//    対し、本実装は Anki 系を含む一般的な SM-2 実装に倣い **全評価で EF を更新する**。
//    理由: again/hard を「忘却の兆候」として EF に反映させたほうが復習間隔の最適化に資し、
//    また "again 連打で EF が下限 1.3 に張り付く" という直感的挙動をテストで固定できるため。
// 4. 間隔算出は「更新前 EF」で行う (interval を求めてから EF を更新する順序)。
//    これは広く流通する SM-2 リファレンス実装の順序に一致する。
// 5. 間隔:
//      - q<3 (again): reps を 0 にリセットし、intervalDays=1 (翌日再出題)。
//        当日再出題(0日)ではなく翌日(1日)を採用 — 原典 I(1)=1日に一致し、
//        「同日中に何度も出す」挙動を避けるため。
//      - q>=3: reps 0→1日、reps 1→6日、reps>=2 → round(前回interval × 更新前EF)。
// 6. 丸め: 間隔の乗算結果は Math.round(四捨五入)。原典どおり。
//    間隔の上限は設けない(長期記憶は素直に伸ばす。表示層で必要なら別途クランプ)。
import type { SelfRating, SrsState } from "../types/study";

export const INITIAL_EF = 2.5;
export const MIN_EF = 1.3;

/** 1日のミリ秒 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 自己評価 → SM-2 品質値 q (0-5) のマッピング */
export function ratingToQuality(rating: SelfRating): number {
  switch (rating) {
    case "again":
      return 1;
    case "hard":
      return 3;
    case "good":
      return 4;
    case "easy":
      return 5;
  }
}

export interface Sm2Input {
  /** 既存状態。初回は null */
  prev: Pick<SrsState, "ef" | "reps" | "intervalDays"> | null;
  rating: SelfRating;
  /** 現在時刻 epoch ms (テスト容易性のため注入) */
  now: number;
}

export interface Sm2Output {
  ef: number;
  reps: number;
  intervalDays: number;
  dueAt: number;
}

/**
 * SM-2 の EF 更新式。下限 MIN_EF でクランプ。
 * EF' = EF + (0.1 − (5−q)(0.08 + (5−q)×0.02))
 */
function updateEf(prevEf: number, q: number): number {
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const next = prevEf + delta;
  return next < MIN_EF ? MIN_EF : next;
}

/**
 * SM-2 で次回出題間隔を計算する。
 * 詳細な設計判断はファイル冒頭のコメント参照。
 */
export function sm2Next(input: Sm2Input): Sm2Output {
  const { prev, rating, now } = input;
  const prevEf = prev?.ef ?? INITIAL_EF;
  const prevReps = prev?.reps ?? 0;
  const prevInterval = prev?.intervalDays ?? 0;
  const q = ratingToQuality(rating);

  let reps: number;
  let intervalDays: number;

  if (q < 3) {
    // 不正解(again): repetition を最初からやり直し、翌日再出題。
    reps = 0;
    intervalDays = 1;
  } else {
    // 正解(hard/good/easy): 間隔は「更新前 EF」で算出してから reps を進める。
    if (prevReps <= 0) {
      intervalDays = 1;
    } else if (prevReps === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(prevInterval * prevEf);
    }
    reps = prevReps + 1;
  }

  const ef = updateEf(prevEf, q);

  return {
    ef,
    reps,
    intervalDays,
    dueAt: now + intervalDays * DAY_MS,
  };
}
