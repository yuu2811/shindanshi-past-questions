// 与件文(jiken)冒頭に混入する試験注意事項(受験番号の記入方法・退室禁止時間等)の
// 終端=本文開始位置を推定するヒューリスティック。
//
// 判断根拠: 全44事例の与件文を確認したところ、本文は必ず匿名化された企業名
// 「(事例記号)+社/商店街/法人/組合」(例: 「A 社は」「B 商店街は」)から始まり、
// この記号は事例記号(A〜D、半角/全角)の直後に出現する。これは注意事項の文中には
// 現れないため、初出位置を本文開始とみなせる(2015〜2025年度・全44事例で検証済み、
// 44/44件で妥当な範囲に収まることを確認)。
//
// 失敗時(パターン不一致・妥当性チェック不通過)は null を返す。呼び出し側は
// 全文をそのまま表示すればよく、実害はない(要件の「失敗しても全文表示なら害なし」)。
const FULL_WIDTH_LETTER: Record<string, string> = { A: "Ａ", B: "Ｂ", C: "Ｃ", D: "Ｄ" };
const ENTITY_SUFFIX_RE = /(社|商店街|法人|組合)(は|（|、|の|を|に)/g;
/** 誤検出を避けるための、事例記号からエンティティ語までの許容距離 */
const MAX_LOOKBACK = 8;

export function findJikenBodyStart(jiken: string, caseLetter: string): number | null {
  const full = FULL_WIDTH_LETTER[caseLetter];
  const re = new RegExp(ENTITY_SUFFIX_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(jiken)) !== null) {
    const idx = m.index;
    const back = jiken.slice(Math.max(0, idx - MAX_LOOKBACK), idx);
    const hasHalf = back.includes(caseLetter);
    const hasFull = full !== undefined && back.includes(full);
    if (!hasHalf && !hasFull) continue;

    const lastHalf = back.lastIndexOf(caseLetter);
    const lastFull = full !== undefined ? back.lastIndexOf(full) : -1;
    const lastPos = Math.max(lastHalf, lastFull);
    let start = Math.max(0, idx - MAX_LOOKBACK) + lastPos;
    // 「A A 社は」のような記号の重複表記(匿名化ラベル+本文中の呼称)も
    // まとめて本文側に含める
    while (start > 0) {
      const ch = jiken[start - 1];
      if (ch === " " || ch === caseLetter || ch === full) {
        start--;
      } else {
        break;
      }
    }

    // 妥当性チェック: ヘッダ直後すぎる/文書の大半を注意事項扱いしてしまう位置は不採用
    if (start > 30 && start < jiken.length * 0.6) {
      return start;
    }
    return null;
  }
  return null;
}
