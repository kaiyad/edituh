import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CommandIcon,
  DownloadIcon,
  FileTextIcon,
  MoreIcon,
  OutlineIcon,
  SparkIcon,
  UploadIcon,
} from "../lib/icons";

interface Props {
  title: string;
  dirty: boolean;
  saving: boolean;
  online: boolean;
  outlineOpen: boolean;
  onTitle: (title: string) => void;
  onToggleOutline: () => void;
  onExport: (format: "markdown" | "html" | "json") => void;
  onImportClick: () => void;
  onCommandMenu: () => void;
}

export function Header(props: Props) {
  const [menuOpen, setMenuOpen] = useState<"export" | "more" | null>(null);

  const status = props.online ? (props.saving ? "Saving…" : props.dirty ? "Unsaved changes" : "Saved") : "Offline mode";

  const exportDoc = (format: "markdown" | "html" | "json") => {
    setMenuOpen(null);
    props.onExport(format);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="icon-btn" onClick={props.onCommandMenu} title="Command menu (⌘K)">
          <CommandIcon size={16} />
        </button>
        <div className="header-breadcrumb">
          <span className="header-breadcrumb-root">Edituh</span>
          <ChevronRightIcon size={13} />
          <input
            className="header-title-input"
            value={props.title}
            placeholder="Untitled"
            onChange={(e) => props.onTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="header-right">
        <span className={`save-status ${props.online ? "" : "offline"}`} title={status}>
          <span className={`save-dot ${props.dirty && props.online ? "dirty" : ""}`} />
          {status}
        </span>

        <button
          className={`icon-btn ${props.outlineOpen ? "active" : ""}`}
          onClick={props.onToggleOutline}
          title="Toggle outline"
        >
          <OutlineIcon size={16} />
        </button>

        <div className="menu-wrap">
          <button
            className="btn btn-ghost"
            onClick={() => {
              setMenuOpen(menuOpen === "export" ? null : "export");
            }}
          >
            <DownloadIcon size={15} />
            <span>Export</span>
            <ChevronDownIcon size={12} />
          </button>
          {menuOpen === "export" && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(null)} />
              <div className="menu menu-anchor-right">
                <div className="menu-label">Export as</div>
                <button className="menu-item" onClick={() => exportDoc("markdown")}>
                  <FileTextIcon size={15} />
                  <span>Markdown</span>
                  <kbd>.md</kbd>
                </button>
                <button className="menu-item" onClick={() => exportDoc("html")}>
                  <SparkIcon size={15} />
                  <span>HTML document</span>
                  <kbd>.html</kbd>
                </button>
                <button className="menu-item" onClick={() => exportDoc("json")}>
                  <DownloadIcon size={15} />
                  <span>JSON document</span>
                  <kbd>.json</kbd>
                </button>
              </div>
            </>
          )}
        </div>

        <button className="btn btn-ghost" onClick={props.onImportClick} title="Import a Markdown file">
          <UploadIcon size={15} />
          <span>Import</span>
        </button>

        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenuOpen(menuOpen === "more" ? null : "more")}>
            <MoreIcon size={16} />
          </button>
          {menuOpen === "more" && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(null)} />
              <div className="menu menu-anchor-right">
                <button className="menu-item" onClick={props.onCommandMenu}>
                  <CommandIcon size={15} />
                  <span>Command menu</span>
                  <kbd>⌘K</kbd>
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(null);
                    props.onToggleOutline();
                  }}
                >
                  <OutlineIcon size={15} />
                  <span>{props.outlineOpen ? "Hide outline" : "Show outline"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}