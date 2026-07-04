// public/data/*.json → IndexedDB への初回取込。以後はネットワーク不要。
// Fail Loud: スキーマ不一致・欠損は起動時に例外で明示する。
import { db } from "../db/db";
import type {
  Question1ji,
  Exam1ji,
  Master2ji,
  Taxonomy1ji,
  SourcesShushi,
} from "../types/data";

/** データ取込バージョン。data/ 更新時にインクリメントすると再取込される */
export const DATA_VERSION = 1;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`データ取得失敗: ${path} (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

function assertQuestionShape(q: Question1ji): void {
  if (
    typeof q.id !== "string" ||
    !Array.isArray(q.items) ||
    q.items.length === 0 ||
    typeof q.year !== "number" ||
    typeof q.subject !== "string"
  ) {
    throw new Error(`master_1ji.json スキーマ不一致: ${JSON.stringify(q).slice(0, 200)}`);
  }
}

export async function isDataLoaded(): Promise<boolean> {
  const v = await db.meta.get("dataVersion");
  return v !== undefined && Number(v.value) >= DATA_VERSION;
}

/** 初回(またはバージョン更新時)にデータを IndexedDB へ取り込む */
export async function ensureDataLoaded(
  onProgress?: (msg: string) => void,
): Promise<void> {
  if (await isDataLoaded()) return;

  onProgress?.("問題データを読み込み中…");
  const [questions, exams, master2ji] = await Promise.all([
    fetchJson<Question1ji[]>("/data/master_1ji.json"),
    fetchJson<Exam1ji[]>("/data/exams_1ji.json"),
    fetchJson<Master2ji>("/data/master_2ji.json"),
  ]);

  if (questions.length === 0 || exams.length === 0 || master2ji.cases.length === 0) {
    throw new Error("データが空です (master_1ji / exams_1ji / master_2ji)");
  }
  for (const q of questions) assertQuestionShape(q);

  // Dexie multiEntry index 用にタグ名を非正規化
  for (const q of questions) {
    q.tagList = q.topic_tags.map((t) => t.tag);
  }

  onProgress?.("データベースへ保存中…");
  await db.transaction("rw", [db.questions, db.exams, db.cases, db.meta], async () => {
    await db.questions.clear();
    await db.exams.clear();
    await db.cases.clear();
    await db.questions.bulkPut(questions);
    await db.exams.bulkPut(exams);
    await db.cases.bulkPut(master2ji.cases);
    await db.meta.put({ key: "dataVersion", value: DATA_VERSION });
    await db.meta.put({ key: "loadedAt", value: Date.now() });
  });
  onProgress?.("完了");
}

/** タクソノミと出題の趣旨は軽量なので都度 fetch (PWAプリキャッシュ済) */
export function fetchTaxonomy(): Promise<Taxonomy1ji> {
  return fetchJson<Taxonomy1ji>("/data/taxonomy_1ji.json");
}

export function fetchSourcesShushi(): Promise<SourcesShushi> {
  return fetchJson<SourcesShushi>("/data/sources_shushi.json");
}
