import type { DocJson } from "./types";

export interface WikiLink {
  target: string;
  alias: string;
}

const WIKILINK_RE = /\[\[([^\]\n]+)\]\]/g;

export function extractWikilinks(doc: DocJson): WikiLink[] {
  const out: WikiLink[] = [];
  const seen = new Set<string>();
  const scan = (text: string) => {
    for (const match of text.matchAll(WIKILINK_RE)) {
      const [target, ...rest] = match[1].split("|");
      const t = target.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ target: t, alias: rest.join("|").trim() || t });
    }
  };
  for (const block of doc.blocks) {
    const data = block.data ?? {};
    switch (block.type) {
      case "bullet_list":
      case "numbered_list":
        (data.items ?? []).forEach((i) => scan(String(i)));
        break;
      case "checklist":
        (data.items ?? []).forEach((i) => scan(Array.isArray(i) ? String(i[1]) : String(i)));
        break;
      case "table":
        (data.headers ?? []).forEach(scan);
        (data.rows ?? []).forEach((row) => row.forEach(scan));
        break;
      default:
        scan(data.text ?? "");
    }
  }
  return out;
}

export interface GraphNode {
  id: string;
  title: string;
  daily: boolean;
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export function buildGraph(docs: { id: string; doc: DocJson }[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const byTitle = new Map<string, string>();
  for (const d of docs) byTitle.set(d.doc.title.trim().toLowerCase(), d.id);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeSet = new Set<string>();
  const edgeSet = new Set<string>();

  for (const d of docs) {
    if (!nodeSet.has(d.id)) {
      nodeSet.add(d.id);
      nodes.push({ id: d.id, title: d.doc.title || "Untitled", daily: /^\d{4}-\d{2}-\d{2}$/.test(d.doc.title.trim()), degree: 0 });
    }
  }

  for (const d of docs) {
    for (const link of extractWikilinks(d.doc)) {
      const targetId = byTitle.get(link.target.toLowerCase());
      if (!targetId) continue;
      const key = `${d.id}->${targetId}`;
      if (d.id === targetId || edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ source: d.id, target: targetId });
      const src = nodes.find((n) => n.id === d.id);
      const tgt = nodes.find((n) => n.id === targetId);
      if (src) src.degree += 1;
      if (tgt) tgt.degree += 1;
    }
  }

  return { nodes, edges };
}

export function backlinksOf(docs: { id: string; doc: DocJson }[], docId: string): { id: string; title: string; count: number }[] {
  const current = docs.find((d) => d.id === docId);
  if (!current) return [];
  const title = current.doc.title.trim().toLowerCase();
  const out: { id: string; title: string; count: number }[] = [];
  for (const d of docs) {
    if (d.id === docId) continue;
    const links = extractWikilinks(d.doc);
    const count = links.filter((l) => l.target.trim().toLowerCase() === title).length;
    if (count > 0) out.push({ id: d.id, title: d.doc.title || "Untitled", count });
  }
  return out;
}

export function outgoingLinksOf(docs: { id: string; doc: DocJson }[], docId: string): { target: string; resolved: boolean }[] {
  const doc = docs.find((d) => d.id === docId);
  if (!doc) return [];
  const byTitle = new Set(docs.map((d) => d.doc.title.trim().toLowerCase()));
  return extractWikilinks(doc.doc).map((l) => ({
    target: l.target,
    resolved: byTitle.has(l.target.toLowerCase()),
  }));
}