import type { PartialInlineContent } from "@blocknote/core";
import type { DocJson } from "./types";
import { uuid } from "./uuid";
import type { EditorBlock, EditorPartialBlock, Inline, Style } from "../editor/schema";

const TOKEN_RE = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

function parseInline(text: string): PartialInlineContent<Inline, Style> {
  const out: PartialInlineContent<Inline, Style> = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: text.slice(last, index), styles: {} });
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      out.push({ type: "text", text: token.slice(2, -2), styles: { bold: true } });
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      out.push({ type: "text", text: token.slice(2, -2), styles: { strike: true } });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      out.push({ type: "text", text: token.slice(1, -1), styles: { code: true } });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      out.push({ type: "text", text: token.slice(1, -1), styles: { italic: true } });
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        out.push({ type: "link", href: linkMatch[2], content: [{ type: "text", text: linkMatch[1], styles: {} }] });
      } else {
        out.push({ type: "text", text: token, styles: {} });
      }
    }
    last = index + token.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last), styles: {} });
  return out;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]])/g, "\\$1");
}

type AnyInline = {
  type?: string;
  text?: string;
  href?: string;
  content?: unknown;
  styles?: { bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean; link?: string };
};

export function inlineToMarkdown(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as AnyInline[])
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if (item.type === "text") {
        let t = escapeMarkdown(item.text ?? "");
        const s = item.styles;
        if (s?.code) t = `\`${t}\``;
        if (s?.bold) t = `**${t}**`;
        if (s?.italic) t = `*${t}*`;
        if (s?.strike) t = `~~${t}~~`;
        return t;
      }
      if (item.type === "link" && typeof item.href === "string") {
        return `[${inlineToMarkdown(item.content)}](${item.href})`;
      }
      return "";
    })
    .join("");
}

function tableBlock(id: string, headers: string[], rows: string[][]): EditorPartialBlock {
  const makeRow = (cells: string[]) => ({
    cells: cells.map((cell) => ({
      type: "tableCell" as const,
      props: {},
      content: parseInline(cell),
    })),
  });
  return {
    id,
    type: "table",
    props: { textColor: "default" },
    content: {
      type: "tableContent",
      columnWidths: headers.map(() => undefined),
      headerRows: 1,
      headerCols: 0,
      rows: [...rows.map(makeRow)],
    },
  };
}

export function docToBlocks(doc: DocJson): EditorPartialBlock[] {
  const blocks: EditorPartialBlock[] = [];
  for (const block of doc.blocks) {
    const data = block.data ?? {};
    switch (block.type) {
      case "heading":
        blocks.push({
          id: block.id,
          type: "heading",
          props: { level: Number(Math.min(Math.max(data.level ?? 1, 1), 6)) as 1 | 2 | 3 | 4 | 5 | 6 },
          content: parseInline(data.text ?? ""),
        });
        break;
      case "paragraph":
        blocks.push({ id: block.id, type: "paragraph", content: parseInline(data.text ?? "") });
        break;
      case "quote":
        blocks.push({ id: block.id, type: "quote", content: parseInline(data.text ?? "") });
        break;
      case "callout":
        blocks.push({
          id: block.id,
          type: "callout",
          props: { icon: data.icon ?? "💡" },
          content: parseInline(data.text ?? ""),
        });
        break;
      case "code":
        blocks.push({
          id: block.id,
          type: "codeBlock",
          props: { language: data.language ?? "text" },
          content: data.text ?? "",
        });
        break;
      case "bullet_list":
        for (const item of data.items ?? []) {
          blocks.push({ id: block.id, type: "bulletListItem", content: parseInline(String(item)) });
        }
        break;
      case "numbered_list":
        for (const item of data.items ?? []) {
          blocks.push({ id: block.id, type: "numberedListItem", content: parseInline(String(item)) });
        }
        break;
      case "checklist":
        for (const item of data.items ?? []) {
          const checked = Array.isArray(item) ? Boolean(item[0]) : false;
          const text = Array.isArray(item) ? item[1] : String(item);
          blocks.push({ id: block.id, type: "checkListItem", props: { checked }, content: parseInline(text) });
        }
        break;
      case "table":
        blocks.push(tableBlock(block.id, data.headers ?? [], data.rows ?? []));
        break;
      case "divider":
        blocks.push({ id: block.id, type: "divider" });
        break;
      case "image":
        blocks.push({
          id: block.id,
          type: "image",
          props: { url: data.src ?? "", caption: data.caption ?? "", name: "" },
        });
        break;
      case "video":
        blocks.push({
          id: block.id,
          type: "video",
          props: { url: data.src ?? "", caption: data.caption ?? "", name: "" },
        });
        break;
      case "audio":
        blocks.push({
          id: block.id,
          type: "audio",
          props: { url: data.src ?? "", caption: data.caption ?? "", name: "" },
        });
        break;
      case "chart":
        blocks.push({
          id: block.id,
          type: "chart",
          props: {
            kind: data.kind ?? "bar",
            title: data.title ?? "",
            labels: JSON.stringify(data.labels ?? []),
            series: JSON.stringify(data.series ?? {}),
          },
        });
        break;
    }
  }
  return blocks;
}

function cellText(cell: unknown): string {
  if (!cell) return "";
  if (Array.isArray(cell)) return inlineToMarkdown(cell);
  const obj = cell as { content?: unknown };
  return inlineToMarkdown(obj.content);
}

function plainToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return (content as { text?: string }[]).map((c) => c.text ?? "").join("");
  return "";
}

export function blocksToDoc(blocks: EditorBlock[]): DocJson {
  const out: DocJson["blocks"] = [];
  const bid = (block: { id?: string }) => block.id || uuid();
  for (const block of blocks) {
    const props = (block.props ?? {}) as Record<string, unknown>;
    switch (block.type) {
      case "heading":
        out.push({
          id: bid(block),
          type: "heading",
          data: { level: Number(props.level ?? 1), text: inlineToMarkdown(block.content) },
        });
        break;
      case "paragraph":
        out.push({ id: bid(block), type: "paragraph", data: { text: inlineToMarkdown(block.content) } });
        break;
      case "quote":
        out.push({ id: bid(block), type: "quote", data: { text: inlineToMarkdown(block.content) } });
        break;
      case "callout":
        out.push({
          id: bid(block),
          type: "callout",
          data: { icon: String(props.icon ?? "💡"), text: inlineToMarkdown(block.content) },
        });
        break;
      case "codeBlock":
        out.push({
          id: bid(block),
          type: "code",
          data: { language: String(props.language ?? "text"), text: plainToString(block.content) },
        });
        break;
      case "bulletListItem":
        out.push({ id: bid(block), type: "bullet_list", data: { items: [inlineToMarkdown(block.content)] } });
        break;
      case "numberedListItem":
        out.push({ id: bid(block), type: "numbered_list", data: { items: [inlineToMarkdown(block.content)] } });
        break;
      case "checkListItem":
        out.push({
          id: bid(block),
          type: "checklist",
          data: { items: [[Boolean((props as { checked?: boolean }).checked), inlineToMarkdown(block.content)]] },
        });
        break;
      case "table": {
        const content = block.content as { rows?: { cells: unknown[] }[] } | undefined;
        const rows = (content?.rows ?? []).map((row) => row.cells.map(cellText));
        const headers = rows[0] ?? [];
        const body = rows.slice(1);
        out.push({ id: bid(block), type: "table", data: { headers, rows: body } });
        break;
      }
      case "divider":
        out.push({ id: bid(block), type: "divider", data: {} });
        break;
      case "image":
        out.push({
          id: bid(block),
          type: "image",
          data: { src: String(props.url ?? ""), caption: String(props.caption ?? "") },
        });
        break;
      case "video":
        out.push({
          id: bid(block),
          type: "video",
          data: { src: String(props.url ?? ""), caption: String(props.caption ?? "") },
        });
        break;
      case "audio":
        out.push({
          id: bid(block),
          type: "audio",
          data: { src: String(props.url ?? ""), caption: String(props.caption ?? "") },
        });
        break;
      case "chart": {
        let labels: string[] = [];
        let series: Record<string, number[]> = {};
        try {
          labels = JSON.parse(String(props.labels ?? "[]"));
          series = JSON.parse(String(props.series ?? "{}"));
        } catch {
          /* keep defaults */
        }
        if (!Array.isArray(labels)) labels = [];
        if (typeof series !== "object" || series === null || Array.isArray(series)) series = {};
        out.push({
          id: bid(block),
          type: "chart",
          data: {
            kind: String(props.kind ?? "bar"),
            title: String(props.title ?? ""),
            labels,
            series,
          },
        });
        break;
      }
      case "file":
        out.push({
          id: bid(block),
          type: "paragraph",
          data: { text: `[${String(props.name ?? "file")}](${String(props.url ?? "")})` },
        });
        break;
      default:
        out.push({ id: bid(block), type: "paragraph", data: { text: inlineToMarkdown(block.content) } });
    }
  }
  return { title: "", blocks: out };
}

export function headingTree(blocks: DocJson["blocks"]): { id: string; level: number; text: string }[] {
  return blocks
    .filter((b) => b.type === "heading")
    .map((b) => ({ id: b.id, level: b.data.level ?? 1, text: b.data.text ?? "" }));
}

export function countWords(doc: DocJson): number {
  let words = 0;
  for (const block of doc.blocks) {
    let text = "";
    const data = block.data ?? {};
    switch (block.type) {
      case "bullet_list":
      case "numbered_list":
        text = (data.items ?? []).map(String).join(" ");
        break;
      case "checklist":
        text = (data.items ?? []).map((i) => (Array.isArray(i) ? i[1] : String(i))).join(" ");
        break;
      case "table":
        text = [...(data.headers ?? []), ...(data.rows ?? []).flat()].join(" ");
        break;
      case "image":
        text = data.caption ?? "";
        break;
      default:
        text = data.text ?? "";
    }
    words += text.split(/\s+/).filter(Boolean).length;
  }
  return words;
}