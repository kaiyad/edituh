import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blocksToDoc, docToBlocks, headingTree } from "../convert";
import type { DocJson } from "../types";

const SAMPLE_PATH = fileURLToPath(new URL("../../../../tests/data/sample.md", import.meta.url));

function parseInlineText(text: string): string {
  const doc: DocJson = { title: "T", blocks: [{ id: "x", type: "paragraph", data: { text } }] };
  const blocks = docToBlocks(doc);
  const back = blocksToDoc(blocks as never);
  return back.blocks[0]?.data?.text ?? "";
}

describe("inline markdown round-trip", () => {
  it("preserves bold, italic, strike, code and links", () => {
    const source = "A **bold** and *italic* and `code` and ~~struck~~ and [link](https://example.com)";
    expect(parseInlineText(source)).toBe(source);
  });

  it("preserves plain text", () => {
    expect(parseInlineText("Just text with 1-2-3 and dots...")).toBe("Just text with 1-2-3 and dots...");
  });

  it("preserves wikilinks with and without alias", () => {
    expect(parseInlineText("See [[Project Alpha]] and [[Beta|the beta page]]")).toBe(
      "See [[Project Alpha]] and [[Beta|the beta page]]"
    );
  });

  it("preserves inline math", () => {
    expect(parseInlineText("Solve $x^2 + y^2 = z^2$ today")).toBe("Solve $x^2 + y^2 = z^2$ today");
  });

  it("tolerates punctuation around tokens", () => {
    const source = "Hello, **world**! (yes)";
    expect(parseInlineText(source)).toBe(source);
  });

  it("keeps math and mermaid blocks through the round-trip", () => {
    const doc: DocJson = {
      title: "T",
      blocks: [
        { id: "m1", type: "math", data: { latex: "\\int_0^1 x^2 dx" } },
        { id: "d1", type: "mermaid", data: { code: "flowchart TD\nA --> B" } },
        { id: "f1", type: "file", data: { name: "plan.pdf", src: "media/plan.pdf", size: 2048 } },
      ],
    };
    const converted = blocksToDoc(docToBlocks(doc) as never);
    expect(converted.blocks[0]).toEqual({ id: "m1", type: "math", data: { latex: "\\int_0^1 x^2 dx" } });
    expect(converted.blocks[1]).toEqual({ id: "d1", type: "mermaid", data: { code: "flowchart TD\nA --> B" } });
    expect(converted.blocks[2]).toEqual({ id: "f1", type: "file", data: { name: "plan.pdf", src: "media/plan.pdf", size: 2048 } });
  });
});

describe("docToBlocks preserves ids", () => {
  it("keeps block ids so outline jumps work before first save", () => {
    const doc: DocJson = {
      title: "T",
      blocks: [
        { id: "h1", type: "heading", data: { level: 1, text: "Hello" } },
        { id: "p1", type: "paragraph", data: { text: "body" } },
      ],
    };
    const blocks = docToBlocks(doc);
    expect(blocks.map((b) => b.id)).toEqual(["h1", "p1"]);
    expect(headingTree(doc.blocks).map((h) => h.id)).toEqual(["h1"]);
  });
});

describe("markdown sample drift test", () => {
  it("round-trips the golden sample", () => {
    const sample = readFileSync(SAMPLE_PATH, "utf8");
    const doc: DocJson = { title: "Sample Document", blocks: [] };
    for (const line of sample.split("\n")) {
      if (line.startsWith("## ")) doc.blocks.push({ id: "h2", type: "heading", data: { level: 2, text: line.slice(3) } });
      else if (line.startsWith("- ")) doc.blocks.push({ id: "l", type: "bullet_list", data: { items: [line.slice(2)] } });
      else if (line.startsWith("> ")) doc.blocks.push({ id: "q", type: "quote", data: { text: line.slice(2) } });
      else if (line.trim()) doc.blocks.push({ id: "p", type: "paragraph", data: { text: line.trim() } });
    }
    const converted = blocksToDoc(docToBlocks(doc) as never);
    expect(converted.blocks.length).toBe(doc.blocks.length);
  });

  it("keeps heading levels and text intact through the round-trip", () => {
    const doc: DocJson = {
      title: "T",
      blocks: [
        { id: "a", type: "heading", data: { level: 3, text: "Sub **section**" } },
        { id: "b", type: "heading", data: { level: 1, text: "Top" } },
      ],
    };
    const converted = blocksToDoc(docToBlocks(doc) as never);
    expect(converted.blocks[0].data.level).toBe(3);
    expect(converted.blocks[0].data.text).toBe("Sub **section**");
    expect(converted.blocks[1].data.level).toBe(1);
  });
});