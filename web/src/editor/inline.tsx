import { createInlineContentSpec, defaultInlineContentSpecs } from "@blocknote/core";
import katex from "katex";

import "katex/dist/katex.min.css";

export const OPEN_DOC_EVENT = "edituh:open-doc";

export function emitOpenDoc(target: string) {
  window.dispatchEvent(new CustomEvent(OPEN_DOC_EVENT, { detail: target }));
}

function mathHtml(latex: string): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    return latex;
  }
}

export const mathInlineSpec = createInlineContentSpec(
  {
    type: "math",
    content: "none",
    propSchema: {
      latex: { default: "" },
    },
  },
  {
    render: (inlineContent) => {
      const dom = document.createElement("span");
      dom.className = "bn-math-inline";
      dom.innerHTML = mathHtml(inlineContent.props.latex ?? "");
      return { dom };
    },
    toExternalHTML: (inlineContent) => {
      const dom = document.createElement("span");
      dom.className = "math-inline";
      dom.innerHTML = mathHtml(inlineContent.props.latex ?? "");
      return { dom };
    },
  }
);

export const wikilinkSpec = createInlineContentSpec(
  {
    type: "wikilink",
    content: "styled",
    propSchema: {
      target: { default: "" },
    },
  },
  {
    render: (inlineContent, _updateInlineContent, _editor, _node, getPos) => {
      const dom = document.createElement("span");
      dom.className = "bn-wikilink";
      const contentDOM = document.createElement("span");
      contentDOM.className = "bn-wikilink-alias";
      const target = inlineContent.props.target ?? "";
      const alias = inlineContent.content.map((t) => t.text).join("") || target;
      contentDOM.textContent = alias;
      dom.dataset.target = target;
      dom.appendChild(contentDOM);
      const onClick = (e: MouseEvent) => {
        const pos = getPos();
        if (pos === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        emitOpenDoc(target);
      };
      dom.addEventListener("click", onClick);
      return { dom, contentDOM };
    },
    toExternalHTML: (inlineContent) => {
      const dom = document.createElement("a");
      dom.className = "wikilink";
      dom.href = `#/doc/${encodeURIComponent(inlineContent.props.target ?? "")}`;
      const alias = inlineContent.content.map((t) => t.text).join("") || inlineContent.props.target;
      dom.textContent = alias;
      return { dom };
    },
  }
);

export const inlineContentSpecs = {
  ...defaultInlineContentSpecs,
  math: mathInlineSpec,
  wikilink: wikilinkSpec,
};