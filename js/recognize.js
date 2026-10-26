// Handwriting recognition from pen strokes.
// Whole lines come back truncated after a few words, so a page is split into lines (by the ruling) and lines into
// words (by horizontal gaps), and each word is recognised on its own. Accents and dots are kept out of the gap test
// and attached to the nearest word afterwards.
import { rerank } from "./lexicon.js";

// Gaps and accent sizes scale with the writing: measured against the median stroke height on the page
// (tuned on a Greek sample: a word gap is ~1.35 stroke heights, accents and dots are under ~0.55).
const GAP_RATIO = 1.35, MARK_RATIO = 0.55;

// Engine: Google's handwriting endpoint used by Google Translate / Input Tools.
// It is free and supports Greek, but it is not an official API and may change; see README.
const ENDPOINT = "https://inputtools.google.com/request?ime=handwriting&app=translate&cs=1&oe=UTF-8";

async function engine(strokes, language) {
  const pts = strokes.flatMap(s => s.pts);
  const x0 = Math.min(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), t0 = Math.min(...pts.map(p => p[2]));
  const ink = strokes.map(s => [s.pts.map(p => Math.round(p[0] - x0)), s.pts.map(p => Math.round(p[1] - y0)), s.pts.map(p => p[2] - t0)]);
  const body = { requests: [{ writing_guide: { writing_area_width: Math.round(Math.max(...pts.map(p => p[0])) - x0) || 1, writing_area_height: Math.round(Math.max(...pts.map(p => p[1])) - y0) || 1 }, ink, language }] };
  const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
  if (r[0] !== "SUCCESS") throw new Error("recognition failed");
  return r[1][0][1];
}

const box = s => {
  const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]);
  return { a: Math.min(...xs), b: Math.max(...xs), top: Math.min(...ys), bot: Math.max(...ys) };
};
function median(xs) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; }

// Split strokes into words. `lineOf(y)` maps a stroke's vertical centre to a ruled line of the template.
export function segment(strokes, lineOf) {
  const h = median(strokes.map(s => box(s)).map(k => k.bot - k.top).filter(v => v > 4)) || 16;
  const WORD_GAP = GAP_RATIO * h, MARK_SIZE = MARK_RATIO * h;
  const isMark = s => { const k = box(s); return Math.max(k.b - k.a, k.bot - k.top) <= MARK_SIZE; };
  const words = [];
  const byLine = new Map();
  for (const s of strokes.filter(s => !isMark(s))) {
    const k = box(s), line = lineOf((k.top + k.bot) / 2);
    (byLine.get(line) || byLine.set(line, []).get(line)).push(s);
  }
  for (const [line, ss] of byLine) {
    let w = null;
    for (const s of ss.sort((p, q) => box(p).a - box(q).a)) {
      const k = box(s);
      if (w && k.a < w.b + WORD_GAP) { w.strokes.push(s); w.b = Math.max(w.b, k.b); w.top = Math.min(w.top, k.top); w.bot = Math.max(w.bot, k.bot); }
      else words.push(w = { line, a: k.a, b: k.b, top: k.top, bot: k.bot, strokes: [s] });
    }
  }
  for (const s of strokes.filter(isMark)) {
    const k = box(s), cx = (k.a + k.b) / 2, cy = (k.top + k.bot) / 2;
    const dist = w => (cx >= w.a && cx <= w.b ? 0 : Math.min(Math.abs(cx - w.a), Math.abs(cx - w.b))) + 0.5 * (cy >= w.top && cy <= w.bot ? 0 : Math.min(Math.abs(cy - w.top), Math.abs(cy - w.bot)));
    if (words.length) words.reduce((m, w) => (dist(w) < dist(m) ? w : m)).strokes.push(s);
  }
  for (const w of words) { w.strokes.sort((p, q) => p.pts[0][2] - q.pts[0][2]); w.key = w.strokes.map(s => s.id).sort((a, b) => a - b).join("."); }
  return words.sort((p, q) => p.line - q.line || p.a - q.a);
}

// Recognise a page. Words whose strokes did not change keep their earlier result (and any correction).
// Corrected, converted and "drawing" words are frozen: new strokes next to them (a full stop, another word) form
// words of their own instead of being merged into them. A frozen word is released only if one of its strokes is erased.
const frozen = w => w.fixed || w.converted || w.drawing;
const ids = w => w.key.split(".").map(Number);
export async function recognise(strokes, lineOf, previous = []) {
  const present = new Set(strokes.map(s => s.id));
  const kept = previous.filter(w => frozen(w) && ids(w).every(id => present.has(id)));
  const keptIds = new Set(kept.flatMap(ids));
  const old = new Map(previous.map(w => [w.key, w]));
  const words = segment(strokes.filter(s => !keptIds.has(s.id)), lineOf);
  return [...kept, ...await Promise.all(words.map(async w => {
    const base = { key: w.key, line: w.line, x: Math.round(w.a), y: Math.round(w.top), w: Math.round(w.b - w.a), h: Math.round(w.bot - w.top) };
    const prev = old.get(w.key);
    if (prev && !prev.error) return { ...prev, ...base };
    try {
      const cands = rerank(await engine(w.strokes, "el"));
      return { ...base, cands: cands.slice(0, 8), text: cands[0] || "" };
    } catch {
      return { ...base, cands: [], text: "", error: true };
    }
  }))].sort((p, q) => p.line - q.line || p.x - q.x);
}

// Plain text of a page, one line per ruled line. Drawings are not text.
export function pageText(words = []) {
  const lines = new Map();
  for (const w of words) if (w.text && !w.drawing) (lines.get(w.line) || lines.set(w.line, []).get(w.line)).push(w.text);
  return [...lines.keys()].sort((a, b) => a - b).map(k => lines.get(k).join(" ")).join("\n");
}
