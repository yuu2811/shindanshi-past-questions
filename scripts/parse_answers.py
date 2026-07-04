# -*- coding: utf-8 -*-
"""正解・配点PDFパーサー v2: 第N問x座標クラスタでカラム検出/読み順cur_q継承/合計行除外"""
import pdfplumber, re, json, os, unicodedata

Z2H = str.maketrans("０１２３４５６７８９", "0123456789")
ANS = set("アイウエオ")
DASH = {"-", "－", "‐", "―", "ー"}

def norm(s): return s.translate(Z2H)

def parse_answer_pdf(path):
    recs, notes = [], []
    cur_q = None  # carried across columns & pages (reading order)
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=1.5, y_tolerance=2)
            if not words: continue
            qws = [w for w in words if re.fullmatch(r"第[0-9０-９]+問", w["text"])]
            xs = sorted(w["x0"] for w in qws)
            clusters = []
            for x in xs:
                if clusters and x - clusters[-1][-1] < 100: clusters[-1].append(x)
                else: clusters.append([x])
            if len(clusters) >= 2:
                boundary = min(clusters[1]) - 25
                col_bounds = [(0, boundary), (boundary, page.width + 1)]
            else:
                col_bounds = [(0, page.width + 1)]
            for (cx0, cx1) in col_bounds:
                cw = [w for w in words if cx0 <= w["x0"] < cx1]
                rows = {}
                for w in cw:
                    rows.setdefault(round(w["top"] / 6), []).append(w)
                for key in sorted(rows):
                    toks = sorted(rows[key], key=lambda w: w["x0"])
                    texts = [t["text"] for t in toks]
                    joined = "".join(texts)
                    if "合計" in joined or ("合" in texts and "計" in texts):
                        continue
                    if re.search(r"(対象外|全員|受験者|お問い合わせ|訂正)", joined):
                        if re.search(r"(対象外|全員|正解として|訂正)", joined) and "お問い合わせ" not in joined:
                            notes.append(joined)
                        continue
                    m = re.search(r"第([0-9０-９]+)問", joined)
                    sq = re.search(r"設問\s*([0-9０-９])", joined)
                    if m: cur_q = int(norm(m.group(1)))
                    payload = []
                    for t in texts:
                        t2 = re.sub(r"＊+", "", t)
                        t2 = re.sub(r"第[0-9０-９]+問", "", t2)
                        t2 = re.sub(r"設問[0-9０-９]+", "", t2)
                        t2 = t2.strip()
                        if t2: payload.append(t2)
                    ans_letters = [p for p in payload if p in ANS]
                    pts_nums = [p for p in payload if re.fullmatch(r"[0-9０-９]+", norm(p))]
                    dashes = [p for p in payload if p in DASH]
                    if cur_q is None: continue
                    star = "＊" in joined
                    subq = int(norm(sq.group(1))) if sq else None
                    ans = ans_letters[0] if ans_letters else None
                    pts = int(norm(pts_nums[-1])) if pts_nums else None
                    # validity: a data row has (answer letter) or (dash where answer would be) plus something
                    is_data = bool(ans_letters) or (star and (pts is not None or dashes)) or (pts is not None and (len(dashes) >= 1 or subq is not None or m))
                    if not is_data: continue
                    if ans is None and pts is not None and pts >= 50: continue  # residue safety
                    recs.append({"q": cur_q, "sub": subq, "answer": ans, "points": pts, "flag": star})
    seen, out = set(), []
    for r in recs:
        k = (r["q"], r["sub"])
        if k in seen: continue
        seen.add(k); out.append(r)
    return out, notes

def main():
    result, qc = {}, []
    for yd in sorted(os.listdir("sources/seikai")):
        for f in sorted(os.listdir(f"sources/seikai/{yd}")):
            S = f[0]
            recs, notes = parse_answer_pdf(f"sources/seikai/{yd}/{f}")
            total = sum(r["points"] or 0 for r in recs)
            nq = len(set(r["q"] for r in recs))
            result.setdefault(yd, {})[S] = {"records": recs, "notes": notes,
                "total_points": total, "n_questions": nq, "n_answer_cells": len(recs)}
            qc.append((yd, S, nq, len(recs), total, "OK" if total == 100 else "CHECK", "|".join(notes)[:60]))
    os.makedirs("work/out", exist_ok=True)
    with open("work/out/answers_raw.json", "w") as fp:
        json.dump(result, fp, ensure_ascii=False, indent=1)
    bad = 0
    for row in qc:
        if row[5] != "OK":
            bad += 1
            print(f"{row[0]:7}{row[1]:3}{row[2]:>4}{row[3]:>6}{row[4]:>5}  {row[5]}  {row[6]}")
    print("Total files:", len(qc), " NG:", bad)

if __name__ == "__main__":
    main()
