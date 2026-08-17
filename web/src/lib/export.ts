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
      case "video":
      case "audio":
      case "chart":
        out.push("```json");
        out.push(JSON.stringify({ type: block.type, data }));
        out.push("```");
        break;
    }
    out.push("");
  }
  return out.join("\n").replace(/\n+$/, "") + "\n";
}

function blockToHtml(block: BlockJson): string {
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

export function docToHtml(doc: DocJson): string {
  const parts: string[] = [];
  parts.push("<!DOCTYPE html><html><head><meta charset='utf-8'>");
  parts.push(`<title>${escapeHtml(doc.title)}</title>`);
  parts.push("<style>");
  parts.push(EXPORT_CSS);
  parts.push("</style></head><body><main>");
  parts.push(`<h1 class='doc-title'>${escapeHtml(doc.title)}</h1>`);
  for (const block of doc.blocks) {
    parts.push(blockToHtml(block));
  }
  parts.push("</main></body></html>");
  return parts.join("");
}