import {
  CustomBlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
  type Block,
  type BlockSchemaFromSpecs,
  type DefaultInlineContentSchema,
  type DefaultStyleSchema,
  type PartialBlock,
} from "@blocknote/core";
import { calloutBlock, chartBlock } from "./blocks";

export const blockSpecs = {
  ...defaultBlockSpecs,
  chart: chartBlock(),
  callout: calloutBlock(),
};

export const inlineContentSpecs = defaultInlineContentSpecs;
export const styleSpecs = defaultStyleSpecs;

export type BSchema = BlockSchemaFromSpecs<typeof blockSpecs>;
export type Inline = DefaultInlineContentSchema;
export type Style = DefaultStyleSchema;

export const schema = new CustomBlockNoteSchema<BSchema, Inline, Style>({
  blockSpecs,
  inlineContentSpecs,
  styleSpecs,
});

export type EditorBlock = Block<BSchema, Inline, Style>;
export type EditorPartialBlock = PartialBlock<BSchema, Inline, Style>;