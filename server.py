import argparse
import json
import os
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from docmodel import Document, MediaStore, chart_svg, parse_markdown
from text_edituh import SessionStore

app = FastAPI(title="Edituh API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

store = SessionStore()
store_lock = threading.Lock()

MAX_MEDIA_BYTES = 250 * 1024 * 1024
ALLOWED_MEDIA_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg", ".m4a",
    ".pdf",
}


class BlockIn(BaseModel):
    id: str = ""
    type: str = "paragraph"
    data: dict = Field(default_factory=dict)


class DocumentIn(BaseModel):
    title: str = "Untitled"
    blocks: list[BlockIn] = Field(default_factory=list)


class CreateRequest(BaseModel):
    title: str = "Untitled"


class SaveRequest(BaseModel):
    doc: DocumentIn


class ImportRequest(BaseModel):
    markdown: str = ""


class ExportRequest(BaseModel):
    doc: DocumentIn
    format: str = "markdown"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _entry_to_summary(item):
    doc = item.get("doc") or {}
    return {
        "id": item.get("id"),
        "title": doc.get("title", "Untitled"),
        "updated": item.get("updated", ""),
        "blocks": len(doc.get("blocks") or []),
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/docs")
def list_documents():
    with store_lock:
        session = store.load()
    return {"active": session.get("active", 0), "documents": [_entry_to_summary(item) for item in session.get("documents", [])]}


@app.post("/api/docs")
def create_document(payload: CreateRequest | None = None):
    title = (payload.title if payload else "") or "Untitled"
    doc = Document(title=title)
    doc.add_block("paragraph", {"text": ""})
    entry = {"id": str(uuid.uuid4())[:10], "title": title, "doc": doc.to_dict(), "updated": _now()}
    with store_lock:
        session = store.load()
        session["documents"].insert(0, entry)
        session["documents"] = session["documents"][:100]
        store.save(session.get("active", 0), session["documents"])
    return {"id": entry["id"]}


@app.get("/api/docs/{doc_id}")
def get_document(doc_id: str):
    with store_lock:
        documents = store.load().get("documents", [])
    for item in documents:
        if str(item.get("id")) == doc_id:
            return {"id": doc_id, "title": item.get("doc", {}).get("title", "Untitled"), "doc": item["doc"]}
    raise HTTPException(404, "Document not found")


@app.put("/api/docs/{doc_id}")
def save_document(doc_id: str, payload: SaveRequest):
    doc = payload.doc.model_dump()
    with store_lock:
        session = store.load()
        for item in session.get("documents", []):
            if str(item.get("id")) == doc_id:
                item["doc"] = doc
                item["title"] = doc.get("title", "Untitled")
                item["updated"] = _now()
                store.save(session.get("active", 0), session["documents"])
                return {"ok": True}
    raise HTTPException(404, "Document not found")


@app.delete("/api/docs/{doc_id}")
def delete_document(doc_id: str):
    with store_lock:
        session = store.load()
        session["documents"] = [item for item in session["documents"] if str(item.get("id")) != doc_id]
        store.save(session.get("active", 0), session["documents"])
    return {"ok": True}


@app.post("/api/import")
def import_markdown(payload: ImportRequest):
    doc = parse_markdown(payload.markdown)
    return {"doc": doc.to_dict()}


@app.post("/api/export")
def export_document(payload: ExportRequest):
    doc = Document.from_dict(payload.doc.model_dump())
    export_format = (payload.format or "markdown").lower()
    if export_format == "json":
        return JSONResponse(doc.to_dict())
    if export_format == "html":
        return Response(doc.to_html(), media_type="text/html")
    return Response(doc.to_markdown(), media_type="text/markdown")


@app.post("/api/chart")
def chart_endpoint(payload: dict):
    kind = payload.get("kind") or "bar"
    labels = payload.get("labels") or []
    series = payload.get("series") or {}
    svg = chart_svg(kind, labels, series, 640, 360)
    if not svg:
        raise HTTPException(400, "chart data required")
    import base64
    return {"svg": "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("ascii")}


@app.post("/api/media")
def upload_media(file: UploadFile = File(...)):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in ALLOWED_MEDIA_EXTENSIONS:
        raise HTTPException(400, f"File type '{extension or 'unknown'}' is not allowed")
    chunks = []
    size = 0
    while chunk := file.file.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_MEDIA_BYTES:
            raise HTTPException(413, f"File exceeds the {MAX_MEDIA_BYTES // (1024 * 1024)} MB limit")
        chunks.append(chunk)
    content = b"".join(chunks)
    name = MediaStore.save(content, file.filename or "file.bin")
    return {"url": f"/api/media/{Path(name).name}"}


@app.get("/api/media/{name}")
def get_media(name: str):
    resolved = MediaStore.resolve(f"media/{name}" if "/" not in name else name)
    if not resolved or not resolved.exists():
        raise HTTPException(404, "Media not found")
    return FileResponse(resolved, media_type=MediaStore.mime_type(resolved))


_dist = Path(__file__).parent / "web" / "dist"


def mount_static(static_dir: str | None):
    target = Path(static_dir) if static_dir else _dist
    if target.is_dir():
        app.mount("/", StaticFiles(directory=str(target), html=True), name="web")
        return True
    return False


def run():
    parser = argparse.ArgumentParser(prog="edituh-server", description="Edituh API + static web app")
    parser.add_argument("--port", type=int, default=8000, help="port to listen on (default: 8000)")
    parser.add_argument("--host", default="127.0.0.1", help="host to bind (default: 127.0.0.1)")
    parser.add_argument("--static-dir", default=None, help="directory with the built web app (default: web/dist)")
    parser.add_argument("--no-static", action="store_true", help="serve the API only")
    args = parser.parse_args()

    mounted = False if args.no_static else mount_static(args.static_dir)
    if not args.no_static and not mounted:
        @app.get("/")
        def root():
            return {"message": "Edituh API. Build the web app with `npm run build` inside web/."}

    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port, reload=False, log_level="warning")


if __name__ == "__main__":
    run()