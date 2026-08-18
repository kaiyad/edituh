import { useMemo, useState } from "react";
import {
  CalendarIcon,
  CopyIcon,
  DownloadIcon,
  InstallIcon,
  LogoMark,
  MoonIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  SunIcon,
  TrashIcon,
  XIcon,
} from "../lib/icons";
import { THEMES, THEME_NAMES } from "../lib/theme";
import type { DocJson, ThemeName } from "../lib/types";

interface DocEntry {
  id: string;
  updated: string;
  doc: DocJson;
}

interface Props {
  docs: DocEntry[];
  activeId: string | null;
  online: boolean;
  theme: ThemeName;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onToday: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onTheme: (theme: ThemeName) => void;
  onToggleCollapsed: () => void;
  installPrompt: () => void;
  canInstall: boolean;
}

function docEmoji(title: string): string {
  const t = title.trim();
  if (!t) return "📄";
  return ["📌", "📓", "📖", "✍️", "🗂️", "🧠", "🚀", "💡", "📊", "🧭"][t.charCodeAt(0) % 10];
}

export function Sidebar(props: Props) {
  const { docs, activeId, online, theme, collapsed } = props;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.doc.title.toLowerCase().includes(q) ||
        JSON.stringify(d.doc).toLowerCase().includes(q)
    );
  }, [docs, query]);

  const isDark = THEMES[theme].dark;

  if (collapsed) {
    return (
      <aside className="sidebar sidebar-collapsed">
        <button className="icon-btn sidebar-logo-btn" onClick={props.onToggleCollapsed} title="Expand sidebar">
          <LogoMark size={22} />
        </button>
        <button className="icon-btn" onClick={props.onNew} title="New page (⌘N)">
          <PlusIcon size={17} />
        </button>
        <div className="sidebar-collapsed-spacer" />
        <button className="icon-btn" onClick={props.onToggleCollapsed} title="Expand">
          <PaletteIcon size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="icon-btn" onClick={props.onToggleCollapsed} title="Collapse sidebar">
          <LogoMark size={22} />
        </button>
        <div className="sidebar-brand">
          <span className="sidebar-title">Edituh</span>
          <span className={`status-dot ${online ? "online" : "offline"}`} title={online ? "Connected" : "Offline — changes saved locally"}>
            {online ? "Cloud" : "Local"}
          </span>
        </div>
      </div>

      <button className="new-page-btn" onClick={props.onNew}>
        <PlusIcon size={16} />
        <span>New page</span>
        <kbd>⌘N</kbd>
      </button>

      <button className="new-page-btn today-btn" onClick={props.onToday}>
        <CalendarIcon size={15} />
        <span>Today's note</span>
        <kbd>⌘⇧N</kbd>
      </button>

      <div className="sidebar-search">
        <SearchIcon size={14} />
        <input
          placeholder="Search pages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
        />
        {query && (
          <button className="icon-btn icon-btn-xs" onClick={() => setQuery("")}>
            <XIcon size={12} />
          </button>
        )}
      </div>

      <div className="sidebar-section-label">{query ? "Results" : "Your pages"}</div>
      <div className="sidebar-list">
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            {query ? "No pages match your search" : "Nothing here yet — create your first page"}
          </div>
        )}
        {filtered.map((entry) => {
          const active = entry.id === activeId;
          const title = entry.doc.title || "Untitled";
          return (
            <div
              key={entry.id}
              className={`sidebar-item ${active ? "active" : ""}`}
              onClick={() => props.onSelect(entry.id)}
              title={title}
            >
              <span className="sidebar-item-emoji">{docEmoji(title)}</span>
              <span className="sidebar-item-title">{title}</span>
              <span className="sidebar-item-actions">
                <button
                  className="icon-btn icon-btn-xs"
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDuplicate(entry.id);
                  }}
                >
                  <CopyIcon size={12} />
                </button>
                <button
                  className="icon-btn icon-btn-xs danger"
                  title="Delete page"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
                      props.onDelete(entry.id);
                    }
                  }}
                >
                  <TrashIcon size={12} />
                </button>
              </span>
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="theme-grid">
          {THEME_NAMES.map((name) => (
            <button
              key={name}
              className={`theme-swatch ${name === theme ? "active" : ""}`}
              title={THEMES[name].name}
              onClick={() => props.onTheme(name)}
              style={{ background: THEMES[name].vars["--accent"] }}
            />
          ))}
        </div>
        <div className="sidebar-footer-row">
          {isDark ? (
            <span className="sidebar-footer-hint">
              <MoonIcon size={13} /> {THEMES[theme].name}
            </span>
          ) : (
            <span className="sidebar-footer-hint">
              <SunIcon size={13} /> {THEMES[theme].name}
            </span>
          )}
          <span className="sidebar-footer-spacer" />
          {props.canInstall && (
            <button className="icon-btn" onClick={props.installPrompt} title="Install Edituh as an app">
              <InstallIcon size={15} />
            </button>
          )}
          <button className="icon-btn" onClick={() => props.onTheme(isDark ? "paper" : "midnight")} title="Quick theme toggle">
            {isDark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>
        </div>
      </div>
    </aside>
  );
}