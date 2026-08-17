import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useState } from "react";
import { BulbIcon, ChartIcon, EditIcon } from "../lib/icons";
import { ChartSvg, chartToCsv, parseChartData, type ChartData } from "../lib/chart";

const CHART_KINDS = ["bar", "line", "area", "scatter"] as const;

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

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
};