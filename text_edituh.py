import base64
import difflib
import html
import json
import os
import re
import urllib.parse
from pathlib import Path

from rope import RopeNode

HISTORY_LIMIT = 1000
SESSION_FILE = Path(os.path.expanduser("~/.edituh/session.json"))
SESSION_MAX_DOCUMENTS = 10
SESSION_MAX_BYTES = 1_000_000

_WORD_RE = re.compile(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+")
_WORD_TOKEN_RE = re.compile(r"\S+")


def _words(value):
    return _WORD_RE.findall(value)


def _to_snake(value):
    return "_".join(word.lower() for word in _words(value))


def _to_kebab(value):
    return "-".join(word.lower() for word in _words(value))


def _to_camel(value):
    words = _words(value)
    if not words:
        return value
    return words[0].lower() + "".join(word.capitalize() for word in words[1:])


def _to_pascal(value):
    return "".join(word.capitalize() for word in _words(value))


def _natural_key(value):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def diff_text(left, right, name_a="Document A", name_b="Document B"):
    result = "".join(
        difflib.unified_diff(
            left.splitlines(keepends=True),
            right.splitlines(keepends=True),
            fromfile=name_a,
            tofile=name_b,
        )
    )
    return result if result else "The documents are identical."


class TextEdituh:
    def __init__(self, initial_text="", filepath=None):
        self.history = [RopeNode.create_rope_from_string(initial_text or "")]
        self.current_index = 0
        self.cursor = 0
        self.anchor = None
        self.filepath = filepath
        self.saved_index = 0

    @property
    def current_rope(self):
        return self.history[self.current_index]

    @property
    def text(self):
        return self.current_rope.to_string()

    @property
    def length(self):
        return len(self.current_rope)

    @property
    def dirty(self):
        return self.current_index != self.saved_index

    @property
    def selection_range(self):
        if self.anchor is None:
            return self.cursor, self.cursor
        return min(self.anchor, self.cursor), max(self.anchor, self.cursor)

    def _commit(self, rope):
        self.history = self.history[: self.current_index + 1]
        self.history.append(rope)
        self.current_index += 1
        if len(self.history) > HISTORY_LIMIT:
            self.history.pop(0)
            self.current_index -= 1

    def _clamp_cursor(self):
        limit = len(self.current_rope)
        self.cursor = max(0, min(self.cursor, limit))
        if self.anchor is not None:
            self.anchor = max(0, min(self.anchor, limit))

    def set_text(self, new_text):
        self.history = [RopeNode.create_rope_from_string(new_text or "")]
        self.current_index = 0
        self.saved_index = 0
        self.cursor = len(new_text or "")
        self.anchor = None

    def commit_import(self, new_text):
        rope = RopeNode.create_rope_from_string(new_text or "")
        if rope.to_string() == self.text:
            return
        self._commit(rope)
        self._clamp_cursor()

    def load_document(self, text, filepath=None):
        self.set_text(text)
        self.filepath = filepath

    def set_cursor(self, position):
        self.cursor = max(0, min(position, len(self.current_rope)))
        self.anchor = None

    def set_selection(self, start, end):
        limit = len(self.current_rope)
        start = max(0, min(start, limit))
        end = max(0, min(end, limit))
        self.cursor = end
        self.anchor = start

    def move_cursor(self, delta):
        self.set_cursor(self.cursor + delta)

    def type_text(self, value):
        if not value:
            return
        start, end = self.selection_range
        rope = RopeNode.replace(self.current_rope, start, end, value)
        self._commit(rope)
        self.cursor = start + len(value)
        self.anchor = None

    def update_text(self, value):
        self.type_text(value)

    def insert_text(self, value):
        if not value:
            return
        rope = RopeNode.replace(self.current_rope, self.cursor, self.cursor, value)
        self._commit(rope)
        self.cursor += len(value)
        self.anchor = None

    def replace_range(self, start, end, value):
        rope = RopeNode.replace(self.current_rope, start, end, value)
        self._commit(rope)
        self.set_cursor(start + len(value))

    def backspace(self):
        start, end = self.selection_range
        if end > start:
            self.replace_range(start, end, "")
        elif self.cursor > 0:
            rope = RopeNode.replace(self.current_rope, self.cursor - 1, self.cursor, "")
            self._commit(rope)
            self.cursor -= 1
            self.anchor = None

    def delete_forward(self):
        start, end = self.selection_range
        if end > start:
            self.replace_range(start, end, "")
        elif self.cursor < self.length:
            rope = RopeNode.replace(self.current_rope, self.cursor, self.cursor + 1, "")
            self._commit(rope)
            self.anchor = None

    def undo(self):
        if self.current_index <= 0:
            return False
        self.current_index -= 1
        self._clamp_cursor()
        return True

    def redo(self):
        if self.current_index >= len(self.history) - 1:
            return False
        self.current_index += 1
        self._clamp_cursor()
        return True

    def save_to_file(self, path):
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(self.text)
        self.filepath = path
        self.saved_index = self.current_index

    def load_from_file(self, path):
        raw = Path(path).read_bytes()
        try:
            content = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = raw.decode("latin-1")
        self.set_text(content)
        self.filepath = str(path)

    def get_display_text(self):
        return self.text[: self.cursor] + "|" + self.text[self.cursor :]

    def _line_starts(self):
        starts = [0]
        text = self.text
        index = text.find("\n")
        while index != -1:
            starts.append(index + 1)
            index = text.find("\n", index + 1)
        return starts

    @property
    def cursor_position(self):
        prefix = self.text[: self.cursor]
        row = prefix.count("\n") + 1
        starts = self._line_starts()
        col = self.cursor - starts[row - 1] + 1
        return row, col

    def goto_line(self, line_number):
        starts = self._line_starts()
        target = max(1, min(line_number, len(starts)))
        self.set_cursor(starts[target - 1])

    def stats(self):
        text = self.text
        lines = text.split("\n")
        return {
            "lines": len(lines),
            "characters": len(text),
            "characters_no_spaces": len(re.sub(r"\s+", "", text)),
            "words": len(_WORD_TOKEN_RE.findall(text)),
            "bytes": len(text.encode("utf-8")),
            "paragraphs": sum(1 for block in re.split(r"\n\s*\n", text) if block.strip()),
            "max_line_length": max((len(line) for line in lines), default=0),
        }

    def _compile(self, pattern, regex, case_sensitive):
        flags = 0 if case_sensitive else re.IGNORECASE
        return re.compile(pattern if regex else re.escape(pattern), flags)

    def find_all(self, pattern, regex=False, case_sensitive=True):
        return [match.start() for match in self._compile(pattern, regex, case_sensitive).finditer(self.text)]

    def find_spans(self, pattern, regex=False, case_sensitive=True):
        return [(match.start(), match.end()) for match in self._compile(pattern, regex, case_sensitive).finditer(self.text)]

    def find(self, pattern, start=0, regex=False, case_sensitive=True):
        match = self._compile(pattern, regex, case_sensitive).search(self.text, start)
        return match.start() if match else -1

    def find_next(self, pattern, regex=False, case_sensitive=True):
        compiled = self._compile(pattern, regex, case_sensitive)
        match = compiled.search(self.text, self.cursor)
        if not match:
            match = compiled.search(self.text)
        if match:
            self.set_selection(match.start(), match.end())
            return match.start()
        return -1

    def replace_one(self, pattern, replacement, regex=False, case_sensitive=True):
        match = self._compile(pattern, regex, case_sensitive).search(self.text, self.cursor)
        if not match:
            return False
        result = match.expand(replacement)
        self.replace_range(match.start(), match.end(), result)
        return True

    def replace_all(self, pattern, replacement, regex=False, case_sensitive=True):
        new_text, count = self._compile(pattern, regex, case_sensitive).subn(replacement, self.text)
        if count:
            rope = RopeNode.create_rope_from_string(new_text)
            self._commit(rope)
            self._clamp_cursor()
        return count

    def apply_transform(self, fn):
        if self.anchor is None:
            start, end = 0, self.length
        else:
            start, end = self.selection_range
        source = self.text[start:end]
        result = fn(source)
        if result == source:
            return False
        rope = RopeNode.replace(self.current_rope, start, end, result)
        self._commit(rope)
        if self.anchor is None:
            self.set_cursor(len(result))
        else:
            self.set_selection(start, start + len(result))
        return True

    def transform_upper(self):
        return self.apply_transform(lambda value: value.upper())

    def transform_lower(self):
        return self.apply_transform(lambda value: value.lower())

    def transform_title(self):
        return self.apply_transform(lambda value: value.title())

    def transform_capitalize(self):
        return self.apply_transform(lambda value: value.capitalize())

    def transform_snake(self):
        return self.apply_transform(_to_snake)

    def transform_kebab(self):
        return self.apply_transform(_to_kebab)

    def transform_camel(self):
        return self.apply_transform(_to_camel)

    def transform_pascal(self):
        return self.apply_transform(_to_pascal)

    def _replace_all_text(self, new_text):
        if new_text == self.text:
            return False
        rope = RopeNode.create_rope_from_string(new_text)
        self._commit(rope)
        self._clamp_cursor()
        return True

    def sort_lines(self, reverse=False, natural=False):
        lines = self.text.split("\n")
        if natural:
            lines = sorted(lines, key=_natural_key, reverse=reverse)
        else:
            lines = sorted(lines, reverse=reverse)
        return self._replace_all_text("\n".join(lines))

    def unique_lines(self, reverse=False):
        seen = set()
        result = [line for line in self.text.split("\n") if not (line in seen or seen.add(line))]
        if reverse:
            result.reverse()
        return self._replace_all_text("\n".join(result))

    def reverse_lines(self):
        return self._replace_all_text("\n".join(reversed(self.text.split("\n"))))

    def trim_lines(self):
        return self._replace_all_text("\n".join(line.strip() for line in self.text.split("\n")))

    def remove_empty_lines(self):
        return self._replace_all_text("\n".join(line for line in self.text.split("\n") if line))

    def join_lines(self, separator=", "):
        return self._replace_all_text(separator.join(self.text.split("\n")))

    def indent(self, size=4):
        pad = " " * size
        return self._replace_all_text(
            "\n".join(pad + line if line else line for line in self.text.split("\n"))
        )

    def dedent(self, size=4):
        def strip_line(line):
            if not line:
                return line
            removed = 0
            for char in line:
                if char != " " or removed >= size:
                    break
                removed += 1
            return line[removed:]

        return self._replace_all_text("\n".join(strip_line(line) for line in self.text.split("\n")))

    def tabs_to_spaces(self, size=4):
        return self._replace_all_text(self.text.replace("\t", " " * size))

    def spaces_to_tabs(self, size=4):
        return self._replace_all_text(re.compile(" " * size).sub("\t", self.text))

    def trim_trailing_whitespace(self):
        return self._replace_all_text("\n".join(line.rstrip() for line in self.text.split("\n")))

    def base64_encode(self):
        return self.apply_transform(lambda value: base64.b64encode(value.encode("utf-8")).decode("ascii"))

    def base64_decode(self):
        return self.apply_transform(
            lambda value: base64.b64decode(value.strip()).decode("utf-8", errors="replace")
        )

    def url_encode(self):
        return self.apply_transform(lambda value: urllib.parse.quote(value, safe=""))

    def url_decode(self):
        return self.apply_transform(lambda value: urllib.parse.unquote(value))

    def html_escape(self):
        return self.apply_transform(lambda value: html.escape(value, quote=True))

    def html_unescape(self):
        return self.apply_transform(lambda value: html.unescape(value))

    def json_format(self):
        return self.apply_transform(
            lambda value: json.dumps(json.loads(value), indent=2, ensure_ascii=False)
        )

    def json_minify(self):
        return self.apply_transform(
            lambda value: json.dumps(json.loads(value), separators=(",", ":"), ensure_ascii=False)
        )

    def json_validate(self):
        try:
            json.loads(self.text)
            return True, "Valid JSON"
        except Exception as exc:
            return False, str(exc)

    def diff_to(self, other):
        return diff_text(self.text, other)


class SessionStore:
    def __init__(self, path=None):
        self.path = Path(path) if path else SESSION_FILE

    def load(self):
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {"active": 0, "documents": []}
        documents = [item for item in data.get("documents") or [] if isinstance(item, dict)]
        documents = documents[:SESSION_MAX_DOCUMENTS]
        for item in documents:
            text = item.get("text")
            if isinstance(text, str) and len(text) > SESSION_MAX_BYTES:
                item["text"] = text[:SESSION_MAX_BYTES]
            doc = item.get("doc")
            if isinstance(doc, dict) and len(json.dumps(doc, ensure_ascii=False)) > SESSION_MAX_BYTES * 4:
                item["doc"] = {
                    "title": doc.get("title", "Untitled"),
                    "blocks": (doc.get("blocks") or [])[:200],
                }
        active = data.get("active") or 0
        return {"active": min(int(active), len(documents)), "documents": documents}

    def save(self, active, documents):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload_documents = []
        for item in documents[:SESSION_MAX_DOCUMENTS]:
            entry = {key: value for key, value in item.items() if key != "source"}
            text = entry.get("text")
            if isinstance(text, str) and len(text) > SESSION_MAX_BYTES:
                entry["text"] = text[:SESSION_MAX_BYTES]
            payload_documents.append(entry)
        payload = {"active": int(active), "documents": payload_documents}
        temp = self.path.with_suffix(".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        temp.replace(self.path)
