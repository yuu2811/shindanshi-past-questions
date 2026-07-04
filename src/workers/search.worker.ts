// 全文検索用 Web Worker。索引構築・検索処理をUIスレッドから分離する。
// 過去問本文はここでも端末内メモリ上で処理するだけで、外部へは送出しない。
/// <reference lib="webworker" />
import type { SearchDoc, SearchHit, WorkerRequest, WorkerResponse } from "./search.types";

interface IndexedDoc extends SearchDoc {
  textLower: string;
}

let docs: IndexedDoc[] = [];

const DEFAULT_CONTEXT = 40;

function buildHit(doc: SearchDoc, matchIndex: number, queryLen: number): SearchHit {
  const start = Math.max(0, matchIndex - DEFAULT_CONTEXT);
  const end = Math.min(doc.text.length, matchIndex + queryLen + DEFAULT_CONTEXT);
  const before = (start > 0 ? "…" : "") + doc.text.slice(start, matchIndex);
  const match = doc.text.slice(matchIndex, matchIndex + queryLen);
  const after = doc.text.slice(matchIndex + queryLen, end) + (end < doc.text.length ? "…" : "");
  return { doc, before, match, after };
}

function search(query: string, limit: number): { hits: SearchHit[]; total: number } {
  const trimmed = query.trim();
  if (trimmed === "") return { hits: [], total: 0 };
  const lowerQuery = trimmed.toLowerCase();
  const hits: SearchHit[] = [];
  let total = 0;
  for (const doc of docs) {
    const idx = doc.textLower.indexOf(lowerQuery);
    if (idx === -1) continue;
    total++;
    if (hits.length < limit) {
      hits.push(buildHit(doc, idx, trimmed.length));
    }
  }
  return { hits, total };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "index") {
    docs = msg.docs.map((d) => ({ ...d, textLower: d.text.toLowerCase() }));
    const res: WorkerResponse = { type: "indexed", count: docs.length };
    self.postMessage(res);
    return;
  }
  if (msg.type === "search") {
    try {
      const { hits, total } = search(msg.query, msg.limit);
      const res: WorkerResponse = { type: "results", requestId: msg.requestId, hits, total };
      self.postMessage(res);
    } catch (e) {
      const res: WorkerResponse = {
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      };
      self.postMessage(res);
    }
  }
};
