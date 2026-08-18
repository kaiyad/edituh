export type BlockType =
  | "paragraph"
  | "heading"
  | "bullet_list"
  | "numbered_list"
  | "checklist"
  | "quote"
  | "callout"
  | "code"
  | "table"
  | "divider"
  | "image"
  | "video"
  | "audio"
  | "chart"
  | "math"
  | "mermaid"
  | "file";

export interface BlockData {
  text?: string;
  level?: number;
  icon?: string;
  language?: string;
  items?: (string | [boolean, string])[];
  headers?: string[];
  rows?: string[][];
  src?: string;
  caption?: string;
  kind?: string;
  labels?: string[];
  series?: Record<string, number[]>;
  title?: string;
  latex?: string;
  code?: string;
  name?: string;
  size?: number;
}

export interface BlockJson {
  id: string;
  type: BlockType;
  data: BlockData;
}

export interface DocJson {
  title: string;
  blocks: BlockJson[];
}

export interface DocSummary {
  id: string;
  title: string;
  updated: string;
  blocks: number;
}

export interface ThemeDef {
  name: string;
  dark: boolean;
  vars: Record<string, string>;
}

export type ThemeName = "midnight" | "paper" | "sepia" | "nord" | "forest" | "ocean";

export interface Settings {
  theme: ThemeName;
  font: "inter" | "serif" | "mono";
  density: "comfortable" | "compact";
}