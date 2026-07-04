# -*- coding: utf-8 -*-
"""1次試験 問題PDFパーサー (Tier1: 2018-2025 + 2023S再試験)
pdfplumberで抽出 → 第N問/（設問N）/〔解答群〕/選択肢ア-オ を構造化。
answers_raw.json との突合QCゲート内蔵。
"""
import os
import pdfplumber, re, json, os, sys
from collections import defaultdict

Z2H = str.maketrans("０１２３４５６７８９", "0123456789")
QNUM_RE   = re.compile(r'^第\s*([0-9０-９]+)\s*問(.*)$')
SETSU_RE  = re.compile(r'^[^\u3040-\u9fff]?\s*設\s*問\s*([0-9０-９〓])\s*[^\u3040-\u9fffア-ン]?(.*)$')
KAITO_RE  = re.compile(r'^.{0,1}\s*解\s*答\s*群\s*.{0,1}$')
CHOICE_RE = re.compile(r'^([ア-オ])(?:[\s　]+(.*)|$)')
PAGENUM_RE = re.compile(r'^[－ー―‐\-]?\s*[0-9０-９]+\s*[－ー―‐\-]?$')
JOBCODE_RE = re.compile(r'^([0-9０-９]?\s*[A-Z]{2,5}-\d[A-Z0-9]?|[0-9０-９]?\s*[A-Z]{0,2}KJC[-\w]*(\s+[\w.\-/: ]*)?)$')
LISTISH_RE = re.compile(r'^(・|[①-⑳㋐-㋾]|[〔【（[]|[ａ-ｚＡ-Ｚa-zA-Z][　\s]*[：:）)]|表\s|図\s|出所|注\s|＜|<)')
TERMINAL = "。：？〕」】＞>"
FIG_KW = re.compile(r'(下図|次の図|上図|グラフ|下表|次の表|上表|図表|出所[：:）)]|散布図|フローチャート|(次|以下)の資料)')
CJK = re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uff01-\uff60]')

ORDER = "アイウエオ"
YEARS = ["2015","2016","2017","2018","2019","2020","2021","2022","2023","2023S","2024","2025"]
SUBS = "ABCDEFG"

# ToUnicode欠陥フォントの決定論的補正(全グリフを300dpi描画で目視確定済み)
MMA_FIX = {
    ("MMaExtra-Regular", "1"): "<",   ("MMaExtra-Regular", "2"): ">",
    ("MMaExtra-Regular", "d"): "□",  ("MMaExtra-Regular", "i"): "△",
    ("MMaVariableA-Regular", "^"): "（", ("MMaVariableA-Regular", "h"): "）",
    ("MMaGreek-Italic", "a"): "α",   ("MMaGreek-Italic", "b"): "β",
    ("MMaGreek-Italic", "c"): "γ",   ("MMaGreek-Italic", "v"): "σ",
    ("MMaGreek-Italic", "z"): "φ",   ("MMaGreek-Italic", "|"): "χ",
    ("MMaNegate-Regular", "!"): "≠", ("MMaRelation-Regular", "E"): "≦",
    ("MMaRelation-Regular", "]"): "≒",
    ("MMaBinary-Regular", "#"): "×", ("MMaBinary-Regular", "'"): "÷",
}
BROKEN_FONTS = ("MMaExtra-", "MMaVariableA-", "MMaGreek-",
                "MMaNegate-", "MMaRelation-", "MMaBinary-")
DROP_FONTS = ("KentenGeneric",)  # 圏点(強調点)装飾グリフ→除去
ZWSP = "\u200b"

def fix_page_chars(chars, cropbox=None):
    """埋め込みToUnicode欠陥の補正・装飾グリフ除去・CropBox外(スラグ)除去。in-place変異。"""
    unknown = set()
    for c in chars:
        if not c.get("upright", True):   # 回転テキスト除去
            c["text"] = ZWSP
            continue
        if cropbox is not None:          # CropBox外=ペーストボードのスラグ等を除去
            x0, y0, x1, y1 = [float(v) for v in cropbox]
            if not (c["x0"] >= x0 - 2 and c["x1"] <= x1 + 2 and
                    c["y0"] >= y0 - 2 and c["y1"] <= y1 + 2):
                c["text"] = ZWSP
                continue
        fn = c["fontname"].split("+")[-1]
        if any(fn.startswith(d) for d in DROP_FONTS):
            c["text"] = ZWSP
            continue
        if any(fn.startswith(bf) for bf in BROKEN_FONTS):
            rep = MMA_FIX.get((fn, c["text"]))
            if rep is not None:
                c["text"] = rep
            else:
                unknown.add((fn, c["text"]))
                c["text"] = "〓"
    return unknown

def build_cid_map(path, pages_chars):
    """pdfplumberが(cid:N)化した文字を、pdftotext(poppler-data)全文との文脈整合で解決。"""
    import subprocess
    out = subprocess.run(["pdftotext", path, "-"], capture_output=True).stdout
    ref = re.sub(r"\s+", "", out.decode("utf-8", "ignore"))
    votes = defaultdict(list)
    for chs in pages_chars:
        stream = [c["text"] for c in chs if c["text"] and not c["text"].isspace() and c["text"] != ZWSP]
        for i, t in enumerate(stream):
            if t.startswith("(cid:"):
                pre = stream[max(0, i-8):i]
                post = stream[i+1:i+9]
                if len(pre) + len(post) < 5:
                    continue
                pat = ("".join("." if x.startswith("(cid:") else re.escape(x) for x in pre)
                       + "(.)"
                       + "".join("." if x.startswith("(cid:") else re.escape(x) for x in post))
                ms = {m.group(1) for m in re.finditer(pat, ref)}
                ms = {x for x in ms if ord(x) >= 0x20}  # 制御文字(pdftotext化け)は拒否
                if len(ms) == 1:
                    votes[t].append(ms.pop())
    cidmap = {}
    for cid, vs in votes.items():
        if vs and len(set(vs)) == 1:
            cidmap[cid] = vs[0]
    return cidmap

def zi(s): return int(s.translate(Z2H))

def clean_lines(page_text):
    out = []
    for ln in page_text.split("\n"):
        ln = ln.strip()
        if not ln: continue
        low = ln.lower()
        if "iinndddd" in low: continue            # InDesign 二重化スラグ
        if PAGENUM_RE.match(ln): continue         # 単独ページ番号
        if JOBCODE_RE.match(ln): continue         # 印刷ジョブコード (KJC-1D 等)
        if "この頁は余白" in ln or "このページは余白" in ln or "メモ用" in ln: continue
        out.append(ln)
    return out

def smart_join(lines):
    """折返し行を結合。リスト様行・終端記号後は改行維持。"""
    if not lines: return ""
    buf = lines[0]
    for ln in lines[1:]:
        prev = buf[-1] if buf else ""
        if LISTISH_RE.match(ln) or (prev in TERMINAL):
            buf += "\n" + ln
        elif prev.isascii() and prev.isalnum() and ln[0].isascii() and ln[0].isalnum():
            buf += " " + ln
        elif CJK.search(prev) or prev in "、，・（(」』０１２３４５６７８９" or ln[0]:
            buf += ln
        else:
            buf += "\n" + ln
    return buf

def split_inline_choices(ln, expected):
    """1行内に複数選択肢が横並びの場合を分割。期待順に一致するトークンのみ区切りとして採用。
    返値: (leading_text, [(letter, text), ...])"""
    hits = []
    for m in re.finditer(r'(?:^|[\s　])([ア-オ])(?=[\s　]|$)', ln):
        hits.append((m.start(1), m.group(1)))
    seq = []
    exp = expected
    for pos, letter in hits:
        if exp < 5 and letter == ORDER[exp]:
            seq.append((pos, letter))
            exp += 1
    if not seq:
        return ln, []
    lead = ln[:seq[0][0]].strip()
    parts = []
    for i, (pos, letter) in enumerate(seq):
        end = seq[i+1][0] if i+1 < len(seq) else len(ln)
        parts.append((letter, ln[pos+1:end].strip()))
    return lead, parts

def parse_segment(lines):
    """1設問(または設問なし1問)分の行 → (stem, choices, issues)"""
    issues = []
    # 〔解答群〕優先: あれば以降のみ選択肢領域
    kaito_idx = None
    for i, ln in enumerate(lines):
        if KAITO_RE.match(ln):
            kaito_idx = i
            break
    choices = {}
    cur = None
    expected = 0
    if kaito_idx is not None:
        scan = lines[kaito_idx+1:]
        stem_lines = list(lines[:kaito_idx])
        stem_scan_mode = False
    else:
        scan = lines
        stem_scan_mode = True
        stem_lines = []
    for ln in scan:
        lead, parts = split_inline_choices(ln, expected)
        if parts:
            if lead:
                if cur is not None:
                    choices[cur] = (choices[cur] + "\n" + lead) if choices[cur] else lead
                elif stem_scan_mode:
                    stem_lines.append(lead)
                else:
                    stem_lines.append(lead)
                    issues.append(f"warn_pre_choice_line:{lead[:20]}")
            for letter, text in parts:
                choices[letter] = text
                cur = letter
                expected += 1
        elif cur is not None:
            t = choices[cur]
            prev = t[-1] if t else ""
            if not t:
                choices[cur] = ln
            elif LISTISH_RE.match(ln) or prev in TERMINAL:
                choices[cur] = t + "\n" + ln
            elif prev.isascii() and prev.isalnum() and ln[0].isascii() and ln[0].isalnum():
                choices[cur] = t + " " + ln
            else:
                choices[cur] = t + ln
        else:
            stem_lines.append(ln)
            if not stem_scan_mode:
                issues.append(f"warn_pre_choice_line:{ln[:20]}")
    stem = smart_join(stem_lines)
    if choices and len(choices) < 2:
        issues.append(f"few_choices:{len(choices)}")
    return stem, choices, issues

def parse_file(year, S):
    path = f"sources/1ji/{year}/{S}.pdf"
    pagemeta = []
    all_lines = []  # (page_no, line)
    file_issues = []
    with pdfplumber.open(path) as pdf:
        pages_chars = [pg.chars for pg in pdf.pages]
        # 第1パス: フォント補正 + CID検出
        has_cid = False
        for pg, chs in zip(pdf.pages, pages_chars):
            unknown = fix_page_chars(chs, getattr(pg, "cropbox", None))
            for fn, t in unknown:
                file_issues.append(f"unknown_symbol_glyph:{fn}:{t!r}")
            if any(c["text"].startswith("(cid:") for c in chs):
                has_cid = True
        # 第1.5パス: レガシーcidマップ適用(OCR文脈整合で構築済み)
        if has_cid and os.path.exists("work/out/legacy_cidmaps.json"):
            lm = json.load(open("work/out/legacy_cidmaps.json")).get(path)
            if lm:
                for chs in pages_chars:
                    for c in chs:
                        if c["text"].startswith("(cid:"):
                            v = lm.get(f'{c["fontname"]}|{c["text"]}')
                            if v and v.get("char"):
                                c["text"] = v["char"]
                has_cid = any(c["text"].startswith("(cid:") for chs in pages_chars for c in chs)
        # 第1.6パス: 誤デコード文字マップ適用(PIフォント記号・本文フォント欠陥スロット)
        if os.path.exists("work/out/legacy_charmaps.json"):
            cm = json.load(open("work/out/legacy_charmaps.json")).get(path)
            if cm:
                for chs in pages_chars:
                    for c in chs:
                        v = cm.get(f'{c["fontname"]}|CHR|{c["text"]}')
                        if v is not None:
                            c["text"] = v["char"] if v.get("char") is not None else "〓"
        # 第2パス: CID解決 (pdftotext文脈整合; レガシー年は参照テキスト自体が壊れているため無効)
        if has_cid and year not in ("2015", "2016", "2017"):
            cidmap = build_cid_map(path, pages_chars)
            for chs in pages_chars:
                for c in chs:
                    if c["text"].startswith("(cid:"):
                        c["text"] = cidmap.get(c["text"], "〓")
        # 残余cidは無条件に〓へ(レガシー年フォールバック無効化の受け皿)
        for chs in pages_chars:
            for c in chs:
                if c["text"].startswith("(cid:"):
                    c["text"] = "〓"
        # 第3パス: テキスト抽出
        for pno, pg in enumerate(pdf.pages, 1):
            t = (pg.extract_text(x_tolerance=1.5) or "").replace(ZWSP, "")
            pagemeta.append({"images": len(pg.images), "curves": len(pg.curves), "rects": len(pg.rects)})
            for ln in clean_lines(t):
                all_lines.append((pno, ln))
    # 第N問アンカー検出(連番ガード)
    anchors = []
    expected_q = 1
    for idx, (pno, ln) in enumerate(all_lines):
        m = QNUM_RE.match(ln)
        if m and len((m.group(2) or "").strip()) <= 25:
            try: n = zi(m.group(1))
            except ValueError: continue
            if n == expected_q:
                anchors.append((idx, n, (m.group(2) or "").strip()))
                expected_q += 1
    questions = []
    for ai, (idx, qn, rest) in enumerate(anchors):
        end = anchors[ai+1][0] if ai+1 < len(anchors) else len(all_lines)
        seg = all_lines[idx+1:end]
        p_start = all_lines[idx][0]
        p_end = all_lines[end-1][0] if end-1 > idx else p_start
        seg_lines = [l for _, l in seg]
        if rest: seg_lines.insert(0, rest)
        # 設問分割(連番ガード)
        s_anchors = []
        exp_s = 1
        for j, ln in enumerate(seg_lines):
            m = SETSU_RE.match(ln)
            if m:
                g = m.group(1)
                if g == "〓":
                    sn = exp_s  # 番号グリフ未解決 → 連番推論(正解データとのQCで検証)
                else:
                    try: sn = zi(g)
                    except ValueError: continue
                if sn == exp_s:
                    s_anchors.append((j, sn, (m.group(2) or "").strip()))
                    exp_s += 1
        issues = []
        rec = {"q": qn, "pages": [p_start, p_end]}
        if s_anchors:
            lead_lines = seg_lines[:s_anchors[0][0]]
            rec["lead"] = smart_join(lead_lines)
            rec["setsumon"] = []
            for si, (j, sn, srest) in enumerate(s_anchors):
                send = s_anchors[si+1][0] if si+1 < len(s_anchors) else len(seg_lines)
                sl = seg_lines[j+1:send]
                if srest: sl.insert(0, srest)
                stem, choices, iss = parse_segment(sl)
                rec["setsumon"].append({"sub": sn, "stem": stem, "choices": choices})
                issues += [f"S{sn}:{x}" for x in iss]
        else:
            stem, choices, iss = parse_segment(seg_lines)
            rec["stem"] = stem
            rec["choices"] = choices
            issues += iss
        # 図表フラグ
        img = sum(pagemeta[p-1]["images"] for p in range(p_start, p_end+1))
        crv = sum(pagemeta[p-1]["curves"] for p in range(p_start, p_end+1))
        txt_all = (rec.get("lead") or "") + (rec.get("stem") or "") + "".join(
            (s["stem"] or "") for s in rec.get("setsumon", []))
        reasons = []
        if img >= 1: reasons.append("images")
        if crv >= 12: reasons.append("curves")
        kw = FIG_KW.search(txt_all)
        if kw: reasons.append(f"keyword:{kw.group(1)}")
        rec["figure"] = {"flag": bool(reasons), "reasons": reasons}
        all_txt = txt_all + "".join(rec.get("choices", {}).values()) + "".join(
            v for s in rec.get("setsumon", []) for v in s["choices"].values())
        if "〓" in all_txt or "(cid:" in all_txt:
            issues.append("unresolved_glyph")
        rec["issues"] = issues
        questions.append(rec)
    return questions, sorted(set(file_issues))

def qc(year, S, questions, ans):
    """answers_raw と突合。issuesリストを返す"""
    problems = []
    recs = ans[year][S]["records"]
    aq = sorted({r["q"] for r in recs})
    pq = sorted({q["q"] for q in questions})
    if aq != pq:
        problems.append(f"qset mismatch ans={aq[-1] if aq else 0}/{len(aq)} parsed={pq[-1] if pq else 0}/{len(pq)} missing={sorted(set(aq)-set(pq))[:5]}")
    qmap = {q["q"]: q for q in questions}
    for r in recs:
        q = qmap.get(r["q"])
        if not q: continue
        if r["sub"] is None:
            ch = q.get("choices", {})
            if "setsumon" in q:
                problems.append(f"Q{r['q']}: ans has no sub but parsed has setsumon")
                continue
        else:
            ss = {s["sub"]: s for s in q.get("setsumon", [])}
            if r["sub"] not in ss:
                problems.append(f"Q{r['q']}-S{r['sub']}: setsumon not parsed")
                continue
            ch = ss[r["sub"]]["choices"]
        if not ch or len(ch) < 2:
            problems.append(f"Q{r['q']}{'-S'+str(r['sub']) if r['sub'] else ''}: choices={len(ch)}")
        elif r["answer"] and r["answer"] not in ch:
            problems.append(f"Q{r['q']}{'-S'+str(r['sub']) if r['sub'] else ''}: answer {r['answer']} not in choices {list(ch)}")
        # 連続性
        if ch and list(ch.keys()) != list(ORDER[:len(ch)]):
            problems.append(f"Q{r['q']}: non-consecutive choices {list(ch)}")
    # 逆方向: parsedにあるが答案にないsetsumon
    for q in questions:
        if "setsumon" in q:
            asubs = {r["sub"] for r in recs if r["q"] == q["q"]}
            psubs = {s["sub"] for s in q["setsumon"]}
            if psubs - asubs:
                problems.append(f"Q{q['q']}: extra setsumon parsed {sorted(psubs-asubs)}")
    return problems

def advisories(questions):
    adv = []
    for q in questions:
        for iss in q.get("issues", []):
            if iss == "unresolved_glyph" or iss.startswith("warn_"):
                adv.append(f"Q{q['q']}: {iss}")
    return adv

def main():
    import sys
    only_years = sys.argv[1].split(",") if len(sys.argv) > 1 else None
    ans = json.load(open("work/out/answers_raw.json"))
    os.makedirs("work/out/questions", exist_ok=True)
    summary = []
    for year in YEARS:
        if only_years and year not in only_years:
            continue
        for S in SUBS:
            try:
                qs, fissues = parse_file(year, S)
            except Exception as e:
                summary.append((year, S, 0, [f"EXCEPTION {e}"]))
                continue
            problems = qc(year, S, qs, ans)
            adv = advisories(qs)
            for q in qs:
                q["parse_status"] = "ok"
            bad_qs = set()
            for p in problems + adv:
                m = re.match(r'Q(\d+)', p)
                if m: bad_qs.add(int(m.group(1)))
            for q in qs:
                if q["q"] in bad_qs: q["parse_status"] = "needs_review"
            json.dump({"year": year, "subject": S, "questions": qs,
                       "qc_problems": problems, "advisories": adv, "file_issues": fissues},
                      open(f"work/out/questions/{year}_{S}.json", "w"), ensure_ascii=False, indent=1)
            summary.append((year, S, len(qs), problems, adv, fissues))
    ok = sum(1 for *_, p, a, f in summary if not p)
    nadv = sum(len(a) for *_, a, f in summary)
    nrev = 0
    print(f"STRUCTURAL OK={ok}/{len(summary)}  advisories(needs_review questions)={nadv}")
    for year, S, n, p, a, f in summary:
        if p or f:
            print(f"-- {year}{S} nq={n} fissues={f}")
            for x in p[:6]: print("  [NG]", x)
            if len(p) > 6: print(f"    ...+{len(p)-6}")
    for year, S, n, p, a, f in summary:
        if a:
            print(f"  [adv] {year}{S}: {len(a)} -> {', '.join(x.split(':')[0] for x in a[:8])}")

if __name__ == "__main__":
    main()
