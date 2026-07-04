// SuperMemo SM-2 間隔反復アルゴリズム (REQUIREMENTS §4-2)。
// EF初期値 2.5、下限 1.3。自己評価4段階 (again/hard/good/easy) を品質値にマップする。
//
// ※ このファイルはドメインロジック担当エージェント (Task #2) が本実装+ユニットテストを行う。
//    現状は暫定実装 (インターフェースは確定、他エージェントはこのシグネチャに依存してよい)。
import type { SelfRating, SrsState } from "../types/study";

export const INITIAL_EF = 2.5;
export const MIN_EF = 1.3;

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
 * SM-2 で次回出題間隔を計算する。
 * 暫定実装 — Task #2 で SuperMemo SM-2 準拠の本実装に置き換える。
 */
export function sm2Next(input: Sm2Input): Sm2Output {
  const { prev, rating, now } = input;
  const ef = prev?.ef ?? INITIAL_EF;
  const q = ratingToQuality(rating);
  const reps = q < 3 ? 0 : (prev?.reps ?? 0) + 1;
  const intervalDays = reps <= 0 ? 0 : reps === 1 ? 1 : 6;
  return {
    ef: Math.max(MIN_EF, ef),
    reps,
    intervalDays,
    dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
  };
}
