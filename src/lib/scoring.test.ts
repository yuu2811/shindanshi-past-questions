import { describe, it, expect } from "vitest";
import { isCorrect, isScorable, scoreExam } from "./scoring";
import type { Question1ji, QuestionItem, Exam1ji } from "../types/data";
import type { ItemKey } from "../types/study";
import { itemKey } from "../types/study";

// @types/node 未導入(依存追加不可)のため、node:fs ではなく Vite の `?raw` インポートで
// マスターデータを文字列として読み込む(vite/client の `declare module "*?raw"` により string 型)。
import masterRaw from "../../data/master_1ji.json?raw";
import examsRaw from "../../data/exams_1ji.json?raw";

// ── テスト用ファクトリ ─────────────────────────────────────
function mkItem(partial: Partial<QuestionItem> = {}): QuestionItem {
  return {
    sub: null,
    stem: "問",
    choices: { ア: "a", イ: "b", ウ: "c", エ: "d" },
    answer: "ア",
    points: 4,
    all_correct: false,
    no_scoring: false,
    ...partial,
  };
}

let qSeq = 0;
function mkQ(items: QuestionItem[], id?: string): Question1ji {
  qSeq += 1;
  const qid = id ?? `1ji-2024-A-Q${String(qSeq).padStart(2, "0")}`;
  return {
    id: qid,
    exam_id: "1ji-2024-A",
    exam: "1ji",
    year: 2024,
    reexam: false,
    subject: "A",
    subject_name: "経済学・経済政策",
    q: qSeq,
    lead: null,
    items,
    topic_tags: [],
    figure: { flag: false, reasons: [] },
    pages: [1, 1],
    parse_status: "ok",
    issues: [],
    source: {},
  };
}

/** 各設問に正解記号を入れた解答マップを作る */
function fullyCorrectAnswers(qs: Question1ji[]): Record<ItemKey, string | null> {
  const ans: Record<ItemKey, string | null> = {};
  for (const q of qs) {
    for (const it of q.items) {
      ans[itemKey(q.id, it.sub)] = it.answer;
    }
  }
  return ans;
}

// ── isCorrect ─────────────────────────────────────────────
describe("isCorrect", () => {
  it("選択が正解と一致で true、不一致で false", () => {
    const it = mkItem({ answer: "ウ" });
    expect(isCorrect(it, "ウ")).toBe(true);
    expect(isCorrect(it, "ア")).toBe(false);
  });
  it("未回答(null)は false", () => {
    expect(isCorrect(mkItem({ answer: "ウ" }), null)).toBe(false);
  });
  it("all_correct は選択に関わらず true (未回答でも)", () => {
    const it = mkItem({ all_correct: true, answer: null });
    expect(isCorrect(it, null)).toBe(true);
    expect(isCorrect(it, "ア")).toBe(true);
  });
  it("answer:null かつ all_correct:false は常に false", () => {
    expect(isCorrect(mkItem({ answer: null }), "ア")).toBe(false);
  });
});

// ── isScorable ────────────────────────────────────────────
describe("isScorable", () => {
  it("通常設問は採点対象", () => {
    expect(isScorable(mkItem())).toBe(true);
  });
  it("no_scoring は対象外", () => {
    expect(isScorable(mkItem({ no_scoring: true }))).toBe(false);
  });
  it("answer:null かつ all_correct:false(正答未公表)は対象外", () => {
    expect(isScorable(mkItem({ answer: null, all_correct: false }))).toBe(false);
  });
  it("all_correct:true は answer:null でも対象", () => {
    expect(isScorable(mkItem({ answer: null, all_correct: true }))).toBe(true);
  });
});

// ── scoreExam 業務ルール ───────────────────────────────────
describe("scoreExam: all_correct(全員正解)", () => {
  it("未回答でも加点する", () => {
    const q = mkQ([mkItem({ all_correct: true, answer: null, points: 4 })]);
    const r = scoreExam({ questions: [q], answers: {} });
    expect(r.score).toBe(4);
    expect(r.maxScore).toBe(4);
    expect(r.nCorrect).toBe(1);
    expect(r.nTotal).toBe(1);
  });
  it("誤った選択をしていても加点する", () => {
    const q = mkQ([mkItem({ all_correct: true, answer: null, points: 4 })]);
    const r = scoreExam({
      questions: [q],
      answers: { [itemKey(q.id, null)]: "イ" },
    });
    expect(r.score).toBe(4);
    expect(r.maxScore).toBe(4);
  });
});

describe("scoreExam: no_scoring(採点対象外)", () => {
  it("得点・満点の双方から除外される", () => {
    const scored = mkItem({ points: 4, answer: "ア" });
    const skipped = mkItem({ points: 4, no_scoring: true, answer: "ア" });
    const q = mkQ([scored, skipped]);
    // scored のみ sub 付与して別 key にする
    scored.sub = 1;
    skipped.sub = 2;
    const r = scoreExam({
      questions: [q],
      answers: { [itemKey(q.id, 1)]: "ア", [itemKey(q.id, 2)]: "ア" },
    });
    expect(r.maxScore).toBe(4); // skipped の 4 点は満点に含めない
    expect(r.score).toBe(4);
    expect(r.nTotal).toBe(1);
  });
});

describe("scoreExam: answer:null かつ all_correct:false(正答未公表)", () => {
  it("採点対象外として得点・満点から除外", () => {
    const normal = mkItem({ sub: 1, points: 4, answer: "ア" });
    const unpublished = mkItem({
      sub: 2,
      points: 3,
      answer: null,
      all_correct: false,
    });
    const q = mkQ([normal, unpublished]);
    const r = scoreExam({
      questions: [q],
      answers: { [itemKey(q.id, 1)]: "ア" },
    });
    expect(r.maxScore).toBe(4); // 未公表 3 点は含めない
    expect(r.score).toBe(4);
    expect(r.nTotal).toBe(1);
  });
});

describe("scoreExam: points:null", () => {
  it("採点対象の points:null は 0 点として扱う", () => {
    const q = mkQ([
      mkItem({ sub: 1, points: 4, answer: "ア" }),
      mkItem({ sub: 2, points: null, answer: "ア" }),
    ]);
    const r = scoreExam({
      questions: [q],
      answers: { [itemKey(q.id, 1)]: "ア", [itemKey(q.id, 2)]: "ア" },
    });
    expect(r.maxScore).toBe(4); // 4 + 0
    expect(r.score).toBe(4);
    expect(r.nTotal).toBe(2); // 対象数には数える
  });
});

// ── 合否・足切り境界 ───────────────────────────────────────
/** points 合計 max、うち correctPts を正解にする単純な試験を作る */
function examWithRatio(maxPts: number, correctPts: number): Question1ji {
  const items: QuestionItem[] = [];
  items.push(mkItem({ sub: 1, points: correctPts, answer: "ア" }));
  if (maxPts - correctPts > 0) {
    items.push(mkItem({ sub: 2, points: maxPts - correctPts, answer: "ア" }));
  }
  return mkQ(items);
}

describe("scoreExam: 合否・足切りの境界", () => {
  it("60%ちょうどは合格 (passed=true)", () => {
    const q = examWithRatio(100, 60);
    const r = scoreExam({ questions: [q], answers: { [itemKey(q.id, 1)]: "ア" } });
    expect(r.ratio).toBeCloseTo(0.6, 10);
    expect(r.passed).toBe(true);
    expect(r.belowFloor).toBe(false);
  });
  it("59% は不合格 (passed=false)", () => {
    const q = examWithRatio(100, 59);
    const r = scoreExam({ questions: [q], answers: { [itemKey(q.id, 1)]: "ア" } });
    expect(r.passed).toBe(false);
  });
  it("40%ちょうどは足切りではない (belowFloor=false)", () => {
    const q = examWithRatio(100, 40);
    const r = scoreExam({ questions: [q], answers: { [itemKey(q.id, 1)]: "ア" } });
    expect(r.ratio).toBeCloseTo(0.4, 10);
    expect(r.belowFloor).toBe(false);
    expect(r.passed).toBe(false);
  });
  it("39.9% は足切り (belowFloor=true)", () => {
    const q = examWithRatio(1000, 399);
    const r = scoreExam({ questions: [q], answers: { [itemKey(q.id, 1)]: "ア" } });
    expect(r.ratio).toBeCloseTo(0.399, 10);
    expect(r.belowFloor).toBe(true);
  });
  it("採点対象が皆無なら ratio=0(足切り扱い)", () => {
    const q = mkQ([mkItem({ no_scoring: true })]);
    const r = scoreExam({ questions: [q], answers: {} });
    expect(r.maxScore).toBe(0);
    expect(r.ratio).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.belowFloor).toBe(true);
  });
});

// ── 設問分割(items 複数・sub 付き)の採点 ─────────────────
describe("scoreExam: 設問分割 (sub 付き複数 item)", () => {
  it("sub ごとに正誤を判定し合算する", () => {
    const q = mkQ([
      mkItem({ sub: 1, points: 2, answer: "ア" }),
      mkItem({ sub: 2, points: 3, answer: "イ" }),
      mkItem({ sub: 3, points: 5, answer: "ウ" }),
    ]);
    const r = scoreExam({
      questions: [q],
      answers: {
        [itemKey(q.id, 1)]: "ア", // 正
        [itemKey(q.id, 2)]: "ウ", // 誤
        [itemKey(q.id, 3)]: "ウ", // 正
      },
    });
    expect(r.maxScore).toBe(10);
    expect(r.score).toBe(7); // 2 + 5
    expect(r.nCorrect).toBe(2);
    expect(r.nTotal).toBe(3);
  });

  it("複数問(lead 分割型)をまたいで合算する", () => {
    const q1 = mkQ(
      [
        mkItem({ sub: 1, points: 4, answer: "ア" }),
        mkItem({ sub: 2, points: 4, answer: "イ" }),
      ],
      "1ji-2024-A-Q01",
    );
    const q2 = mkQ([mkItem({ sub: null, points: 4, answer: "エ" })], "1ji-2024-A-Q02");
    const r = scoreExam({
      questions: [q1, q2],
      answers: {
        [itemKey(q1.id, 1)]: "ア",
        [itemKey(q1.id, 2)]: "イ",
        [itemKey(q2.id, null)]: "エ",
      },
    });
    expect(r.maxScore).toBe(12);
    expect(r.score).toBe(12);
    expect(r.nTotal).toBe(3);
  });
});

// ── 実データ整合性テスト ───────────────────────────────────
describe("実データ: 全問正解で採点した満点が公式 total_points と一致する", () => {
  const master = JSON.parse(masterRaw) as Question1ji[];
  const exams = JSON.parse(examsRaw) as Exam1ji[];

  // exam_id ごとに問題をまとめる
  const byExam = new Map<string, Question1ji[]>();
  for (const q of master) {
    const arr = byExam.get(q.exam_id);
    if (arr) arr.push(q);
    else byExam.set(q.exam_id, [q]);
  }

  // 既知の差分: 正答未公表(answer:null かつ !all_correct)の採点対象外設問により、
  // 公式 total_points より maxScore が不足する試験(調査結果は完了レポート参照)。
  //   1ji-2021-G  : Q22 sub2 = 3点  (公式は 100 点だが採点可能は 97 点)
  //   1ji-2023S-C : Q33      = 3点  (同上)
  const KNOWN_SHORTFALL: Record<string, number> = {
    "1ji-2021-G": 3,
    "1ji-2023S-C": 3,
  };

  it("84試験すべてを走査する", () => {
    expect(exams.length).toBe(84);
    for (const e of exams) {
      expect(byExam.has(e.exam_id)).toBe(true);
    }
  });

  it("各試験で全問正解の得点 = 満点、満点と total_points の差は既知分のみ", () => {
    const unexpected: string[] = [];
    for (const e of exams) {
      const qs = byExam.get(e.exam_id) ?? [];
      const answers = fullyCorrectAnswers(qs);
      const r = scoreExam({ questions: qs, answers });
      // 全問正解なら採点対象は満点になる
      expect(r.score).toBe(r.maxScore);
      const shortfall = e.total_points - r.maxScore;
      const expected = KNOWN_SHORTFALL[e.exam_id] ?? 0;
      if (shortfall !== expected) {
        unexpected.push(
          `${e.exam_id}: total_points=${e.total_points} maxScore=${r.maxScore} shortfall=${shortfall} (expected ${expected})`,
        );
      }
    }
    expect(unexpected).toEqual([]);
  });

  it("既知差分の試験以外は maxScore が total_points に一致する", () => {
    for (const e of exams) {
      if (e.exam_id in KNOWN_SHORTFALL) continue;
      const qs = byExam.get(e.exam_id) ?? [];
      const r = scoreExam({ questions: qs, answers: fullyCorrectAnswers(qs) });
      expect(r.maxScore).toBe(e.total_points);
    }
  });
});
