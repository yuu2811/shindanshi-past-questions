# -*- coding: utf-8 -*-
"""2次試験(筆記)PDFの構造化: 与件文 / 設問(配点付き) / 設問サブ分割。
対象: 2018-2025 (レガシー2015-2017はcidmap解決後にYEARSへ追加)。
QC: 各事例の配点合計=100点、問番号連番。
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfplumber
from parse_questions import fix_page_chars, build_cid_map, clean_lines, smart_join, zi, ZWSP

YEARS = ["2015","2016","2017","2018","2019","2020","2021","2022","2023","2024","2025"]
CASES = "ABCD"
CASE_NAMES = {"A": "事例Ⅰ(組織・人事)", "B": "事例Ⅱ(マーケティング・流通)",
              "C": "事例Ⅲ(生産・技術)", "D": "事例Ⅳ(財務・会計)"}

Q_RE = re.compile(r'^第\s*([0-9０-９〓]{1,2})\s*問\s*.{0,2}\s*配\s*点\s*([0-9０-９]{1,3})\s*点')
SUB_RE = re.compile(r'^[^\u3040-\u9fff]?\s*設\s*問\s*([0-9０-９〓])\s*[^\u3040-\u9fffア-ン]?')

def parse_file(year, C, legacy_maps=None):
    path = f"sources/2ji/{year}/{C}.pdf"
    all_lines, pagemeta, file_issues = [], [], []
    with pdfplumber.open(path) as pdf:
        pages_chars = [pg.chars for pg in pdf.pages]
        for pg, chs in zip(pdf.pages, pages_chars):
            unknown = fix_page_chars(chs, getattr(pg, "cropbox", None))
            for fn, t in unknown:
                file_issues.append(f"unknown_symbol_glyph:{fn}:{t!r}")
        # レガシーcidマップ適用(あれば) → 残余は文脈整合 → 最後は〓
        if legacy_maps and path in legacy_maps:
            lm = legacy_maps[path]
            for chs in pages_chars:
                for c in chs:
                    if c["text"].startswith("(cid:"):
                        k = f'{c["fontname"]}|{c["text"]}'
                        v = lm.get(k)
                        if v and v.get("char"):
                            c["text"] = v["char"]
        if year not in ("2015", "2016", "2017") and \
           any(c["text"].startswith("(cid:") for chs in pages_chars for c in chs):
            cidmap = build_cid_map(path, pages_chars)
            for chs in pages_chars:
                for c in chs:
                    if c["text"].startswith("(cid:"):
                        c["text"] = cidmap.get(c["text"], "〓")
        for chs in pages_chars:
            for c in chs:
                if c["text"].startswith("(cid:"):
                    c["text"] = "〓"
        for pno, pg in enumerate(pdf.pages, 1):
            t = (pg.extract_text(x_tolerance=1.5) or "").replace(ZWSP, "")
            pagemeta.append({"images": len(pg.images), "curves": len(pg.curves)})
            for ln in clean_lines(t):
                all_lines.append((pno, ln))
    # 与件文と設問の分割
    anchors = []
    expect = 1
    for idx, (pno, ln) in enumerate(all_lines):
        m = Q_RE.match(ln)
        if m:
            g = m.group(1)
            qn = expect if g == "〓" else None
            if qn is None:
                try: qn = zi(g)
                except ValueError: continue
            if qn == expect:
                anchors.append((idx, qn, zi(m.group(2)), pno))
                expect += 1
    if not anchors:
        return None, ["no_question_anchors"] + file_issues
    jiken_lines = [(p, l) for p, l in all_lines[:anchors[0][0]]]
    jiken = smart_join([l for _, l in jiken_lines])
    jiken_pages = sorted({p for p, _ in jiken_lines})
    questions = []
    for ai, (idx, qn, pts, pno) in enumerate(anchors):
        end = anchors[ai + 1][0] if ai + 1 < len(anchors) else len(all_lines)
        seg = all_lines[idx:end]
        pages = sorted({p for p, _ in seg})
        body = seg[1:]  # アンカー行を除外
        # 設問サブ分割
        subs = []
        cur = None
        headline = []
        for p, ln in body:
            sm = SUB_RE.match(ln)
            if sm:
                if cur:
                    subs.append(cur)
                g = sm.group(1)
                nxt = (subs[-1]["sub"] + 1) if subs else 1
                cur = {"sub": nxt if g == "〓" else zi(g), "lines": []}
                rest = ln[sm.end():].strip()
                if rest:
                    cur["lines"].append(rest)
            elif cur:
                cur["lines"].append(ln)
            else:
                headline.append(ln)
        if cur:
            subs.append(cur)
        rec = {"q": qn, "points": pts, "pages": [pages[0], pages[-1]]}
        if subs:
            rec["lead"] = smart_join(headline) or None
            rec["setsumon"] = [{"sub": s["sub"], "stem": smart_join(s["lines"])} for s in subs]
        else:
            rec["stem"] = smart_join(headline)
        questions.append(rec)
    return {"jiken": jiken, "jiken_pages": [jiken_pages[0], jiken_pages[-1]] if jiken_pages else None,
            "questions": questions, "pagemeta": pagemeta}, file_issues

def qc(rec):
    problems = []
    pts = sum(q["points"] for q in rec["questions"])
    if pts != 100:
        problems.append(f"配点合計={pts}")
    if len(rec["jiken"]) < 400:
        problems.append(f"与件文短すぎ({len(rec['jiken'])}字)")
    for q in rec["questions"]:
        body = q.get("stem") or "".join(s["stem"] or "" for s in q.get("setsumon", []))
        if len(body) < 20 and not re.search(r"(字以内|述べよ|答えよ|説明せよ)", body):
            problems.append(f"Q{q['q']}: 本文短すぎ")
        if "〓" in (q.get("stem") or "") + (q.get("lead") or "") + \
           "".join(s["stem"] or "" for s in q.get("setsumon", [])):
            problems.append(f"Q{q['q']}: unresolved_glyph(advisory)")
    return problems

def main(years=None):
    os.makedirs("work/out/2ji", exist_ok=True)
    legacy_maps = None
    if os.path.exists("work/out/legacy_cidmaps.json"):
        legacy_maps = json.load(open("work/out/legacy_cidmaps.json"))
    summary = []
    for year in (years or YEARS):
        for C in CASES:
            try:
                rec, fissues = parse_file(year, C, legacy_maps)
            except Exception as e:
                summary.append((year, C, f"EXC:{e}"))
                continue
            if rec is None:
                summary.append((year, C, f"FAIL:{fissues}"))
                continue
            problems = qc(rec)
            out = {"year": int(year), "case": C, "case_name": CASE_NAMES[C],
                   "jiken": rec["jiken"], "jiken_pages": rec["jiken_pages"],
                   "questions": rec["questions"], "qc_problems": problems,
                   "file_issues": sorted(set(fissues))}
            json.dump(out, open(f"work/out/2ji/{year}_{C}.json", "w"),
                      ensure_ascii=False, indent=1)
            summary.append((year, C, problems or "OK"))
    ok = sum(1 for *_, s in summary if s == "OK")
    print(f"2ji OK={ok}/{len(summary)}")
    for y, C, s in summary:
        if s != "OK":
            print(f"  {y}{C}: {s}")

if __name__ == "__main__":
    main()
