import json

import pytest
from fastapi.testclient import TestClient

import server
from docmodel import Document

client = TestClient(server.app)


def _fresh_client(tmp_path, monkeypatch):
    store_path = tmp_path / "session.json"
    server.store.path = store_path
    server.MediaStore.DIR = tmp_path / "media"
    server.MediaStore.DIR.mkdir(parents=True, exist_ok=True)
    return client


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_document_crud(tmp_path, monkeypatch):
    _fresh_client(tmp_path, monkeypatch)
    doc_id = client.post("/api/docs", json={"title": "First Page"}).json()["id"]
    entry = client.get(f"/api/docs/{doc_id}").json()
    assert entry["title"] == "First Page"
    assert entry["doc"]["blocks"]
    docs = client.get("/api/docs").json()["documents"]
    assert any(item["id"] == doc_id for item in docs)
    assert client.delete(f"/api/docs/{doc_id}").json() == {"ok": True}
    assert client.get(f"/api/docs/{doc_id}").status_code == 404


def test_save_and_export(tmp_path, monkeypatch):
    _fresh_client(tmp_path, monkeypatch)
    doc_id = client.post("/api/docs", json={"title": "T"}).json()["id"]
    doc = Document(title="Updated")
    doc.add_block("heading", {"text": "Hello", "level": 1})
    doc.add_block("paragraph", {"text": "World"})
    client.put(f"/api/docs/{doc_id}", json={"doc": doc.to_dict()})
    entry = client.get(f"/api/docs/{doc_id}").json()
    assert entry["title"] == "Updated"
    md = client.post("/api/export", json={"doc": doc.to_dict(), "format": "markdown"}).text
    assert "# Hello" in md and "World" in md
    html = client.post("/api/export", json={"doc": doc.to_dict(), "format": "html"}).text
    assert "<h1>Hello</h1>" in html
    j = client.post("/api/export", json={"doc": doc.to_dict(), "format": "json"}).json()
    assert j["title"] == "Updated"


def test_import_roundtrip(tmp_path, monkeypatch):
    _fresh_client(tmp_path, monkeypatch)
    doc = client.post("/api/import", json={"markdown": "# Title\n\nSome **bold** text."}).json()["doc"]
    assert doc["title"] == "Title"
    blocks = doc["blocks"]
    assert blocks[0]["type"] == "heading" and blocks[0]["data"]["text"] == "Title"
    md = client.post("/api/export", json={"doc": doc, "format": "markdown"}).text
    assert "**bold**" in md


def test_chart_endpoint(tmp_path, monkeypatch):
    _fresh_client(tmp_path, monkeypatch)
    response = client.post("/api/chart", json={"kind": "bar", "labels": ["Jan"], "series": {"Sales": [5.0]}})
    assert response.json()["svg"].startswith("data:image/svg+xml;base64,")
    assert client.post("/api/chart", json={}).status_code == 400


def test_media_upload(tmp_path, monkeypatch):
    _fresh_client(tmp_path, monkeypatch)
    response = client.post("/api/media", files={"file": ("pic.png", b"\x89PNG\r\n\x1a\n", "image/png")})
    url = response.json()["url"]
    fetched = client.get(url)
    assert fetched.status_code == 200
    assert fetched.content == b"\x89PNG\r\n\x1a\n"