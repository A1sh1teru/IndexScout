/*
 * Пакетная конвертация Excel -> CSV для скаутинговых выгрузок.
 * Обходит папку рекурсивно, каждый .xlsx/.xls превращает в .csv рядом
 * (разделитель «;», кодировка UTF-8 с BOM — открывается и платформой, и Excel).
 * Существующие .csv не трогает.
 *
 * Запуск: node tools/xlsx2csv.mjs "C:\путь\к\папке"
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require(path.join(import.meta.dirname, "..", "v2", "xlsx.full.min.js"));

const root = process.argv[2];
if (!root || !fs.existsSync(root)) {
  console.error("Укажите папку: node tools/xlsx2csv.mjs \"C:\\путь\"");
  process.exit(1);
}

let converted = 0, skipped = 0, failed = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(xlsx|xls)$/i.test(e.name) || e.name.startsWith("~$")) continue;
    const out = p.replace(/\.(xlsx|xls)$/i, ".csv");
    if (fs.existsSync(out)) { console.log(`пропуск (csv уже есть): ${path.relative(root, out)}`); skipped++; continue; }
    try {
      const wb = XLSX.read(fs.readFileSync(p), { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // строим CSV сами: числа с десятичной ЗАПЯТОЙ (иначе русский Excel
      // при открытии превращает «1.54» в дату), разделитель «;»
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
      const fmtCell = v => {
        if (typeof v === "number") return String(v).replace(".", ",");
        let s = String(v);
        if (/[;"\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      const csv = rows.filter(r => r.some(c => c !== "")).map(r => r.map(fmtCell).join(";")).join("\r\n");
      fs.writeFileSync(out, "\ufeff" + csv, "utf8");
      console.log(`OK (${rows.length - 1} строк): ${path.relative(root, out)}`);
      converted++;
    } catch (err) {
      console.error(`ОШИБКА: ${path.relative(root, p)} — ${err.message}`);
      failed++;
    }
  }
}

walk(root);
console.log(`\nИтого: сконвертировано ${converted}, пропущено ${skipped}, ошибок ${failed}.`);
