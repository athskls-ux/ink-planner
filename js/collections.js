// Bullet-journal collections: trackers and logs, each an ink page with its own printed template.
// A collection has a period: "month" (one page per month), "year" or "none" (a single page).
// Trackers are filled with marks and colour, so they are not run through handwriting recognition.
import { GAP, svg, rule, text, notesTemplate } from "./templates.js";

const daysIn = period => { const [y, m] = period.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const weekdayOf = (period, d, lang) => { const [y, m] = period.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(lang, { weekday: "narrow" }); };
const vline = (x, y1, y2, cls = "grid") => `<line class="${cls}" x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"/>`;
const title = s => text(16, 44, s, "ctitle");

// Month grid: a row per day, a day column, then the given columns (with printed or blank headers to write in).
function monthGrid(period, lang, name, { head = 130, cols, colX = 90, extra }) {
  const n = daysIn(period), rowH = 34, top = 60 + head, width = 1000 - colX, cw = width / cols.length;
  let body = title(name) + rule(top, 0, 1000, "grid");
  cols.forEach((c, i) => {
    const x = colX + i * cw;
    body += vline(x, 60, top + n * rowH);
    if (c.fill) body += `<rect x="${x + 1}" y="${top - 30}" width="${cw - 2}" height="28" rx="6" fill="${c.fill}" opacity=".55"/>`;
    if (c.label) body += `<text class="chead" x="${x + cw / 2}" y="${top - 10}" text-anchor="middle">${c.label}</text>`;
  });
  for (let d = 1; d <= n; d++) {
    const y = top + d * rowH;
    body += rule(y, 0, 1000, "grid") + text(12, y - 10, `${d} ${weekdayOf(period, d, lang)}`, "lbl");
  }
  if (extra) body += extra(top, rowH, cw);
  return { height: top + n * rowH + 40, baselines: [], recognize: false, background: svg(top + n * rowH + 40, body) };
}

// Lined log, optionally with a day number per line, a bullet circle, or column separators.
function lined(name, { lines = 26, numbers = false, bullet = false, cols = [], top = 110 } = {}) {
  const baselines = [];
  let body = title(name);
  for (let k = 0; k < lines; k++) {
    const y = top + k * GAP; baselines.push(y);
    body += rule(y);
    if (numbers) body += text(12, y - 14, k + 1, "lbl");
    if (bullet) body += `<circle class="bullet" cx="30" cy="${y - 18}" r="8"/>`;
  }
  for (const c of cols) body += vline(c.x, top - GAP, top + (lines - 1) * GAP, "margin") + (c.label ? text(c.x + 8, top - GAP - 8, c.label, "lbl") : "");
  const height = top + lines * GAP;
  return { height, baselines, textX: numbers || bullet ? 56 : 16, background: svg(height, body) };
}

export const COLLECTIONS = {
  habits: { icon: "✅", period: "month", el: ["Habit tracker", "Γράψε τις συνήθειες στις στήλες και σημείωνε κάθε μέρα."],
            en: ["Habit tracker", "Write your habits in the columns and tick each day."],
            build: (p, lang, n) => monthGrid(p, lang, n, { cols: Array.from({ length: 8 }, () => ({})) }) },
  mood: { icon: "🙂", period: "month", el: ["Mood tracker", "Σημάδεψε τη διάθεση κάθε μέρας."], en: ["Mood tracker", "Mark each day's mood."],
          build: (p, lang, n) => monthGrid(p, lang, n, { head: 50, cols: ["😞", "🙁", "😐", "🙂", "😄"].map(label => ({ label })).concat([{ label: "✎" }, {}, {}]) }) },
  stress: { icon: "🌡️", period: "month", el: ["Stress tracker", "Επίπεδο άγχους 1–5 και τι το προκάλεσε."],
            en: ["Stress tracker", "Stress level 1–5 and what caused it."],
            build: (p, lang, n) => monthGrid(p, lang, n, { head: 50, cols: ["#3ccf7a", "#a6d94a", "#ffd23f", "#ff9a3c", "#ff4d4d"].map((fill, i) => ({ fill, label: i + 1 })).concat([{ label: "✎" }, {}, {}]) }) },
  energy: { icon: "⚡", period: "month", el: ["Energy tracker", "Ενέργεια από 1 έως 5."], en: ["Energy tracker", "Energy from 1 to 5."],
            build: (p, lang, n) => monthGrid(p, lang, n, { head: 50, cols: [1, 2, 3, 4, 5].map(label => ({ label })).concat([{ label: "✎" }, {}, {}]) }) },
  sleep: { icon: "😴", period: "month", el: ["Sleep tracker", "Χρωμάτισε τις ώρες που κοιμήθηκες."], en: ["Sleep tracker", "Shade the hours you slept."],
           build: (p, lang, n) => monthGrid(p, lang, n, { head: 50, cols: [21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(h => ({ label: h })).concat([{ label: "Σ" }]) }) },
  water: { icon: "💧", period: "month", el: ["Water tracker", "Ένα κυκλάκι για κάθε ποτήρι."], en: ["Water tracker", "One circle per glass."],
           build: (p, lang, n) => monthGrid(p, lang, n, { head: 50, cols: Array.from({ length: 8 }, (_, i) => ({ label: i + 1 })),
             extra: (top, rowH, cw) => Array.from({ length: daysIn(p) * 8 }, (_, i) => `<circle class="bullet" cx="${90 + (i % 8) * cw + cw / 2}" cy="${top + Math.floor(i / 8) * rowH + rowH / 2}" r="9"/>`).join("") }) },
  workout: { icon: "🏃", period: "month", el: ["Γυμναστική", "Τι γυμναστική έκανες κάθε μέρα."], en: ["Workout log", "What exercise you did each day."],
             build: (p, lang, n) => lined(n, { lines: daysIn(p), numbers: true, cols: [{ x: 820, label: "′" }] }) },
  pixels: { icon: "🟩", period: "year", el: ["Year in pixels", "Ένα τετραγωνάκι για κάθε μέρα, χρωματισμένο με τη διάθεση."],
            en: ["Year in pixels", "One square per day, coloured by mood."],
            build: (y, lang, n) => {
              const top = 120, cw = 900 / 12, rh = 30;
              let body = title(n) + ["#ff4d4d", "#ff9a3c", "#ffd23f", "#a6d94a", "#3ccf7a"].map((c, i) => `<rect x="${16 + i * 46}" y="62" width="34" height="22" rx="5" fill="${c}" opacity=".6"/>`).join("");
              for (let m = 0; m < 12; m++) body += `<text class="chead" x="${90 + m * cw + cw / 2}" y="${top - 10}" text-anchor="middle">${new Date(y, m, 1).toLocaleDateString(lang, { month: "narrow" })}</text>`;
              for (let d = 1; d <= 31; d++) {
                body += text(40, top + d * rh - 9, d, "lbl");
                for (let m = 0; m < 12; m++) if (d <= new Date(y, m + 1, 0).getDate()) body += `<rect class="cellbox" x="${92 + m * cw}" y="${top + (d - 1) * rh + 2}" width="${cw - 4}" height="${rh - 4}" rx="4"/>`;
              }
              return { height: top + 31 * rh + 40, baselines: [], recognize: false, background: svg(top + 31 * rh + 40, body) };
            } },
  gratitude: { icon: "🙏", period: "month", el: ["Ευγνωμοσύνη", "Ένα πράγμα για το οποίο είσαι ευγνώμων κάθε μέρα."],
               en: ["Gratitude log", "One thing you are grateful for each day."], build: (p, lang, n) => lined(n, { lines: daysIn(p), numbers: true }) },
  goals: { icon: "🎯", period: "year", el: ["Στόχοι", "Οι στόχοι της χρονιάς."], en: ["Goals", "This year's goals."], build: (y, lang, n) => lined(n, { bullet: true }) },
  futurelog: { icon: "🗓️", period: "year", el: ["Future log", "Ό,τι έρχεται τους επόμενους μήνες."], en: ["Future log", "What is coming in the months ahead."],
               build: (y, lang, n) => {
                 // Twelve month boxes, two per row, three lines each.
                 const top = 80, boxH = 4 * GAP, baselines = [];
                 let body = title(n);
                 for (let m = 0; m < 12; m++) {
                   const x = (m % 2) * 500, y0 = top + Math.floor(m / 2) * boxH;
                   body += `<rect class="box" x="${x + 8}" y="${y0 + 6}" width="484" height="${boxH - 12}" rx="10"/>` +
                           text(x + 22, y0 + 34, new Date(y, m, 1).toLocaleDateString(lang, { month: "long" }), "chead2");
                   if (m % 2 === 0) for (let k = 2; k <= 4; k++) baselines.push(y0 + k * GAP - 8);
                   for (let k = 2; k <= 4; k++) body += rule(y0 + k * GAP - 8, x + 20, x + 480);
                 }
                 const height = top + 6 * boxH + 20;
                 return { height, baselines, textX: 22, background: svg(height, body) };
               } },
  braindump: { icon: "🧠", period: "none", el: ["Brain dump", "Άδειασε το μυαλό σου: ιδέες, σκέψεις, εκκρεμότητες."],
               en: ["Brain dump", "Empty your head: ideas, thoughts, loose ends."], build: (_, lang, n) => lined(n, { lines: 30 }) },
  books: { icon: "📚", period: "none", el: ["Βιβλία", "Βιβλία για διάβασμα· τσέκαρε όσα τελείωσες."], en: ["Reading list", "Books to read; tick the ones you finish."],
           build: (_, lang, n) => lined(n, { lines: 30, bullet: true, cols: [{ x: 880, label: "★" }] }) },
  movies: { icon: "🎬", period: "none", el: ["Ταινίες & σειρές", "Τι θέλεις να δεις."], en: ["Movies & shows", "What you want to watch."],
            build: (_, lang, n) => lined(n, { lines: 30, bullet: true, cols: [{ x: 880, label: "★" }] }) },
  expenses: { icon: "💶", period: "month", el: ["Έξοδα", "Ημερομηνία, τι, πόσο."], en: ["Expenses", "Date, what, how much."],
              build: (p, lang, n) => lined(n, { lines: 30, cols: [{ x: 110, label: "📅" }, { x: 800, label: "€" }] }) },
  ideas: { icon: "💡", period: "none", el: ["Ιδέες", "Ελεύθερη σελίδα με τελείες για ιδέες και σκίτσα."], en: ["Ideas", "A dotted page for ideas and sketches."],
           build: () => notesTemplate("dotted", 30) },
};

export const DEFAULT_COLLECTIONS = ["habits", "mood", "stress", "gratitude", "futurelog", "braindump"];

// Current period key for a collection: "2026-10", "2026" or "all".
export function periodNow(c, d = new Date()) {
  return c.period === "month" ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : c.period === "year" ? String(d.getFullYear()) : "all";
}
export function shiftPeriod(c, p, n) {
  if (c.period === "year") return String(+p + n);
  if (c.period === "month") { const [y, m] = p.split("-").map(Number), d = new Date(y, m - 1 + n, 1); return periodNow(c, d); }
  return p;
}
