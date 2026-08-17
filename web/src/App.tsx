import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandMenu } from "./components/CommandMenu";
import { Header } from "./components/Header";
import { OutlinePanel } from "./components/OutlinePanel";
import { Sidebar } from "./components/Sidebar";
import { EdituhEditor, type EditorHandle } from "./editor/EdituhEditor";
import { api, loadLocalActive, loadLocalDocs, loadLocalSettings, persistLocalActive, persistLocalDocs, persistLocalSettings, type LocalDoc } from "./lib/api";
import { useToast } from "./lib/toast";
import { FONT_CSS, THEMES } from "./lib/theme";
import type { DocJson, Settings, ThemeName } from "./lib/types";
import { uuid } from "./lib/uuid";

const SAVE_DEBOUNCE_MS = 350;

const WELCOME_DOC: DocJson = {
  title: "Welcome to Edituh",
  blocks: [
    { id: "b1", type: "heading", data: { level: 1, text: "Welcome to **Edituh** 👋" } },
    { id: "b2", type: "paragraph", data: { text: "A beautiful documentation workspace. Type `/` anywhere to add blocks — text, tables, code, charts, images, video, audio, checklists, callouts and more." } },
    { id: "b3", type: "callout", data: { icon: "💡", text: "Try the **command menu** with `⌘K` (Ctrl+K) to jump between pages, switch themes and export documents." } },
    { id: "b4", type: "heading", data: { level: 2, text: "Quick tour" } },
    { id: "b5", type: "checklist", data: { items: [[false, "Create pages from the sidebar or with **⌘N**"], [false, "Drag & drop images, or paste a video URL"], [false, "Add charts and tables to bring your data to life"], [false, "Export any page as Markdown, HTML or JSON"], [false, "Install Edituh as a **native-feeling app** (macOS / iOS) from the sidebar"]] } },
    { id: "b6", type: "heading", data: { level: 2, text: "A sample table" } },
    { id: "b7", type: "table", data: { headers: ["Feature", "Confluence", "Notion", "Edituh"], rows: [["Themes", "✅", "✅", "✅ 6 handcrafted"], ["Charts", "Add-on", "External", "Built-in"], ["Offline first", "—", "—", "✅"], ["Installable app", "—", "✅", "✅ macOS · iOS · Web"]] } },
    { id: "b8", type: "heading", data: { level: 2, text: "Charts" } },
    { id: "b9", type: "chart", data: { kind: "bar", title: "Monthly usage", labels: ["Jan", "Feb", "Mar", "Apr"], series: { "Pages": [12, 19, 24, 31], "Media": [4, 8, 9, 14] } } },
    { id: "b10", type: "heading", data: { level: 2, text: "Quotes & code" } },
    { id: "b11", type: "quote", data: { text: "The best documentation is the one people actually read — make it beautiful." } },
    { id: "b12", type: "code", data: { language: "python", text: "def hello():\n    print(\"Hello, Edituh!\")" } },
    { id: "b13", type: "divider", data: {} },
    { id: "b14", type: "paragraph", data: { text: "Enjoy exploring. Delete this page anytime — your next one is a keystroke away." } },
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docsRef = useRef<LocalDoc[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const pendingSavesRef = useRef<Map<string, LocalDoc>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<number | null>(null);
  const localTimerRef = useRef<number | null>(null);

  const active = useMemo(() => docs.find((d) => d.id === activeId) ?? null, [docs, activeId]);

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
      docsRef.current = next;
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
    [flushRemote, persistLocalSoon]
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
      const cleaned = title.trim() || "Untitled";
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
    (format: "markdown" | "html" | "json") => {
      const current = activeIdRef.current;
      const currentDoc = docsRef.current.find((d) => d.id === current);
      if (!currentDoc) return;
      api
        .exportDoc(currentDoc.doc, format)
        .then(() => toast("success", `Exported as ${format.toUpperCase()}`))
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
      } else if (key === "n") {
        e.preventDefault();
        createPage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createPage]);

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
          onTitle={handleTitle}
          onToggleOutline={() => setOutlineOpen((v) => !v)}
          onExport={exportDoc}
          onImportClick={() => fileInputRef.current?.click()}
          onCommandMenu={() => setCommandOpen(true)}
        />

        <div className="workspace">
          <div className="editor-scroll" style={settings.density === "compact" ? { paddingTop: 18 } : undefined}>
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
        </div>
      </div>

      <CommandMenu
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        docs={docs.map((d) => ({ id: d.id, title: d.doc.title }))}
        theme={theme}
        activeId={activeId}
        onNew={createPage}
        onSelectDoc={(id) => {
          commitActive(id);
        }}
        onTheme={setTheme}
        onExport={exportDoc}
        onImport={() => fileInputRef.current?.click()}
        onToggleOutline={() => setOutlineOpen((v) => !v)}
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onQuickTheme={quickTheme}
      />

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