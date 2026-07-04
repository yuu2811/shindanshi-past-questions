// 2次答案下書きの自動保存フック。db.drafts (端末内 IndexedDB) にのみ保存する。
// 外部送信は一切行わない(CLAUDE.md / REQUIREMENTS §2.1)。
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../../db/db";
import { draftKey } from "./normalize";

const AUTOSAVE_DEBOUNCE_MS = 500;

export interface UseDraftResult {
  text: string;
  /** テキストを更新し、デバウンス後に保存する */
  setText: (next: string) => void;
  /** 初回ロード完了フラグ(未ロード中はtextareaを操作させない) */
  loaded: boolean;
}

export function useDraft(caseId: string, q: number, sub: number): UseDraftResult {
  const key = draftKey(caseId, q, sub);
  const [text, setTextState] = useState("");
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    pendingRef.current = null;
    void db.drafts.get(key).then((d) => {
      if (!active) return;
      setTextState(d?.text ?? "");
      setLoaded(true);
    });
    return () => {
      active = false;
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      // アンマウント時は保留中の変更を即時フラッシュしてから離脱する
      if (pendingRef.current !== null) {
        const flushText = pendingRef.current;
        void db.drafts.put({
          key,
          caseId,
          q,
          sub: sub === 0 ? null : sub,
          text: flushText,
          updatedAt: Date.now(),
        });
      }
    };
  }, [key, caseId, q, sub]);

  const setText = useCallback(
    (next: string) => {
      setTextState(next);
      pendingRef.current = next;
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void db.drafts.put({
          key,
          caseId,
          q,
          sub: sub === 0 ? null : sub,
          text: next,
          updatedAt: Date.now(),
        });
        pendingRef.current = null;
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [key, caseId, q, sub],
  );

  return { text, setText, loaded };
}
