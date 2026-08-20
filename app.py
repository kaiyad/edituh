import base64
import html
import json
import os
import re
import time

import streamlit as st
import streamlit_hotkeys as hotkeys

from docmodel import (
    Document,
    MediaStore,
    chart_svg,
    inline_markdown,
    make_png,
    parse_markdown,
    render_markdown,
)
from text_edituh import SessionStore, TextEdituh, diff_text

THEMES = {
    "Midnight": {
        "bg": "#0e1117", "bg2": "#161b26", "card": "#1a2130", "text": "#e6edf3",
        "muted": "#8b949e", "accent": "#4f8bf9", "accent_soft": "rgba(79,139,249,0.16)",
        "border": "#2d3646", "mark": "#ffd93d", "accent_rgb": (79, 139, 249),
    },
    "Paper": {
        "bg": "#f6f7f9", "bg2": "#ffffff", "card": "#ffffff", "text": "#1f2328",
        "muted": "#656d76", "accent": "#0969da", "accent_soft": "rgba(9,105,218,0.12)",
        "border": "#d8dee4", "mark": "#fff3bf", "accent_rgb": (9, 105, 218),
    },
    "Sepia": {
        "bg": "#f4ecd8", "bg2": "#efe3c8", "card": "#faf3e3", "text": "#433422",
        "muted": "#8a7a5f", "accent": "#b45309", "accent_soft": "rgba(180,83,9,0.14)",
        "border": "#dccfb0", "mark": "#fde68a", "accent_rgb": (180, 83, 9),
    },
    "Nord": {
        "bg": "#2e3440", "bg2": "#3b4252", "card": "#434c5e", "text": "#d8dee9",
        "muted": "#81a1c1", "accent": "#88c0d0", "accent_soft": "rgba(136,192,208,0.16)",
        "border": "#4c566a", "mark": "#ebcb8b", "accent_rgb": (136, 192, 208),
    },
    "Forest": {
        "bg": "#0f1a13", "bg2": "#152318", "card": "#1b2a1d", "text": "#d9e8d2",
        "muted": "#7f9a79", "accent": "#6bcb77", "accent_soft": "rgba(107,203,119,0.16)",
        "border": "#2c4230", "mark": "#f0c808", "accent_rgb": (107, 203, 119),
    },
    "Ocean": {
        "bg": "#071826", "bg2": "#0d2336", "card": "#102c44", "text": "#d7e6f2",
        "muted": "#6f95b3", "accent": "#00bbf9", "accent_soft": "rgba(0,187,249,0.16)",
        "border": "#1c3d5a", "mark": "#fee440", "accent_rgb": (0, 187, 249),
    },
}

CODE_LANGUAGES = ["text", "python", "javascript", "typescript", "html", "css", "json", "sql", "bash", "java", "c", "cpp", "rust", "go", "ruby", "php", "yaml", "xml", "markdown"]

CHART_KINDS = ["line", "bar", "area", "scatter"]

TEXT_LIKE_TYPES = ["heading", "paragraph", "quote", "callout", "code", "bullet_list", "numbered_list", "divider"]

TOOLBAR_BLOCKS = [
    ("heading", "H1", "Heading"),
    ("paragraph", "¶", "Text"),
    ("bullet_list", "•", "Bullet list"),
    ("numbered_list", "1.", "Numbered list"),
    ("checklist", "☑", "Checklist"),
    ("table", "▦", "Table"),
    ("code", "</>", "Code"),
    ("quote", "❝", "Quote"),
    ("callout", "💡", "Callout"),
    ("image", "🖼", "Image"),
    ("video", "🎬", "Video"),
    ("audio", "🎵", "Audio"),
    ("chart", "📊", "Chart"),
    ("divider", "—", "Divider"),
]

DEFAULT_STATE = {
    "theme": "Midnight",
    "clipboard": "",
    "find_info": "",
    "find_open": False,
    "diff_result": "",
    "settings": {"font_size": 15, "autosave": True, "tab_size": 4},
    "handled_open": False,
    "last_save": 0.0,
    "last_persist": 0.0,
    "diff_left_text": "",
    "diff_right_text": "",
    "diff_left_ver": 0,
    "diff_right_ver": 0,
    "search_query": "",
}

st.set_page_config(page_title="Edituh", layout="wide")


def migrate_entry(item, doc_id):
    if isinstance(item, TextEdituh):
        return {
            "id": doc_id,
            "doc": parse_markdown(item.text),
            "source": item,
            "mode": "source",
            "path": item.filepath,
            "rev": 0,
            "editing": set(),
            "focus": None,
            "saved_markdown": None,
        }
    entry = dict(item)
    entry.setdefault("id", doc_id)
    entry.setdefault("editing", set())
    entry.setdefault("focus", None)
    entry.setdefault("mode", "rich")
    entry.setdefault("rev", 0)
    entry.setdefault("path", None)
    entry.setdefault("saved_markdown", None)
    if not isinstance(entry.get("doc"), Document):
        entry["doc"] = Document.from_dict(entry.get("doc") or {})
    if not isinstance(entry.get("source"), TextEdituh):
        entry["source"] = TextEdituh(entry.get("source_text") or entry["doc"].to_markdown(), entry.get("path"))
    entry["editing"] = set(entry.get("editing") or [])
    return entry


def init_state():
    if "S" not in st.session_state:
        session = SessionStore().load()
        documents = session.get("documents") or []
        if not documents:
            documents = [{"mode": "rich", "doc": Document().to_dict()}]
        st.session_state.S = {
            "docs": [migrate_entry(item, index + 1) for index, item in enumerate(documents)],
            "active": min(session.get("active", 0), len(documents) - 1),
            "next_doc_id": len(documents) + 1,
        }
    state = st.session_state.S
    for key, value in DEFAULT_STATE.items():
        state.setdefault(key, value)
    state.setdefault("next_doc_id", len(state["docs"]) + 1)
    if state["active"] >= len(state["docs"]):
        state["active"] = len(state["docs"]) - 1
    for index, item in enumerate(state["docs"]):
        item_id = getattr(item, "id", None) or (item.get("id") if isinstance(item, dict) else None) or index + 1
        state["docs"][index] = migrate_entry(item, item_id)
        state["next_doc_id"] = max(state["next_doc_id"], int(item_id) + 1)


init_state()

STATE = st.session_state.S


def active_entry():
    return STATE["docs"][STATE["active"]]


def bump_rev():
    active_entry()["rev"] += 1


def entry_dirty(entry):
    if entry["mode"] == "source":
        saved = entry.get("saved_markdown")
        return saved is None or entry["source"].text != saved
    saved = entry.get("saved_markdown")
    return saved is None or entry["doc"].to_markdown() != saved


def persist_session():
    now = time.time()
    if now - STATE["last_persist"] < 2:
        return
    SessionStore().save(
        STATE["active"],
        [
            {
                "path": entry["path"],
                "mode": entry["mode"],
                "doc": entry["doc"].to_dict(),
                "source_text": entry["source"].text,
            }
            for entry in STATE["docs"]
        ],
    )
    STATE["last_persist"] = now


def new_page():
    entry = {
        "id": STATE["next_doc_id"],
        "doc": Document(),
        "source": TextEdituh("", None),
        "mode": "rich",
        "path": None,
        "rev": 0,
        "editing": set(),
        "focus": None,
        "saved_markdown": None,
    }
    STATE["next_doc_id"] += 1
    STATE["docs"].append(entry)
    STATE["active"] = len(STATE["docs"]) - 1


def close_page_at(index):
    if len(STATE["docs"]) <= 1:
        st.toast("Cannot close the last page.")
        return
    STATE["docs"].pop(index)
    if STATE["active"] > index:
        STATE["active"] -= 1
    if STATE["active"] >= len(STATE["docs"]):
        STATE["active"] = len(STATE["docs"]) - 1
    bump_rev()


def save_page(path=None):
    entry = active_entry()
    target = path or entry["path"]
    if not target:
        st.warning("Set a path in Save As first.")
        return False
    try:
        if entry["mode"] == "source":
            entry["source"].save_to_file(target)
            entry["saved_markdown"] = entry["source"].text
        else:
            with open(target, "w", encoding="utf-8") as handle:
                handle.write(entry["doc"].to_markdown())
            entry["path"] = target
            entry["saved_markdown"] = entry["doc"].to_markdown()
        st.toast(f"Saved: {target}")
        STATE["last_save"] = time.time()
        return True
    except Exception as exc:
        st.error(f"Save failed: {exc}")
        return False


def widget_prefix(entry, block=None):
    base = f"d{entry['id']}_{entry['rev']}"
    return f"{base}_{block.id}" if block else base


def convert_block(block, new_type):
    data = {}
    if new_type in ("paragraph", "heading", "quote", "callout", "code"):
        if block.type in ("bullet_list", "numbered_list", "checklist"):
            items = block.data.get("items", [])
            text = "\n".join(item[1] if isinstance(item, list) else item for item in items)
        else:
            text = block.data.get("text", "")
        data["text"] = text
        if new_type == "heading":
            data["level"] = min(int(block.data.get("level", 1)), 3)
        if new_type == "callout":
            data["icon"] = block.data.get("icon", "💡")
        if new_type == "code":
            data["language"] = block.data.get("language", "text")
    elif new_type in ("bullet_list", "numbered_list"):
        if block.type == "checklist":
            items = [item[1] for item in block.data.get("items", [])]
        else:
            items = block.data.get("items", [])
            if not items and block.data.get("text"):
                items = [block.data.get("text", "")]
        data["items"] = items
    elif new_type == "checklist":
        items = block.data.get("items", [])
        if not items:
            if block.type in ("bullet_list", "numbered_list"):
                items = [[False, item] for item in block.data.get("items", [])]
            elif block.data.get("text"):
                items = [[False, block.data.get("text", "")]]
        data["items"] = items
    block.type = new_type
    block.data = data


def parse_chart_data(text):
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    if not lines:
        return [], {}
    header = [part.strip() for part in lines[0].split(",")]
    names = header[1:] or ["Value"]
    labels = []
    series = {name: [] for name in names}
    for line in lines[1:]:
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 2:
            continue
        labels.append(parts[0])
        for index, name in enumerate(names):
            raw = parts[index + 1] if index + 1 < len(parts) else "0"
            try:
                series[name].append(float(raw))
            except ValueError:
                series[name].append(0.0)
    return labels, series


def build_theme_css(theme):
    t = THEMES[theme]
    return f"""
<style>
:root {{
    --bg: {t['bg']}; --bg2: {t['bg2']}; --card: {t['card']}; --text: {t['text']};
    --muted: {t['muted']}; --accent: {t['accent']}; --border: {t['border']}; --mark: {t['mark']};
}}
html, body, [data-testid="stAppViewContainer"] {{
    background: var(--bg); color: var(--text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}}
[data-testid="stHeader"] {{ background: transparent; }}
[data-testid="stMain"] {{ max-width: 1000px; margin: 0 auto; padding-top: 1rem; }}
[data-testid="stSidebar"] {{ background: var(--bg2); border-right: 1px solid var(--border); }}
[data-testid="stSidebar"] .stMarkdown, [data-testid="stSidebar"] label, [data-testid="stSidebar"] .stCaption {{
    color: var(--text);
}}
.stMarkdown {{ color: var(--text); }}
.stMarkdown h1, .stMarkdown h2, .stMarkdown h3, .stMarkdown h4 {{ color: var(--text); letter-spacing: -0.02em; }}
.stMarkdown p {{ line-height: 1.7; }}
.stMarkdown a {{ color: var(--accent); }}
.stMarkdown blockquote {{ border-left: 3px solid var(--accent); color: var(--muted); padding-left: 14px; margin: 8px 0; }}
.stMarkdown code {{ background: var(--border); border-radius: 5px; padding: 1px 6px; font-size: 0.9em; }}
.stMarkdown pre {{ background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; }}
.stMarkdown pre code {{ background: transparent; padding: 0; }}
.stMarkdown table {{ border-collapse: collapse; width: 100%; }}
.stMarkdown th, .stMarkdown td {{ border: 1px solid var(--border); padding: 8px 12px; }}
.stMarkdown th {{ background: var(--bg2); }}
[data-testid="stTextArea"] textarea, [data-testid="stTextInput"] input, [data-testid="stNumberInput"] input {{
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px; caret-color: var(--accent);
}}
[data-testid="stTextArea"] textarea:focus, [data-testid="stTextInput"] input:focus {{
    border-color: var(--accent); box-shadow: 0 0 0 3px {t['accent_soft']};
}}
[data-testid="stVerticalBlockBorderWrapper"] {{
    background: var(--card); border: 1px solid var(--border); border-radius: 14px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: box-shadow 0.15s ease, border-color 0.15s ease;
}}
[data-testid="stVerticalBlockBorderWrapper"]:hover {{ box-shadow: 0 6px 18px rgba(0,0,0,0.10); }}
.stButton button, [data-testid="stButton"] button {{
    border-radius: 10px; border: 1px solid var(--border); background: var(--card);
    color: var(--text); font-weight: 500;
}}
.stButton button:hover {{ border-color: var(--accent); color: var(--accent); }}
.stButton button[kind="primary"] {{ background: var(--accent); border-color: var(--accent); color: #ffffff; }}
.stButton button[kind="primary"]:hover {{ color: #ffffff; opacity: 0.92; }}
[data-testid="stExpander"] {{ background: var(--card); border: 1px solid var(--border); border-radius: 12px; }}
[data-testid="stDataFrame"] {{ border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }}
[data-testid="stCaptionContainer"], .stCaption {{ color: var(--muted); }}
mark {{ background: var(--mark); color: var(--text); border-radius: 3px; padding: 0 2px; }}
hr {{ border-color: var(--border); }}
[data-testid="stToolbar"] {{ display: none; }}
div[data-testid="stFileUploader"] {{ border: 1px dashed var(--border); border-radius: 10px; }}
.chart-card {{ border: 1px solid var(--border); border-radius: 12px; padding: 8px; background: var(--bg2); }}
@media (max-width: 760px) {{
    [data-testid="stMain"] {{ max-width: 100%; padding: 0.4rem; }}
    .stButton button {{ font-size: 0.78rem; }}
    [data-testid="stVerticalBlockBorderWrapper"] {{ border-radius: 10px; }}
}}
</style>"""


def inject_ios_meta(theme):
    t = THEMES[theme]
    icon = base64.b64encode(make_png(180, t["accent_rgb"])).decode("ascii")
    st.markdown(
        f"""
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Edituh">
<meta name="theme-color" content="{t['bg']}">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="apple-touch-icon" href="data:image/png;base64,{icon}">
<link rel="icon" href="data:image/png;base64,{icon}">
""",
        unsafe_allow_html=True,
    )


inject_ios_meta(STATE["theme"])
st.markdown(
    "<link href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' rel='stylesheet'>",
    unsafe_allow_html=True,
)
st.markdown(build_theme_css(STATE["theme"]), unsafe_allow_html=True)
st.markdown(
    f"<style>div[data-testid='stTextArea'] textarea {{font-size:{STATE['settings']['font_size']}px;tab-size:{STATE['settings']['tab_size']};}}</style>",
    unsafe_allow_html=True,
)

hotkeys.activate([
    hotkeys.hk("save", "s", ctrl=True, prevent_default=True),
    hotkeys.hk("save", "s", meta=True, prevent_default=True),
    hotkeys.hk("open", "o", ctrl=True, prevent_default=True),
    hotkeys.hk("open", "o", meta=True, prevent_default=True),
    hotkeys.hk("new", "n", ctrl=True, prevent_default=True),
    hotkeys.hk("new", "n", meta=True, prevent_default=True),
    hotkeys.hk("undo", "z", ctrl=True, prevent_default=True),
    hotkeys.hk("undo", "z", meta=True, prevent_default=True),
    hotkeys.hk("redo", "z", ctrl=True, shift=True),
    hotkeys.hk("redo", "z", meta=True, shift=True),
    hotkeys.hk("redo", "y", ctrl=True),
    hotkeys.hk("redo", "y", meta=True),
    hotkeys.hk("close", "w", ctrl=True, prevent_default=True),
    hotkeys.hk("close", "w", meta=True, prevent_default=True),
    hotkeys.hk("find", "f", ctrl=True, prevent_default=True),
    hotkeys.hk("find", "f", meta=True, prevent_default=True),
    hotkeys.hk("next_tab", "arrowright", ctrl=True, alt=True, prevent_default=True),
    hotkeys.hk("prev_tab", "arrowleft", ctrl=True, alt=True, prevent_default=True),
])

entry = active_entry()

if hotkeys.pressed("save"):
    save_page()
    st.rerun()

if hotkeys.pressed("open"):
    st.toast("Use the Open uploader in the sidebar.")
    st.rerun()

if hotkeys.pressed("new"):
    new_page()
    st.rerun()

if hotkeys.pressed("undo"):
    if entry["mode"] == "source" and entry["source"].undo():
        bump_rev()
        st.rerun()
    else:
        st.toast("Nothing to undo here.")

if hotkeys.pressed("redo"):
    if entry["mode"] == "source" and entry["source"].redo():
        bump_rev()
        st.rerun()
    else:
        st.toast("Nothing to redo here.")

if hotkeys.pressed("close"):
    close_page_at(STATE["active"])
    st.rerun()

if hotkeys.pressed("next_tab") or hotkeys.pressed("prev_tab"):
    step = 1 if hotkeys.pressed("next_tab") else -1
    STATE["active"] = (STATE["active"] + step) % len(STATE["docs"])
    st.rerun()

if hotkeys.pressed("find"):
    STATE["find_open"] = not STATE["find_open"]
    st.rerun()


def render_tabs():
    count = len(STATE["docs"])
    columns = st.columns(count + 1)
    for index, column in enumerate(columns[:count]):
        with column:
            title = STATE["docs"][index]["doc"].title or f"Page {index + 1}"
            inner = st.columns([5, 1])
            with inner[0]:
                if st.button(
                    title,
                    key=f"tab_{index}",
                    type="primary" if index == STATE["active"] else "secondary",
                    width='stretch',
                ):
                    STATE["active"] = index
                    st.rerun()
            with inner[1]:
                if st.button("✕", key=f"tab_close_{index}", width='stretch'):
                    close_page_at(index)
                    st.rerun()
    with columns[count]:
        if st.button("＋", key="tab_new", width='stretch'):
            new_page()
            st.rerun()


def render_block_controls(entry, index, block):
    prefix = widget_prefix(entry, block)
    columns = st.columns([2, 1, 1, 1, 1, 2])
    with columns[0]:
        st.caption(f"#{index + 1}")
    with columns[1]:
        if st.button("↑", key=f"{prefix}_up", width='stretch'):
            entry["doc"].move_block(block.id, -1)
            entry["rev"] += 1
            st.rerun()
    with columns[2]:
        if st.button("↓", key=f"{prefix}_down", width='stretch'):
            entry["doc"].move_block(block.id, 1)
            entry["rev"] += 1
            st.rerun()
    with columns[3]:
        if st.button("✕", key=f"{prefix}_del", width='stretch'):
            entry["doc"].remove_block(block.id)
            entry["editing"].discard(block.id)
            entry["rev"] += 1
            st.rerun()
    with columns[4]:
        if st.button("Edit" if block.id not in entry["editing"] else "Done", key=f"{prefix}_toggle", width='stretch'):
            if block.id in entry["editing"]:
                entry["editing"].discard(block.id)
            else:
                entry["editing"].add(block.id)
            st.rerun()
    with columns[5]:
        if block.type in TEXT_LIKE_TYPES:
            new_type = st.selectbox(
                "Block type",
                TEXT_LIKE_TYPES,
                index=TEXT_LIKE_TYPES.index(block.type),
                key=f"{prefix}_type",
                label_visibility="collapsed",
            )
            if new_type != block.type:
                convert_block(block, new_type)
                entry["rev"] += 1
                st.rerun()
        else:
            st.caption(block.type.title())


def render_text_block(entry, block):
    prefix = widget_prefix(entry, block)
    editing = block.id in entry["editing"]
    block_type = block.type
    if block_type == "heading":
        level = st.selectbox("Level", [1, 2, 3], index=int(block.data.get("level", 1)) - 1, key=f"{prefix}_level")
        block.data["level"] = int(level)
    if block_type == "callout":
        icon = st.text_input("Icon", value=block.data.get("icon", "💡"), key=f"{prefix}_icon")
        block.data["icon"] = icon
    if block_type == "code":
        language = st.selectbox("Language", CODE_LANGUAGES, index=CODE_LANGUAGES.index(block.data.get("language", "text")) if block.data.get("language", "text") in CODE_LANGUAGES else 0, key=f"{prefix}_lang")
        block.data["language"] = language
    if block_type in ("bullet_list", "numbered_list"):
        text = st.text_area(
            "Items",
            value="\n".join(block.data.get("items", [])),
            key=f"{prefix}_items",
            height=min(120 + len(block.data.get("items", [])) * 14, 320),
        )
        block.data["items"] = [line for line in text.split("\n")]
        return
    if editing:
        text = st.text_area("Content", value=block.data.get("text", ""), key=f"{prefix}_txt", height=120)
        block.data["text"] = text
    else:
        content = block.data.get("text", "")
        if block_type == "heading":
            level = int(block.data.get("level", 1))
            st.markdown(f"<h{level}>{inline_markdown(content)}</h{level}>", unsafe_allow_html=True)
        elif block_type == "quote":
            st.markdown(f"> {inline_markdown(content)}", unsafe_allow_html=True)
        elif block_type == "callout":
            st.markdown(
                f"<div style='background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;'>"
                f"<span>{html.escape(block.data.get('icon', '💡'))}</span> <span>{inline_markdown(content)}</span></div>",
                unsafe_allow_html=True,
            )
        elif block_type == "code":
            st.code(content, language=block.data.get("language", "text"))
        else:
            st.markdown(render_markdown(content), unsafe_allow_html=True)


def render_checklist_block(entry, block):
    prefix = widget_prefix(entry, block)
    editing = block.id in entry["editing"]
    if editing:
        value = [{"Done": bool(checked), "Item": text} for checked, text in block.data.get("items", [])]
        result = st.data_editor(
            value,
            key=f"{prefix}_chk",
            num_rows="dynamic",
            hide_index=True,
            width='stretch',
            column_config={
                "Done": st.column_config.CheckboxColumn("Done", width="small"),
                "Item": st.column_config.TextColumn("Item", width="large"),
            },
        )
        block.data["items"] = [[bool(row.get("Done")), row.get("Item", "")] for row in result]
    else:
        lines = []
        for checked, text in block.data.get("items", []):
            mark = "☑" if checked else "☐"
            lines.append(f"{mark} {text}")
        st.markdown("\n\n".join(lines) if lines else "_Empty checklist_", unsafe_allow_html=True)


def render_table_block(entry, block):
    prefix = widget_prefix(entry, block)
    headers = block.data.get("headers", [])
    headers_text = st.text_input("Headers (comma separated)", value=", ".join(headers), key=f"{prefix}_headers")
    new_headers = [part.strip() for part in headers_text.split(",") if part.strip()]
    if new_headers != headers:
        block.data["headers"] = new_headers
        block.data["rows"] = [[row.get(h, "") for h in new_headers] for row in []]
    headers = block.data.get("headers", [])
    if not headers:
        st.caption("Add headers to build the table.")
        return
    rows = block.data.get("rows", [])
    value = [{header: (row[index] if index < len(row) else "") for index, header in enumerate(headers)} for row in rows]
    result = st.data_editor(
        value,
        key=f"{prefix}_tbl_{abs(hash(tuple(headers)))}",
        num_rows="dynamic",
        hide_index=True,
        width='stretch',
        column_config={header: st.column_config.TextColumn(header) for header in headers},
    )
    block.data["rows"] = [[row.get(header, "") for header in headers] for row in result]


def render_media_block(entry, block, media_kind):
    import inspect
    with open("/tmp/media_trace.txt", "a") as trace_handle:
        trace_handle.write(f"render_media block={block.id} kind={media_kind} rev={entry['rev']}\n")
        trace_handle.write("".join(inspect.stack()[i].function + ":" + str(inspect.stack()[i].lineno) + "\n" for i in range(min(6, len(inspect.stack())))))
    prefix = widget_prefix(entry, block)
    src = block.data.get("src", "")
    uploaded = st.file_uploader(
        "Upload",
        type=None,
        key=f"{prefix}_up",
        label_visibility="collapsed",
    )
    if uploaded is not None and uploaded.file_id not in entry.setdefault("uploaded_done", []):
        block.data["src"] = MediaStore.save(uploaded.getvalue(), uploaded.name)
        entry["uploaded_done"].append(uploaded.file_id)
        st.toast(f"Media stored: {block.data['src']}")
    url = st.text_input(
        "or URL",
        value=src if not str(src).startswith("media/") else "",
        key=f"{prefix}_url",
        label_visibility="collapsed",
    )
    if url and url != src:
        block.data["src"] = url
    caption = st.text_input("Caption", value=block.data.get("caption", ""), key=f"{prefix}_cap")
    block.data["caption"] = caption
    resolved = MediaStore.resolve(src)
    display_src = str(resolved) if resolved else (src if str(src).startswith(("http", "data:")) else None)
    if display_src:
        if media_kind == "image":
            st.image(display_src, width='stretch')
        elif media_kind == "video":
            st.video(display_src)
        else:
            st.audio(display_src)
    else:
        st.caption("Upload a file or paste a URL.")


def render_chart_block(entry, block):
    prefix = widget_prefix(entry, block)
    kind = st.selectbox("Kind", CHART_KINDS, index=CHART_KINDS.index(block.data.get("kind", "line")) if block.data.get("kind", "line") in CHART_KINDS else 0, key=f"{prefix}_kind")
    title = st.text_input("Title", value=block.data.get("title", ""), key=f"{prefix}_title")
    block.data["kind"] = kind
    block.data["title"] = title
    default_data = "\n".join(
        [",".join(["Label"] + list(block.data.get("series", {}).keys()))]
        + [",".join([str(label)] + [str(value) for value in values]) for label, values in zip(block.data.get("labels", []), zip(*block.data.get("series", {}).values())) if values]
    )
    data_text = st.text_area("Data (first line: Label,Series…)", value=default_data, key=f"{prefix}_data", height=110)
    labels, series = parse_chart_data(data_text)
    block.data["labels"] = labels
    block.data["series"] = series
    if not labels:
        st.caption("Enter data as Label,Series1,Series2 on each line.")
        return
    with st.container(border=True):
        st.image(chart_svg(kind, labels, series, 640, 360))
    st.caption(title or "Chart")


def render_block(entry, index, block):
    if entry["focus"] == block.id:
        st.markdown(
            f"<div style='height:3px;background:{THEMES[STATE['theme']]['accent']};border-radius:3px;'></div>",
            unsafe_allow_html=True,
        )
    with st.container(border=True):
        if block.type != "divider":
            render_block_controls(entry, index, block)
        if block.type == "divider":
            st.divider()
        elif block.type in ("paragraph", "heading", "quote", "callout", "code", "bullet_list", "numbered_list"):
            render_text_block(entry, block)
        elif block.type == "checklist":
            render_checklist_block(entry, block)
        elif block.type == "table":
            render_table_block(entry, block)
        elif block.type in ("image", "video", "audio"):
            render_media_block(entry, block, block.type)
        elif block.type == "chart":
            render_chart_block(entry, block)


def render_toolbar():
    st.caption("Add a block")
    first_row, second_row = st.columns(2)
    for row, start, end in ((first_row, 0, 7), (second_row, 7, 14)):
        with row:
            columns = st.columns(7)
            for offset in range(7):
                index = start + offset
                if index >= len(TOOLBAR_BLOCKS):
                    break
                block_type, icon, label = TOOLBAR_BLOCKS[index]
                with columns[offset]:
                    if st.button(icon, key=f"add_{block_type}", width='stretch', help=label):
                        active_entry()["doc"].add_block(block_type)
                        bump_rev()
                        st.rerun()


def render_rich(entry):
    st.caption(f"{len(entry['doc'].blocks)} blocks · {entry['doc'].word_count()} words")
    render_toolbar()
    st.divider()
    for index, block in enumerate(entry["doc"].blocks):
        render_block(entry, index, block)


def render_match_preview(source, pattern, use_regex, match_case):
    try:
        spans = source.find_spans(pattern, use_regex, match_case)
    except re.error as exc:
        st.error(f"Invalid pattern: {exc}")
        return
    if not spans:
        st.caption("No matches")
        return
    text = source.text
    snippets = []
    for start, end in spans[:30]:
        ctx_start = max(0, start - 25)
        ctx_end = min(len(text), end + 25)
        prefix = html.escape(text[ctx_start:start].replace("\n", " "))
        match = html.escape(text[start:end].replace("\n", " "))
        suffix = html.escape(text[end:ctx_end].replace("\n", " "))
        snippets.append(f"<span>…{prefix}<mark>{match}</mark>{suffix}…</span>")
    st.markdown("<br/>".join(snippets), unsafe_allow_html=True)


def render_find_bar(source):
    if not STATE["find_open"]:
        return
    with st.container(border=True):
        c1, c2, c3, c4 = st.columns([4, 4, 1, 1])
        pattern = c1.text_input("Find", key="find_pattern", placeholder="Text or pattern", label_visibility="collapsed")
        replacement = c2.text_input("Replace", key="find_replacement", placeholder="Replacement", label_visibility="collapsed")
        use_regex = c3.checkbox("Regex", key="find_regex")
        match_case = c4.checkbox("Case", key="find_case")
        b1, b2, b3, b4 = st.columns(4)
        if b1.button("Find Next", width='stretch') and pattern:
            try:
                position = source.find_next(pattern, use_regex, match_case)
            except re.error as exc:
                st.error(f"Invalid pattern: {exc}")
            else:
                bump_rev()
                STATE["find_info"] = f"Match at offset {position}" if position >= 0 else "No match found"
        if b2.button("Replace", width='stretch') and pattern:
            try:
                replaced = source.replace_one(pattern, replacement, use_regex, match_case)
            except re.error as exc:
                st.error(f"Invalid pattern: {exc}")
            else:
                bump_rev()
                STATE["find_info"] = "Replaced one match" if replaced else "No match to replace"
        if b3.button("Replace All", width='stretch') and pattern:
            try:
                count = source.replace_all(pattern, replacement, use_regex, match_case)
            except re.error as exc:
                st.error(f"Invalid pattern: {exc}")
            else:
                bump_rev()
                STATE["find_info"] = f"Replaced {count} matches"
        if b4.button("Count", width='stretch') and pattern:
            try:
                matches = source.find_all(pattern, use_regex, match_case)
            except re.error as exc:
                st.error(f"Invalid pattern: {exc}")
            else:
                STATE["find_info"] = f"{len(matches)} matches"
        if STATE.get("find_info"):
            st.caption(STATE["find_info"])
        if pattern:
            render_match_preview(source, pattern, use_regex, match_case)


def render_source(entry):
    source = entry["source"]
    render_find_bar(source)
    text = st.text_area(
        "Markdown source",
        value=source.text,
        key=f"d{entry['id']}_{entry['rev']}_src",
        height=520,
        label_visibility="collapsed",
    )
    if text != source.text:
        source.commit_import(text)
    c1, c2, c3 = st.columns(3)
    if c1.button("Apply as document", width='stretch'):
        entry["doc"] = parse_markdown(source.text)
        entry["mode"] = "rich"
        entry["saved_markdown"] = None
        entry["editing"] = set()
        bump_rev()
        st.rerun()
    if c2.button("Preview markdown", width='stretch'):
        STATE["source_preview"] = True
    if c3.button("Clear preview", width='stretch'):
        STATE["source_preview"] = False
    if STATE.get("source_preview"):
        st.markdown(render_markdown(source.text), unsafe_allow_html=True)


def render_sidebar(entry):
    with st.sidebar:
        st.subheader("Edituh")
        with st.expander("File", expanded=True):
            if st.button("New Page", width='stretch'):
                new_page()
                st.rerun()
            uploaded = st.file_uploader("Open", type=None, key="open_uploader")
            replace_current = st.checkbox("Replace current page", key="open_replace")
            if uploaded is not None:
                if not STATE["handled_open"]:
                    STATE["handled_open"] = True
                    try:
                        content = uploaded.getvalue().decode("utf-8-sig")
                    except UnicodeDecodeError:
                        content = uploaded.getvalue().decode("latin-1")
                    name = os.path.basename(uploaded.name)
                    try:
                        payload = json.loads(content)
                        document = Document.from_dict(payload) if isinstance(payload, dict) else parse_markdown(content)
                    except Exception:
                        document = parse_markdown(content)
                    if not document.title and name:
                        document.title = os.path.splitext(name)[0]
                    if replace_current:
                        entry["doc"] = document
                        entry["mode"] = "rich"
                        entry["saved_markdown"] = None
                        bump_rev()
                    else:
                        new_entry = {
                            "id": STATE["next_doc_id"],
                            "doc": document,
                            "source": TextEdituh(document.to_markdown(), None),
                            "mode": "rich",
                            "path": None,
                            "rev": 0,
                            "editing": set(),
                            "focus": None,
                            "saved_markdown": None,
                        }
                        STATE["next_doc_id"] += 1
                        STATE["docs"].append(new_entry)
                        STATE["active"] = len(STATE["docs"]) - 1
                    st.toast(f"Opened: {name}")
                    st.rerun()
            else:
                STATE["handled_open"] = False
            if st.button("Save Page", type="primary", width='stretch'):
                save_page()
            st.caption("Ctrl/Cmd + S")
            save_path = st.text_input("Save As path", value=entry["path"] or "", key="save_path_input", placeholder="Absolute file path")
            if st.button("Save As", width='stretch'):
                if save_path:
                    save_page(save_path)
                else:
                    st.warning("Enter a path first.")
            if entry["mode"] == "rich":
                st.download_button(
                    "Download Markdown",
                    data=entry["doc"].to_markdown().encode("utf-8"),
                    file_name=f"{entry['doc'].title or 'page'}.md",
                    mime="text/markdown",
                    width='stretch',
                )
                st.download_button(
                    "Download HTML",
                    data=entry["doc"].to_html().encode("utf-8"),
                    file_name=f"{entry['doc'].title or 'page'}.html",
                    mime="text/html",
                    width='stretch',
                )
                st.download_button(
                    "Download JSON",
                    data=json.dumps(entry["doc"].to_dict(), ensure_ascii=False, indent=2).encode("utf-8"),
                    file_name=f"{entry['doc'].title or 'page'}.json",
                    mime="application/json",
                    width='stretch',
                )
            else:
                st.download_button(
                    "Download Markdown",
                    data=entry["source"].text.encode("utf-8"),
                    file_name=f"{entry['doc'].title or 'page'}.md",
                    mime="text/markdown",
                    width='stretch',
                )
            if st.button("Revert to Disk", width='stretch'):
                if entry["path"] and os.path.exists(entry["path"]):
                    try:
                        with open(entry["path"], "r", encoding="utf-8") as handle:
                            content = handle.read()
                        entry["doc"] = parse_markdown(content)
                        entry["source"] = TextEdituh(content, entry["path"])
                        entry["mode"] = "rich"
                        entry["saved_markdown"] = content
                        entry["editing"] = set()
                        bump_rev()
                        st.toast("Reverted to the saved file.")
                    except Exception as exc:
                        st.error(str(exc))
                else:
                    st.warning("This page has no saved file.")
            if st.button("Duplicate Page", width='stretch'):
                duplicate = {
                    "id": STATE["next_doc_id"],
                    "doc": Document.from_dict(entry["doc"].to_dict()),
                    "source": TextEdituh(entry["source"].text, None),
                    "mode": entry["mode"],
                    "path": None,
                    "rev": 0,
                    "editing": set(),
                    "focus": None,
                    "saved_markdown": None,
                }
                STATE["next_doc_id"] += 1
                STATE["docs"].append(duplicate)
                STATE["active"] = len(STATE["docs"]) - 1
                st.rerun()
            if st.button("Close Tab", width='stretch'):
                close_page_at(STATE["active"])
                st.rerun()

        with st.expander("Appearance"):
            theme = st.selectbox("Theme", list(THEMES.keys()), index=list(THEMES.keys()).index(STATE["theme"]), key="set_theme")
            STATE["theme"] = theme
            font_size = st.slider("Font size", 10, 28, STATE["settings"]["font_size"], key="set_font")
            STATE["settings"]["font_size"] = font_size
            tab_size = st.selectbox("Tab size", [2, 4, 8], index=[2, 4, 8].index(STATE["settings"]["tab_size"]), key="set_tabs")
            STATE["settings"]["tab_size"] = tab_size
            auto_save = st.checkbox("Auto-save", value=STATE["settings"]["autosave"], key="set_autosave")
            STATE["settings"]["autosave"] = auto_save

        with st.expander("Document"):
            blocks = len(entry["doc"].blocks)
            st.metric("Blocks", blocks)
            st.metric("Words", entry["doc"].word_count())
            st.metric("Characters", entry["doc"].char_count())
            if entry["mode"] == "rich" and entry["doc"].heading_tree():
                st.markdown("**Contents**")
                for block_id, level, text in entry["doc"].heading_tree():
                    indent = "　" * (level - 1)
                    if st.button(f"{indent}{text}", key=f"toc_{block_id}", width='stretch'):
                        entry["focus"] = block_id
                        st.rerun()

        if entry["mode"] == "rich":
            with st.expander("Search in page"):
                query = st.text_input("Find", key="search_query")
                if query:
                    found = []
                    for block in entry["doc"].blocks:
                        haystack = json.dumps(block.to_dict())
                        if query.lower() in haystack.lower():
                            found.append(block)
                    if not found:
                        st.caption("No matches")
                    for block in found[:20]:
                        text = block.data.get("text", "") or " ".join(block.data.get("items", []))
                        snippet = text[:80] if text else block.type
                        st.caption(f"**{block.type}** · {snippet}")
                        if st.button("Jump", key=f"jump_{block.id}", width='stretch'):
                            entry["focus"] = block.id
                            st.rerun()

        if entry["mode"] == "source":
            source = entry["source"]
            with st.expander("Jump to line"):
                line_count = source.text.count("\n") + 1
                line_number = st.number_input("Line", min_value=1, max_value=max(1, line_count), value=source.cursor_position[0], key="goto_line_input")
                if st.button("Go", width='stretch'):
                    source.goto_line(int(line_number))
                    bump_rev()
                    st.rerun()
            with st.expander("Text tools"):
                c1, c2 = st.columns(2)
                if c1.button("UPPERCASE", width='stretch'):
                    source.transform_upper()
                    bump_rev()
                if c2.button("lowercase", width='stretch'):
                    source.transform_lower()
                    bump_rev()
                if c1.button("Title Case", width='stretch'):
                    source.transform_title()
                    bump_rev()
                if c2.button("snake_case", width='stretch'):
                    source.transform_snake()
                    bump_rev()
                if c1.button("camelCase", width='stretch'):
                    source.transform_camel()
                    bump_rev()
                if c2.button("PascalCase", width='stretch'):
                    source.transform_pascal()
                    bump_rev()
                if c1.button("Sort A to Z", width='stretch'):
                    source.sort_lines()
                    bump_rev()
                if c2.button("Sort Z to A", width='stretch'):
                    source.sort_lines(reverse=True)
                    bump_rev()
                if c1.button("Unique lines", width='stretch'):
                    source.unique_lines()
                    bump_rev()
                if c2.button("Reverse lines", width='stretch'):
                    source.reverse_lines()
                    bump_rev()
                if c1.button("Indent", width='stretch'):
                    source.indent(STATE["settings"]["tab_size"])
                    bump_rev()
                if c2.button("Dedent", width='stretch'):
                    source.dedent(STATE["settings"]["tab_size"])
                    bump_rev()
                if c1.button("Tabs to spaces", width='stretch'):
                    source.tabs_to_spaces(STATE["settings"]["tab_size"])
                    bump_rev()
                if c2.button("Spaces to tabs", width='stretch'):
                    source.spaces_to_tabs(STATE["settings"]["tab_size"])
                    bump_rev()
                if c1.button("Base64 encode", width='stretch'):
                    try:
                        source.base64_encode()
                        bump_rev()
                    except Exception as exc:
                        st.error(f"Base64 encode failed: {exc}")
                if c2.button("Base64 decode", width='stretch'):
                    try:
                        source.base64_decode()
                        bump_rev()
                    except Exception as exc:
                        st.error(f"Base64 decode failed: {exc}")
                if c1.button("URL encode", width='stretch'):
                    source.url_encode()
                    bump_rev()
                if c2.button("URL decode", width='stretch'):
                    source.url_decode()
                    bump_rev()
                if c1.button("HTML escape", width='stretch'):
                    source.html_escape()
                    bump_rev()
                if c2.button("HTML unescape", width='stretch'):
                    source.html_unescape()
                    bump_rev()
                if c1.button("JSON format", width='stretch'):
                    try:
                        source.json_format()
                        bump_rev()
                    except Exception as exc:
                        st.error(f"Invalid JSON: {exc}")
                if c2.button("JSON minify", width='stretch'):
                    try:
                        source.json_minify()
                        bump_rev()
                    except Exception as exc:
                        st.error(f"Invalid JSON: {exc}")
                valid, message = source.json_validate()
                st.caption(f"JSON: {message[:60]}")
                if c1.button("Trim trailing spaces", width='stretch'):
                    source.trim_trailing_whitespace()
                    bump_rev()
                if c2.button("Join lines", width='stretch'):
                    source.join_lines(", ")
                    bump_rev()
                c3, c4, c5 = st.columns(3)
                if c3.button("Copy", width='stretch'):
                    start, end = source.selection_range
                    STATE["clipboard"] = source.text[start:end]
                    st.toast(f"Copied {end - start} characters.")
                if c4.button("Cut", width='stretch'):
                    start, end = source.selection_range
                    STATE["clipboard"] = source.text[start:end]
                    if end > start:
                        source.replace_range(start, end, "")
                        bump_rev()
                if c5.button("Paste", width='stretch'):
                    if STATE["clipboard"]:
                        source.type_text(STATE["clipboard"])
                        bump_rev()

        with st.expander("Compare documents"):
            target_names = [STATE["docs"][i]["doc"].title or f"Page {i + 1}" for i in range(len(STATE["docs"]))]
            target_index = st.selectbox("Tab to load", range(len(target_names)), format_func=lambda i: target_names[i], key="diff_target")
            c1, c2, c3 = st.columns(3)
            if c1.button("Load editor", width='stretch'):
                STATE["diff_left_text"] = entry["doc"].to_markdown() if entry["mode"] == "rich" else entry["source"].text
                STATE["diff_left_ver"] += 1
            if c2.button("Load tab into right", width='stretch'):
                other = STATE["docs"][target_index]
                STATE["diff_right_text"] = other["doc"].to_markdown() if other["mode"] == "rich" else other["source"].text
                STATE["diff_right_ver"] += 1
            if c3.button("Compare", width='stretch'):
                left_value = st.session_state.get(f"diff_left_v{STATE['diff_left_ver']}") or STATE["diff_left_text"]
                right_value = st.session_state.get(f"diff_right_v{STATE['diff_right_ver']}") or STATE["diff_right_text"]
                STATE["diff_result"] = diff_text(left_value, right_value)
            left = st.text_area("Left", key=f"diff_left_v{STATE['diff_left_ver']}", height=110, value=STATE["diff_left_text"])
            right = st.text_area("Right", key=f"diff_right_v{STATE['diff_right_ver']}", height=110, value=STATE["diff_right_text"])
            if STATE["diff_result"]:
                st.code(STATE["diff_result"], language="diff")

        with st.expander("Shortcuts"):
            st.caption("Ctrl/Cmd + S    Save page")
            st.caption("Ctrl/Cmd + N    New page")
            st.caption("Ctrl/Cmd + F    Find (markdown mode)")
            st.caption("Ctrl/Cmd + Z    Undo (markdown mode)")
            st.caption("Ctrl/Cmd + W    Close tab")
            st.caption("Ctrl + Alt + Left/Right    Switch tab")


entry = active_entry()
render_sidebar(entry)
render_tabs()

title = st.text_input(
    "Page title",
    value=entry["doc"].title,
    key=f"d{entry['id']}_{entry['rev']}_title",
    label_visibility="collapsed",
    placeholder="Untitled",
)
entry["doc"].title = title or "Untitled"

c1, c2 = st.columns(2)
if c1.button("📝 Rich document" if entry["mode"] != "rich" else "📝 Rich document", key="mode_rich", type="primary" if entry["mode"] == "rich" else "secondary", width='stretch'):
    if entry["mode"] != "rich":
        entry["doc"] = parse_markdown(entry["source"].text)
        entry["mode"] = "rich"
        entry["saved_markdown"] = None
        entry["editing"] = set()
        bump_rev()
        st.rerun()
if c2.button("📄 Markdown" if entry["mode"] != "source" else "📄 Markdown", key="mode_source", type="primary" if entry["mode"] == "source" else "secondary", width='stretch'):
    if entry["mode"] != "source":
        entry["source"].set_text(entry["doc"].to_markdown())
        entry["mode"] = "source"
        bump_rev()
        st.rerun()

if entry["mode"] == "rich":
    render_rich(entry)
else:
    render_source(entry)

entry = active_entry()
dirty = entry_dirty(entry)
c1, c2, c3, c4, c5 = st.columns(5)
c1.caption(f"Page: {entry['doc'].title or 'Untitled'}")
c2.caption("Unsaved" if dirty else "Saved")
c3.caption(f"{len(entry['doc'].blocks)} blocks")
c4.caption(f"{entry['doc'].word_count()} words")
c5.caption(f"Mode: {'Rich' if entry['mode'] == 'rich' else 'Markdown'}")

now = time.time()
if STATE["settings"]["autosave"] and entry["path"] and dirty and now - STATE["last_save"] > 5:
    try:
        save_page(entry["path"])
        STATE["last_save"] = now
    except Exception:
        pass

persist_session()
