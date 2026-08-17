import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { blocksToDoc, docToBlocks } from "../lib/convert";
import { BulbIcon, ChartIcon } from "../lib/icons";
import type { DocJson } from "../lib/types";
import { schema, type EditorPartialBlock } from "./schema";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

export type EditorHandle = ReturnType<typeof useCreateBlockNote<{ schema: typeof schema }>>;

interface Props {
  doc: DocJson;
  docId: string;
  dark: boolean;
  onContentChange: (doc: DocJson) => void;
  onReady: (editor: EditorHandle) => void;
  onSaveRequest: () => void;
}

export function EdituhEditor({ doc, docId, dark, onContentChange, onReady, onSaveRequest }: Props) {
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const titleRef = useRef(doc.title);
  titleRef.current = doc.title;

  const editor = useCreateBlockNote(
    {
      schema,
      initialContent: docToBlocks(doc),
      uploadFile: async (file) => {
        try {
          return await api.uploadMedia(file);
        } catch {
          return "";
        }
      },
      animations: true,
    },
    [docId]
  );

  useEffect(() => {
    onReadyRef.current(editor);
  }, [editor, onReadyRef]);

  const serialize = useCallback((ed: EditorHandle) => {
    const converted = blocksToDoc(ed.document as never);
    return { ...converted, title: titleRef.current || "Untitled" };
  }, []);

  const insertBlock = useCallback(
    (type: "chart" | "callout") => {
      const pos = editor.getTextCursorPosition();
      const block = pos.block;
      const newBlock: EditorPartialBlock =
        type === "chart"
          ? { type: "chart", props: { kind: "bar", title: "", labels: "[]", series: "{}" } }
          : { type: "callout", props: { icon: "💡" }, content: "" };
      editor.replaceBlocks([block], [newBlock]);
    },
    [editor]
  );

  const customItems = [
    {
      title: "Chart",
      subtext: "Bar, line, area or scatter chart",
      aliases: ["graph", "plot", "data", "chart"],
      group: "Media",
      icon: <ChartIcon size={18} />,
      onItemClick: () => insertBlock("chart"),
    },
    {
      title: "Callout",
      subtext: "Highlight a note with an icon",
      aliases: ["note", "tip", "highlight", "callout"],
      group: "Basic blocks",
      icon: <BulbIcon size={18} />,
      onItemClick: () => insertBlock("callout"),
    },
  ];

  return (
    <BlockNoteView
      editor={editor}
      theme={dark ? "dark" : "light"}
      slashMenu={false}
      onChange={(ed) => {
        onContentChangeRef.current(serialize(ed));
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          onSaveRequest();
        }
      }}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        shouldOpen={(context) => {
          const from = context.selection?.$from;
          return !from?.parent.type.isInGroup("tableContent");
        }}
        getItems={async (query) => {
          const defaults = getDefaultReactSlashMenuItems(editor);
          return filterSuggestionItems([...defaults, ...customItems], query);
        }}
      />
    </BlockNoteView>
  );
}