import type { BlockJson, BlockData, DocJson } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: unknown): string {
  const value = String(url ?? "");
  if (
    /^(https?:|mailto:|data:)/i.test(value) ||
    value.startsWith("/api/media/") ||
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("#")
  ) {
    return value;
  }
  return "#";
}

export function inlineToHtml(text: unknown): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, src: string) => `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}"/>`
  );
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, href: string) => `<a href="${safeUrl(href)}">${escapeHtml(label)}</a>`
  );
  out = out.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias?: string) =>
      `<a class="wikilink" href="#/doc/${encodeURIComponent(target.trim())}">${escapeHtml((alias ?? target).trim())}</a>`
  );
  out = out.replace(/\$[^$\s](?:[^$\n]*[^$\s])?\$/g, (_match, latex: string) => `<span class="math-inline">${_match}</span>`);
  return out;
}

function textItems(items: unknown): string[] {
  return (Array.isArray(items) ? items : []).map((item) => String(item));
}

function pairItems(items: unknown): [boolean, string][] {
  if (!Array.isArray(items)) return [];
  const out: [boolean, string][] = [];
  for (const item of items) {
    if (Array.isArray(item) && item.length > 1) out.push([Boolean(item[0]), String(item[1])]);
  }
  return out;
}

export function docToMarkdown(doc: DocJson): string {
  const out: string[] = [];
  for (const block of doc.blocks) {
    const data = block.data ?? {};
    switch (block.type) {
      case "heading":
        out.push("#".repeat(Math.max(1, Number(data.level) || 1)) + " " + String(data.text ?? ""));
        break;
      case "paragraph":
        out.push(String(data.text ?? ""));
        break;
      case "quote":
        out.push("> " + String(data.text ?? ""));
        break;
      case "callout":
        out.push("> " + String(data.icon ?? "💡") + " " + String(data.text ?? ""));
        break;
      case "code":
        out.push("```" + String(data.language ?? "text"));
        out.push(String(data.text ?? ""));
        out.push("```");
        break;
      case "bullet_list":
        textItems(data.items).forEach((item) => out.push("- " + item));
        break;
      case "numbered_list":
        textItems(data.items).forEach((item, index) => out.push(`${index + 1}. ${item}`));
        break;
      case "checklist":
        pairItems(data.items).forEach(([checked, item]) => out.push((checked ? "- [x] " : "- [ ] ") + item));
        break;
      case "table": {
        const headers = textItems(data.headers);
        const rows = Array.isArray(data.rows) ? data.rows : [];
        out.push("| " + headers.join(" | ") + " |");
        out.push("| " + headers.map(() => "---").join(" | ") + " |");
        for (const row of rows) {
          out.push("| " + (Array.isArray(row) ? row.map((cell) => String(cell)).join(" | ") : String(row)) + " |");
        }
        break;
      }
      case "divider":
        out.push("---");
        break;
      case "image":
        out.push(`![${String(data.caption ?? "")}](${String(data.src ?? "")})`);
        break;
      case "math":
        out.push("$$" + String(data.latex ?? "").trim() + "$$");
        break;
      case "mermaid":
        out.push("```mermaid");
        out.push(String(data.code ?? ""));
        out.push("```");
        break;
      case "video":
      case "audio":
      case "chart":
      case "file":
        out.push("```json");
        out.push(JSON.stringify({ type: block.type, data }));
        out.push("```");
        break;
    }
    out.push("");
  }
  return out.join("\n").replace(/\n+$/, "") + "\n";
}

export function blockToHtml(block: BlockJson): string {
  const data: BlockData = block.data ?? {};
  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(data.level) || 1, 1), 6);
      return `<h${level}>${inlineToHtml(data.text)}</h${level}>`;
    }
    case "paragraph":
      return `<p>${inlineToHtml(data.text)}</p>`;
    case "quote":
      return `<blockquote>${inlineToHtml(data.text)}</blockquote>`;
    case "callout":
      return `<div class='callout'>${escapeHtml(data.icon ?? "💡")} <span>${inlineToHtml(data.text)}</span></div>`;
    case "code":
      return `<pre><code class='language-${escapeHtml(data.language ?? "text")}'>${escapeHtml(data.text)}</code></pre>`;
    case "bullet_list":
    case "numbered_list": {
      const tag = block.type === "bullet_list" ? "ul" : "ol";
      const items = textItems(data.items)
        .map((item) => `<li>${inlineToHtml(item)}</li>`)
        .join("");
      return `<${tag}>${items}</${tag}>`;
    }
    case "checklist": {
      const items = pairItems(data.items)
        .map(([checked, item]) => `<li class='checklist'>${checked ? "&#9745;" : "&#9744;"} ${inlineToHtml(item)}</li>`)
        .join("");
      return `<ul class='checklist'>${items}</ul>`;
    }
    case "table": {
      const headers = textItems(data.headers)
        .map((cell) => `<th>${inlineToHtml(cell)}</th>`)
        .join("");
      const rows = (Array.isArray(data.rows) ? data.rows : [])
        .map(
          (row) =>
            "<tr>" +
            (Array.isArray(row) ? row.map((cell) => `<td>${inlineToHtml(cell)}</td>`).join("") : `<td>${inlineToHtml(row)}</td>`) +
            "</tr>"
        )
        .join("");
      return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    case "divider":
      return "<hr/>";
    case "image": {
      const src = escapeHtml(data.src ?? "");
      const alt = escapeHtml(data.caption ?? "");
      const caption = data.caption ? `<figcaption>${alt}</figcaption>` : "";
      return `<figure><img src='${src}' alt='${alt}'/>${caption}</figure>`;
    }
    case "video": {
      const src = escapeHtml(data.src ?? "");
      const caption = data.caption ? `<figcaption>${escapeHtml(data.caption)}</figcaption>` : "";
      return `<figure><video controls src='${src}' style='max-width:100%'></video>${caption}</figure>`;
    }
    case "audio": {
      const src = escapeHtml(data.src ?? "");
      const caption = data.caption ? `<figcaption>${escapeHtml(data.caption)}</figcaption>` : "";
      return `<figure><audio controls src='${src}'></audio>${caption}</figure>`;
    }
    case "chart": {
      const caption = data.title ? `<figcaption>${escapeHtml(data.title)}</figcaption>` : "";
      return `<figure><pre>${escapeHtml(JSON.stringify({ kind: data.kind, labels: data.labels, series: data.series }))}</pre>${caption}</figure>`;
    }
    case "math":
      return `<p class="math-block">$$${escapeHtml(data.latex ?? "")}$$</p>`;
    case "mermaid":
      return `<pre class="mermaid">${escapeHtml(data.code ?? "")}</pre>`;
    case "file": {
      const src = escapeHtml(data.src ?? "");
      const name = escapeHtml(data.name ?? "attachment");
      return `<p class="attachment"><a href='${src}'>&#128206; ${name}</a></p>`;
    }
    default:
      return "";
  }
}

const EXPORT_CSS = `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #fafbfc; color: #24292f; }
main { max-width: 820px; margin: 0 auto; padding: 48px 24px 96px; }
h1.doc-title { font-size: 2.1rem; margin: 0 0 8px; }
h1 { font-size: 1.8rem; } h2 { font-size: 1.45rem; } h3 { font-size: 1.2rem; }
p { line-height: 1.7; }
blockquote { border-left: 4px solid #d0d7de; margin: 8px 0; padding: 4px 16px; color: #57606a; }
.callout { background: #fff8c5; border: 1px solid #d4a72c; border-radius: 10px; padding: 12px 16px; }
pre { background: #f6f8fa; border-radius: 8px; padding: 14px; overflow-x: auto; }
code { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 0.9em; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; }
th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
th { background: #f6f8fa; }
ul.checklist { list-style: none; padding-left: 4px; }
figure { margin: 14px 0; }
figure img, figure video, figure svg { max-width: 100%; border-radius: 8px; }
figcaption { color: #57606a; font-size: 0.85rem; margin-top: 6px; text-align: center; }
@media print { body { background: white; } main { max-width: 100%; padding: 0; } }`;

const MATH_CDN = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script defer>
  window.addEventListener('load', function () {
    if (window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    if (window.mermaid) mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', theme: 'base' });
  });
</script>`;

export function docToHtml(doc: DocJson): string {
  const parts: string[] = [];
  parts.push("<!DOCTYPE html><html><head><meta charset='utf-8'>");
  parts.push(`<title>${escapeHtml(doc.title)}</title>`);
  parts.push("<style>");
  parts.push(EXPORT_CSS);
  parts.push("</style>");
  parts.push(MATH_CDN);
  parts.push("</head><body><main>");
  parts.push(`<h1 class='doc-title'>${escapeHtml(doc.title)}</h1>`);
  for (const block of doc.blocks) {
    parts.push(blockToHtml(block));
  }
  parts.push("</main></body></html>");
  return parts.join("");
}

const DECK_CSS = `body { margin: 0; background: #0e1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
.deck { height: 100vh; overflow: hidden; position: relative; }
.slide { position: absolute; inset: 0; padding: 9vh 10vw; box-sizing: border-box; overflow-y: auto; opacity: 0; pointer-events: none; transform: translateX(24px); transition: opacity .28s ease, transform .28s ease; background: radial-gradient(900px 500px at 75% -10%, rgba(79,139,249,0.14), transparent 60%); }
.slide.active { opacity: 1; pointer-events: auto; transform: none; }
.slide h1 { font-size: 2.6rem; margin: 0 0 .4em; }
.slide h2 { font-size: 1.7rem; margin: 0 0 .3em; }
.slide p, .slide li { font-size: 1.35rem; line-height: 1.65; }
.slide img, .slide video, .slide svg { max-width: 100%; max-height: 56vh; border-radius: 10px; }
.slide table { border-collapse: collapse; font-size: 1.15rem; }
.slide th, .slide td { border: 1px solid #3a4355; padding: .5em .9em; text-align: left; }
.slide blockquote { border-left: 4px solid #4f8bf9; margin: .6em 0; padding: .2em 1em; color: #9aa7b8; }
.slide pre { background: #161b26; border-radius: 10px; padding: 1em; overflow-x: auto; font-size: 1rem; }
.slide code { font-family: 'SF Mono', Menlo, Consolas, monospace; }
.deck-ui { position: fixed; bottom: 18px; right: 20px; display: flex; gap: 8px; align-items: center; z-index: 10; }
.deck-ui button { background: #1a2130; color: #e6edf3; border: 1px solid #38445a; border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: .9rem; }
.deck-ui button:hover { background: #2a3344; }
.deck-ui .counter { color: #9aa7b8; font-size: .85rem; margin-right: 4px; }
.notes-toggle { position: fixed; bottom: 18px; left: 20px; z-index: 10; }
.speaker-notes { position: fixed; bottom: 74px; left: 20px; max-width: 40vw; background: #1a2130; border: 1px solid #38445a; border-radius: 10px; padding: 10px 16px; font-size: .95rem; color: #9aa7b8; display: none; z-index: 10; }
.speaker-notes.visible { display: block; }
.slide ul, .slide ol { padding-left: 1.6em; }
@media print { .deck-ui, .notes-toggle, .speaker-notes { display: none; } .slide { position: relative; page-break-after: always; opacity: 1; transform: none; height: auto; min-height: 90vh; } }`;

const DECK_JS = `(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var notes = Array.prototype.slice.call(document.querySelectorAll('.speaker-notes'));
  var current = 0, showNotes = false;
  function show(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (s, k) { s.classList.toggle('active', k === current); });
    document.querySelector('.counter').textContent = (current + 1) + ' / ' + slides.length;
    notes.forEach(function (n, k) { n.classList.toggle('visible', showNotes && k === current); });
  }
  function step(d) { show(current + d); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key.toLowerCase() === 'n') { showNotes = !showNotes; show(current); }
  });
  document.querySelector('.next').addEventListener('click', function () { step(1); });
  document.querySelector('.prev').addEventListener('click', function () { step(-1); });
  document.querySelector('.notes-toggle').addEventListener('click', function () { showNotes = !showNotes; show(current); });
  show(0);
})();`;

export function docToDeck(doc: DocJson): string {
  const parts: string[] = [];
  parts.push("<!DOCTYPE html><html><head><meta charset='utf-8'>");
  parts.push(`<title>${escapeHtml(doc.title)} — deck</title>`);
  parts.push("<style>" + DECK_CSS + "</style>");
  parts.push(MATH_CDN);
  parts.push("</head><body><div class='deck'>");

  const { slides } = buildSlides(doc);
  if (slides.length === 0) {
    parts.push(`<section class='slide active'><h1>${escapeHtml(doc.title)}</h1></section>`);
  }
  slides.forEach((slide) => {
    parts.push(`<section class='slide'>`);
    for (const block of slide.blocks) parts.push(blockToHtml(block));
    parts.push("</section>");
    if (slide.notes.length > 0) {
      parts.push(`<aside class='speaker-notes'><strong>Notes:</strong> ${slide.notes.map((n) => escapeHtml(n)).join("<br/>")}</aside>`);
    }
  });

  parts.push(`</div>
  <div class='deck-ui'>
    <span class='counter'></span>
    <button class='prev'>&larr;</button>
    <button class='next'>&rarr;</button>
  </div>
  <button class='notes-toggle'>Notes</button>
  <script>${DECK_JS}</script>
  </body></html>`);
  return parts.join("");
}

const PRESENTER_NOTE_ICONS = new Set(["📝", "🎙️"]);

export interface Slide {
  blocks: BlockJson[];
  notes: string[];
}

export function buildSlides(doc: DocJson): { slides: Slide[] } {
  const blocks = doc.blocks;
  const hasH1 = blocks.some((b) => b.type === "heading" && (b.data.level ?? 1) === 1);
  const topLevel = hasH1 ? 1 : 2;

  const slides: Slide[] = [];
  let current: Slide | null = null;

  const flush = () => {
    if (current && current.blocks.length > 0) slides.push(current);
  };

  for (const block of blocks) {
    const data = block.data ?? {};
    if (block.type === "callout" && PRESENTER_NOTE_ICONS.has(data.icon ?? "")) {
      if (current) current.notes.push(String(data.text ?? ""));
      continue;
    }
    if (block.type === "heading" && (data.level ?? 1) === topLevel) {
      flush();
      current = { blocks: [block], notes: [] };
    } else {
      if (!current) current = { blocks: [], notes: [] };
      current.blocks.push(block);
    }
  }
  flush();

  if (slides.length === 0) {
    slides.push({ blocks: blocks.filter((b) => !(b.type === "callout" && PRESENTER_NOTE_ICONS.has(b.data.icon ?? ""))), notes: [] });
  }

  const titleSlide: Slide = {
    blocks: [{ id: "title", type: "heading", data: { level: 1, text: doc.title || "Untitled" } }],
    notes: [],
  };
  return { slides: [titleSlide, ...slides] };
}