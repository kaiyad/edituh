import json
from pathlib import Path

from docmodel import (
    Document,
    MediaStore,
    chart_svg,
    make_png,
    parse_markdown,
    render_markdown,
)


def test_render_markdown_inline():
    html_text = render_markdown("Hello **bold** and *italic* and `code` and [link](https://x.dev)")
    assert "<strong>bold</strong>" in html_text
    assert "<em>italic</em>" in html_text
    assert "<code>code</code>" in html_text
    assert '<a href="https://x.dev">link</a>' in html_text


def test_render_markdown_structure():
    source = "# Title\n\n## Sub\n\n- a\n- b\n\n1. one\n2. two\n\n```python\nprint(1)\n```\n\n> quote\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |"
    html_text = render_markdown(source)
    assert "<h1>Title</h1>" in html_text
    assert "<h2>Sub</h2>" in html_text
    assert "<li>a</li>" in html_text
    assert "<ol>" in html_text
    assert "print(1)" in html_text
    assert "<blockquote>quote</blockquote>" in html_text
    assert "<hr/>" in html_text
    assert "<th>A</th>" in html_text
    assert "<td>2</td>" in html_text


def test_render_markdown_escapes_html():
    html_text = render_markdown("<script>alert(1)</script>")
    assert "<script>" not in html_text
    assert "&lt;script&gt;" in html_text


def test_render_markdown_wikilinks_and_math():
    html_text = render_markdown("See [[Project Alpha|the project]] and $x^2$.\n\n$$E = mc^2$$")
    assert '<a class="wikilink" href="#/doc/Project Alpha">the project</a>' in html_text
    assert 'class="math-inline"' in html_text
    assert '<p class="math-block">$$E = mc^2$$</p>' in html_text


def test_render_markdown_mermaid():
    html_text = render_markdown("```mermaid\nflowchart TD\n  A --> B\n```")
    assert "<pre class='mermaid'>" in html_text
    assert "A --&gt; B" in html_text
    assert "language-mermaid" not in html_text


def test_parse_markdown_math_mermaid_file():
    doc = parse_markdown("$$\\int_0^1 x dx$$\n\n```mermaid\nsequenceDiagram\nA->>B: hi\n```")
    assert doc.blocks[0].type == "math"
    assert doc.blocks[0].data["latex"] == "\\int_0^1 x dx"
    assert doc.blocks[1].type == "mermaid"
    assert doc.blocks[1].data["code"] == "sequenceDiagram\nA->>B: hi"


def test_math_mermaid_roundtrip():
    doc = Document("Math")
    doc.add_block("math", {"latex": "E = mc^2"})
    doc.add_block("mermaid", {"code": "flowchart TD\nA --> B"})
    doc.add_block("file", {"name": "plan.pdf", "src": "media/plan.pdf", "size": 42})
    markdown = doc.to_markdown()
    assert "$$E = mc^2$$" in markdown
    assert "```mermaid" in markdown
    assert '"type": "file"' in markdown
    restored = parse_markdown(markdown)
    assert [b.type for b in restored.blocks] == ["math", "mermaid", "file"]
    assert restored.blocks[0].data == {"latex": "E = mc^2"}
    assert restored.blocks[1].data == {"code": "flowchart TD\nA --> B"}
    assert restored.blocks[2].data == {"name": "plan.pdf", "src": "media/plan.pdf", "size": 42}


def test_to_html_includes_math_and_mermaid_cdn():
    doc = Document("Export")
    doc.add_block("math", {"latex": "x^2"})
    doc.add_block("mermaid", {"code": "flowchart TD\nA --> B"})
    html_text = doc.to_html()
    assert "katex@0.16.11" in html_text
    assert "mermaid@11" in html_text
    assert '<p class="math-block">$$x^2$$</p>' in html_text
    assert '<pre class="mermaid">flowchart TD\nA --&gt; B</pre>' in html_text


def test_parse_markdown_roundtrip():
    source = (
        "# Heading\n\n"
        "Some paragraph text\n\n"
        "- item one\n- item two\n\n"
        "1. first\n2. second\n\n"
        "```python\nx = 1\n```\n\n"
        "> quoted line\n\n"
        "| A | B |\n|---|---|\n| 1 | 2 |\n\n"
        "---\n\n"
        "![an image](media/pic.png)"
    )
    doc = parse_markdown(source)
    types = [block.type for block in doc.blocks]
    assert types == ["heading", "paragraph", "bullet_list", "numbered_list", "code", "quote", "table", "divider", "image"]
    heading = doc.blocks[0]
    assert heading.data["level"] == 1
    assert heading.data["text"] == "Heading"
    assert doc.blocks[1].data["text"] == "Some paragraph text"
    assert doc.blocks[2].data["items"] == ["item one", "item two"]
    assert doc.blocks[3].data["items"] == ["first", "second"]
    assert doc.blocks[4].data["language"] == "python"
    assert doc.blocks[4].data["text"] == "x = 1"
    assert doc.blocks[5].data["text"] == "quoted line"
    assert doc.blocks[6].data["headers"] == ["A", "B"]
    assert doc.blocks[6].data["rows"] == [["1", "2"]]
    assert doc.blocks[8].data["src"] == "media/pic.png"


def test_parse_markdown_checklist():
    doc = parse_markdown("- [x] done\n- [ ] pending")
    assert doc.blocks[0].type == "checklist"
    assert doc.blocks[0].data["items"] == [[True, "done"], [False, "pending"]]


def test_markdown_roundtrip_consistency():
    source = "# Title\n\nBody text here\n\n- a\n- b\n\n1. one\n\n```js\nlet x = 1\n```\n\n> quote\n\n| H1 | H2 |\n|---|---|\n| c1 | c2 |\n\n---\n\n![cap](media/x.png)"
    doc = parse_markdown(source)
    regenerated = parse_markdown(doc.to_markdown())
    assert [b.type for b in regenerated.blocks] == [b.type for b in doc.blocks]
    for original, copy in zip(doc.blocks, regenerated.blocks):
        assert original.data == copy.data


def test_document_json_roundtrip():
    doc = Document("My Doc")
    doc.add_block("heading", {"level": 2, "text": "Intro"})
    doc.add_block("table", {"headers": ["a", "b"], "rows": [["1", "2"]]})
    restored = Document.from_dict(doc.to_dict())
    assert restored.title == "My Doc"
    assert len(restored.blocks) == 2
    assert restored.blocks[0].data["text"] == "Intro"
    assert restored.blocks[1].data["rows"] == [["1", "2"]]


def test_block_operations():
    doc = Document("Ops")
    first = doc.add_block("paragraph", {"text": "one"})
    second = doc.add_block("paragraph", {"text": "two"})
    third = doc.add_block("paragraph", {"text": "three"})
    assert doc.move_block(second.id, 1)
    assert [b.data["text"] for b in doc.blocks] == ["one", "three", "two"]
    assert doc.move_block(second.id, -1)
    assert [b.data["text"] for b in doc.blocks] == ["one", "two", "three"]
    assert doc.remove_block(second.id)
    assert [b.data["text"] for b in doc.blocks] == ["one", "three"]
    assert not doc.remove_block("missing")


def test_word_count():
    doc = Document("Stats")
    doc.add_block("heading", {"text": "Hello world"})
    doc.add_block("paragraph", {"text": "two words"})
    doc.add_block("bullet_list", {"items": ["one", "two three"]})
    doc.add_block("checklist", {"items": [[True, "four"], [False, ""]]})
    doc.add_block("table", {"headers": ["x"], "rows": [["five six"]]})
    doc.add_block("image", {"caption": "seven"})
    assert doc.word_count() == 12


def test_heading_tree():
    doc = Document("TOC")
    a = doc.add_block("heading", {"level": 1, "text": "A"})
    b = doc.add_block("heading", {"level": 2, "text": "B"})
    doc.add_block("paragraph", {"text": "x"})
    tree = doc.heading_tree()
    assert tree == [(a.id, 1, "A"), (b.id, 2, "B")]


def test_chart_svg_kinds():
    labels = ["Jan", "Feb", "Mar"]
    series = {"Sales": [10, 20, 15]}
    assert "<svg" in chart_svg("bar", labels, series)
    assert "<svg" in chart_svg("line", labels, series)
    assert "<svg" in chart_svg("area", labels, series)
    assert "<svg" in chart_svg("scatter", labels, series)
    assert chart_svg("bar", [], {}) == ""


def test_make_png():
    png = make_png(64, (79, 139, 249))
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(png) > 100


def test_media_store_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(MediaStore, "DIR", tmp_path / "media")
    stored = MediaStore.save(b"\x89PNG data", "photo.png")
    assert stored == "media/photo.png"
    resolved = MediaStore.resolve(stored)
    assert resolved is not None
    assert resolved.read_bytes() == b"\x89PNG data"
    uri = MediaStore.data_uri(stored)
    assert uri.startswith("data:image/png;base64,")
    assert MediaStore.resolve("http://example.com/x.png") is None
    assert MediaStore.data_uri("https://example.com/x.png") == "https://example.com/x.png"


def test_html_export_embeds_media(tmp_path, monkeypatch):
    monkeypatch.setattr(MediaStore, "DIR", tmp_path / "media")
    MediaStore.save(b"png-bytes", "pic.png")
    doc = Document("Export")
    doc.add_block("image", {"src": "media/pic.png", "caption": "A pic"})
    doc.add_block("chart", {"kind": "bar", "labels": ["x"], "series": {"S": [5]}})
    html_text = doc.to_html()
    assert "<html>" in html_text
    assert "data:image/png;base64,cG5nLWJ5dGVz" in html_text
    assert "<svg" in html_text
    assert "doc-title" in html_text and "Export" in html_text
    assert "<figcaption>A pic</figcaption>" in html_text


def test_html_export_escapes():
    doc = Document("T")
    doc.add_block("paragraph", {"text": "<b>nope</b>"})
    html_text = doc.to_html()
    assert "<b>nope</b>" not in html_text
    assert "&lt;b&gt;nope&lt;/b&gt;" in html_text


def test_markdown_export_media_blocks():
    doc = Document("M")
    doc.add_block("video", {"src": "media/v.mp4", "caption": "Clip"})
    doc.add_block("chart", {"kind": "line", "labels": ["a"], "series": {"S": [1]}})
    markdown = doc.to_markdown()
    parsed = parse_markdown(markdown)
    assert [b.type for b in parsed.blocks] == ["video", "chart"]
    assert parsed.blocks[0].data["src"] == "media/v.mp4"
    assert parsed.blocks[1].data["kind"] == "line"

def test_markdown_golden_roundtrip():
    sample = Path(__file__).parent / "tests" / "data" / "sample.md"
    source = sample.read_text(encoding="utf-8")
    doc = parse_markdown(source)
    types = [block.type for block in doc.blocks]
    assert "heading" in types
    assert "bullet_list" in types
    assert "numbered_list" in types
    assert "checklist" in types
    assert "table" in types
    assert "quote" in types
    assert "code" in types
    assert "divider" in types
    assert "image" in types
    assert doc.title == "Sample Document"
    inline = doc.blocks[1].data["text"]
    assert "**bold**" in inline
    assert "~~struck~~" in inline
    assert "[link](https://example.com)" in inline
    roundtrip = parse_markdown(doc.to_markdown())
    assert [block.type for block in roundtrip.blocks] == types
    assert len(roundtrip.blocks) == len(doc.blocks)


def test_export_html_sanitizes_links():
    doc = Document("T")
    doc.add_block("paragraph", {"text": "[bad](javascript:alert(1)) and [ok](https://good.dev) [rel](/api/media/x.png)"})
    html_text = doc.to_html()
    assert 'href="javascript:' not in html_text
    assert 'href="#"' in html_text
    assert 'href="https://good.dev"' in html_text
    assert 'href="/api/media/x.png"' in html_text


def test_strike_rendering():
    html_text = render_markdown("~~gone~~ stays")
    assert "<del>gone</del>" in html_text


def test_export_html_handles_malformed_checklist():
    doc = Document("T")
    doc.add_block("checklist", {"items": [123, "nope"]})
    doc.to_html()
    doc.word_count()
