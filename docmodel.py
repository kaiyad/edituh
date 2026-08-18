import base64
import html as html_lib
import json
import os
import re
import uuid
import zlib
import struct
from pathlib import Path

MEDIA_DIR = Path(os.path.expanduser("~/.edituh/media"))
CHART_COLORS = ["#4f8bf9", "#ff6b6b", "#ffd93d", "#6bcb77", "#9b5de5", "#00bbf9", "#f15bb5"]


def _safe_url(url):
    low = url.strip().lower()
    if low.startswith(("http://", "https://", "mailto:", "data:")):
        return url.strip()
    if low.startswith(("media/", "/", "./", "../", "#")):
        return url.strip()
    return "#"


def _inline(text):
    out = html_lib.escape(text)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"~~([^~]+)~~", r"<del>\1</del>", out)
    out = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", out)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", lambda m: f'<img src="{_safe_url(m.group(2))}" alt="{m.group(1)}"/>', out)
    out = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", lambda m: f'<a href="{_safe_url(m.group(2))}">{m.group(1)}</a>', out)
    out = re.sub(
        r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]",
        lambda m: f'<a class="wikilink" href="#/doc/{html_lib.escape(m.group(1).strip())}">{html_lib.escape((m.group(2) or m.group(1)).strip())}</a>',
        out,
    )
    out = re.sub(r"\$[^$\s](?:[^$\n]*[^$\s])?\$", lambda m: f'<span class="math-inline">{m.group(0)}</span>', out)
    return out


def inline_markdown(text):
    return _inline(text)


def render_markdown(source):
    lines = source.split("\n")
    output = []
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if stripped.startswith("```"):
            language = stripped[3:].strip()
            buffer = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                buffer.append(lines[index])
                index += 1
            index += 1
            code = html_lib.escape(chr(10).join(buffer))
            if language.lower() == "mermaid":
                output.append(f"<pre class='mermaid'>{code}</pre>")
            else:
                output.append(
                    f"<pre><code class='language-{html_lib.escape(language or 'text')}'>"
                    f"{code}</code></pre>"
                )
            continue
        match = re.match(r"^(#{1,6})\s+(.*)$", line)
        if match:
            level = len(match.group(1))
            output.append(f"<h{level}>{_inline(match.group(2))}</h{level}>")
            index += 1
            continue
        if re.match(r"^\s*[-*+]\s+", line):
            output.append("<ul>")
            while index < len(lines) and re.match(r"^\s*[-*+]\s+", lines[index]):
                item = re.sub(r"^\s*[-*+]\s+", "", lines[index])
                output.append(f"<li>{_inline(item)}</li>")
                index += 1
            output.append("</ul>")
            continue
        if re.match(r"^\s*\d+[.)]\s+", line):
            output.append("<ol>")
            while index < len(lines) and re.match(r"^\s*\d+[.)]\s+", lines[index]):
                item = re.sub(r"^\s*\d+[.)]\s+", "", lines[index])
                output.append(f"<li>{_inline(item)}</li>")
                index += 1
            output.append("</ol>")
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[index + 1].strip()):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                rows.append(cells)
                index += 1
            header = rows[0]
            body = rows[2:]
            output.append("<table><thead><tr>" + "".join(f"<th>{_inline(cell)}</th>" for cell in header) + "</tr></thead>")
            if body:
                output.append("<tbody>")
                for row in body:
                    output.append("<tr>" + "".join(f"<td>{_inline(cell)}</td>" for cell in row) + "</tr>")
                output.append("</tbody>")
            output.append("</table>")
            continue
        if stripped.startswith(">"):
            output.append(f"<blockquote>{_inline(stripped[1:].strip())}</blockquote>")
            index += 1
            continue
        if re.match(r"^(\s*[-*_]\s*){3,}$", stripped):
            output.append("<hr/>")
            index += 1
            continue
        if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) > 4:
            latex = stripped[2:-2].strip()
            output.append(f'<p class="math-block">$${html_lib.escape(latex)}$$</p>')
            index += 1
            continue
        if not stripped:
            index += 1
            continue
        paragraph = []
        while index < len(lines) and lines[index].strip():
            paragraph.append(lines[index].strip())
            index += 1
        output.append(f"<p>{_inline(' '.join(paragraph))}</p>")
    return "\n".join(output)


def parse_markdown(source):
    doc = Document("Untitled")
    lines = source.split("\n")
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if stripped.startswith("```"):
            language = stripped[3:].strip()
            buffer = []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith("```"):
                buffer.append(lines[index])
                index += 1
            index += 1
            text = "\n".join(buffer)
            if language.lower() == "mermaid":
                doc.add_block("mermaid", {"code": text})
                continue
            if language.lower() == "json":
                try:
                    payload = json.loads(text)
                except Exception:
                    payload = None
                if isinstance(payload, dict) and payload.get("type") in (
                    "video", "audio", "chart", "callout", "checklist", "image", "file",
                ):
                    doc.add_block(payload["type"], payload.get("data") or {})
                    continue
            doc.add_block("code", {"language": language or "text", "text": text})
            continue
        match = re.match(r"^(#{1,6})\s+(.*)$", line)
        if match:
            doc.add_block("heading", {"level": len(match.group(1)), "text": match.group(2)})
            if doc.title == "Untitled" and len(match.group(1)) == 1:
                doc.title = match.group(2)
            index += 1
            continue
        if re.match(r"^\s*[-*+]\s+", line):
            items = []
            while index < len(lines) and re.match(r"^\s*[-*+]\s+", lines[index]):
                items.append(re.sub(r"^\s*[-*+]\s+", "", lines[index]))
                index += 1
            if all(re.match(r"^\[[ xX]\]\s*", item) for item in items if item):
                doc.add_block("checklist", {"items": [[bool(re.match(r"^\[[xX]\]", item)), re.sub(r"^\[[ xX]\]\s*", "", item)] for item in items]})
            else:
                doc.add_block("bullet_list", {"items": items})
            continue
        if re.match(r"^\s*\d+[.)]\s+", line):
            items = []
            while index < len(lines) and re.match(r"^\s*\d+[.)]\s+", lines[index]):
                items.append(re.sub(r"^\s*\d+[.)]\s+", "", lines[index]))
                index += 1
            doc.add_block("numbered_list", {"items": items})
            continue
        if stripped.startswith("|") and index + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[index + 1].strip()):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                rows.append(cells)
                index += 1
            doc.add_block("table", {"headers": rows[0], "rows": rows[2:]})
            continue
        if stripped.startswith(">"):
            doc.add_block("quote", {"text": stripped[1:].strip()})
            index += 1
            continue
        if re.match(r"^(\s*[-*_]\s*){3,}$", stripped):
            doc.add_block("divider", {})
            index += 1
            continue
        if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) > 4:
            doc.add_block("math", {"latex": stripped[2:-2].strip()})
            index += 1
            continue
        if not stripped:
            index += 1
            continue
        image = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)$", stripped)
        if image:
            doc.add_block("image", {"src": image.group(2), "caption": image.group(1)})
            index += 1
            continue
        paragraph = []
        while index < len(lines) and lines[index].strip():
            paragraph.append(lines[index].strip())
            index += 1
        doc.add_block("paragraph", {"text": " ".join(paragraph)})
    return doc


def chart_svg(kind, labels, series, width=640, height=360):
    if not labels or not series:
        return ""
    padding = 46
    plot_width = width - padding * 2
    plot_height = height - padding * 2
    all_values = [value for values in series.values() for value in values]
    max_value = max(all_values) if all_values else 1
    min_value = min(0, min(all_values)) if all_values else 0
    span = max(max_value - min_value, 1)
    def x_at(index):
        if len(labels) <= 1:
            return padding + plot_width / 2
        return padding + plot_width * index / (len(labels) - 1)
    def y_at(value):
        return padding + plot_height - plot_height * (value - min_value) / span
    parts = [f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {width} {height}' width='100%' height='auto'>"]
    for step in range(5):
        ratio = step / 4
        value = min_value + span * ratio
        y = y_at(value)
        parts.append(f"<line x1='{padding}' y1='{y:.1f}' x2='{width - padding}' y2='{y:.1f}' stroke='#d0d7de' stroke-width='1'/>")
        parts.append(f"<text x='4' y='{y + 4:.1f}' font-size='11' fill='#8b949e'>{value:.1f}</text>")
    for index, label in enumerate(labels):
        x = x_at(index)
        parts.append(f"<text x='{x:.1f}' y='{height - 12}' font-size='11' fill='#8b949e' text-anchor='middle'>{html_lib.escape(str(label))}</text>")
    for series_index, (name, values) in enumerate(series.items()):
        color = CHART_COLORS[series_index % len(CHART_COLORS)]
        if kind == "bar":
            bar_width = plot_width / max(len(labels), 1) * 0.6 / max(len(series), 1)
            for point_index, value in enumerate(values):
                x = x_at(point_index) - bar_width * len(series) / 2 + series_index * bar_width
                bar_height = max(plot_height * value / span, 2) if value >= 0 else 2
                y = y_at(value) if value >= 0 else y_at(0)
                parts.append(f"<rect x='{x:.1f}' y='{y:.1f}' width='{bar_width:.1f}' height='{bar_height:.1f}' fill='{color}' rx='3'/>")
        else:
            points = " ".join(f"{x_at(i):.1f},{y_at(value):.1f}" for i, value in enumerate(values))
            if kind == "line":
                parts.append(f"<polyline points='{points}' fill='none' stroke='{color}' stroke-width='2.5'/>")
            elif kind == "area":
                area_points = points + f" {x_at(len(values) - 1):.1f},{y_at(0):.1f} {x_at(0):.1f},{y_at(0):.1f}"
                parts.append(f"<polygon points='{area_points}' fill='{color}' opacity='0.25'/>")
                parts.append(f"<polyline points='{points}' fill='none' stroke='{color}' stroke-width='2.5'/>")
            else:
                for i, value in enumerate(values):
                    cx, cy = x_at(i), y_at(value)
                    parts.append(f"<circle cx='{cx:.1f}' cy='{cy:.1f}' r='4.5' fill='{color}'/>")
                parts.append(f"<polyline points='{points}' fill='none' stroke='{color}' stroke-width='1.5' stroke-dasharray='4 3'/>")
        if len(series) > 1:
            parts.append(f"<text x='{padding}' y='{padding - 8 - series_index * 16}' font-size='11' fill='{color}'>{html_lib.escape(name)}</text>")
    parts.append("</svg>")
    return "".join(parts)


class MediaStore:
    DIR = MEDIA_DIR

    @classmethod
    def _ensure_dir(cls):
        cls.DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def save(cls, data, filename):
        cls._ensure_dir()
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(filename or "media.bin"))
        target = cls.DIR / safe
        counter = 1
        while target.exists():
            target = cls.DIR / f"{Path(safe).stem}_{counter}{Path(safe).suffix}"
            counter += 1
        target.write_bytes(data)
        return f"media/{target.name}"

    @classmethod
    def resolve(cls, src):
        if not src:
            return None
        if str(src).startswith("media/"):
            path = cls.DIR / Path(str(src)).name
            return path if path.exists() else None
        path = Path(src)
        if path.is_file():
            return path
        return None

    @classmethod
    def mime_type(cls, path):
        return {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
            ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
            ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
            ".m4a": "audio/mp4",
        }.get(Path(str(path)).suffix.lower(), "application/octet-stream")

    @classmethod
    def data_uri(cls, src):
        path = cls.resolve(src)
        if path is None:
            return src if str(src).startswith(("http://", "https://", "data:")) else None
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{cls.mime_type(path)};base64,{encoded}"


def make_png(size, rgb):
    def chunk(tag, data):
        payload = struct.pack(">I", len(data)) + tag + data
        return payload + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    row = b"\x00" + bytes(rgb) * size
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(row * size))
        + chunk(b"IEND", b"")
    )


class Block:
    def __init__(self, block_id=None, block_type="paragraph", data=None):
        self.id = block_id or uuid.uuid4().hex[:10]
        self.type = block_type
        self.data = data or {}

    def to_dict(self):
        return {"id": self.id, "type": self.type, "data": self.data}

    @classmethod
    def from_dict(cls, payload):
        return cls(payload.get("id"), payload.get("type", "paragraph"), payload.get("data") or {})


class Document:
    def __init__(self, title="Untitled", blocks=None):
        self.title = title
        self.blocks = blocks or []

    def add_block(self, block_type, data=None, index=None):
        block = Block(block_type=block_type, data=data)
        if index is None:
            self.blocks.append(block)
        else:
            self.blocks.insert(index, block)
        return block

    def remove_block(self, block_id):
        for index, block in enumerate(self.blocks):
            if block.id == block_id:
                self.blocks.pop(index)
                return True
        return False

    def move_block(self, block_id, direction):
        for index, block in enumerate(self.blocks):
            if block.id == block_id:
                target = index + direction
                if 0 <= target < len(self.blocks):
                    self.blocks[index], self.blocks[target] = self.blocks[target], self.blocks[index]
                    return True
        return False

    def block_by_id(self, block_id):
        for block in self.blocks:
            if block.id == block_id:
                return block
        return None

    def word_count(self):
        total = 0
        for block in self.blocks:
            text = block.data.get("text", "")
            if block.type in ("bullet_list", "numbered_list"):
                text = " ".join(block.data.get("items", []))
            elif block.type == "checklist":
                text = " ".join(
                    str(item[1]) for item in block.data.get("items", []) if isinstance(item, (list, tuple)) and len(item) > 1
                )
            elif block.type == "table":
                text = " ".join(block.data.get("headers", [])) + " " + " ".join(
                    " ".join(cell for cell in row) for row in block.data.get("rows", [])
                )
            elif block.type == "image":
                text = block.data.get("caption", "")
            total += len(re.findall(r"\S+", text))
        return total

    def char_count(self):
        return len(self.to_markdown())

    def heading_tree(self):
        return [(block.id, block.data.get("level", 1), block.data.get("text", "")) for block in self.blocks if block.type == "heading"]

    def to_dict(self):
        return {"title": self.title, "blocks": [block.to_dict() for block in self.blocks]}

    @classmethod
    def from_dict(cls, payload):
        blocks = [Block.from_dict(item) for item in (payload.get("blocks") or [])]
        return cls(payload.get("title", "Untitled"), blocks)

    def to_markdown(self):
        output = []
        for block in self.blocks:
            if block.type == "heading":
                output.append("#" * int(block.data.get("level", 1)) + " " + block.data.get("text", ""))
            elif block.type == "paragraph":
                output.append(block.data.get("text", ""))
            elif block.type == "quote":
                output.append("> " + block.data.get("text", ""))
            elif block.type == "callout":
                icon = block.data.get("icon", "💡")
                output.append("> " + icon + " " + block.data.get("text", ""))
            elif block.type == "code":
                language = block.data.get("language", "text")
                output.append("```" + language)
                output.append(block.data.get("text", ""))
                output.append("```")
            elif block.type == "bullet_list":
                output.extend("- " + item for item in block.data.get("items", []))
            elif block.type == "numbered_list":
                output.extend(f"{index + 1}. {item}" for index, item in enumerate(block.data.get("items", [])))
            elif block.type == "checklist":
                output.extend(
                    ("- [x] " if item[0] else "- [ ] ") + str(item[1])
                    for item in block.data.get("items", [])
                    if isinstance(item, (list, tuple)) and len(item) > 1
                )
            elif block.type == "table":
                headers = block.data.get("headers", [])
                rows = block.data.get("rows", [])
                output.append("| " + " | ".join(headers) + " |")
                output.append("| " + " | ".join("---" for _ in headers) + " |")
                for row in rows:
                    output.append("| " + " | ".join(row) + " |")
            elif block.type == "divider":
                output.append("---")
            elif block.type == "image":
                output.append(f"![{block.data.get('caption', '')}]({block.data.get('src', '')})")
            elif block.type == "math":
                output.append("$$" + str(block.data.get("latex", "")).strip() + "$$")
            elif block.type == "mermaid":
                output.append("```mermaid")
                output.append(block.data.get("code", ""))
                output.append("```")
            elif block.type in ("video", "audio", "chart", "file"):
                output.append("```json")
                output.append(json.dumps({"type": block.type, "data": block.data}, ensure_ascii=False))
                output.append("```")
            output.append("")
        return "\n".join(output).rstrip("\n") + "\n"

    def to_html(self, title=None):
        head = []
        head.append("<!DOCTYPE html><html><head><meta charset='utf-8'>")
        head.append(f"<title>{html_lib.escape(title or self.title)}</title>")
        head.append("<style>")
        head.append(_EXPORT_CSS)
        head.append("</style>")
        head.append(_MATH_CDN)
        head.append("</head><body><main>")
        head.append(f"<h1 class='doc-title'>{html_lib.escape(title or self.title)}</h1>")
        for block in self.blocks:
            head.append(self._block_html(block))
        head.append("</main></body></html>")
        return "".join(head)

    def _block_html(self, block):
        block_type = block.type
        data = block.data
        if block_type == "heading":
            level = min(int(data.get("level", 1)), 6)
            return f"<h{level}>{_inline(data.get('text', ''))}</h{level}>"
        if block_type == "paragraph":
            return f"<p>{_inline(data.get('text', ''))}</p>"
        if block_type == "quote":
            return f"<blockquote>{_inline(data.get('text', ''))}</blockquote>"
        if block_type == "callout":
            return f"<div class='callout'>{html_lib.escape(data.get('icon', '💡'))} <span>{_inline(data.get('text', ''))}</span></div>"
        if block_type == "code":
            language = data.get("language", "text")
            return f"<pre><code class='language-{html_lib.escape(language)}'>{html_lib.escape(data.get('text', ''))}</code></pre>"
        if block_type in ("bullet_list", "numbered_list"):
            tag = "ul" if block_type == "bullet_list" else "ol"
            items = "".join(f"<li>{_inline(item)}</li>" for item in data.get("items", []))
            return f"<{tag}>{items}</{tag}>"
        if block_type == "checklist":
            items = []
            for item in data.get("items", []):
                if not isinstance(item, (list, tuple)) or len(item) < 2:
                    continue
                checked, text = item
                mark = "&#9745;" if checked else "&#9744;"
                items.append(f"<li class='checklist'>{mark} {_inline(str(text))}</li>")
            return f"<ul class='checklist'>{''.join(items)}</ul>"
        if block_type == "table":
            headers = data.get("headers", [])
            rows = data.get("rows", [])
            header_html = "".join(f"<th>{_inline(cell)}</th>" for cell in headers)
            body_html = "".join(
                "<tr>" + "".join(f"<td>{_inline(cell)}</td>" for cell in row) + "</tr>"
                for row in rows
            )
            return f"<table><thead><tr>{header_html}</tr></thead><tbody>{body_html}</tbody></table>"
        if block_type == "divider":
            return "<hr/>"
        if block_type == "image":
            src = MediaStore.data_uri(data.get("src", "")) or data.get("src", "")
            alt = html_lib.escape(data.get("caption", ""))
            figure = f"<figure><img src='{html_lib.escape(src)}' alt='{alt}'/>"
            if data.get("caption"):
                figure += f"<figcaption>{alt}</figcaption>"
            return figure + "</figure>"
        if block_type == "video":
            src = MediaStore.data_uri(data.get("src", "")) or data.get("src", "")
            caption = f"<figcaption>{html_lib.escape(data.get('caption', ''))}</figcaption>" if data.get("caption") else ""
            return f"<figure><video controls src='{html_lib.escape(src)}' style='max-width:100%'></video>{caption}</figure>"
        if block_type == "audio":
            src = MediaStore.data_uri(data.get("src", "")) or data.get("src", "")
            caption = f"<figcaption>{html_lib.escape(data.get('caption', ''))}</figcaption>" if data.get("caption") else ""
            return f"<figure><audio controls src='{html_lib.escape(src)}'></audio>{caption}</figure>"
        if block_type == "chart":
            kind = data.get("kind", "line")
            labels = data.get("labels", [])
            series = data.get("series", {})
            svg = chart_svg(kind, labels, series)
            caption = f"<figcaption>{html_lib.escape(data.get('title', ''))}</figcaption>" if data.get("title") else ""
            return f"<figure>{svg}{caption}</figure>"
        if block_type == "math":
            return f'<p class="math-block">$${html_lib.escape(data.get("latex", ""))}$$</p>'
        if block_type == "mermaid":
            return f'<pre class="mermaid">{html_lib.escape(data.get("code", ""))}</pre>'
        if block_type == "file":
            name = html_lib.escape(data.get("name", "attachment"))
            src = html_lib.escape(data.get("src", ""))
            return f'<p class="attachment"><a href="{src}">&#128206; {name}</a></p>'
        return ""


_MATH_CDN = """
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"/>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script defer>
  window.addEventListener('load', function () {
    if (window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false });
    if (window.mermaid) mermaid.initialize({ startOnLoad: true, securityLevel: 'loose', theme: 'base' });
  });
</script>
"""

_EXPORT_CSS = """
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #fafbfc; color: #24292f; }
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
.math-block { text-align: center; font-size: 1.1rem; }
.math-inline { font-size: 0.95em; }
a.wikilink { color: #0969da; text-decoration: none; border-bottom: 1px dashed #0969da; }
pre.mermaid { background: #ffffff; text-align: center; }
p.attachment { margin: 6px 0; }
@media print { body { background: white; } main { max-width: 100%; padding: 0; } }
"""