import ExcelJS from "exceljs";
import { readFileSync } from "fs";

const path =
  "c:/Users/chuck/source/tektonology/ai-collab/saint-stanislaus-map-kneeler-plate-20260426(1).xlsx";
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(readFileSync(path));
const ws = wb.worksheets[0];
console.log("Sheet:", ws.name, "rows", ws.rowCount, "cols", ws.columnCount);

const toCol = (L) => {
  let n = 0;
  for (const ch of L.toUpperCase()) n = n * 26 + (ch.codePointAt(0) - 64);
  return n;
};

for (const rr of [11, 12]) {
  const row = ws.getRow(rr);
  console.log("\n--- Row", rr, "---");
  const a = row.getCell(1).value;
  console.log("Col A:", String(a ?? "").replaceAll("\r\n", " | ").slice(0, 400));

  const merges = ws.model?.merges;
  const onRow = (merges ?? []).filter((sp) => {
    const m = sp.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!m) return false;
    return Number(m[2]) === rr && Number(m[4]) === rr;
  });
  const sorted = onRow
    .map((sp) => {
      const m = sp.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (!m) return null;
      const c0 = toCol(m[1]);
      const c1 = toCol(m[3]);
      return { sp, c0, w: c1 - c0 + 1 };
    })
    .filter((x) => x && x.c0 >= 2)
    .sort((a, b) => a.c0 - b.c0);
  console.log(
    "Merges B+ count",
    sorted.length,
    "\n",
    sorted.map((x) => `${x.sp}(${x.w}w)`).join("  "),
  );
  for (const c0 of [2, 3, 4, 5, 10, 11, 12, 18, 19, 20, 28, 29]) {
    if (c0 > (ws.columnCount || 200)) continue;
    const t = String(row.getCell(c0).value ?? "");
    if (t) console.log(`  c${c0}:`, t.replaceAll("\r\n", " / ").slice(0, 60));
  }
}
