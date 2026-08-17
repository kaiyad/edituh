import type { DocJson, DocSummary } from "./types";

const API = "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  listDocs: () => request<{ active: number; documents: DocSummary[] }>("/api/docs"),

  getDoc: (id: string) =>
    request<{ id: string; title: string; doc: DocJson }>(`/api/docs/${id}`),

  createDoc: (title = "Untitled") =>
    request<{ id: string }>("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),

  saveDoc: (id: string, doc: DocJson) =>
    request<{ ok: boolean }>(`/api/docs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc }),
    }),

  deleteDoc: (id: string) =>
    request<{ ok: boolean }>(`/api/docs/${id}`, { method: "DELETE" }),

  importMarkdown: (markdown: string) =>
    request<{ doc: DocJson }>("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    }),

  exportDoc: async (doc: DocJson, format: "markdown" | "html" | "json") => {
    const res = await fetch(`${API}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc, format }),
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const ext = format === "markdown" ? "md" : format;
    downloadBlob(blob, `${doc.title || "Untitled"}.${ext}`);
  },

  uploadMedia: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/api/media`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed");
    const data = (await res.json()) as { url: string };
    return data.url;
  },
};

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- localStorage fallback (works offline / without backend) ----------

const LS_DOCS = "edituh.docs.v1";
const LS_ACTIVE = "edituh.active.v1";
const LS_SETTINGS = "edituh.settings.v1";

export interface LocalDoc {
  id: string;
  updated: string;
  doc: DocJson;
}

export function loadLocalDocs(): LocalDoc[] {
  try {
    return JSON.parse(localStorage.getItem(LS_DOCS) || "[]");
  } catch {
    return [];
  }
}

export function persistLocalDocs(docs: LocalDoc[]) {
  try {
    localStorage.setItem(LS_DOCS, JSON.stringify(docs));
  } catch {
    /* storage full — ignore */
  }
}

export function loadLocalActive(): string | null {
  return localStorage.getItem(LS_ACTIVE);
}

export function persistLocalActive(id: string) {
  localStorage.setItem(LS_ACTIVE, id);
}

export function loadLocalSettings(): Record<string, unknown> | null {
  try {
    return JSON.parse(localStorage.getItem(LS_SETTINGS) || "null");
  } catch {
    return null;
  }
}

export function persistLocalSettings(settings: unknown) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}