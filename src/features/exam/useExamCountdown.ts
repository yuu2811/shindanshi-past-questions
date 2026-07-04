// 模試タイマー。startedAt 基準で残り秒を毎秒算出する(session.ts の設計判断参照)。
// 残り 0 で onExpire を一度だけ呼ぶ(時間切れ→自動採点のトリガ)。
import { useEffect, useRef, useState } from "react";

export interface Countdown {
  remainingSec: number;
  expired: boolean;
}

export function useExamCountdown(
  startedAt: number | null,
  durationSec: number,
  onExpire: () => void,
): Countdown {
  const [remainingSec, setRemainingSec] = useState<number>(durationSec);
  const [expired, setExpired] = useState<boolean>(false);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const rem = Math.max(0, durationSec - elapsed);
      setRemainingSec(rem);
      if (rem <= 0) {
        setExpired(true);
        if (!firedRef.current) {
          firedRef.current = true;
          onExpireRef.current();
        }
      }
    };
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, [startedAt, durationSec]);

  return { remainingSec, expired };
}

/** 秒 → "mm:ss" / "h:mm:ss"。 */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(h > 0 ? m : m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
