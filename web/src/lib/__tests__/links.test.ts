import { describe, expect, it } from "vitest";
import { backlinksOf, buildGraph, extractWikilinks, outgoingLinksOf } from "../links";
import type { DocJson } from "../types";

const make = (id: string, title: string, text: string): { id: string; doc: DocJson } => ({
  id,
  doc: { title, blocks: [{ id: `${id}-b`, type: "paragraph", data: { text } }] },
});

describe("extractWikilinks", () => {
  it("extracts targets with and without aliases", () => {
    const links = extractWikilinks({ title: "T", blocks: [{ id: "a", type: "paragraph", data: { text: "See [[Alpha]] and [[Beta|the beta]]" } }] });
    expect(links).toEqual([
      { target: "Alpha", alias: "Alpha" },
      { target: "Beta", alias: "the beta" },
    ]);
  });

  it("deduplicates and scans list items", () => {
    const links = extractWikilinks({
      title: "T",
      blocks: [{ id: "a", type: "bullet_list", data: { items: ["[[X]] and [[X]]", "plain"] } }],
    });
    expect(links).toEqual([{ target: "X", alias: "X" }]);
  });
});

describe("buildGraph", () => {
  it("builds nodes and resolved edges", () => {
    const docs = [make("a", "Alpha", "links to [[Beta]]"), make("b", "Beta", "no links"), make("c", "Gamma", "links [[alpha]] case-insensitive")];
    const { nodes, edges } = buildGraph(docs);
    expect(nodes.length).toBe(3);
    expect(edges).toEqual([
      { source: "a", target: "b" },
      { source: "c", target: "a" },
    ]);
    expect(nodes.find((n) => n.id === "a")?.degree).toBe(2);
    expect(nodes.find((n) => n.id === "b")?.degree).toBe(1);
  });

  it("flags daily notes", () => {
    const docs = [make("a", "2026-08-18", "x"), make("b", "Not a date", "y")];
    const { nodes } = buildGraph(docs);
    expect(nodes.find((n) => n.id === "a")?.daily).toBe(true);
    expect(nodes.find((n) => n.id === "b")?.daily).toBe(false);
  });

  it("ignores self links and unresolvable targets", () => {
    const docs = [make("a", "Alpha", "[[Alpha]] [[Missing]]")];
    const { nodes, edges } = buildGraph(docs);
    expect(nodes.length).toBe(1);
    expect(edges.length).toBe(0);
  });
});

describe("backlinksOf", () => {
  it("counts unique incoming links per document", () => {
    const docs = [make("a", "Alpha", "[[Beta]] [[Beta]]"), make("b", "Beta", "[[Gamma]]"), make("c", "Gamma", "")];
    expect(backlinksOf(docs, "b")).toEqual([{ id: "a", title: "Alpha", count: 1 }]);
    expect(backlinksOf(docs, "c")).toEqual([{ id: "b", title: "Beta", count: 1 }]);
  });
});

describe("outgoingLinksOf", () => {
  it("marks unresolved targets", () => {
    const docs = [make("a", "Alpha", "[[Beta]] and [[Missing]]"), make("b", "Beta", "")];
    expect(outgoingLinksOf(docs, "a")).toEqual([
      { target: "Beta", resolved: true },
      { target: "Missing", resolved: false },
    ]);
  });
});