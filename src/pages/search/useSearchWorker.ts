// 検索用 Web Worker のライフサイクル管理 + デバウンス。
// 索引構築はマウント時に一度だけ行い、以後は query の変化に応じて検索のみ行う。
import { useEffect, useRef, useState } from "react";
import { db } from "../../db/db";
import { buildCase2jiDocs, buildQuestion1jiDocs } from "./buildDocs";
import type { SearchHit, WorkerRequest, WorkerResponse } from "../../workers/search.types";

export type IndexStatus = "loading" | "ready" | "error";

const SEARCH_DEBOUNCE_MS = 150;
const RESULT_LIMIT = 60;

export interface UseSearchWorkerResult {
  status: IndexStatus;
  errorMessage: string | null;
  hits: SearchHit[];
  total: number;
  /** 検索実行中(索引はready済みだが直近のクエリの結果待ち) */
  searching: boolean;
}

export function useSearchWorker(query: string): UseSearchWorkerResult {
  const [status, setStatus] = useState<IndexStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const latestHandledRef = useRef(0);
  const debounceRef = useRef<number | undefined>(undefined);

  // Worker生成 + 索引構築(マウント時に一度だけ)
  useEffect(() => {
    const worker = new Worker(new URL("../../workers/search.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "indexed") {
        setStatus("ready");
      } else if (msg.type === "results") {
        if (msg.requestId >= latestHandledRef.current) {
          latestHandledRef.current = msg.requestId;
          setHits(msg.hits);
          setTotal(msg.total);
          setSearching(false);
        }
      } else if (msg.type === "error") {
        setStatus("error");
        setErrorMessage(msg.message);
      }
    };
    worker.onerror = (e) => {
      setStatus("error");
      setErrorMessage(e.message);
    };

    Promise.all([db.questions.toArray(), db.cases.toArray()])
      .then(([questions, cases]) => {
        const docs = [...buildQuestion1jiDocs(questions), ...buildCase2jiDocs(cases)];
        const req: WorkerRequest = { type: "index", docs };
        worker.postMessage(req);
      })
      .catch((e: unknown) => {
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : String(e));
      });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // クエリ変化時、デバウンスして検索リクエストを送る
  useEffect(() => {
    if (status !== "ready") return;
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);

    if (query.trim() === "") {
      setHits([]);
      setTotal(0);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = window.setTimeout(() => {
      const worker = workerRef.current;
      if (!worker) return;
      const requestId = ++requestIdRef.current;
      const req: WorkerRequest = { type: "search", requestId, query, limit: RESULT_LIMIT };
      worker.postMessage(req);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    };
  }, [query, status]);

  return { status, errorMessage, hits, total, searching };
}
