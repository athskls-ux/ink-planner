// Dictionary re-ranking of handwriting candidates.
// The recogniser returns ~8 guesses per word; the right word is often among them but not first.
// We prefer guesses that are real words (Greek/English frequency lists) or words this writer has used before.
import { allWords, putWord } from "./store.js";

const rank = new Map();      // lower-case word -> frequency rank (0 = most common)
const plain = new Map();     // word without accents -> most common form that has accents
const personal = new Map();  // word -> times the writer confirmed it
let ready;

export const strip = w => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function loadLexicon() {
  ready ||= (async () => {
    const lists = await Promise.all(["el", "en"].map(l => fetch(`data/${l}-words.txt`).then(r => r.text()).catch(() => "")));
    for (const text of lists) {
      text.split("\n").forEach((w, i) => {
        if (!w) return;
        const k = w.toLowerCase();
        if (!rank.has(k) || rank.get(k) > i) rank.set(k, i);
        const p = strip(w); if (p !== k && !plain.has(p)) plain.set(p, k);
      });
    }
    for (const { word, count } of await allWords()) { personal.set(word, count); if (strip(word) !== word) plain.set(strip(word), word); }
  })();
  return ready;
}

export async function learn(text) {
  for (const w of tokens(text)) {
    const k = w.toLowerCase(), count = (personal.get(k) || 0) + 1;
    personal.set(k, count); if (strip(k) !== k) plain.set(strip(k), k);
    await putWord({ word: k, count });
  }
}

const tokens = s => s.split(/\s+/).map(w => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")).filter(Boolean);
const keepCase = (orig, w) => orig[0] && orig[0] !== orig[0].toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w;

// Cost of one token, roughly -log(word frequency): confirmed words are cheapest, unknown tokens most expensive.
function cost(tok) {
  const k = tok.toLowerCase();
  if (personal.has(k)) return 0.5;
  if (rank.has(k)) return Math.log10(rank.get(k) + 10);
  return 6;
}
// Greek words of two or more syllables always carry an accent, so an unaccented one is restored
// to its most common accented form (μετα -> μετά), even when the subtitle word list knows the unaccented spelling.
const greek = /[Ͱ-Ͽ]/;
const syllables = w => (w.match(/αι|ει|οι|ου|υι|αυ|ευ|[αεηιουω]/g) || []).length;
function fixAccents(tok) {
  const k = tok.toLowerCase();
  if (personal.has(k)) return tok;
  if (greek.test(k) && syllables(k) > 1 && strip(k) === k && plain.has(k)) return keepCase(tok, plain.get(k));
  if (rank.has(k)) return tok;
  const p = plain.get(strip(tok));
  return p ? keepCase(tok, p) : tok;
}

export function rerank(cands) {
  const seen = new Set(), scored = [];
  cands.forEach((c, i) => {
    const toks = tokens(c);
    // Numbers and times ("10:30") have no letters; they rank like an ordinary known word.
    if (!toks.length) { const t = c.trim(); if (/\d/.test(t) && !seen.has(t)) { seen.add(t); scored.push({ text: t, score: -2.5 - i * 0.12 }); } return; }
    const lead = c.match(/^[^\p{L}]*/u)[0], tail = c.match(/[^\p{L}]*$/u)[0];
    const fixedToks = toks.map(fixAccents), fixed = lead + fixedToks.join(" ") + tail;
    // The recogniser's own order still counts a little.
    const score = -fixedToks.reduce((a, t) => a + cost(t), 0) / toks.length - i * 0.12;
    const key = fixed.trim();
    if (key && !seen.has(key)) { seen.add(key); scored.push({ text: key, score }); }
  });
  return scored.sort((a, b) => b.score - a.score).map(s => s.text);
}
