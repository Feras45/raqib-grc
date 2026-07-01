// Run: node test/markdown.test.mjs  (dependency-free; src/markdown.js is browser-safe JS)
import { parseBlocks, tableToHtml, markdownToHtml } from "../src/markdown.js";

let pass = 0, fail = 0; const fails = [];
const t = (n, fn) => { try { if (fn() === false) throw new Error("returned false"); pass++; } catch (e) { fail++; fails.push(`${n}: ${e.message}`); } };
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

const FIXED_TABLE = [
  "| Control | Status | Evidence |",
  "|---------|:------:|---------:|",
  "| 1-1-1   | Gap    | None     |",
  "| 2-9-1   | OK     | Policy   |",
].join("\n");

t("fixed table string → real <table>/<th>/<td> HTML", () => {
  const html = markdownToHtml(FIXED_TABLE);
  for (const tag of ["<table>", "<thead>", "<tbody>", "<th ", "<td "]) {
    if (!html.includes(tag)) throw new Error(`missing ${tag}`);
  }
  if (!html.includes(">Control</th>")) throw new Error("header cell content");
  if (!html.includes(">1-1-1</td>")) throw new Error("body cell content");
  if ((html.match(/<tr>/g) || []).length !== 3) throw new Error("row count");
});

t("parseBlocks structures header/align/rows", () => {
  const blocks = parseBlocks(FIXED_TABLE);
  eq(blocks.length, 1);
  eq(blocks[0].type, "table");
  eq(blocks[0].header, ["Control", "Status", "Evidence"]);
  eq(blocks[0].align, ["left", "center", "right"]);
  eq(blocks[0].rows, [["1-1-1", "Gap", "None"], ["2-9-1", "OK", "Policy"]]);
});

t("table without outer pipes still parses", () => {
  const blocks = parseBlocks("Name | Value\n--- | ---\nECC | 2-3-1");
  eq(blocks[0].type, "table");
  eq(blocks[0].header, ["Name", "Value"]);
  eq(blocks[0].rows, [["ECC", "2-3-1"]]);
});

t("text around a table stays as lines", () => {
  const blocks = parseBlocks(`Intro line\n\n${FIXED_TABLE}\nOutro line`);
  eq(blocks[0], { type: "line", text: "Intro line" });
  eq(blocks[1], { type: "line", text: "" });
  eq(blocks[2].type, "table");
  eq(blocks[3], { type: "line", text: "Outro line" });
});

t("partial/streaming: header without separator yet → plain lines, no crash", () => {
  const blocks = parseBlocks("| a | b |");
  eq(blocks, [{ type: "line", text: "| a | b |" }]);
});

t("partial/streaming: table cut off mid-body keeps complete rows", () => {
  const blocks = parseBlocks("| a | b |\n|---|---|\n| 1 | 2 |\n| 3 ");
  eq(blocks[0].type, "table");
  eq(blocks[0].rows[0], ["1", "2"]);
  // trailing fragment: either padded row or line — must not throw and must keep row 1
  if (blocks.some((b) => b === undefined)) throw new Error("undefined block");
});

t("ragged rows are padded to header width", () => {
  const blocks = parseBlocks("| a | b | c |\n|---|---|---|\n| only |");
  eq(blocks[0].rows[0], ["only", "", ""]);
});

t("prose with a stray pipe is not a table", () => {
  const blocks = parseBlocks("choose A | B as you like\nanother line");
  eq(blocks.every((b) => b.type === "line"), true);
});

t("escaped pipe stays inside the cell", () => {
  const blocks = parseBlocks("| a \\| b | c |\n|---|---|\n| 1 | 2 |");
  eq(blocks[0].header, ["a | b", "c"]);
});

t("HTML in cells is escaped in tableToHtml (no injection)", () => {
  const html = tableToHtml(parseBlocks("| x |\n|---|\n| <script>alert(1)</script> |")[0]);
  if (html.includes("<script>")) throw new Error("unescaped html");
  if (!html.includes("&lt;script&gt;")) throw new Error("expected escaped entity");
});

t("empty / null / garbage input never throws", () => {
  parseBlocks(""); parseBlocks(null); parseBlocks(undefined);
  parseBlocks("|||||\n|-|-|\n|"); parseBlocks("\n\n\n|");
  eq(tableToHtml(null), "");
  eq(tableToHtml({ type: "line", text: "x" }), "");
});

t("Arabic content in table cells survives", () => {
  const blocks = parseBlocks("| الضابط | الحالة |\n|---|---|\n| ٢-٩-١ | ملتزم |");
  eq(blocks[0].header, ["الضابط", "الحالة"]);
  eq(blocks[0].rows[0], ["٢-٩-١", "ملتزم"]);
});

console.log(`${pass} passed, ${fail} failed`);
if (fails.length) { for (const f of fails) console.error(" ✗ " + f); process.exit(1); }
