const CHART_COLORS = ["#4f8bf9", "#ff6b6b", "#ffd93d", "#6bcb77", "#9b5de5", "#00bbf9", "#f15bb5"];

export interface ChartData {
  kind: "line" | "bar" | "area" | "scatter";
  title?: string;
  labels: string[];
  series: Record<string, number[]>;
}

export function parseChartData(text: string): { labels: string[]; series: Record<string, number[]> } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { labels: [], series: {} };
  const header = lines[0].split(",").map((p) => p.trim());
  const names = header.slice(1).length ? header.slice(1) : ["Value"];
  const labels: string[] = [];
  const series: Record<string, number[]> = {};
  for (const name of names) series[name] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 2) continue;
    labels.push(parts[0]);
    names.forEach((name, index) => {
      const raw = parts[index + 1] ?? "0";
      const value = Number.parseFloat(raw);
      series[name].push(Number.isFinite(value) ? value : 0);
    });
  }
  return { labels, series };
}

export function chartToCsv(data: ChartData): string {
  const names = Object.keys(data.series);
  const rows = [["Label", ...names].join(",")];
  data.labels.forEach((label, i) => {
    rows.push([label, ...names.map((n) => String(data.series[n]?.[i] ?? 0))].join(","));
  });
  return rows.join("\n");
}

export function ChartSvg({
  data,
  width = 680,
  height = 360,
  className,
}: {
  data: ChartData;
  width?: number;
  height?: number;
  className?: string;
}) {
  const { labels, series } = data;
  const padding = 46;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const allValues = Object.values(series).flat();
  const maxValue = allValues.length ? Math.max(...allValues) : 1;
  const minValue = Math.min(0, ...allValues);
  const span = Math.max(maxValue - minValue, 1);
  const xAt = (index: number) =>
    labels.length <= 1 ? padding + plotWidth / 2 : padding + (plotWidth * index) / (labels.length - 1);
  const yAt = (value: number) => padding + plotHeight - (plotHeight * (value - minValue)) / span;
  const seriesNames = Object.keys(series);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: "100%", height: "auto" }}
      role="img"
      aria-label={data.title || "Chart"}
    >
      {[0, 1, 2, 3, 4].map((step) => {
        const ratio = step / 4;
        const value = minValue + span * ratio;
        const y = yAt(value);
        return (
          <g key={step}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--chart-grid, #3a4355)" strokeWidth="1" />
            <text x="4" y={y + 4} fontSize="11" fill="var(--chart-text, #8b949e)">
              {value.toFixed(1)}
            </text>
          </g>
        );
      })}
      {labels.map((label, index) => (
        <text key={index} x={xAt(index)} y={height - 12} fontSize="11" fill="var(--chart-text, #8b949e)" textAnchor="middle">
          {label}
        </text>
      ))}
      {seriesNames.map((name, si) => {
        const values = series[name];
        const color = CHART_COLORS[si % CHART_COLORS.length];
        const points = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
        if (data.kind === "bar") {
          const barWidth = (plotWidth / Math.max(labels.length, 1)) * (0.6 / Math.max(seriesNames.length, 1));
          return (
            <g key={name}>
              {values.map((value, i) => {
                const x = xAt(i) - (barWidth * seriesNames.length) / 2 + si * barWidth;
                const bh = value >= 0 ? Math.max((plotHeight * value) / span, 2) : 2;
                const y = value >= 0 ? yAt(value) : yAt(0);
                return <rect key={i} x={x} y={y} width={barWidth} height={bh} fill={color} rx="3" />;
              })}
            </g>
          );
        }
        if (data.kind === "area") {
          const areaPoints = `${points} ${xAt(values.length - 1).toFixed(1)},${yAt(0).toFixed(1)} ${xAt(0).toFixed(1)},${yAt(0).toFixed(1)}`;
          return (
            <g key={name}>
              <polygon points={areaPoints} fill={color} opacity="0.22" />
              <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" />
            </g>
          );
        }
        if (data.kind === "scatter") {
          return (
            <g key={name}>
              {values.map((v, i) => (
                <circle key={i} cx={xAt(i)} cy={yAt(v)} r="4.5" fill={color} />
              ))}
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" />
            </g>
          );
        }
        return <polyline key={name} points={points} fill="none" stroke={color} strokeWidth="2.5" />;
      })}
      {seriesNames.length > 1 &&
        seriesNames.map((name, si) => (
          <text key={name} x={padding} y={padding - 8 - si * 16} fontSize="11" fill={CHART_COLORS[si % CHART_COLORS.length]}>
            {name}
          </text>
        ))}
    </svg>
  );
}