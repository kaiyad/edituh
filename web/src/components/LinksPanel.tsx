import { useMemo } from "react";
import { BacklinkIcon, LinkIcon } from "../lib/icons";
import { backlinksOf, outgoingLinksOf } from "../lib/links";
import type { DocJson } from "../lib/types";

interface Props {
  docs: { id: string; doc: DocJson }[];
  docId: string;
  onOpenById: (id: string) => void;
  onOpenByTitle: (title: string) => void;
}

export function LinksPanel({ docs, docId, onOpenById, onOpenByTitle }: Props) {
  const backlinks = useMemo(() => backlinksOf(docs, docId), [docs, docId]);
  const outgoing = useMemo(() => outgoingLinksOf(docs, docId), [docs, docId]);

  if (backlinks.length === 0 && outgoing.length === 0) {
    return (
      <aside className="links-panel">
        <div className="links-empty">
          <BacklinkIcon size={20} />
          <p>No links yet</p>
          <span>Write <code>[[Page name]]</code> anywhere to link pages — they'll show up here and in the graph.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="links-panel">
      {outgoing.length > 0 && (
        <div className="links-section">
          <div className="links-title">
            <LinkIcon size={13} /> Outgoing links
          </div>
          <div className="links-list">
            {outgoing.map((link, i) => (
              <button
                key={i}
                className={`links-item ${link.resolved ? "" : "unresolved"}`}
                onClick={() => onOpenByTitle(link.target)}
              >
                <span>{link.target}</span>
                {link.resolved ? <span className="links-check">✓</span> : <span className="links-missing">create</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {backlinks.length > 0 && (
        <div className="links-section">
          <div className="links-title">
            <BacklinkIcon size={13} /> Backlinks
          </div>
          <div className="links-list">
            {backlinks.map((link) => (
              <button key={link.id} className="links-item" onClick={() => onOpenById(link.id)}>
                <span>{link.title}</span>
                <span className="links-count">{link.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}