// Page templates: an SVG background in page units plus the ruled baselines that recognition uses to find lines.
import { addDays, pad } from "./dates.js";

const GAP = 48;

function svg(height, body) {
  return `<svg viewBox="0 0 1000 ${height}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}
const rule = (y, x1 = 0, x2 = 1000, cls = "rule") => `<line class="${cls}" x1="${x1}" x2="${x2}" y1="${y}" y2="${y}"/>`;
const text = (x, y, s, cls = "lbl") => `<text class="${cls}" x="${x}" y="${y}">${s}</text>`;

// Day: a schedule from 07:00 to 22:00 on the first lines, then free notes.
export function dayTemplate() {
  const top = 100, lines = 26, baselines = [];
  let body = `<line class="margin" x1="78" x2="78" y1="${top - GAP}" y2="${top + (lines - 1) * GAP}"/>`;
  for (let k = 0; k < lines; k++) {
    const y = top + k * GAP; baselines.push(y);
    body += rule(y);
    if (k < 16) body += text(12, y - 14, `${pad(7 + k)}:00`);
    if (k === 16) body += text(12, y - 14, "✎", "lbl");
  }
  const height = top + lines * GAP;
  // slots[line] = hour of that schedule line; whatever is written there is an appointment or task.
  const slots = Array.from({ length: 16 }, (_, k) => 7 + k);
  return { height, baselines, slots, background: svg(height, body) };
}

// Week: seven day sections of three lines each.
export function weekTemplate(start, lang) {
  const head = 34, per = 3, baselines = [], days = [];
  let y = 20, body = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    days.push({ date: d, y });
    body += `<rect class="band" x="0" y="${y}" width="1000" height="${head}"/>`;
    body += text(14, y + 24, d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "short" }), "day");
    y += head;
    for (let k = 1; k <= per; k++) { baselines.push(y + k * GAP); body += rule(y + k * GAP); }
    y += per * GAP + 14;
  }
  return { height: y, baselines, days, background: svg(y, body) };
}

// A free notes page: just lines.
export function notesTemplate() {
  const top = 70, lines = 28, baselines = [];
  let body = "";
  for (let k = 0; k < lines; k++) { const y = top + k * GAP; baselines.push(y); body += rule(y); }
  const height = top + lines * GAP;
  return { height, baselines, background: svg(height, body) };
}

// Map a stroke's vertical centre to the ruled line it was written on.
export const lineFinder = baselines => y => {
  const i = baselines.findIndex(b => b >= y - 6);
  return i < 0 ? baselines.length - 1 : i;
};
