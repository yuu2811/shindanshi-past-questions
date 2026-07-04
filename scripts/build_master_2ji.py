# -*- coding: utf-8 -*-
"""work/out/2ji/{year}_{C}.json (44事例) → handoff/data/master_2ji.json 統合。
ID: 2ji-{year}-{C}、設問ごとに字数制約(〜字以内)を自動抽出。QC: 配点合計100/44事例。"""
import json, re, glob, os

CASE_NAMES = {"A": "事例I(組織・人事)", "B": "事例II(マーケティング・流通)",
              "C": "事例III(生産・技術)", "D": "事例IV(財務・会計)"}
LIMIT_RE = re.compile(r"([0-9０-９]{2,3})\s*字以内")

def zi(s):
    return int(s.translate(str.maketrans("０１２３４５６７８９", "0123456789")))

def limits_of(text):
    return [zi(m.group(1)) for m in LIMIT_RE.finditer(text or "")]

def main():
    cases = []
    problems = []
    for f in sorted(glob.glob("work/out/2ji/*.json")):
        d = json.load(open(f))
        year, C = d["year"], d["case"]
        qs = []
        pts_sum = 0
        for q in d["questions"]:
            pts_sum += q["points"]
            item = {"q": q["q"], "points": q["points"], "pages": q.get("pages")}
            if q.get("lead"):
                item["lead"] = q["lead"]
            if q.get("setsumon"):
                item["setsumon"] = []
                for s in q["setsumon"]:
                    st = {"sub": s["sub"], "stem": s["stem"]}
                    lm = limits_of(s["stem"])
                    if lm: st["char_limits"] = lm
                    item["setsumon"].append(st)
            else:
                item["stem"] = q.get("stem") or ""
                lm = limits_of(item["stem"]) + limits_of(item.get("lead", ""))
                if lm: item["char_limits"] = lm
            if q.get("parse_status"):
                item["parse_status"] = q["parse_status"]
            qs.append(item)
        if pts_sum != 100:
            problems.append(f"{year}{C}: 配点合計={pts_sum}")
        cases.append({
            "id": f"2ji-{year}-{C}", "year": year, "case": C,
            "case_name": CASE_NAMES[C], "jiken": d["jiken"],
            "jiken_pages": d.get("jiken_pages"), "questions": qs,
            "source_pdf": f"sources/2ji/{year}/{C}.pdf",
        })
    os.makedirs("handoff/data", exist_ok=True)
    json.dump({"cases": cases},
              open("handoff/data/master_2ji.json", "w"), ensure_ascii=False, indent=1)
    nq = sum(len(c["questions"]) for c in cases)
    nlim = sum(1 for c in cases for q in c["questions"]
               for lm in ([q.get("char_limits")] +
                          [s.get("char_limits") for s in q.get("setsumon", [])]) if lm)
    print(f"master_2ji: {len(cases)}事例 / {nq}問 / 字数制約付与 {nlim}箇所")
    print("配点QC:", problems if problems else "全44事例=100点")

if __name__ == "__main__":
    main()
