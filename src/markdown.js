// Burhan · minimal GFM-table-aware markdown block parser. Dependency-free and
// browser-safe (also runs under node for tests — test/markdown.test.mjs).
//
// The advisor renderer builds React elements (no HTML injection), so this
// module only STRUCTURES the text: it splits a reply into 'line' blocks and
// 'table' blocks ({ header, align, rows }). App.jsx renders tables as real
// <table> elements; tableToHtml() below is the string equivalent used by the
// unit tests and by anything that needs HTML output.
//
// Robust against partial/streaming input: a header row whose separator line
// has not arrived yet stays a plain line; a table cut off mid-row renders the
// complete rows it has. Nothing here throws on malformed input.

const SEP_CELL = /^:?-{2,}:?$|^:-+:?$|^:?-+:$|^-+$/;

function splitRow(line) {
  // split on unescaped pipes; trim outer empties from leading/trailing '|'
  const cells = [];
  let cur = "", esc = false;
  const s = String(line);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { cur += c; esc = false; continue; }
    if (c === "\\") { esc = true; cur += c; continue; }
    if (c === "|") { cells.push(cur); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur);
  if (cells.length && cells[0].trim() === "") cells.shift();
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop();
  return cells.map((c) => c.trim().replace(/\\\|/g, "|"));
}

// Any line with a pipe can be a table row (GFM allows outer pipes to be
// omitted); the mandatory separator row on the next line prevents prose with
// a stray "|" from being misread as a table.
const isPipeRow = (line) => String(line || "").trim().includes("|");

function isSeparatorRow(line) {
  const t = String(line || "").trim();
  if (!t.includes("-") || !isPipeRow(t)) return false;
  const cells = splitRow(t);
  return cells.length > 0 && cells.every((c) => SEP_CELL.test(c.replace(/\s+/g, "")));
}

function alignOf(sepCell) {
  const c = String(sepCell).replace(/\s+/g, "");
  const l = c.startsWith(":"), r = c.endsWith(":");
  if (l && r) return "center";
  if (r) return "right";
  return "left";
}

/* text → [{ type:'line', text } | { type:'table', header, align, rows }] */
export function parseBlocks(text) {
  const lines = String(text ?? "").split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    // table start: pipe row + separator row immediately after
    if (isPipeRow(lines[i]) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = splitRow(lines[i]);
      const sep = splitRow(lines[i + 1]);
      const align = header.map((_, k) => alignOf(sep[k] ?? "-"));
      const rows = [];
      let j = i + 2;
      for (; j < lines.length && isPipeRow(lines[j]) && !isSeparatorRow(lines[j]); j++) {
        const cells = splitRow(lines[j]);
        // normalize width to header (pad short, keep long trimmed to header)
        rows.push(header.map((_, k) => cells[k] ?? ""));
      }
      blocks.push({ type: "table", header, align, rows });
      i = j - 1;
      continue;
    }
    blocks.push({ type: "line", text: lines[i] });
  }
  return blocks;
}

const escapeHtml = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* One table block → HTML string (escaped). */
export function tableToHtml(block) {
  if (!block || block.type !== "table") return "";
  const th = block.header.map((h, i) => `<th style="text-align:${block.align[i] || "left"}">${escapeHtml(h)}</th>`).join("");
  const body = block.rows.map((r) =>
    `<tr>${r.map((c, i) => `<td style="text-align:${block.align[i] || "left"}">${escapeHtml(c)}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

/* Full reply → HTML (tables as tables, other lines escaped). Used by tests as
   the canonical markdown-to-HTML step; the React renderer mirrors it. */
export function markdownToHtml(text) {
  return parseBlocks(text).map((b) => (b.type === "table" ? tableToHtml(b) : `<p>${escapeHtml(b.text)}</p>`)).join("\n");
}
