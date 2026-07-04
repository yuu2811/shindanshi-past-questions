# -*- coding: utf-8 -*-
"""レガシーPDFの誤デコード文字(cidではなく間違った文字に化けるもの)をOCR文脈整合で解決。
対象:
 (1) ZZ-PI* フォントの全文字 (記号Piフォント: 安=−, 暗=＝ 等、漢字にすら化ける)
 (2) レガシー本文フォント(Pr6系, 非Pr6N)の疑義記号 (»¿«“”„ˇ£¢⁄æ‰’— 等、ファイル毎にマップ相違)
出力: work/out/legacy_charmaps.json  {file: {"FULLFONT|CHR|c": {char, votes, n_occ, conf}}}
"""
import pdfplumber, json, os, sys
from collections import defaultdict, Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from resolve_legacy_cids import ocr_strip, extract_target, norm, FILES

# 本文フォントの疑義記号(OCRが裁定; 未解決時はTIERで処理を分岐)
SUSPECT_HARD = set('»¿«“”„‰æ£¢⁄’‛ˇ¢£')          # 未解決→〓
SUSPECT_SOFT = set('…—―$&<>~×÷±§†‡•·‥')         # 未解決→原文維持
def is_legacy_body(fn):
    base = fn.split("+")[-1]
    return ("Pr6-" in base) and ("Pr6N" not in base)
def is_pi(fn):
    return "ZZ-PI" in fn

def process_file(path):
    occ = defaultdict(list)
    with pdfplumber.open(path) as pdf:
        for pno, pg in enumerate(pdf.pages):
            chs = pg.chars
            for i, c in enumerate(chs):
                t = c["text"]
                if len(t) != 1 or t.startswith("(cid:"):
                    continue
                fn = c["fontname"]
                if is_pi(fn) or (is_legacy_body(fn) and (t in SUSPECT_HARD or t in SUSPECT_SOFT)):
                    line = sorted([x for x in chs if abs(x["top"] - c["top"]) < 3.0],
                                  key=lambda x: x["x0"])
                    pos = next(j for j, x in enumerate(line) if x is c)
                    pre = "".join(x["text"] for x in line[max(0, pos-7):pos]
                                  if not x["text"].startswith("(cid:"))
                    post = "".join(x["text"] for x in line[pos+1:pos+8]
                                   if not x["text"].startswith("(cid:"))
                    occ[(fn, t)].append((pno, i, norm(pre), norm(post)))
        fmap = {}
        for (fn, ch), lst in occ.items():
            votes = Counter()
            for pno, i, pre, post in lst[:5]:
                pg = pdf.pages[pno]
                c = pg.chars[i]
                got = None
                for psm in ("7", "6"):
                    txt = ocr_strip(pg, c, psm=psm)
                    got = extract_target(txt, pre, post)
                    if got:
                        break
                if got:
                    votes[got] += 1
                if votes and votes.most_common(1)[0][1] >= 2:
                    break
            key = f"{fn}|CHR|{ch}"
            if votes:
                res, n = votes.most_common(1)[0]
                conf = "high" if (n >= 2 or len(lst) == 1) and len(votes) == 1 else \
                       ("mid" if n >= 2 else "low")
                fmap[key] = {"char": res, "votes": n, "n_occ": len(lst), "conf": conf,
                             "orig": ch, "pi": is_pi(fn)}
            else:
                fmap[key] = {"char": None, "votes": 0, "n_occ": len(lst), "conf": "none",
                             "orig": ch, "pi": is_pi(fn)}
    return path, fmap

def main():
    out_path = "work/out/legacy_charmaps.json"
    existing = json.load(open(out_path)) if os.path.exists(out_path) else {}
    files = [f for f in FILES if f not in existing]
    if not files:
        print("all files already processed")
    for path in files:
        p, fmap = process_file(path)
        existing[p] = fmap
        json.dump(existing, open(out_path, "w"), ensure_ascii=False, indent=1)
        nok = sum(1 for v in fmap.values() if v["char"])
        print(f"{p}: {nok}/{len(fmap)} resolved", flush=True)
    tot = sum(len(v) for v in existing.values())
    ok = sum(1 for v in existing.values() for x in v.values() if x["char"])
    print(f"\nTOTAL: {ok}/{tot} char entries resolved, files={len(existing)}")

if __name__ == "__main__":
    main()
