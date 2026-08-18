export function todayTitle(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDailyTitle(title: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(title.trim());
}

export function findDocByTitle(docs: { id: string; doc: { title: string } }[], title: string) {
  const t = title.trim().toLowerCase();
  return docs.find((d) => d.doc.title.trim().toLowerCase() === t) ?? null;
}

export function findTodayDoc(docs: { id: string; doc: { title: string } }[]): { id: string; doc: { title: string } } | null {
  return findDocByTitle(docs, todayTitle());
}

export function formatDailyHeader(title: string): string {
  const match = title.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return title;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  return `${y}-${m}-${d} · ${weekday}`;
}