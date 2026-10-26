// Date helpers. Pages are keyed by local dates: day:2026-10-26, week:2026-W44, month:2026-10.
export const pad = n => String(n).padStart(2, "0");
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

// Monday-based weeks, ISO 8601 numbering.
export function monday(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - y0) / 864e5 + 1) / 7) };
}
export function weekKey(d) { const w = isoWeek(d); return `${w.year}-W${pad(w.week)}`; }
export function weekStart(key) {
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(y, 0, 4);
  return addDays(monday(jan4), (w - 1) * 7);
}

export function fmt(d, opts, lang) { return d.toLocaleDateString(lang, opts); }
export const sameDay = (a, b) => iso(a) === iso(b);
