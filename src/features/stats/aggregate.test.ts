import { describe, expect, it } from "vitest";
import {
  accuracy,
  aggregateByDay,
  aggregateBySubject,
  aggregateByTag,
  recentJstDays,
  tagKey,
  weeklyAccuracyBySubject,
} from "./aggregate";
import type { Attempt } from "../../types/study";

function attempt(overrides: Partial<Attempt>): Attempt {
  return {
    itemKey: "1ji-2024-B-Q01#0",
    questionId: "1ji-2024-B-Q01",
    sub: null,
    subject: "B",
    year: 2024,
    reexam: false,
    tags: ["財務・会計/企業価値"],
    selected: "ア",
    correct: true,
    mode: "practice",
    answeredAt: Date.UTC(2026, 6, 1, 3, 0, 0), // 2026-07-01 12:00 JST
    ...overrides,
  };
}

describe("aggregateByTag", () => {
  it("科目+タグ単位で正誤を集計する", () => {
    const attempts = [
      attempt({ correct: true }),
      attempt({ correct: false }),
      attempt({ subject: "A", tags: ["未分類"], correct: true }),
    ];
    const map = aggregateByTag(attempts);
    expect(map.get(tagKey("B", "財務・会計/企業価値"))).toEqual({ total: 2, correct: 1 });
    expect(map.get(tagKey("A", "未分類"))).toEqual({ total: 1, correct: 1 });
  });

  it("1件の attempt が複数タグを持つ場合は両方に加算する", () => {
    const attempts = [attempt({ tags: ["タグ1", "タグ2"], correct: true })];
    const map = aggregateByTag(attempts);
    expect(map.get(tagKey("B", "タグ1"))).toEqual({ total: 1, correct: 1 });
    expect(map.get(tagKey("B", "タグ2"))).toEqual({ total: 1, correct: 1 });
  });
});

describe("aggregateBySubject", () => {
  it("科目単位で集計する", () => {
    const attempts = [
      attempt({ subject: "A", correct: true }),
      attempt({ subject: "A", correct: false }),
      attempt({ subject: "B", correct: true }),
    ];
    const map = aggregateBySubject(attempts);
    expect(map.get("A")).toEqual({ total: 2, correct: 1 });
    expect(map.get("B")).toEqual({ total: 1, correct: 1 });
  });
});

describe("accuracy", () => {
  it("total=0 は null を返す(未演習)", () => {
    expect(accuracy({ total: 0, correct: 0 })).toBeNull();
  });
  it("正答率を計算する", () => {
    expect(accuracy({ total: 4, correct: 3 })).toBe(0.75);
  });
});

describe("aggregateByDay / recentJstDays", () => {
  it("JST暦日単位で解答数を集計する", () => {
    // 2026-07-01 15:00 JST (UTC 06:00) と 2026-07-01 08:59 JST (UTC 前日23:59) は
    // どちらも JST では別日/同日になり得るため、jstDateString の変換を経由して検証する
    const noonJst = Date.UTC(2026, 6, 1, 3, 0, 0); // 2026-07-01 12:00 JST
    const earlyJst = Date.UTC(2026, 5, 30, 15, 30, 0); // 2026-07-01 00:30 JST
    const attempts = [attempt({ answeredAt: noonJst }), attempt({ answeredAt: earlyJst })];
    const map = aggregateByDay(attempts);
    expect(map.get("2026-07-01")).toBe(2);
  });

  it("recentJstDays は指定日数分・古い→新しい順で今日を含む", () => {
    const now = Date.UTC(2026, 6, 10, 3, 0, 0); // 2026-07-10 12:00 JST
    const days = recentJstDays(5, now);
    expect(days).toEqual(["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"]);
  });
});

describe("weeklyAccuracyBySubject", () => {
  it("直近 weeks*7 日を7日ずつのバケットに束ねる(古い→新しい順)", () => {
    const now = Date.UTC(2026, 6, 14, 3, 0, 0); // 2026-07-14 12:00 JST
    const oldWeekDay = Date.UTC(2026, 6, 1, 3, 0, 0); // 13日前 (2週目バケットの範囲外想定)
    const recentDay = Date.UTC(2026, 6, 13, 3, 0, 0); // 直近週
    const attempts = [
      attempt({ subject: "C", answeredAt: oldWeekDay, correct: false }),
      attempt({ subject: "C", answeredAt: recentDay, correct: true }),
      attempt({ subject: "D", answeredAt: recentDay, correct: true }), // 別科目は含めない
    ];
    const buckets = weeklyAccuracyBySubject(attempts, "C", 2, now);
    expect(buckets).toHaveLength(2);
    // 最後のバケットが直近週で、正答1件を含む
    const last = buckets[1];
    expect(last?.total).toBe(1);
    expect(last?.correct).toBe(1);
  });

  it("ウィンドウ外の attempt は無視する", () => {
    const now = Date.UTC(2026, 6, 14, 3, 0, 0);
    const farPast = Date.UTC(2020, 0, 1, 3, 0, 0);
    const buckets = weeklyAccuracyBySubject([attempt({ subject: "C", answeredAt: farPast })], "C", 2, now);
    expect(buckets.every((b) => b.total === 0)).toBe(true);
  });
});
