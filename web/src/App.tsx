import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandMenu } from "./components/CommandMenu";
import { GraphView } from "./components/GraphView";
import { Header } from "./components/Header";
import { LinksPanel } from "./components/LinksPanel";
import { OutlinePanel } from "./components/OutlinePanel";
import { PresentView } from "./components/PresentView";
import { CAPTURE_TODAY, QuickCapture } from "./components/QuickCapture";
import { Sidebar } from "./components/Sidebar";
import { EdituhEditor, type EditorHandle } from "./editor/EdituhEditor";
import { OPEN_DOC_EVENT } from "./editor/inline";
import { api, loadLocalActive, loadLocalDocs, loadLocalSettings, persistLocalActive, persistLocalDocs, persistLocalSettings, type LocalDoc } from "./lib/api";
import { findDocByTitle, findTodayDoc, todayTitle } from "./lib/daily";
import { useToast } from "./lib/toast";
import { FONT_CSS, THEMES } from "./lib/theme";
import type { DocJson, Settings, ThemeName } from "./lib/types";
import { uuid } from "./lib/uuid";

const SAVE_DEBOUNCE_MS = 350;

const WELCOME_DOC: DocJson = {
  title: "Welcome to Edituh",
  blocks: [
    { id: "b1", type: "heading", data: { level: 1, text: "Welcome to **Edituh** 👋" } },
    { id: "b2", type: "paragraph", data: { text: "A beautiful documentation workspace. Type `/` anywhere to add blocks — text, tables, code, charts, **math**, **diagrams**, images, checklists, callouts and more." } },
    { id: "b3", type: "callout", data: { icon: "💡", text: "**Link pages** with `[[Page name]]` — try `[[Daily notes]]` or `[[Presentation mode]]` — then open the **knowledge graph** from the header." } },
    { id: "b4", type: "heading", data: { level: 2, text: "Quick tour" } },
    { id: "b5", type: "checklist", data: { items: [[false, "Create pages from the sidebar or with **⌘N** — press **⌘⇧N** for quick capture into today's note"], [false, "Drag & drop images and files, or paste an image right into quick capture"], [false, "Add charts, **LaTeX math** and **Mermaid diagrams** to bring data to life"], [false, "Link pages with [[wikilinks]] and explore the knowledge graph"], [false, "Present any page as slides from its headings"], [false, "Export as Markdown, HTML, JSON or a standalone deck"]] } },
    { id: "b6", type: "heading", data: { level: 2, text: "Math & diagrams" } },
    { id: "b7", type: "math", data: { latex: "E = mc^2" } },
    { id: "b8", type: "mermaid", data: { code: "flowchart TD\n  A[Ideas] --> B[Daily notes]\n  B --> C[Knowledge graph]\n  C --> D[Presentations]" } },
    { id: "b9", type: "heading", data: { level: 2, text: "A sample table" } },
    { id: "b10", type: "table", data: { headers: ["Feature", "Confluence", "Notion", "Edituh"], rows: [["Themes", "✅", "✅", "✅ 6 handcrafted"], ["Charts", "Add-on", "External", "Built-in"], ["Math + diagrams", "—", "External", "✅ KaTeX + Mermaid"], ["Knowledge graph", "—", "—", "✅"], ["Presentations", "—", "—", "✅ From headings"]] } },
    { id: "b11", type: "heading", data: { level: 2, text: "Charts" } },
    { id: "b12", type: "chart", data: { kind: "bar", title: "Monthly usage", labels: ["Jan", "Feb", "Mar", "Apr"], series: { "Pages": [12, 19, 24, 31], "Media": [4, 8, 9, 14] } } },
    { id: "b13", type: "heading", data: { level: 2, text: "Quotes & code" } },
    { id: "b14", type: "quote", data: { text: "The best documentation is the one people actually read — make it beautiful." } },
    { id: "b15", type: "code", data: { language: "python", text: "def hello():\n    print(\"Hello, Edituh!\")" } },
    { id: "b16", type: "divider", data: {} },
    { id: "b17", type: "paragraph", data: { text: "Enjoy exploring. Delete this page anytime — your next one is a keystroke away." } },
  ],
};

function defaultSettings(): Settings {
  const stored = loadLocalSettings();
  if (stored && typeof stored === "object") {
    return {
      theme: (stored.theme as ThemeName) || "midnight",
      font: (stored.font as Settings["font"]) || "inter",
      density: (stored.density as Settings["density"]) || "comfortable",
    };
  }
  return { theme: "midnight", font: "inter", density: "comfortable" };
}

export function App() {
  const [docs, setDocs] = useState<LocalDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docsRef = useRef<LocalDoc[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const onlineRef = useRef(true);
  const pendingSavesRef = useRef<Map<string, LocalDoc>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<number | null>(null);
  const localTimerRef = useRef<number | null>(null);

  const active = useMemo(() => docs.find((d) => d.id === activeId) ?? null, [docs, activeId]);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  const commitDocs = useCallback((next: LocalDoc[]) => {
    docsRef.current = next;
    setDocs(next);
  }, []);

  const commitActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
    if (id) persistLocalActive(id);
  }, []);

  const persistLocalSoon = useCallback(() => {
    if (localTimerRef.current) window.clearTimeout(localTimerRef.current);
    localTimerRef.current = window.setTimeout(() => {
      persistLocalDocs(docsRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // ---------- remote sync: debounced, per-doc sequenced ----------
  const flushRemote = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (pendingSavesRef.current.size === 0) {
      setSaving(false);
      setDirty(false);
      return;
    }
    const pending = pendingSavesRef.current;
    pendingSavesRef.current = new Map();
    for (const [id, entry] of pending) {
      if (inFlightRef.current.has(id)) {
        pendingSavesRef.current.set(id, entry);
        continue;
      }
      inFlightRef.current.add(id);
      api
        .saveDoc(id, entry.doc)
        .catch(() => {
          setOnline(false);
          const latest = docsRef.current.find((d) => d.id === id);
          if (latest) pendingSavesRef.current.set(id, latest);
        })
        .finally(() => {
          inFlightRef.current.delete(id);
          if (pendingSavesRef.current.size === 0 && inFlightRef.current.size === 0) {
            setSaving(false);
            setDirty(false);
          }
        });
    }
    if (pendingSavesRef.current.size > 0) {
      flushTimerRef.current = window.setTimeout(flushRemote, SAVE_DEBOUNCE_MS);
    }
  }, []);

  const schedulePersist = useCallback(
    (next: LocalDoc[]) => {
      commitDocs(next);
      pendingSavesRef.current = new Map();
      for (const entry of next) {
        if (!entry.id.startsWith("local-")) pendingSavesRef.current.set(entry.id, entry);
      }
      persistLocalSoon();
      setSaving(true);
      setDirty(true);
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = window.setTimeout(flushRemote, SAVE_DEBOUNCE_MS);
    },
    [commitDocs, flushRemote, persistLocalSoon]
  );

  // Flush pending writes when the tab closes.
  useEffect(() => {
    const onUnload = () => {
      persistLocalDocs(docsRef.current);
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  // ---------- init: load + reconcile local vs server ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.health();
        const { documents: summaries } = await api.listDocs();
        if (cancelled) return;
        const local = loadLocalDocs();
        const byId = new Map(local.map((d) => [d.id, d]));

        const bodyResults = await Promise.all(
          summaries.map(async (s) => {
            try {
              const res = await api.getDoc(s.id);
              return { id: s.id, doc: res.doc, updated: s.updated };
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;

        const merged: LocalDoc[] = [];
        const recover: LocalDoc[] = [];
        for (const s of summaries) {
          const l = byId.get(s.id);
          const serverDoc = bodyResults.find((b) => b?.id === s.id);
          if (l && serverDoc && l.updated > s.updated) {
            merged.push(l);
            recover.push(l);
          } else if (l && !serverDoc) {
            merged.push(l);
            recover.push(l);
          } else if (serverDoc) {
            merged.push({ id: s.id, updated: s.updated, doc: serverDoc.doc });
          } else if (l) {
            merged.push(l);
          }
        }
        for (const l of local) {
          if (!byId.has(l.id) || !summaries.some((s) => s.id === l.id)) merged.push(l);
        }
        for (const d of merged) {
          if (!byId.has(d.id)) byId.set(d.id, d);
        }
        const deduped = Array.from(new Map(merged.map((d) => [d.id, d])).values());

        commitDocs(deduped);
        commitActive(loadLocalActive() && deduped.some((d) => d.id === loadLocalActive()) ? loadLocalActive()! : (deduped[0]?.id ?? null));
        setOnline(true);
        if (recover.length > 0) {
          pendingSavesRef.current = new Map(recover.map((d) => [d.id, d]));
          flushTimerRef.current = window.setTimeout(flushRemote, 100);
          toast("info", "Recovered local changes from offline editing");
        }
        if (deduped.length === 0) createLocal(WELCOME_DOC);
      } catch {
        if (cancelled) return;
        const local = loadLocalDocs();
        setOnline(false);
        commitDocs(local);
        commitActive(loadLocalActive() && local.some((d) => d.id === loadLocalActive()) ? loadLocalActive()! : (local[0]?.id ?? null));
        if (local.length === 0) createLocal(WELCOME_DOC);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- reconnect flush ----------
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      flushRemote();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushRemote]);

  const createLocal = useCallback((doc: DocJson) => {
    const id = `local-${uuid()}`;
    const entry: LocalDoc = { id, updated: new Date().toISOString(), doc };
    commitDocs([entry, ...docsRef.current.filter((d) => d.id !== id)]);
    commitActive(id);
    persistLocalDocs(docsRef.current);
    return id;
  }, [commitActive, commitDocs]);

  const createLocalWithId = useCallback((doc: DocJson, id: string) => {
    const entry: LocalDoc = { id, updated: new Date().toISOString(), doc };
    commitDocs([entry, ...docsRef.current.filter((d) => d.id !== id)]);
    commitActive(id);
    persistLocalDocs(docsRef.current);
  }, [commitActive, commitDocs]);

  // ---------- persistence ----------
  const updateDoc = useCallback(
    (id: string, doc: DocJson) => {
      const entry: LocalDoc = { id, updated: new Date().toISOString(), doc };
      schedulePersist(docsRef.current.map((d) => (d.id === id ? entry : d)));
    },
    [schedulePersist]
  );

  const handleContentChange = useCallback(
    (doc: DocJson) => {
      const current = activeIdRef.current;
      if (!current) return;
      updateDoc(current, { ...doc, title: doc.title || "Untitled" });
    },
    [updateDoc]
  );

  const handleTitle = useCallback(
    (title: string) => {
      const current = activeIdRef.current;
      const currentDoc = docsRef.current.find((d) => d.id === current);
      if (!current || !currentDoc) return;
      const cleaned = title.trim() || "";
      if (cleaned === currentDoc.doc.title) return;
      updateDoc(current, { ...currentDoc.doc, title: cleaned });
    },
    [updateDoc]
  );

  // ---------- actions ----------
  const createPage = useCallback(() => {
    const doc: DocJson = {
      title: "Untitled",
      blocks: [{ id: uuid(), type: "paragraph", data: { text: "" } }],
    };
    if (docsRef.current.length === 0 || online) {
      api
        .createDoc("Untitled")
        .then(({ id }) => createLocalWithId(doc, id))
        .catch(() => createLocal(doc));
    } else {
      createLocal(doc);
    }
  }, [online, createLocal, createLocalWithId]);

  const deletePage = useCallback(
    (id: string) => {
      const next = docsRef.current.filter((d) => d.id !== id);
      commitDocs(next);
      pendingSavesRef.current.delete(id);
      if (!id.startsWith("local-")) api.deleteDoc(id).catch(() => setOnline(false));
      if (activeIdRef.current === id) {
        if (next.length > 0) {
          commitActive(next[0].id);
        } else {
          createLocal(WELCOME_DOC);
        }
      }
    },
    [commitActive, commitDocs, createLocal]
  );

  const duplicatePage = useCallback(
    (id: string) => {
      const source = docsRef.current.find((d) => d.id === id);
      if (!source) return;
      const copy: DocJson = {
        title: `${source.doc.title} (copy)`,
        blocks: source.doc.blocks.map((b) => ({ ...b, id: uuid() })),
      };
      createLocal(copy);
    },
    [createLocal]
  );

  const openTodayNote = useCallback(() => {
    const existing = findTodayDoc(docsRef.current);
    if (existing) {
      commitActive(existing.id);
      return;
    }
    const doc: DocJson = {
      title: todayTitle(),
      blocks: [
        { id: uuid(), type: "heading", data: { level: 1, text: todayTitle() } },
        { id: uuid(), type: "paragraph", data: { text: "" } },
      ],
    };
    if (docsRef.current.length === 0 || onlineRef.current) {
      api
        .createDoc(doc.title)
        .then(({ id }) => createLocalWithId(doc, id))
        .catch(() => createLocal(doc));
    } else {
      createLocal(doc);
    }
  }, [commitActive, createLocal, createLocalWithId]);

  const openByTitle = useCallback(
    (title: string) => {
      const existing = findDocByTitle(docsRef.current, title);
      if (existing) {
        commitActive(existing.id);
        return;
      }
      const doc: DocJson = {
        title: title.trim() || "Untitled",
        blocks: [{ id: uuid(), type: "paragraph", data: { text: "" } }],
      };
      if (onlineRef.current) {
        api
          .createDoc(doc.title)
          .then(({ id }) => createLocalWithId(doc, id))
          .catch(() => createLocal(doc));
      } else {
        createLocal(doc);
      }
      toast("info", `Created “${title}”`);
    },
    [commitActive, createLocal, createLocalWithId, toast]
  );

  const handleCapture = useCallback(
    (targetId: string, text: string, attachments: { name: string; kind: string; url: string; size: number }[]) => {
      const append = (id: string, doc: DocJson) => {
        const blocks = [...doc.blocks];
        if (text) {
          blocks.push({ id: uuid(), type: "paragraph", data: { text } });
        }
        for (const a of attachments) {
          blocks.push({
            id: uuid(),
            type: a.kind === "image" ? "image" : "file",
            data: a.kind === "image" ? { src: a.url, caption: "" } : { src: a.url, name: a.name, size: a.size },
          });
        }
        updateDoc(id, { ...doc, blocks });
      };

      const target = targetId === CAPTURE_TODAY ? findTodayDoc(docsRef.current)?.id ?? null : targetId;
      if (target) {
        const doc = docsRef.current.find((d) => d.id === target)?.doc;
        if (doc) {
          append(target, doc);
          commitActive(target);
          return;
        }
      }
      const doc: DocJson = {
        title: todayTitle(),
        blocks: [
          { id: uuid(), type: "heading", data: { level: 1, text: todayTitle() } },
          { id: uuid(), type: "paragraph", data: { text: "" } },
        ],
      };
      if (onlineRef.current) {
        api
          .createDoc(doc.title)
          .then(({ id }) => {
            createLocalWithId(doc, id);
            append(id, doc);
          })
          .catch(() => {
            const id = createLocal(doc);
            append(id, doc);
          });
      } else {
        const id = createLocal(doc);
        append(id, doc);
      }
    },
    [commitActive, createLocal, createLocalWithId, updateDoc]
  );

  const importDoc = useCallback(
    (doc: DocJson) => {
      const imported = { ...doc, title: doc.title || "Imported page" };
      if (online) {
        api
          .createDoc(imported.title)
          .then(({ id }) => createLocalWithId(imported, id))
          .catch(() => createLocal(imported));
      } else {
        createLocal(imported);
      }
    },
    [online, createLocal, createLocalWithId]
  );

  const exportDoc = useCallback(
    (format: "markdown" | "html" | "json" | "deck") => {
      const current = activeIdRef.current;
      const currentDoc = docsRef.current.find((d) => d.id === current);
      if (!currentDoc) return;
      api
        .exportDoc(currentDoc.doc, format)
        .then((via) => toast("success", `Exported as ${format.toUpperCase()}${via === "local" ? " (offline)" : ""}`))
        .catch((err: unknown) => toast("error", `Export failed: ${err instanceof Error ? err.message : "unknown error"}`));
    },
    [toast]
  );

  const jumpToBlock = useCallback(
    (id: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      try {
        editor.setTextCursorPosition(id, "start");
        editor.focus();
      } catch {
        toast("info", "Heading not found");
      }
    },
    [toast]
  );

  const quickTheme = useCallback(() => {
    setSettings((s) => {
      const next: Settings = { ...s, theme: THEMES[s.theme].dark ? "paper" : "midnight" };
      persistLocalSettings(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((theme: ThemeName) => {
    setSettings((s) => {
      const next = { ...s, theme };
      persistLocalSettings(next);
      return next;
    });
  }, []);

  // ---------- theme application ----------
  useEffect(() => {
    const t = THEMES[settings.theme];
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    for (const [key, value] of Object.entries(t.vars)) {
      root.style.setProperty(key, value);
    }
    root.style.setProperty("--editor-font", FONT_CSS[settings.font]);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t.vars["--bg"]);
  }, [settings]);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      } else if (key === "n" && e.shiftKey) {
        e.preventDefault();
        setCaptureOpen(true);
      } else if (key === "n") {
        e.preventDefault();
        createPage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createPage]);

  // ---------- wikilink navigation ----------
  useEffect(() => {
    const onOpenDoc = (e: Event) => {
      const target = (e as CustomEvent).detail as string;
      if (typeof target === "string" && target) openByTitle(target);
    };
    window.addEventListener(OPEN_DOC_EVENT, onOpenDoc);
    return () => window.removeEventListener(OPEN_DOC_EVENT, onOpenDoc);
  }, [openByTitle]);

  // ---------- deep links (#/doc/<title>, #/capture) ----------
  const hashAppliedRef = useRef(false);
  const applyHash = useCallback(() => {
    if (hashAppliedRef.current) return;
    const hash = window.location.hash;
    if (!hash || !hash.startsWith("#/")) return;
    hashAppliedRef.current = true;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (hash.startsWith("#/doc/")) {
      const title = decodeURIComponent(hash.slice(6));
      if (title) openByTitle(title);
    } else if (hash === "#/capture") {
      setCaptureOpen(true);
    }
  }, [openByTitle]);

  useEffect(() => {
    if (!hashAppliedRef.current && docsRef.current.length > 0) applyHash();
  }, [docs, applyHash]);

  // ---------- PWA install ----------
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installEventRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      setCanInstall(false);
      toast("success", "Edituh installed");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [toast]);

  const installApp = useCallback(() => {
    const event = installEventRef.current;
    if (!event) return;
    void event.prompt();
    installEventRef.current = null;
    setCanInstall(false);
  }, []);

  const handleSaveRequest = useCallback(() => {
    flushRemote();
  }, [flushRemote]);

  const theme = settings.theme;
  const dark = THEMES[theme].dark;

  return (
    <div className="app">
      <Sidebar
        docs={docs}
        activeId={activeId}
        online={online}
        theme={theme}
        collapsed={sidebarCollapsed}
        onSelect={(id) => {
          commitActive(id);
          setCommandOpen(false);
        }}
        onNew={createPage}
        onToday={openTodayNote}
        onDelete={deletePage}
        onDuplicate={duplicatePage}
        onTheme={setTheme}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        installPrompt={installApp}
        canInstall={canInstall}
      />

      <div className="main">
        <Header
          title={active?.doc.title ?? "Untitled"}
          dirty={dirty}
          saving={saving}
          online={online}
          outlineOpen={outlineOpen}
          linksOpen={linksOpen}
          canPresent={Boolean(active)}
          onTitle={handleTitle}
          onToggleOutline={() => setOutlineOpen((v) => !v)}
          onToggleLinks={() => setLinksOpen((v) => !v)}
          onExport={exportDoc}
          onImportClick={() => fileInputRef.current?.click()}
          onCommandMenu={() => setCommandOpen(true)}
          onPresent={() => setPresentOpen(true)}
          onGraph={() => setGraphOpen(true)}
        />

        <div className="workspace">
          <div
            className="editor-scroll"
            style={settings.density === "compact" ? { paddingTop: 18 } : undefined}
            onDragOver={(e) => {
              const files = e.dataTransfer?.files;
              if (files && files.length > 0 && [...files].some((f) => !f.type.startsWith("image/"))) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              const files = [...(e.dataTransfer?.files ?? [])];
              const nonImages = files.filter((f) => !f.type.startsWith("image/"));
              if (nonImages.length === 0) return;
              e.preventDefault();
              const current = activeIdRef.current;
              const currentDoc = docsRef.current.find((d) => d.id === current);
              if (!current || !currentDoc) return;
              void (async () => {
                const added: DocJson["blocks"] = [];
                for (const file of nonImages) {
                  try {
                    const url = await api.uploadMedia(file);
                    added.push({ id: uuid(), type: "file", data: { src: url, name: file.name, size: file.size } });
                  } catch {
                    toast("error", `Upload failed for ${file.name}`);
                  }
                }
                if (added.length > 0) {
                  updateDoc(current, { ...currentDoc.doc, blocks: [...currentDoc.doc.blocks, ...added] });
                  toast("success", `Attached ${added.length} file${added.length > 1 ? "s" : ""}`);
                }
              })();
            }}
          >
            {active ? (
              <div className="editor-shell">
                <EdituhEditor
                  doc={active.doc}
                  docId={active.id}
                  dark={dark}
                  onContentChange={handleContentChange}
                  onReady={(editor) => {
                    editorRef.current = editor;
                  }}
                  onSaveRequest={handleSaveRequest}
                />
              </div>
            ) : (
              <div className="empty-workspace">
                <h2>Nothing open</h2>
                <p>Select a page from the sidebar, or create a new one.</p>
                <button className="btn btn-primary" onClick={createPage}>
                  New page
                </button>
              </div>
            )}
          </div>

          {outlineOpen && active && (
            <OutlinePanel doc={active.doc} onJump={jumpToBlock} onClose={() => setOutlineOpen(false)} />
          )}
          {linksOpen && active && (
            <LinksPanel
              docs={docs.map((d) => ({ id: d.id, doc: d.doc }))}
              docId={active.id}
              onOpenById={(id) => commitActive(id)}
              onOpenByTitle={openByTitle}
            />
          )}
        </div>
      </div>

      <CommandMenu
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        docs={docs.map((d) => ({ id: d.id, title: d.doc.title }))}
        theme={theme}
        activeId={activeId}
        todayDocId={findTodayDoc(docs)?.id ?? null}
        onNew={createPage}
        onSelectDoc={(id) => {
          commitActive(id);
        }}
        onToday={openTodayNote}
        onCapture={() => setCaptureOpen(true)}
        onGraph={() => setGraphOpen(true)}
        onPresent={() => setPresentOpen(true)}
        onTheme={setTheme}
        onExport={exportDoc}
        onImport={() => fileInputRef.current?.click()}
        onToggleOutline={() => setOutlineOpen((v) => !v)}
        onToggleLinks={() => setLinksOpen((v) => !v)}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onQuickTheme={quickTheme}
      />

      {graphOpen && (
        <GraphView
          docs={docs.map((d) => ({ id: d.id, doc: d.doc }))}
          activeId={activeId}
          onOpenDoc={(id) => {
            commitActive(id);
            setGraphOpen(false);
          }}
          onClose={() => setGraphOpen(false)}
        />
      )}

      {captureOpen && (
        <QuickCapture
          open={captureOpen}
          docs={docs.map((d) => ({ id: d.id, doc: d.doc }))}
          todayDocId={findTodayDoc(docs)?.id ?? null}
          onCapture={handleCapture}
          onClose={() => setCaptureOpen(false)}
        />
      )}

      {presentOpen && active && <PresentView doc={active.doc} onClose={() => setPresentOpen(false)} />}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,.json"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.name.toLowerCase().endsWith(".json")) {
              const parsed = JSON.parse(await file.text()) as unknown;
              if (
                typeof parsed === "object" &&
                parsed !== null &&
                "blocks" in parsed &&
                Array.isArray((parsed as { blocks?: unknown }).blocks)
              ) {
                importDoc(parsed as DocJson);
                toast("success", `Imported “${file.name}”`);
              } else {
                throw new Error("not a valid Edituh JSON document");
              }
            } else {
              const text = await file.text();
              const { doc } = await api.importMarkdown(text);
              importDoc(doc);
              toast("success", `Imported “${file.name}”`);
            }
          } catch (err) {
            toast("error", `Import failed: ${err instanceof Error ? err.message : "unknown error"}`);
          } finally {
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
