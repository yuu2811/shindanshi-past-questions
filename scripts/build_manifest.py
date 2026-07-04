import csv
BASE = "https://www.jf-cmca.jp/attach/test"
subs = list("ABCDEFG")
rows = []
q_pat = {
 2025:("1ji2025","{S}1JI2025.pdf"), 2024:("1ji2024","{S}1JI2024.pdf"), 2023:("1ji2023","{S}1JI2023.pdf"),
 2022:("1ji2022","{S}1ji2022.pdf"), 2021:("1ji2021","{S}1ji2021.pdf"), 2020:("1ji2020","{S}1ji2020.pdf"),
 2019:("1ji2019","{S}1ji2019.pdf"), 2018:("1ji2018","{S}1ji2018.pdf"),
 2017:("1ji2017","{s}1ji2017.pdf"), 2016:("1ji2016","{s}1ji2016.pdf"), 2015:("1ji2015","{s}1ji2015.pdf"),
}
for y,(d,f) in q_pat.items():
    for S in subs:
        rows.append([str(y),"1ji_mondai",S,f"{BASE}/shikenmondai/{d}/"+f.format(S=S,s=S.lower()),f"sources/1ji/{y}/{S}.pdf"])
for S in subs:
    rows.append(["2023S","1ji_mondai",S,f"{BASE}/shikenmondai/1ji(sai)2023/{S}1JI2023-2.pdf",f"sources/1ji/2023S/{S}.pdf"])
a_map = {
 2025:{S:f"r07/1ji_seikai/2025{S.lower()}.pdf" for S in subs},
 2024:{S:f"r06/1ji_seikai/2024{S.lower()}.pdf" for S in subs},
 2023:{**{S:f"r05/1ji_seikai/2023{S.lower()}.pdf" for S in subs}, "D":"r05/1ji_seikai/2023dv2.pdf"},
 2022:{**{S:f"r04/1j_seikai/2022{S.lower()}.pdf" for S in subs}, "D":"r04/1j_seikai/2022dv2.pdf","F":"r04/1j_seikai/2022fv2.pdf"},
 2021:{**{S:f"r03/1j_seikai/2021{S.lower()}.pdf" for S in subs}, "G":"r03/1j_seikai/2021g_teisei.pdf"},
 2020:{S:f"r02/1j_seikai/2020{S.lower()}.pdf" for S in subs},
 2019:{S:f"h31/1j_seikai/2019{S.lower()}.pdf" for S in subs},
 2018:{S:f"h30/1j_seikai/{S.lower()}2018.pdf" for S in subs},
 2017:{**{S:f"h29/1j_seikai/{S.lower()}2017.pdf" for S in subs}, "E":"h29/1j_seikai/e2017v2.pdf"},
 2016:{S:f"h28/1j_seikai/{S.lower()}2016.pdf" for S in subs},
 2015:{S:f"h27/1ji_seikai/{S.lower()}2015.pdf" for S in subs},
}
for y,m in a_map.items():
    for S in subs:
        rows.append([str(y),"1ji_seikai",S,f"{BASE}/{m[S]}",f"sources/seikai/{y}/{S}.pdf"])
for S in subs:
    rows.append(["2023S","1ji_seikai",S,f"{BASE}/r05/1ji(sai)_seikai/{S}.pdf",f"sources/seikai/2023S/{S}.pdf"])
j2_pat = {
 2025:"{S}2JI2025.pdf",2024:"{S}2JI2024.pdf",2023:"{S}2JI2023.pdf",
 2022:"{s}2ji2022.pdf",2021:"{s}2ji2021.pdf",2020:"{s}2ji2020.pdf",2019:"{s}2ji2019.pdf",
 2018:"{s}2ji2018.pdf",2017:"{s}2ji2017.pdf",2016:"{s}2j2016.pdf",2015:"{s}2ji2015.pdf",
}
for y,f in j2_pat.items():
    for S in list("ABCD"):
        rows.append([str(y),"2ji_mondai",S,f"{BASE}/shikenmondai/2ji{y}/"+f.format(S=S,s=S.lower()),f"sources/2ji/{y}/{S}.pdf"])
rows.append(["2025","toukei","-",f"{BASE}/r07/r07_1ji_toukei.pdf","sources/misc/r07_1ji_toukei.pdf"])
rows.append(["all","suii","-",f"{BASE}/suii_moushikomisha.pdf","sources/misc/suii_moushikomisha.pdf"])
with open("work/manifest.csv","w",newline="") as fp:
    w=csv.writer(fp); w.writerow(["year","kind","subject","url","local"]); w.writerows(rows)
print("manifest rows:",len(rows))
