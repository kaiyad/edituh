import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { AttachIcon, CalendarIcon, CheckIcon, FileIcon, ImageIcon, TrashIcon, XIcon } from "../lib/icons";
import { formatDailyHeader, isDailyTitle, todayTitle } from "../lib/daily";
import type { DocJson } from "../lib/types";

interface CaptureAttachment {
  name: string;
  kind: "image" | "file";
  url: string;
  size: number;
}

export const CAPTURE_TODAY = "__today__";

interface Props {
  open: boolean;
  docs: { id: string; doc: DocJson }[];
  todayDocId: string | null;
  onCapture: (targetId: string, text: string, attachments: CaptureAttachment[]) => void;
  onClose: () => void;
}

export function QuickCapture({ open, docs, todayDocId, onCapture, onClose }: Props) {
  const [text, setText] = useState("");
  const [targetId, setTargetId] = useState<string>(todayDocId ?? CAPTURE_TODAY);
  const [attachments, setAttachments] = useState<CaptureAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setAttachments([]);
      setTargetId(todayDocId ?? CAPTURE_TODAY);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (todayDocId) setTargetId(todayDocId);
  }, [todayDocId]);

  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void upload([file]);
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const upload = async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        const url = await api.uploadMedia(file);
        const kind = file.type.startsWith("image/") ? "image" : "file";
        setAttachments((prev) => [...prev, { name: file.name, kind, url, size: file.size }]);
      }
    } finally {
      setUploading(false);
    }
  };

  const todayTitleText = todayTitle();

  if (!open) return null;

  const capture = () => {
    if (!targetId) return;
    if (!text.trim() && attachments.length === 0) return;
    onCapture(targetId, text.trim(), attachments);
    onClose();
  };

  return (
    <div className="capture-overlay" onClick={onClose}>
      <div className="capture-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="capture-head">
          <span className="capture-title">Quick capture</span>
          <button className="icon-btn" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>

        <textarea
          ref={inputRef}
          className="capture-input"
          placeholder="Capture a thought… (paste ⌘V an image, or drop a file)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") capture();
          }}
        />

        {attachments.length > 0 && (
          <div className="capture-attachments">
            {attachments.map((a, i) => (
              <div key={i} className="capture-attachment">
                {a.kind === "image" ? <ImageIcon size={14} /> : <FileIcon size={14} />}
                <span className="capture-attachment-name">{a.name}</span>
                <button
                  className="icon-btn icon-btn-xs"
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="capture-targets">
          <div className="capture-targets-label">Capture into</div>
          <button
            className={`capture-target ${(todayDocId ?? CAPTURE_TODAY) === targetId ? "active" : ""}`}
            onClick={() => setTargetId(todayDocId ?? CAPTURE_TODAY)}
          >
            <CalendarIcon size={14} />
            <span>Today · {formatDailyHeader(todayTitleText)}</span>
            {(todayDocId ?? CAPTURE_TODAY) === targetId && <CheckIcon size={13} />}
          </button>
          {docs
            .filter((d) => d.id !== todayDocId && !isDailyTitle(d.doc.title))
            .slice(0, 8)
            .map((d) => (
              <button
                key={d.id}
                className={`capture-target ${d.id === targetId ? "active" : ""}`}
                onClick={() => setTargetId(d.id)}
              >
                <FileIcon size={14} />
                <span>{d.doc.title || "Untitled"}</span>
                {d.id === targetId && <CheckIcon size={13} />}
              </button>
            ))}
        </div>

        <div className="capture-foot">
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <AttachIcon size={15} />
            {uploading ? "Uploading…" : "Attach file"}
          </button>
          <button className="btn btn-primary" onClick={capture} disabled={(!text.trim() && attachments.length === 0) || !targetId}>
            Capture
            <kbd>⌘↵</kbd>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={async (e) => {
            const files = e.target.files;
            if (files) await upload(Array.from(files));
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}