import { describe, it, expect } from "vitest";
import {
  INITIAL_EF,
  MIN_EF,
  ratingToQuality,
  sm2Next,
  type Sm2Output,
} from "./sm2";
import type { SelfRating } from "../types/study";

const NOW = 1_700_000_000_000; // 固定 epoch ms
const DAY_MS = 24 * 60 * 60 * 1000;

/** prev を output から作り直して次の評価を適用するヘルパ */
function next(
  prev: Sm2Output | null,
  rating: SelfRating,
  now = NOW,
): Sm2Output {
  return sm2Next({
    prev: prev
      ? { ef: prev.ef, reps: prev.reps, intervalDays: prev.intervalDays }
      : null,
    rating,
    now,
  });
}

describe("ratingToQuality", () => {
  it("again=1, hard=3, good=4, easy=5", () => {
    expect(ratingToQuality("again")).toBe(1);
    expect(ratingToQuality("hard")).toBe(3);
    expect(ratingToQuality("good")).toBe(4);
    expect(ratingToQuality("easy")).toBe(5);
  });
});

describe("sm2Next 基本系列 (good を繰り返す)", () => {
  it("初回 good → 1日 / reps=1 / EF=2.5 据え置き", () => {
    const o = next(null, "good");
    expect(o.reps).toBe(1);
    expect(o.intervalDays).toBe(1);
    expect(o.ef).toBeCloseTo(INITIAL_EF, 10); // good(q=4) は EF 変化なし
    expect(o.dueAt).toBe(NOW + 1 * DAY_MS);
  });

  it("2回目 good → 6日 / reps=2", () => {
    const o1 = next(null, "good");
    const o2 = next(o1, "good");
    expect(o2.reps).toBe(2);
    expect(o2.intervalDays).toBe(6);
    expect(o2.ef).toBeCloseTo(INITIAL_EF, 10);
    expect(o2.dueAt).toBe(NOW + 6 * DAY_MS);
  });

  it("3回目 good → 前回interval × EF (round(6×2.5)=15)", () => {
    const o1 = next(null, "good");
    const o2 = next(o1, "good");
    const o3 = next(o2, "good");
    expect(o3.reps).toBe(3);
    expect(o3.intervalDays).toBe(15);
    expect(o3.dueAt).toBe(NOW + 15 * DAY_MS);
  });

  it("4回目 good → round(15 × 2.5)=38", () => {
    let o = next(null, "good");
    o = next(o, "good");
    o = next(o, "good");
    o = next(o, "good");
    expect(o.intervalDays).toBe(Math.round(15 * INITIAL_EF)); // 38
  });
});

describe("sm2Next again (不正解)", () => {
  it("again は reps を 0 にリセットし翌日再出題 (interval=1)", () => {
    let o = next(null, "good");
    o = next(o, "good");
    o = next(o, "good"); // reps=3, interval=15
    const a = next(o, "again");
    expect(a.reps).toBe(0);
    expect(a.intervalDays).toBe(1);
    expect(a.dueAt).toBe(NOW + 1 * DAY_MS);
  });

  it("again 後に good で reps が 1 から積み直す", () => {
    let o = next(null, "good");
    o = next(o, "good"); // reps=2
    o = next(o, "again"); // reps=0
    const g = next(o, "good");
    expect(g.reps).toBe(1);
    expect(g.intervalDays).toBe(1);
  });

  it("again は EF を下げる (q=1: -0.54)", () => {
    const a = next(null, "again");
    expect(a.ef).toBeCloseTo(INITIAL_EF - 0.54, 10);
  });
});

describe("sm2Next EF の増減と下限", () => {
  it("easy 連打で EF が上昇し続ける (q=5: +0.1 ずつ)", () => {
    const e1 = next(null, "easy");
    expect(e1.ef).toBeCloseTo(INITIAL_EF + 0.1, 10);
    const e2 = next(e1, "easy");
    expect(e2.ef).toBeCloseTo(INITIAL_EF + 0.2, 10);
    const e3 = next(e2, "easy");
    expect(e3.ef).toBeCloseTo(INITIAL_EF + 0.3, 10);
    expect(e3.ef).toBeGreaterThan(e2.ef);
  });

  it("hard 連打で EF が下がる (q=3: -0.14 ずつ) が下限 1.3 で張り付く", () => {
    let o = next(null, "hard");
    expect(o.ef).toBeCloseTo(INITIAL_EF - 0.14, 10);
    // 十分な回数 hard を繰り返すと MIN_EF に張り付く
    for (let i = 0; i < 20; i++) o = next(o, "hard");
    expect(o.ef).toBe(MIN_EF);
    // さらに hard しても 1.3 のまま
    const stuck = next(o, "hard");
    expect(stuck.ef).toBe(MIN_EF);
  });

  it("again 連打でも EF は下限 1.3 に張り付く", () => {
    let o = next(null, "again");
    for (let i = 0; i < 5; i++) o = next(o, "again");
    expect(o.ef).toBe(MIN_EF);
  });

  it("EF が MIN_EF を下回ることはない", () => {
    let o = next(null, "again");
    for (let i = 0; i < 50; i++) o = next(o, "again");
    expect(o.ef).toBeGreaterThanOrEqual(MIN_EF);
  });
});

describe("sm2Next 間隔算出は更新前 EF を使う", () => {
  it("EF が下がった状態でも interval は前回 EF で計算される", () => {
    // reps を 2 まで進め、interval=6 の状態を作る
    let o = next(null, "good"); // reps1 int1 ef2.5
    o = next(o, "good"); // reps2 int6 ef2.5
    // ここで hard を打つと q=3: interval=round(6 × 2.5)=15, その後 EF=2.36
    const h = next(o, "hard");
    expect(h.intervalDays).toBe(15); // 更新前 EF(2.5)で算出
    expect(h.ef).toBeCloseTo(INITIAL_EF - 0.14, 10); // EF は更新される
    expect(h.reps).toBe(3);
  });
});
