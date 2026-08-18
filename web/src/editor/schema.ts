import {
  CustomBlockNoteSchema,
  defaultBlockSpecs,
  defaultStyleSpecs,
  type Block,
  type BlockSchemaFromSpecs,
  type InlineContentSchemaFromSpecs,
  type PartialBlock,
  type StyleSchemaFromSpecs,
} from "@blocknote/core";
import { calloutBlock, chartBlock, mathBlock, mermaidBlock } from "./blocks";
import { inlineContentSpecs } from "./inline";

export const blockSpecs = {
  ...defaultBlockSpecs,
  chart: chartBlock(),
  callout: calloutBlock(),
  math: mathBlock(),
  mermaid: mermaidBlock(),
};

export const styleSpecs = defaultStyleSpecs;

export type BSchema = BlockSchemaFromSpecs<typeof blockSpecs>;
export type Inline = InlineContentSchemaFromSpecs<typeof inlineContentSpecs>;
export type Style = StyleSchemaFromSpecs<typeof styleSpecs>;

export const schema = new CustomBlockNoteSchema<BSchema, Inline, Style>({
  blockSpecs,
  inlineContentSpecs,
  styleSpecs,
});

export type EditorBlock = Block<BSchema, Inline, Style>;
export type EditorPartialBlock = PartialBlock<BSchema, Inline, Style>;