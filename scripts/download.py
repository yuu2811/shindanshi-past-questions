import csv, os, subprocess, time
ok=fail=0; failures=[]
with open("work/manifest.csv") as fp:
    rd=csv.DictReader(fp)
    for r in rd:
        os.makedirs(os.path.dirname(r["local"]), exist_ok=True)
        if os.path.exists(r["local"]) and os.path.getsize(r["local"])>1000:
            ok+=1; continue
        for attempt in range(3):
            p=subprocess.run(["curl","-sL","--fail","--max-time","60","-o",r["local"],r["url"]],capture_output=True)
            if p.returncode==0 and os.path.exists(r["local"]) and open(r["local"],"rb").read(5)==b"%PDF-":
                ok+=1; break
            time.sleep(1.5)
        else:
            fail+=1; failures.append((r["url"],p.returncode))
            if os.path.exists(r["local"]): os.remove(r["local"])
        time.sleep(0.25)
print(f"OK={ok} FAIL={fail}")
for u,c in failures: print("FAIL:",u,c)
