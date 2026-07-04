// db.questions / db.cases から検索インデックス用ドキュメント(SearchDoc[])を組み立てる。
// ここで抽出したテキストのみをWorkerへ渡す(生データそのものではなく必要な文字列だけを渡す)。
import type { Case2ji, Question1ji } from "../../types/data";
import { yearLabel } from "../../types/data";
import type { SearchDoc } from "../../workers/search.types";
import { normalizeCaseQuestions } from "../../features/niji/normalize";
import { findJikenBodyStart } from "../../features/niji/jikenBoundary";

function question1jiText(q: Question1ji): string {
  const parts: string[] = [];
  if (q.lead) parts.push(q.lead);
  for (const item of q.items) {
    parts.push(item.stem);
    parts.push(...Object.values(item.choices));
  }
  const tags = q.tagList ?? q.topic_tags.map((t) => t.tag);
  parts.push(...tags);
  return parts.join("\n");
}

export function buildQuestion1jiDocs(questions: Question1ji[]): SearchDoc[] {
  return questions.map((q) => ({
    id: q.id,
    kind: "1ji" as const,
    year: q.year,
    yearLabel: yearLabel(q.year, q.reexam),
    badgeMain: q.subject_name,
    badgeSub: `第${q.q}問`,
    q: 0,
    examId: q.exam_id,
    text: question1jiText(q),
  }));
}

export function buildCase2jiDocs(cases: Case2ji[]): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const c of cases) {
    const start = findJikenBodyStart(c.jiken, c.case);
    const bodyText = start !== null ? c.jiken.slice(start) : c.jiken;
    docs.push({
      id: `${c.id}#jiken`,
      kind: "2ji",
      year: c.year,
      yearLabel: String(c.year),
      badgeMain: c.case_name,
      badgeSub: "与件文",
      q: 0,
      caseId: c.id,
      text: bodyText,
    });

    for (const g of normalizeCaseQuestions(c.questions)) {
      const parts: string[] = [];
      if (g.lead) parts.push(g.lead);
      for (const sub of g.subQuestions) parts.push(sub.stem);
      docs.push({
        id: `${c.id}#q${g.q}`,
        kind: "2ji",
        year: c.year,
        yearLabel: String(c.year),
        badgeMain: c.case_name,
        badgeSub: `第${g.q}問`,
        q: g.q,
        caseId: c.id,
        text: parts.join("\n"),
      });
    }
  }
  return docs;
}
