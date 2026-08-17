import { describe, expect, it } from "vitest";
import { docToHtml, docToMarkdown, inlineToHtml } from "../export";
import type { DocJson } from "../types";

function doc(blocks: DocJson["blocks"]): DocJson {
  return { title: "My Doc", blocks };
}

describe("docToMarkdown", () => {
  it("serializes all block types", () => {
    const md = docToMarkdown(
      doc([
        { id: "a", type: "heading", data: { level: 2, text: "Sub" } },
        { id: "b", type: "paragraph", data: { text: "Hello **world**" } },
        { id: "c", type: "quote", data: { text: "quoted" } },
        { id: "d", type: "callout", data: { icon: "💡", text: "tip" } },
        { id: "e", type: "code", data: { language: "py", text: "print(1)" } },
        { id: "f", type: "bullet_list", data: { items: ["a", "b"] } },
        { id: "g", type: "numbered_list", data: { items: ["one", "two"] } },
        { id: "h", type: "checklist", data: { items: [[true, "done"], ["bad"], "x"] as never } },
        { id: "i", type: "table", data: { headers: ["A", "B"], rows: [["1", "2"]] } },
        { id: "j", type: "divider", data: {} },
        { id: "k", type: "image", data: { src: "/api/media/x.png", caption: "pic" } },
      ])
    );
    expect(md).toContain("## Sub");
    expect(md).toContain("Hello **world**");
    expect(md).toContain("> quoted");
    expect(md).toContain("> 💡 tip");
    expect(md).toContain("```py\nprint(1)\n```");
    expect(md).toContain("- a\n- b");
    expect(md).toContain("1. one\n2. two");
    expect(md).toContain("- [x] done");
    expect(md).toContain("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(md).toContain("---");
    expect(md).toContain("![pic](/api/media/x.png)");
  });

  it("wraps chart/video/audio as json fenced blocks", () => {
    const md = docToMarkdown(
      doc([
        {
          id: "a",
          type: "chart",
          data: { kind: "bar", title: "T", labels: ["x"], series: { S: [1] } },
        },
      ])
    );
    expect(md).toContain('```json\n{"type":"chart","data":{"kind":"bar","title":"T","labels":["x"],"series":{"S":[1]}}}\n```');
  });
});

describe("docToHtml", () => {
  it("renders inline styles and escapes html", () => {
    const html = docToHtml(
      doc([
        { id: "a", type: "paragraph", data: { text: "<script>alert(1)</script> **bold** ~~strike~~ `code` [link](https://x.dev)" } },
      ])
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<del>strike</del>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://x.dev">link</a>');
    expect(html).toContain("<title>My Doc</title>");
  });

  it("strips javascript: urls from links and images", () => {
    const html = docToHtml(
      doc([
        { id: "a", type: "paragraph", data: { text: "[bad](javascript:alert(1)) ![img](javascript:x)" } },
      ])
    );
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
    expect(html).toContain('src="#"');
  });

  it("keeps safe relative and media urls", () => {
    const html = docToHtml(
      doc([
        { id: "a", type: "paragraph", data: { text: "[rel](/api/media/x.png) [dot](../y.md)" } },
      ])
    );
    expect(html).toContain('href="/api/media/x.png"');
    expect(html).toContain('href="../y.md"');
  });

  it("renders checklist, table and image blocks", () => {
    const html = docToHtml(
      doc([
        { id: "a", type: "checklist", data: { items: [[true, "done"], [false, "todo"]] } },
        { id: "b", type: "table", data: { headers: ["A"], rows: [["1"]] } },
        { id: "c", type: "image", data: { src: "/api/media/p.png", caption: "cap" } },
      ])
    );
    expect(html).toContain("<ul class='checklist'>");
    expect(html).toContain("&#9745; done");
    expect(html).toContain("<th>A</th>");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain("<figcaption>cap</figcaption>");
  });

  it("ignores malformed checklist items", () => {
    const html = docToHtml(doc([{ id: "a", type: "checklist", data: { items: [123, "x", null] as never } }]));
    expect(html).toContain("<ul class='checklist'></ul>");
  });
});

describe("inlineToHtml parity", () => {
  it("matches the backend strong/del/em/code ordering", () => {
    const source = "**b** ~~s~~ *i* `c`";
    expect(inlineToHtml(source)).toBe("<strong>b</strong> <del>s</del> <em>i</em> <code>c</code>");
  });
});