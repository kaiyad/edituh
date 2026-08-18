import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { useEffect, useMemo, useState } from "react";
import { XIcon } from "../lib/icons";
import { buildGraph } from "../lib/links";
import type { DocJson } from "../lib/types";

interface Props {
  docs: { id: string; doc: DocJson }[];
  activeId: string | null;
  onOpenDoc: (id: string) => void;
  onClose: () => void;
}

type SimNode = SimulationNodeDatum & { id: string; title: string; daily: boolean; degree: number };
type SimLink = SimulationLinkDatum<SimNode>;

const W = 920;
const H = 620;

function linkEnd(edge: SimLink, key: "source" | "target"): string {
  const v = edge[key];
  return typeof v === "string" ? v : (v as SimNode | null)?.id ?? "";
}

export function GraphView({ docs, activeId, onOpenDoc, onClose }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [positions, setPositions] = useState<{ id: string; x: number; y: number }[]>([]);

  const { nodes, edges } = useMemo(() => buildGraph(docs), [docs]);

  const simNodes = useMemo<SimNode[]>(
    () => nodes.map((n) => ({ ...n, x: W / 2 + (Math.random() - 0.5) * 200, y: H / 2 + (Math.random() - 0.5) * 200 })),
    [nodes]
  );

  useEffect(() => {
    if (nodes.length === 0) return;
    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(edges as SimLink[])
          .id((d) => d.id)
          .distance(95)
          .strength(0.5)
      )
      .force("charge", forceManyBody<SimNode>().strength(-240))
      .force("center", forceCenter(W / 2, H / 2))
      .force("collide", forceCollide<SimNode>().radius((d) => 16 + Math.min(d.degree, 6) * 3).strength(0.9));

    const tick = () => {
      setPositions(simNodes.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 })));
    };
    sim.on("tick", tick);
    tick();
    return () => {
      sim.stop();
    };
  }, [simNodes, edges, nodes.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (nodes.length === 0) {
    return (
      <div className="graph-overlay" onClick={onClose}>
        <div className="graph-panel" onClick={(e) => e.stopPropagation()}>
          <div className="graph-head">
            <span>Knowledge graph</span>
            <button className="icon-btn" onClick={onClose}>
              <XIcon size={16} />
            </button>
          </div>
          <div className="graph-empty">
            <p>No links yet.</p>
            <p>
              Link pages with <code>[[Page name]]</code> to build your knowledge graph.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const posById = new Map(positions.map((p) => [p.id, p]));
  const hoverSet = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    for (const e of edges) {
      const s = linkEnd(e, "source");
      const t = linkEnd(e, "target");
      if (s === hover) set.add(t);
      if (t === hover) set.add(s);
    }
    return set;
  }, [hover, edges]);

  return (
    <div className="graph-overlay" onClick={onClose}>
      <div className="graph-panel" onClick={(e) => e.stopPropagation()}>
        <div className="graph-head">
          <span>
            Knowledge graph <span className="graph-count">{nodes.length} pages · {edges.length} links</span>
          </span>
          <div className="graph-head-actions">
            <span className="graph-legend">
              <span className="graph-legend-dot daily" /> daily note
            </span>
            <button className="icon-btn" onClick={onClose}>
              <XIcon size={16} />
            </button>
          </div>
        </div>
        <svg
          className="graph-svg"
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <marker id="graph-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="graph-arrow-head" />
            </marker>
          </defs>
          <g>
            {edges.map((edge, i) => {
              const s = linkEnd(edge, "source");
              const t = linkEnd(edge, "target");
              const a = posById.get(s);
              const b = posById.get(t);
              if (!a || !b) return null;
              const dimmed = hoverSet !== null && !(hoverSet.has(s) && hoverSet.has(t));
              return (
                <line
                  key={i}
                  className={`graph-edge ${dimmed ? "dimmed" : ""}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  markerEnd="url(#graph-arrow)"
                />
              );
            })}
          </g>
          <g>
            {nodes.map((node) => {
              const p = posById.get(node.id);
              if (!p) return null;
              const r = 10 + Math.min(node.degree, 6) * 2.2;
              const dimmed = hoverSet !== null && !hoverSet.has(node.id);
              const isActive = node.id === activeId;
              return (
                <g
                  key={node.id}
                  className={`graph-node ${dimmed ? "dimmed" : ""} ${node.daily ? "daily" : ""} ${isActive ? "active" : ""}`}
                  transform={`translate(${p.x},${p.y})`}
                  onMouseEnter={() => setHover(node.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDoc(node.id);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle r={r} className="graph-node-circle" />
                  <text className="graph-node-label" dy={r + 14} textAnchor="middle">
                    {node.title.length > 22 ? node.title.slice(0, 21) + "…" : node.title}
                  </text>
                  <title>{`${node.title}${node.daily ? " (daily note)" : ""}`}</title>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="graph-foot">Click a node to open the page · Esc to close</div>
      </div>
    </div>
  );
}