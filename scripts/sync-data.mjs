// data/ (正本・読み取り専用) を public/data/ へ同期する。
// アプリは public/data/ 経由でのみ配信し、正本を直接触らない。
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "master_1ji.json",
  "exams_1ji.json",
  "taxonomy_1ji.json",
  "master_2ji.json",
  "sources_shushi.json",
];

const dest = join(root, "public", "data");
mkdirSync(dest, { recursive: true });
for (const f of FILES) {
  const src = join(root, "data", f);
  statSync(src); // 欠損は即時エラー (Fail Loud)
  copyFileSync(src, join(dest, f));
}
console.log(`synced ${FILES.length} data files -> public/data/`);
