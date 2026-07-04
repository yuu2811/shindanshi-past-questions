# -*- coding: utf-8 -*-
"""マスターデータ統合: 問題(parse_questions) + 正解(parse_answers) + 出典URL(manifest)
+ 論点タグ(taxonomy keyword_v1) → handoff/data/master_1ji.json / exams_1ji.json
"""
import json, csv, re

YEARS = ["2015","2016","2017","2018","2019","2020","2021","2022","2023","2023S","2024","2025"]
SUBS = "ABCDEFG"
SUBJECT_NAMES = {"A":"経済学・経済政策","B":"財務・会計","C":"企業経営理論","D":"運営管理",
                 "E":"経営法務","F":"経営情報システム","G":"中小企業経営・中小企業政策"}
DURATION = {"A":60,"B":60,"C":90,"D":90,"E":60,"F":60,"G":90}  # 各年度PDF表紙から実測(全年度一致)

def load_manifest():
    m = {}
    with open("work/manifest.csv", newline="") as f:
        for row in csv.DictReader(f):
            m[(row["year"], row["kind"], row["subject"])] = row["url"]
    return m

def tagger(tax):
    rules = {S: [(t["tag"], t["keywords"]) for t in tax["subjects"][S]["topics"]] for S in SUBS}
    def tag(S, text):
        hits = [t for t, kws in rules[S] if any(k in text for k in kws)]
        return hits or ["未分類"]
    return tag

def main():
    ans = json.load(open("work/out/answers_raw.json"))
    tax = json.load(open("handoff/data/taxonomy_1ji.json"))
    manifest = load_manifest()
    tag = tagger(tax)
    master, exams = [], []
    for year in YEARS:
        yr = int(year.rstrip("S"))
        reexam = year.endswith("S")
        for S in SUBS:
            qd = json.load(open(f"work/out/questions/{year}_{S}.json"))
            a = ans[year][S]
            amap = {}
            for r in a["records"]:
                amap[(r["q"], r["sub"])] = r
            mondai_url = manifest.get((year, "1ji_mondai", S), "")
            seikai_url = manifest.get((year, "1ji_seikai", S), "")
            exams.append({
                "exam_id": f"1ji-{year}-{S}",
                "exam": "1ji", "year": yr, "reexam": reexam,
                "subject": S, "subject_name": SUBJECT_NAMES[S],
                "duration_minutes": DURATION[S],
                "total_points": a["total_points"],
                "n_questions": a["n_questions"],
                "n_answer_cells": a["n_answer_cells"],
                "official_notes": a["notes"],
                "source": {"mondai_pdf": mondai_url, "seikai_pdf": seikai_url,
                           "local_mondai": f"sources/1ji/{year}/{S}.pdf",
                           "local_seikai": f"sources/seikai/{year}/{S}.pdf"},
            })
            for q in qd["questions"]:
                qn = q["q"]
                items = []
                if "setsumon" in q:
                    for s in q["setsumon"]:
                        r = amap.get((qn, s["sub"]))
                        items.append(build_item(s["sub"], s["stem"], s["choices"], r))
                else:
                    r = amap.get((qn, None))
                    items.append(build_item(None, q.get("stem"), q.get("choices"), r))
                txt = (q.get("lead") or "") + "".join((i["stem"] or "") for i in items) \
                      + "".join(" ".join(i["choices"].values()) for i in items if i["choices"])
                master.append({
                    "id": f"1ji-{year}-{S}-Q{qn:02d}",
                    "exam_id": f"1ji-{year}-{S}",
                    "exam": "1ji", "year": yr, "reexam": reexam,
                    "subject": S, "subject_name": SUBJECT_NAMES[S],
                    "q": qn,
                    "lead": q.get("lead"),
                    "items": items,
                    "topic_tags": [{"tag": t, "method": "keyword_v1", "confidence": "low"}
                                   for t in tag(S, txt)],
                    "figure": q["figure"],
                    "pages": q["pages"],
                    "parse_status": q["parse_status"],
                    "issues": q.get("issues", []),
                    "source": {"mondai_pdf": mondai_url, "seikai_pdf": seikai_url,
                               "local_pdf": f"sources/1ji/{year}/{S}.pdf"},
                })
    json.dump(master, open("handoff/data/master_1ji.json", "w"), ensure_ascii=False, indent=1)
    json.dump(exams, open("handoff/data/exams_1ji.json", "w"), ensure_ascii=False, indent=1)
    # 集計
    n_items = sum(len(m["items"]) for m in master)
    pts = {}
    for m in master:
        k = m["exam_id"]
        pts[k] = pts.get(k, 0) + sum(i["points"] or 0 for i in m["items"])
    bad = [k for k, v in pts.items() if v != 100]
    print(f"master: {len(master)} questions / {n_items} answer cells / {len(exams)} exams")
    print(f"配点合計!=100 の試験: {bad if bad else 'なし(全試験=100点)'}")
    tagged = sum(1 for m in master if m["topic_tags"][0]["tag"] != "未分類")
    print(f"タグ付与率: {tagged}/{len(master)} ({tagged/len(master)*100:.0f}%)")

def build_item(sub, stem, choices, r):
    return {
        "sub": sub,
        "stem": stem,
        "choices": choices or {},
        "answer": r["answer"] if r else None,
        "points": r["points"] if r else None,
        "all_correct": bool(r and r["flag"] and r["answer"] is None and r["points"] is not None),
        "no_scoring": bool(r and r["flag"] and r["points"] is None),
    }

if __name__ == "__main__":
    main()
