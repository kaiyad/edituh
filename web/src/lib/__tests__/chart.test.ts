import { describe, expect, it } from "vitest";
import { chartToCsv, parseChartData } from "../chart";

describe("parseChartData", () => {
  it("parses header + rows", () => {
    const { labels, series } = parseChartData("Label,Pages,Media\nJan,12,4\nFeb,19,8");
    expect(labels).toEqual(["Jan", "Feb"]);
    expect(series).toEqual({ Pages: [12, 19], Media: [4, 8] });
  });

  it("handles a header with a single label column (series named Value)", () => {
    const { labels, series } = parseChartData("Value\nQ1, 10\nQ2, 20");
    expect(labels).toEqual(["Q1", "Q2"]);
    expect(series).toEqual({ Value: [10, 20] });
  });

  it("coerces invalid numbers to zero", () => {
    const { series } = parseChartData("Label,A\nx,abc");
    expect(series.A).toEqual([0]);
  });

  it("ignores blank lines", () => {
    const { labels } = parseChartData("\n\nLabel,Value\nA,1\n\nB,2\n");
    expect(labels).toEqual(["A", "B"]);
  });
});

describe("chartToCsv round-trip", () => {
  it("round-trips through parseChartData", () => {
    const data = {
      kind: "bar" as const,
      title: "Usage",
      labels: ["Jan", "Feb"],
      series: { Pages: [12, 19], Media: [4, 8] },
    };
    const parsed = parseChartData(chartToCsv(data));
    expect(parsed.labels).toEqual(data.labels);
    expect(parsed.series).toEqual(data.series);
  });
});