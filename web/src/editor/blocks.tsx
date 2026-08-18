import { createReactBlockSpec } from "@blocknote/react";
import katex from "katex";
import mermaid from "mermaid";
import { useEffect, useState } from "react";
import { BulbIcon, ChartIcon, EditIcon, MermaidIcon, SigmaIcon } from "../lib/icons";
import { ChartSvg, chartToCsv, parseChartData, type ChartData } from "../lib/chart";

import "katex/dist/katex.min.css";

mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "base" });

function mermaidTheme(): "dark" | "default" {
  const theme = document.documentElement.dataset.theme;
  const dark = theme === "midnight" || theme === "nord" || theme === "forest" || theme === "ocean";
  return dark ? "dark" : "default";
}

const CHART_KINDS = ["bar", "line", "area", "scatter"] as const;

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mathHtml(latex: string): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: true });
  } catch {
    return latex;
  }
}

export const mathBlock = createReactBlockSpec(
  {
    type: "math",
    propSchema: {
      latex: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const [editing, setEditing] = useState(false);
      const [draft, setDraft] = useState("");
      const props = (block.props ?? {}) as { latex?: string };
      const latex = props.latex ?? "";

      useEffect(() => {
        if (editing) setDraft(latex);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editing]);

      return (
        <div className="math-card" onClick={() => !latex && setEditing(true)}>
          <div className="math-head">
            <SigmaIcon size={14} />
            <span className="math-label">LaTeX</span>
            <button
              className="icon-btn chart-edit"
              onClick={() => setEditing((v) => !v)}
              title={editing ? "Done editing" : "Edit LaTeX"}
            >
              {editing ? <span className="chart-done">Done</span> : <EditIcon size={14} />}
            </button>
          </div>
          {editing ? (
            <textarea
              className="math-input"
              rows={3}
              value={draft}
              placeholder="e.g. E = mc^2"
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                setEditing(false);
                editor.updateBlock(block, { props: { latex: draft } });
              }}
            />
          ) : latex ? (
            <div
              className="math-output"
              dangerouslySetInnerHTML={{ __html: mathHtml(latex) }}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            />
          ) : (
            <div className="chart-empty">
              <SigmaIcon size={22} />
              <span>Add math (LaTeX)</span>
            </div>
          )}
        </div>
      );
    },
  }
);

let mermaidSeq = 0;

export const mermaidBlock = createReactBlockSpec(
  {
    type: "mermaid",
    propSchema: {
      code: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const [editing, setEditing] = useState(false);
      const [draft, setDraft] = useState("");
      const [svg, setSvg] = useState("");
      const [error, setError] = useState("");
      const props = (block.props ?? {}) as { code?: string };
      const code = props.code ?? "";

      useEffect(() => {
        let cancelled = false;
        if (!code) {
          setSvg("");
          setError("");
          return;
        }
        const id = `edituh-mermaid-${++mermaidSeq}`;
        mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: mermaidTheme() });
        mermaid
          .render(id, code)
          .then(({ svg: rendered }) => {
            if (!cancelled) {
              setSvg(rendered);
              setError("");
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) setError(err instanceof Error ? err.message : "Invalid diagram");
          });
        return () => {
          cancelled = true;
        };
      }, [code]);

      useEffect(() => {
        if (editing) setDraft(code);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editing]);

      return (
        <div className="mermaid-card" onClick={() => !code && setEditing(true)}>
          <div className="mermaid-head">
            <MermaidIcon size={14} />
            <span className="math-label">Diagram</span>
            <button
              className="icon-btn chart-edit"
              onClick={() => setEditing((v) => !v)}
              title={editing ? "Done editing" : "Edit diagram"}
            >
              {editing ? <span className="chart-done">Done</span> : <EditIcon size={14} />}
            </button>
          </div>
          {editing ? (
            <textarea
              className="mermaid-input"
              rows={5}
              value={draft}
              placeholder={"flowchart TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]"}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                setEditing(false);
                editor.updateBlock(block, { props: { code: draft } });
              }}
            />
          ) : error ? (
            <div className="mermaid-error" onClick={(e) => e.stopPropagation()}>
              <span>Diagram error</span>
              <code>{error}</code>
            </div>
          ) : svg ? (
            <div className="mermaid-output" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="chart-empty">
              <MermaidIcon size={22} />
              <span>Add a diagram (Mermaid)</span>
            </div>
          )}
        </div>
      );
    },
  }
);

export const chartBlock = createReactBlockSpec(
  {
    type: "chart",
    propSchema: {
      kind: { default: "bar" },
      title: { default: "" },
      labels: { default: "[]" },
      series: { default: "{}" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const [editing, setEditing] = useState(false);
      const [draft, setDraft] = useState("");
      const props = (block.props ?? {}) as {
        kind?: string;
        title?: string;
        labels?: string;
        series?: string;
      };

      const data: ChartData = {
        kind: CHART_KINDS.includes(props.kind as (typeof CHART_KINDS)[number])
          ? (props.kind as (typeof CHART_KINDS)[number])
          : "bar",
        title: props.title ?? "",
        labels: parseJson<string[]>(props.labels, []),
        series: parseJson<Record<string, number[]>>(props.series, {}),
      };
      const hasData = data.labels.length > 0 && Object.keys(data.series).length > 0;

      useEffect(() => {
        if (editing) setDraft(chartToCsv(data));
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [editing]);

      const apply = (next: Partial<ChartData>) => {
        editor.updateBlock(block, {
          props: {
            kind: next.kind ?? data.kind,
            title: next.title ?? data.title,
            labels: JSON.stringify(next.labels ?? data.labels),
            series: JSON.stringify(next.series ?? data.series),
          },
        });
      };

      const commitDraft = () => {
        const parsed = parseChartData(draft);
        apply({ labels: parsed.labels, series: parsed.series });
      };

      return (
        <div className="chart-card">
          <div className="chart-head">
            {data.title ? <span className="chart-title">{data.title}</span> : <span className="chart-title chart-title-empty">Chart</span>}
            <button
              className="icon-btn chart-edit"
              onClick={() => setEditing((v) => !v)}
              title={editing ? "Done editing" : "Edit chart data"}
            >
              {editing ? <span className="chart-done">Done</span> : <EditIcon size={14} />}
            </button>
          </div>
          {hasData ? (
            <ChartSvg data={data} />
          ) : (
            <div className="chart-empty" onClick={() => setEditing(true)}>
              <ChartIcon size={22} />
              <span>Add chart data</span>
            </div>
          )}
          {editing && (
            <div className="chart-editor" onClick={(e) => e.stopPropagation()}>
              <div className="chart-editor-row">
                <input
                  className="chart-input"
                  placeholder="Chart title"
                  value={data.title ?? ""}
                  onChange={(e) => apply({ title: e.target.value })}
                />
                <select
                  className="chart-input chart-kind"
                  value={data.kind}
                  onChange={(e) => apply({ kind: e.target.value as ChartData["kind"] })}
                >
                  {CHART_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k[0].toUpperCase() + k.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chart-editor-label">Data — first line: label, series&hellip;</div>
              <textarea
                className="chart-input chart-data"
                rows={4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
              />
              {!hasData && <div className="chart-editor-label">Format: <code>Q1, 10, 20</code> per line</div>}
            </div>
          )}
        </div>
      );
    },
  }
);

export const calloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      icon: { default: "💡" },
    },
    content: "inline",
  },
  {
    render: ({ block, contentRef }) => {
      const props = (block.props ?? {}) as { icon?: string };
      return (
        <div className="callout-block">
          <span className="callout-icon">{props.icon ?? "💡"}</span>
          <div className="callout-content" ref={contentRef} />
        </div>
      );
    },
  }
);

export const BLOCK_ICONS: Record<string, React.FC<{ size?: number }>> = {
  chart: ChartIcon,
  callout: BulbIcon,
  math: SigmaIcon,
  mermaid: MermaidIcon,
};