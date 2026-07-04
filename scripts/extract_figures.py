# -*- coding: utf-8 -*-
"""figure_flag付き問題の該当ページをPNGレンダリング。
用途: アプリで図表問題は原文頁画像を併載する(テキスト化不能な図・表・グラフの正確性担保)。
出力: work/out/figures/{qid}_p{page}.png  (150dpi, 原寸)
使い方:
  python3 work/extract_figures.py            # 全figure_flag問題(1次+2次)
  python3 work/extract_figures.py 2016 A     # 年度・科目指定
  python3 work/extract_figures.py --limit 5  # スモークテスト
"""
import pdfplumber, json, glob, os, sys

OUT = "work/out/figures"
DPI = 150

def targets_1ji(year=None, sub=None):
    for f in sorted(glob.glob("work/out/questions/*.json")):
        d = json.load(open(f))
        if year and d["year"] != year: continue
        if sub and d["subject"] != sub: continue
        path = f'sources/1ji/{d["year"]}/{d["subject"]}.pdf'
        for q in d["questions"]:
            if q.get("figure", {}).get("flag"):
                qid = f'1ji-{d["year"]}-{d["subject"]}-Q{q["q"]:02d}'
                yield path, qid, q["pages"]

def targets_2ji(year=None, case=None):
    for f in sorted(glob.glob("work/out/2ji/*.json")):
        d = json.load(open(f))
        if year and d["year"] != year: continue
        if case and d["case"] != case: continue
        path = f'sources/2ji/{d["year"]}/{d["case"]}.pdf'
        # 2次は与件文に図表が付く事例(主に事例IIIのレイアウト図、事例IVの財務諸表)
        for q in d["questions"]:
            if q.get("figure", {}).get("flag"):
                qid = f'2ji-{d["year"]}-{d["case"]}-Q{q["q"]}'
                yield path, qid, q.get("pages") or []

def main():
    argv = sys.argv[1:]
    limit = None
    args = []
    i = 0
    while i < len(argv):
        if argv[i] == "--limit":
            limit = int(argv[i + 1]); i += 2
        elif argv[i].startswith("--limit="):
            limit = int(argv[i].split("=")[1]); i += 1
        else:
            args.append(argv[i]); i += 1
    year = args[0] if args else None
    sub = args[1] if len(args) > 1 else None
    os.makedirs(OUT, exist_ok=True)
    done = 0
    cache = {}
    todo = list(targets_1ji(year, sub)) + list(targets_2ji(year, sub))
    for path, qid, pages in todo:
        if limit and done >= limit:
            break
        for pno in range(pages[0], pages[-1] + 1):
            out = f"{OUT}/{qid}_p{pno:02d}.png"
            if os.path.exists(out):
                continue
            if path not in cache:
                cache = {path: pdfplumber.open(path)}  # 直近1冊のみ保持(メモリ節約)
            pdf = cache[path]
            if pno - 1 >= len(pdf.pages):
                continue
            im = pdf.pages[pno - 1].to_image(resolution=DPI).original
            im.save(out)
        done += 1
        print(f"{qid}: p{pages[0]}-{pages[-1]}", flush=True)
    print(f"rendered questions: {done} / total flagged: {len(todo)}")

if __name__ == "__main__":
    main()
