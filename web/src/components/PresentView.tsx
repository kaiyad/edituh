import { useCallback, useEffect, useMemo, useState } from "react";
import katex from "katex";
import mermaid from "mermaid";
import { blockToHtml, buildSlides } from "../lib/export";
import { ChartSvg, type ChartData } from "../lib/chart";
import { ChevronLeftIcon, ChevronRightIcon, PresentIcon, XIcon } from "../lib/icons";
import type { BlockJson, DocJson } from "../lib/types";

interface Props {
  doc: DocJson;
  onClose: () => void;
}

const CHART_KINDS = ["bar", "line", "area", "scatter"] as const;

let mermaidSeq = 0;

function mermaidTheme(): "dark" | "default" {
  const theme = document.documentElement.dataset.theme;
  const dark = theme === "midnight" || theme === "nord" || theme === "forest" || theme === "ocean";
  return dark ? "dark" : "default";
}

function ChartBlock({ block }: { block: BlockJson }) {
  const data = block.data ?? {};
  const chart: ChartData = {
    kind: CHART_KINDS.includes(data.kind as (typeof CHART_KINDS)[number])
      ? (data.kind as (typeof CHART_KINDS)[number])
      : "bar",
    title: data.title ?? "",
    labels: Array.isArray(data.labels) ? data.labels : [],
    series:
      typeof data.series === "object" && data.series !== null && !Array.isArray(data.series)
        ? (data.series as Record<string, number[]>)
        : {},
  };
  return <ChartSvg data={chart} />;
}

function MathBlock({ block }: { block: BlockJson }) {
  const latex = String(block.data?.latex ?? "");
  const html = useMemo(
    () => katex.renderToString(latex, { throwOnError: false, displayMode: true }),
    [latex]
  );
  if (!latex) return null;
  return <div className="math-output" dangerouslySetInnerHTML={{ __html: html }} />;
}

function MermaidBlock({ block }: { block: BlockJson }) {
  const code = String(block.data?.code ?? "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setSvg("");
      setError("");
      return;
    }
    const id = `present-mermaid-${++mermaidSeq}`;
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

  if (error) return <pre className="mermaid-error">{error}</pre>;
  if (!svg) return null;
  return <div className="mermaid-output" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function SlideBlock({ block }: { block: BlockJson }) {
  if (block.type === "chart") return <ChartBlock block={block} />;
  if (block.type === "math") return <MathBlock block={block} />;
  if (block.type === "mermaid") return <MermaidBlock block={block} />;
  return <div dangerouslySetInnerHTML={{ __html: blockToHtml(block) }} />;
}

export function PresentView({ doc, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  const slides = useMemo(() => buildSlides(doc).slides, [doc]);
  const total = slides.length;

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)));
    },
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(total - 1);
      } else if (e.key.toLowerCase() === "n") {
        setShowNotes((v) => !v);
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key.toLowerCase() === "f") {
        void document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, total, onClose]);

  if (total === 0) return null;
  const slide = slides[index];

  return (
    <div className="present-overlay">
      <div className="present-stage">
        {slides.map((s, i) => (
          <div key={i} className={`present-slide ${i === index ? "active" : ""}`}>
            <div className="present-slide-inner">
              {s.blocks.map((block) => (
                <SlideBlock key={block.id} block={block} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="present-ui">
        <button className="present-btn" onClick={() => step(-1)} title="Previous (←)">
          <ChevronLeftIcon size={18} />
        </button>
        <span className="present-counter">
          {index + 1} / {total}
        </span>
        <button className="present-btn" onClick={() => step(1)} title="Next (→)">
          <ChevronRightIcon size={18} />
        </button>
        <span className="present-sep" />
        <button className="present-btn" onClick={() => setShowNotes((v) => !v)} title="Presenter notes (N)">
          <PresentIcon size={17} />
        </button>
        <button className="present-btn" onClick={onClose} title="Exit (Esc)">
          <XIcon size={17} />
        </button>
      </div>

      {showNotes && (
        <div className="present-notes">
          <div className="present-notes-label">Presenter notes</div>
          {slide.notes.length > 0 ? (
            <ul>
              {slide.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="present-notes-empty">No notes for this slide. Add a callout with 📝 or 🎙️ icon.</p>
          )}
          <div className="present-notes-next">
            {index + 1 < total && (
              <>
                <strong>Next:</strong> {slides[index + 1].blocks[0]?.data?.text ?? ""}
              </>
            )}
          </div>
        </div>
      )}

      <div className="present-progress">
        <div className="present-progress-bar" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}