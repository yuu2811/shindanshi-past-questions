# -*- coding: utf-8 -*-
"""2015-2017 レガシーPDFの (cid:N) をOCR+文脈整合で解決し、ファイル単位マップを構築。
方式: 各(file, subset_font, cid)につき最大3出現箇所の周辺ストリップを300dpiで描画→
tesseract(jpn+eng)でOCR→既知の前後文脈と整合させて◆位置の文字を抽出→多数決+一貫性検証。
出力: work/out/legacy_cidmaps.json  {file: {"font|cid": {"char": c, "votes": n, "conf": "..."}}}
"""
import pdfplumber, subprocess, re, json, os, unicodedata
from collections import defaultdict, Counter

FILES = [(f"sources/1ji/{y}/{S}.pdf") for y in ["2015","2016","2017"] for S in "ABCDEFG"] + \
        [(f"sources/2ji/{y}/{S}.pdf") for y in ["2015","2016","2017"] for S in "ABCD"]

def norm(s):
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"[\s\u3000]+", "", s)

def ocr_strip(pg, c, pad_l=110, pad_r=110, psm="7"):
    bbox = (max(0, c["x0"]-pad_l), max(0, c["top"]-6),
            min(pg.width, c["x1"]+pad_r), min(pg.height, c["bottom"]+6))
    tmp = f"/tmp/_strip_{os.getpid()}.png"
    im = pg.crop(bbox).to_image(resolution=300).original
    im.save(tmp)
    r = subprocess.run(["tesseract", tmp, "-", "-l", "jpn+eng", "--psm", psm],
                       capture_output=True)
    return r.stdout.decode("utf-8", "ignore").strip()

def extract_target(ocr_text, pre, post):
    """OCR結果から pre◆post の◆を抽出。pre/postは正規化済み文字列(各3+文字)。"""
    t = norm(ocr_text)
    for plen in range(min(4, len(pre)), 0, -1):
        for slen in range(min(4, len(post)), 0, -1):
            if plen + slen < 2:
                continue
            p, s = pre[-plen:], post[:slen]
            m = re.search(re.escape(p) + r"(.{1,2}?)" + re.escape(s), t)
            if m and len(m.group(1)) == 1:
                return m.group(1)
    return None

def process_file(path):
    result = {}
    for path in [path]:
        occ = defaultdict(list)  # (font,cid) -> [(pno, char_idx, pre, post)]
        with pdfplumber.open(path) as pdf:
            for pno, pg in enumerate(pdf.pages):
                chs = pg.chars
                for i, c in enumerate(chs):
                    if c["text"].startswith("(cid:"):
                        fn = c["fontname"]
                        # 同一行(top±3pt)の物理隣接文字のみでコンテキストを構築
                        line = sorted([x for x in chs
                                       if abs(x["top"] - c["top"]) < 3.0], key=lambda x: x["x0"])
                        pos = next(j for j, x in enumerate(line)
                                   if x is c)
                        pre = "".join(x["text"] for x in line[max(0,pos-7):pos]
                                      if not x["text"].startswith("(cid:"))
                        post = "".join(x["text"] for x in line[pos+1:pos+8]
                                       if not x["text"].startswith("(cid:"))
                        occ[(fn, c["text"])].append((pno, i, norm(pre), norm(post)))
            fmap = {}
            for (fn, cid), lst in occ.items():
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
                if votes:
                    ch, n = votes.most_common(1)[0]
                    conf = "high" if (n >= 2 or len(lst) == 1) and len(votes) == 1 else \
                           ("mid" if n >= 2 else "low")
                    fmap[f"{fn}|{cid}"] = {"char": ch, "votes": n,
                                           "n_occ": len(lst), "conf": conf}
                else:
                    fmap[f"{fn}|{cid}"] = {"char": None, "votes": 0,
                                           "n_occ": len(lst), "conf": "none"}
        n_ok = sum(1 for v in fmap.values() if v["char"])
        print(f"{path}: {n_ok}/{len(fmap)} resolved", flush=True)
        return path, fmap

def main():
    import sys
    from multiprocessing import Pool
    files = FILES
    if len(sys.argv) == 3:
        files = FILES[int(sys.argv[1]):int(sys.argv[2])]
    existing = {}
    if os.path.exists("work/out/legacy_cidmaps.json"):
        existing = json.load(open("work/out/legacy_cidmaps.json"))
    files = [f for f in files if f not in existing]  # レジューム
    if not files:
        print("all files already processed")
    else:
        with Pool(min(8, os.cpu_count() or 4)) as pool:
            for path, fmap in pool.imap_unordered(process_file, files):
                existing[path] = fmap
                json.dump(existing, open("work/out/legacy_cidmaps.json", "w"),
                          ensure_ascii=False, indent=1)  # 逐次保存
    tot = sum(len(v) for v in existing.values())
    ok = sum(1 for v in existing.values() for x in v.values() if x["char"])
    print(f"\nTOTAL(merged): {ok}/{tot} entries resolved, files={len(existing)}")

if __name__ == "__main__":
    main()
