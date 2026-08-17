import { useMemo, useState } from "react";
import { headingTree } from "../lib/convert";
import { ClockIcon, FileTextIcon, XIcon } from "../lib/icons";
import type { DocJson } from "../lib/types";

interface Props {
  doc: DocJson;
  onJump: (id: string) => void;
  onClose: () => void;
}

export function OutlinePanel({ doc, onJump, onClose }: Props) {
  const [query, setQuery] = useState("");
  const headings = useMemo(() => headingTree(doc.blocks), [doc]);
  const words = useMemo(() => {
    let count = 0;
    for (const b of doc.blocks) {
      let text = "";
      const data = b.data ?? {};
      if (b.type === "bullet_list" || b.type === "numbered_list") text = (data.items ?? []).map(String).join(" ");
      else if (b.type === "checklist") text = (data.items ?? []).map((i) => (Array.isArray(i) ? i[1] : String(i))).join(" ");
      else if (b.type === "table") text = [...(data.headers ?? []), ...(data.rows ?? []).flat()].join(" ");
      else text = data.text ?? "";
      count += text.split(/\s+/).filter(Boolean).length;
    }
    return count;
  }, [doc]);

  const filtered = headings.filter((h) => h.text.toLowerCase().includes(query.toLowerCase()));

  return (
    <aside className="outline-panel">
      <div className="outline-head">
        <span className="outline-title">Outline</span>
        <button className="icon-btn icon-btn-xs" onClick={onClose} title="Close outline">
          <XIcon size={13} />
        </button>
      </div>
      <input
        className="outline-search"
        placeholder="Filter headings"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="outline-list">
        {filtered.length === 0 && <div className="outline-empty">No headings yet</div>}
        {filtered.map((h) => (
          <button
            key={h.id}
            className="outline-item"
            style={{ paddingLeft: 10 + (h.level - 1) * 14 }}
            onClick={() => onJump(h.id)}
            title={h.text}
          >
            <span className="outline-dot" style={{ opacity: Math.max(0.25, 1 - (h.level - 1) * 0.2) }} />
            <span className="outline-item-text">{h.text || "Untitled heading"}</span>
          </button>
        ))}
      </div>
      <div className="outline-stats">
        <span title="Blocks">
          <FileTextIcon size={12} /> {doc.blocks.length}
        </span>
        <span title="Words">
          <span style={{ fontWeight: 600 }}>{words}</span> words
        </span>
        <span title="Last updated" className="outline-clock">
          <ClockIcon size={12} /> on device
        </span>
      </div>
    </aside>
  );
}