# Edituh

Edituh is a Confluence/Notion-style documentation editor for the web **and the desktop**.
It combines a FastAPI backend with a modern React frontend (BlockNote + Mantine) and a
balanced rope data structure for fast text handling. Desktop builds are published as
downloadable installers on GitHub Releases; the same app also runs as an installable
Progressive Web App.

## Download the desktop app

Grab an installer from the **Releases** page of this repo:

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Apple Silicon) | `Edituh-<version>-arm64.dmg` | Drag to Applications. First launch: right-click → Open (unsigned build) |
| macOS (Intel) | `Edituh-<version>-x64.dmg` | Same as above |
| Windows | `Edituh-Setup-<version>-x64.exe` | SmartScreen may warn: click "More info" → "Run anyway" |
| Linux | `Edituh-<version>-x86_64.AppImage` or `.deb` | AppImage: `chmod +x` then run |

The app bundles its own local server, works fully offline, and stores documents and
media under `~/.edituh/`.

To publish a new release, push a version tag:

```bash
git tag v2.0.0 && git push origin v2.0.0
```

GitHub Actions builds all four platforms and attaches the installers to the release.

## Features

### Web app (`web/`)
- Rich block editing: headings, paragraphs, quotes, callouts, code, checklists, lists, tables, dividers
- Media blocks: images, videos, audio (uploaded to the server), file attachments (drag & drop)
- Chart block: bar, line, area, scatter charts edited inline with a CSV-style editor
- **Math (KaTeX):** `$inline$` and block `$$...$$` LaTeX — a dedicated Math block in the editor, rendered
  with KaTeX in the app, Markdown/HTML exports and presentation mode
- **Diagrams (Mermaid):** a Diagram block for flowcharts, sequence and class diagrams, rendered live
- **Bidirectional links:** `[[Page name]]` and `[[Page|alias]]` wikilinks everywhere — click to jump or
  auto-create the target page; backlinks + outgoing links panel; a force-directed **knowledge graph**
  (d3-force) with daily-note highlighting
- **Daily notes & quick capture:** "Today's note" button and **⌘⇧N** quick capture tray with a target
  doc list, clipboard image auto-insert and drag-and-drop attachments
- **Presentation mode:** present any page as slides built from its headings — presenter notes (📝/🎙️
  callouts), keyboard navigation, and one-click **deck export** as a standalone HTML file
- Slash menu (`/`) with custom chart, math, diagram and callout entries
- 6 themes: Midnight, Paper, Sepia, Nord, Forest, Ocean (light/dark)
- Outline panel with heading navigation, sidebar document list, command menu (⌘K)
- Export to Markdown, HTML, JSON or a presentation deck; import from Markdown
- Auto-save with save status indicator; offline mode with localStorage fallback
- Installable PWA (manifest, service worker, icons)
- Word count in the sidebar footer

### Desktop app (`desktop/`)
- System tray with the document list, "Open today's note", quick capture, and **paste clipboard image
  → today's note** (uploads and inserts from the tray, then shows a notification)

### Core engine (Python)
- Balanced rope data structure for fast editing of large documents (`rope.py`)
- Document model with blocks, media store, markdown import/export, chart SVG rendering (`docmodel.py`)
- Streamlit desktop-style editor kept for reference (`app.py`)

## Requirements

- Python 3.14 or newer
- Node.js 22+ (for building the web app)

## Installation

1. Install Python dependencies:

   ```bash
   uv sync
   ```

   (or `pip install -e .`)

2. Build the web app:

   ```bash
   cd web && npm install && npm run build
   ```

## Run the application

Start the FastAPI server (serves the API and the built web app):

```bash
uv run python server.py
```

Open http://127.0.0.1:8000 in your browser.

### Development mode

Run the Vite dev server with hot reload:

```bash
cd web && npm run dev
```

and point it at the API server (default `http://127.0.0.1:8000`, see `web/vite.config.ts`).

## Install as an app (PWA)

Open the app in Chrome/Edge (macOS/Windows) or Safari (iOS/macOS):

- **macOS (Chrome):** click the install icon in the address bar, or use the in-app
  install button (also available from the header via ⌘K > "Install app").
- **iOS (Safari):** tap **Share** → **Add to Home Screen**.
- **Android (Chrome):** menu → **Install app** / **Add to Home screen**.

The app works offline once opened: documents are cached in localStorage and synced to
the server when back online.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| ⌘K / Ctrl+K | Command menu |
| ⌘N / Ctrl+N | New document |
| ⌘⇧N | Quick capture into today's note (sidebar: Today's note) |
| ⌘S / Ctrl+S | Save |
| ⌘Shift+P | Quick theme toggle |
| `/` | Slash menu (inside the editor) |
| `[[Page]]` | Wikilink — opens or creates the linked page |
| In Present mode: `→`/`←` navigate, `N` notes, `F` fullscreen, `Esc` exit |

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Health check |
| `GET /api/docs` | List documents |
| `POST /api/docs` | Create a document |
| `GET /api/docs/{id}` | Get a document |
| `PUT /api/docs/{id}` | Save a document |
| `DELETE /api/docs/{id}` | Delete a document |
| `POST /api/import` | Parse Markdown into a document |
| `POST /api/export` | Export a document (markdown/html/json) |
| `POST /api/chart` | Render chart data as an SVG data URL |
| `POST /api/media` | Upload a media file |
| `GET /api/media/{name}` | Download media |

## Deep links

Open documents by title (also used by tray and wikilinks): `#/doc/Page%20Name`.
Open quick capture: `#/capture`.

## Storage

Documents are stored in the session file at `~/.edituh/session.json`; uploaded media in
`~/.edituh/media`.

## Project structure

| File | Purpose |
| --- | --- |
| `server.py` | FastAPI server: API + static web app (`--port` / `--static-dir` CLI) |
| `docmodel.py` | Document model, media store, markdown/HTML (wikilinks, math, mermaid), chart SVG |
| `rope.py` | Balanced rope data structure |
| `text_edituh.py` | Core Streamlit editor logic |
| `app.py` | Streamlit web interface (reference) |
| `web/` | React web app (BlockNote + Vite + Mantine) |
| `web/src/editor/` | Editor component, custom blocks (chart, math, mermaid), inline specs (wikilink, math), schema |
| `web/src/lib/` | Types, themes, API client, doc conversion, charts, links/graph, daily notes, exports |
| `web/src/components/` | Sidebar, header, command menu, outline, backlinks, graph view, quick capture, presenter |
| `web/scripts/gen-icons.mjs` | PWA icon generator |
| `desktop/` | Electron shell: system tray, spawns the bundled server, opens the app window |
| `.github/workflows/release.yml` | Builds + attaches macOS/Windows/Linux installers on version tags |

## Testing

```bash
uv run pytest -q          # Python: rope, editor, doc model, API (83 tests)
cd web && npx tsc -b      # TypeScript type check
cd web && npm test        # Web: conversion, export, links/graph (34 tests)
cd web && npm run build   # Production build
```
