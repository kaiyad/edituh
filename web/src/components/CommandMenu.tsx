import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  CommandIcon,
  DownloadIcon,
  FileTextIcon,
  MoonIcon,
  OutlineIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  SidebarIcon,
  SparkIcon,
  SunIcon,
  UploadIcon,
} from "../lib/icons";
import { THEMES, THEME_NAMES } from "../lib/theme";
import type { DocJson, ThemeName } from "../lib/types";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  docs: { id: string; title: string }[];
  theme: ThemeName;
  activeId: string | null;
  onNew: () => void;
  onSelectDoc: (id: string) => void;
  onTheme: (theme: ThemeName) => void;
  onExport: (format: "markdown" | "html" | "json") => void;
  onImport: () => void;
  onToggleOutline: () => void;
  onToggleSidebar: () => void;
  onQuickTheme: () => void;
}

export function CommandMenu(props: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (props.open) {
      setQuery("");
      setSelected(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [props.open]);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [
      {
        id: "new",
        group: "Create",
        label: "New page",
        hint: "⌘N",
        icon: <PlusIcon size={15} />,
        run: () => {
          props.onNew();
          props.onClose();
        },
      },
      {
        id: "import",
        group: "Create",
        label: "Import Markdown file",
        icon: <UploadIcon size={15} />,
        run: () => {
          props.onImport();
          props.onClose();
        },
      },
      {
        id: "export-md",
        group: "Export",
        label: "Export as Markdown",
        icon: <FileTextIcon size={15} />,
        run: () => {
          props.onExport("markdown");
          props.onClose();
        },
      },
      {
        id: "export-html",
        group: "Export",
        label: "Export as HTML",
        icon: <SparkIcon size={15} />,
        run: () => {
          props.onExport("html");
          props.onClose();
        },
      },
      {
        id: "export-json",
        group: "Export",
        label: "Export as JSON",
        icon: <DownloadIcon size={15} />,
        run: () => {
          props.onExport("json");
          props.onClose();
        },
      },
      {
        id: "outline",
        group: "View",
        label: "Toggle document outline",
        icon: <OutlineIcon size={15} />,
        run: () => {
          props.onToggleOutline();
          props.onClose();
        },
      },
      {
        id: "sidebar",
        group: "View",
        label: "Toggle sidebar",
        icon: <SidebarIcon size={15} />,
        run: () => {
          props.onToggleSidebar();
          props.onClose();
        },
      },
      {
        id: "theme-quick",
        group: "Appearance",
        label: "Toggle light / dark theme",
        icon: <SunIcon size={15} />,
        run: () => {
          props.onQuickTheme();
          props.onClose();
        },
      },
      ...THEME_NAMES.map<Item>((name) => ({
        id: `theme-${name}`,
        group: "Appearance",
        label: `Theme: ${THEMES[name].name}`,
        hint: name === props.theme ? "Active" : undefined,
        icon: <PaletteIcon size={15} />,
        run: () => {
          props.onTheme(name);
          props.onClose();
        },
      })),
      ...props.docs.map<Item>((doc) => ({
        id: `doc-${doc.id}`,
        group: "Jump to page",
        label: doc.title || "Untitled",
        hint: doc.id === props.activeId ? "Current" : undefined,
        icon: <OutlineIcon size={15} />,
        run: () => {
          props.onSelectDoc(doc.id);
          props.onClose();
        },
      })),
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.docs, props.theme, props.activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => setSelected(0), [query]);

  if (!props.open) return null;

  return (
    <div className="command-overlay" onClick={props.onClose}>
      <div className="command-menu" onClick={(e) => e.stopPropagation()}>
        <div className="command-input-row">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            className="command-input"
            placeholder="Type a command or search pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && filtered[selected]) {
                e.preventDefault();
                filtered[selected].run();
              } else if (e.key === "Escape") {
                props.onClose();
              }
            }}
          />
          <kbd className="command-esc">esc</kbd>
        </div>
        <div className="command-list">
          {filtered.length === 0 && <div className="command-empty">No results</div>}
          {filtered.map((item, index) => {
            const showGroup = index === 0 || filtered[index - 1].group !== item.group;
            return (
              <div key={item.id}>
                {showGroup && <div className="command-group">{item.group}</div>}
                <button
                  className={`command-item ${index === selected ? "selected" : ""}`}
                  onMouseEnter={() => setSelected(index)}
                  onClick={item.run}
                >
                  <span className="command-item-icon">{item.icon}</span>
                  <span className="command-item-label">{item.label}</span>
                  {item.hint === "Active" && <CheckIcon size={14} className="command-item-check" />}
                  {item.hint && item.hint !== "Active" && <kbd>{item.hint}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="command-footer">
          <CommandIcon size={12} /> <span>Edituh commands</span>
        </div>
      </div>
    </div>
  );
}