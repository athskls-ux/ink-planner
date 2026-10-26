// Ink Planner: month, week and day pages you write on with a pen; handwriting becomes searchable text.
import { getPage, putPage, allPages, exportAll, importAll } from "./store.js";
import { InkSurface, inkSettings } from "./ink.js";
import { dayTemplate, weekTemplate, notesTemplate, lineFinder } from "./templates.js";
import { recognise, pageText } from "./recognize.js";
import { loadLexicon, learn, strip } from "./lexicon.js";
import { iso, parseIso, addDays, addMonths, monday, weekKey, weekStart, isoWeek, sameDay } from "./dates.js";
import { askNotifications, scheduleReminders } from "./remind.js";
import { occurrences, addRecurring, updateRecurring, REPEATS } from "./recurring.js";
import { COLLECTIONS, DEFAULT_COLLECTIONS, periodNow, shiftPeriod } from "./collections.js";
import { PAPERS } from "./templates.js";

// ---------- language ----------
const LANG = (navigator.language || "en").startsWith("el") ? "el" : "en";
const STR = {
  el: { today: "Σήμερα", month: "Μήνας", week: "Εβδομάδα", day: "Ημέρα", notes: "Σημειώσεις", search: "Αναζήτηση", pen: "Στυλό", eraser: "Γόμα",
        undo: "Αναίρεση", redo: "Επανάληψη", penOnly: "Μόνο γραφίδα", text: "Κείμενο", recognising: "Αναγνώριση…", offline: "Εκτός σύνδεσης: η αναγνώριση θα γίνει αργότερα",
        empty: "Γράψε με τη γραφίδα· το κείμενο εμφανίζεται εδώ.", fix: "Διόρθωση", save: "Αποθήκευση", cancel: "Άκυρο", searchHint: "Ψάξε στις χειρόγραφες σημειώσεις…",
        noResults: "Δεν βρέθηκε τίποτα.", settings: "Ρυθμίσεις", recognition: "Αναγνώριση χειρογράφου", backup: "Αντίγραφο ασφαλείας (JSON)", restore: "Επαναφορά από αντίγραφο",
        calib: "Βαθμονόμηση πίεσης", reset: "Επαναφορά", week_n: "Εβδομάδα", tapFix: "Πάτα μια λέξη για να τη διορθώσεις.", restored: "Η επαναφορά ολοκληρώθηκε.",
        convert: "Μετατροπή σε κείμενο", showInk: "Δείξε το χειρόγραφο", agenda: "Πρόγραμμα", addCal: "Πρόσθεσε στο Google Calendar",
        noAgenda: "Γράψε δίπλα σε μια ώρα, ή γράψε μια ώρα μπροστά (π.χ. 10:30), για ραντεβού ή δουλειά.", done: "Έγινε", time: "Ώρα",
        status: "Κατάσταση", task: "Δουλειά", event: "Ραντεβού", star: "Σημαντικό", cancelItem: "Ακύρωση", reopen: "Ξανά ανοιχτό",
        remind: "Υπενθύμιση", migrate: "Μετάθεση", move: "Μετάθεση", notifOff: "Οι ειδοποιήσεις είναι κλειστές για αυτή τη σελίδα στον browser.",
        newItem: "Νέο ραντεβού ή δουλειά…", add: "Προσθήκη", theme: "Εμφάνιση", auto: "Αυτόματο", light: "Φωτεινό", dark: "Σκούρο",
        allDay: "Όλη μέρα", birthday: "Γενέθλια", repeat: "Επανάληψη", noRepeat: "Χωρίς", rep_daily: "Κάθε μέρα", rep_weekdays: "Καθημερινές",
        rep_weekly: "Κάθε εβδομάδα", rep_monthly: "Κάθε μήνα", rep_yearly: "Κάθε χρόνο", thickness: "Πάχος", isDrawing: "Σχέδιο, όχι κείμενο", isText: "Είναι κείμενο",
        hour: "Ώρα", minutes: "Λεπτά", install: "Εγκατάσταση ως εφαρμογή", installed: "Εγκατεστημένη εφαρμογή",
        installHint: "Στο Chrome: μενού ⋮ → «Εγκατάσταση εφαρμογής» ή «Προσθήκη στην αρχική οθόνη».",
        marker: "Μαρκαδόρος", penStyle: "Χρώμα και πάχος", col: "Συλλογές", collections: "Συλλογές", moreCols: "Περισσότερες",
        moreColsHint: "Διάλεξε trackers και λίστες στις Ρυθμίσεις.", paper: "Χαρτί σημειώσεων", paper_lined: "Γραμμές", paper_dotted: "Τελείες",
        paper_grid: "Τετράγωνα", paper_blank: "Λευκό", writing: "Γραφή" },
  en: { today: "Today", month: "Month", week: "Week", day: "Day", notes: "Notes", search: "Search", pen: "Pen", eraser: "Eraser",
        undo: "Undo", redo: "Redo", penOnly: "Pen only", text: "Text", recognising: "Recognising…", offline: "Offline: recognition will run later",
        empty: "Write with the pen; the text appears here.", fix: "Correct", save: "Save", cancel: "Cancel", searchHint: "Search your handwriting…",
        noResults: "Nothing found.", settings: "Settings", recognition: "Handwriting recognition", backup: "Backup (JSON)", restore: "Restore from backup",
        calib: "Pressure calibration", reset: "Reset", week_n: "Week", tapFix: "Tap a word to correct it.", restored: "Restore complete.",
        convert: "Convert to text", showInk: "Show handwriting", agenda: "Schedule", addCal: "Add to Google Calendar",
        noAgenda: "Write next to an hour, or start a line with a time (e.g. 10:30), to add an appointment or task.", done: "Done", time: "Time",
        status: "Status", task: "Task", event: "Appointment", star: "Important", cancelItem: "Cancel", reopen: "Reopen",
        remind: "Reminder", migrate: "Postpone", move: "Move", notifOff: "Notifications are blocked for this page in the browser.",
        newItem: "New appointment or task…", add: "Add", theme: "Appearance", auto: "Automatic", light: "Light", dark: "Dark",
        allDay: "All day", birthday: "Birthday", repeat: "Repeat", noRepeat: "None", rep_daily: "Daily", rep_weekdays: "Weekdays",
        rep_weekly: "Weekly", rep_monthly: "Monthly", rep_yearly: "Yearly", thickness: "Thickness", isDrawing: "Drawing, not text", isText: "It is text",
        hour: "Hour", minutes: "Minutes", install: "Install as an app", installed: "Installed app",
        installHint: "In Chrome: menu ⋮ → “Install app” or “Add to Home screen”.",
        marker: "Highlighter", penStyle: "Colour and thickness", col: "Collections", collections: "Collections", moreCols: "More",
        moreColsHint: "Choose trackers and lists in Settings.", paper: "Notes paper", paper_lined: "Lined", paper_dotted: "Dotted",
        paper_grid: "Grid", paper_blank: "Blank", writing: "Writing" },
}[LANG];

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const main = $("#main");
const recognitionOn = () => localStorage.getItem("recognition") !== "0";

// ---------- routing ----------
// #/day/2026-10-26 · #/week/2026-W44 · #/month/2026-10 · #/notes · #/search
function route() {
  const [, view = "day", arg] = location.hash.split("/");
  const today = new Date();
  closeSurface(); syncTools();
  if (view === "month") return showMonth(arg ? parseIso(arg + "-01") : today);
  if (view === "week") return showWeek(arg || weekKey(today));
  if (view === "notes") return showInk("notes:inbox", notesTemplate(localStorage.getItem("paper") || "lined"), STR.notes);
  if (view === "col") return arg ? showCollection(arg, location.hash.split("/")[3]) : showCollections();
  if (view === "search") return showSearch(decodeURIComponent(arg || ""));
  return showDay(arg ? parseIso(arg) : today);
}
addEventListener("hashchange", route);

function header(title, prev, next, active, extra = "") {
  $("#title").innerHTML = title;
  $("#prev").onclick = () => prev && (location.hash = prev);
  $("#next").onclick = () => next && (location.hash = next);
  $("#prev").hidden = $("#next").hidden = !prev;
  for (const a of document.querySelectorAll("#views a")) a.classList.toggle("on", a.dataset.v === active);
  $("#subnav").innerHTML = extra;
}

// ---------- month ----------
async function showMonth(d) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  header(first.toLocaleDateString(LANG, { month: "long", year: "numeric" }), `#/month/${iso(addMonths(first, -1)).slice(0, 7)}`, `#/month/${iso(addMonths(first, 1)).slice(0, 7)}`, "month");
  const pages = new Map((await allPages()).map(p => [p.key, p]));
  const start = monday(first), today = new Date();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const nWeeks = Math.ceil(((first - start) / 864e5 + daysInMonth) / 7);
  const open = e => !e.done && !["done", "cancelled", "migrated"].includes(e.status);
  // A narrow first column holds the week numbers, which open the week page.
  let cells = `<div class="dow"></div>`;
  for (let i = 0; i < 7; i++) cells += `<div class="dow">${addDays(start, i).toLocaleDateString(LANG, { weekday: "short" })}</div>`;
  for (let i = 0; i < nWeeks * 7; i++) {
    const day = addDays(start, i);
    if (i % 7 === 0) cells += `<a class="wk" href="#/week/${weekKey(day)}" title="${STR.week_n} ${isoWeek(day).week}">${isoWeek(day).week}</a>`;
    // Repeating items (birthdays first), then appointments with their time, then the day's other notes.
    const p = pages.get("day:" + iso(day)), reps = await occurrences(iso(day));
    const timed = (p?.events || []).filter(e => open(e) && e.rid == null).map(e => `${eventTime(e)} ${e.text}`);
    const lines = [...reps.filter(open).map(r => `${r.kind === "birthday" ? "🎂" : "↻"} ${r.time ? r.time + " " : ""}${r.text}`),
                   ...(timed.length ? timed : (p?.text || "").split("\n").filter(Boolean))].slice(0, 3);
    const ink = p?.strokes?.length && !lines.length;
    cells += `<a class="cell${day.getMonth() !== first.getMonth() ? " out" : ""}${sameDay(day, today) ? " today" : ""}" href="#/day/${iso(day)}">
      <span class="num">${day.getDate()}</span>${lines.map(s => `<span class="snip">${esc(s)}</span>`).join("")}${ink ? `<span class="dot"></span>` : ""}</a>`;
  }
  main.innerHTML = `<div class="month" style="--weeks:${nWeeks}">${cells}</div>`;
}

// ---------- collections (trackers and logs) ----------
const enabledCollections = () => { try { return JSON.parse(localStorage.getItem("collections")) || DEFAULT_COLLECTIONS; } catch { return DEFAULT_COLLECTIONS; } };
const colName = id => COLLECTIONS[id][LANG][0];
function periodLabel(c, p) {
  if (c.period === "month") { const [y, m] = p.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString(LANG, { month: "long", year: "numeric" }); }
  return c.period === "year" ? p : "";
}
function showCollections() {
  header(STR.collections, null, null, "col");
  main.innerHTML = `<div class="cols">${enabledCollections().filter(id => COLLECTIONS[id]).map(id => {
    const c = COLLECTIONS[id];
    return `<a class="colcard" href="#/col/${id}/${periodNow(c)}"><span class="icon">${c.icon}</span><b>${esc(c[LANG][0])}</b><span>${esc(c[LANG][1])}</span></a>`;
  }).join("")}<a class="colcard more" href="#" id="moreCols"><span class="icon">＋</span><b>${STR.moreCols}</b><span>${STR.moreColsHint}</span></a></div>`;
  $("#moreCols").onclick = e => { e.preventDefault(); $("#settingsBtn").click(); };
}
function showCollection(id, period) {
  const c = COLLECTIONS[id]; if (!c) return showCollections();
  period ||= periodNow(c);
  const nav = p => `#/col/${id}/${shiftPeriod(c, period, p)}`;
  header(`${c.icon} ${esc(colName(id))} <small>${periodLabel(c, period)}</small>`, c.period === "none" ? null : nav(-1), nav(1), "col",
         `<a href="#/col">← ${STR.collections}</a>`);
  return showInk(`col:${id}:${period}`, c.build(period, LANG, colName(id)));
}

// ---------- week & day ----------
function showWeek(key) {
  const start = weekStart(key), tpl = weekTemplate(start, LANG), end = addDays(start, 6);
  const range = `${start.toLocaleDateString(LANG, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(LANG, { day: "numeric", month: "short", year: "numeric" })}`;
  const chips = tpl.days.map(d => `<a href="#/day/${iso(d.date)}"${sameDay(d.date, new Date()) ? ' class="on"' : ""}>${d.date.toLocaleDateString(LANG, { weekday: "short", day: "numeric" })}</a>`).join("");
  header(`${STR.week_n} ${isoWeek(start).week} <small>${range}</small>`, `#/week/${weekKey(addDays(start, -7))}`, `#/week/${weekKey(addDays(start, 7))}`, "week", chips);
  return showInk("week:" + key, tpl);
}

function showDay(d) {
  const title = `${d.toLocaleDateString(LANG, { weekday: "long" })} <small>${d.toLocaleDateString(LANG, { day: "numeric", month: "long", year: "numeric" })}</small>`;
  const links = `<a href="#/week/${weekKey(d)}">${STR.week_n} ${isoWeek(d).week}</a><a href="#/month/${iso(d).slice(0, 7)}">${d.toLocaleDateString(LANG, { month: "long" })}</a>`;
  header(title, `#/day/${iso(addDays(d, -1))}`, `#/day/${iso(addDays(d, 1))}`, "day", links);
  return showInk("day:" + iso(d), dayTemplate());
}

let surface = null, saveTimer = null, recogTimer = null, page = null, tplNow = null, dayReps = [];
function closeSurface() { surface?.destroy(); surface = null; clearTimeout(saveTimer); clearTimeout(recogTimer); }

// `title` is only given for pages without dates (notes), which have no prev/next.
async function showInk(key, tpl, title) {
  if (title) header(title, null, null, "notes");
  page = (await getPage(key)) || { key, strokes: [], words: [], text: "" };
  tplNow = tpl;
  dayReps = tpl.slots ? await occurrences(key.slice(4)) : [];
  if (tpl.slots) page.events = extractEvents();
  // Trackers are not recognised, so they get the whole width and no text panel.
  main.innerHTML = `<div class="inkview${tpl.recognize === false ? " solo" : ""}">
      <div class="scroller"><div class="sheet"><div id="ink"></div></div></div>
      ${tpl.recognize === false ? "" : `<aside class="transcript">${tpl.slots ? `<h3>${STR.agenda}</h3><div id="agenda"></div>` : ""}
        <h3>${STR.text} <span id="rstatus"></span></h3><div id="words"></div><p class="hint">${STR.tapFix}</p></aside>`}
    </div>`;
  surface = new InkSurface($("#ink"), {
    height: tpl.height, background: tpl.background, strokes: page.strokes,
    onChange: strokes => { page.strokes = strokes; scheduleSave(); if (tpl.recognize !== false) scheduleRecognition(tpl); },
    ...(tpl.margin && { margin: tpl.margin, onMarginTap: marginTap }),
  });
  applyPen();
  syncTools();
  renderWords();
  // Pages written while offline (or before recognition was on) get recognised on open.
  if (tpl.recognize !== false && (page.words || []).some(w => w.error) || unrecognised().length) scheduleRecognition(tpl, 300);
}

// Handwriting strokes that no word covers yet (written offline, or with the old drawing pen).
function unrecognised() {
  if (tplNow?.recognize === false) return [];
  const covered = new Set((page.words || []).flatMap(w => w.key.split(".").map(Number)));
  return page.strokes.filter(s => !s.hl && !covered.has(s.id));
}

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => putPage(page), 500); }

// Words are recognised soon after the pen lifts (only new or changed words are sent), and at least every 2.5 s
// while writing continues. A run that finishes after a newer one has started is dropped.
let recogSince = 0, recogRun = 0;
function scheduleRecognition(tpl, delay = 700) {
  clearTimeout(recogTimer);
  if (!recognitionOn()) return;
  const now = Date.now();
  recogSince ||= now;
  recogTimer = setTimeout(async () => {
    recogSince = 0;
    const run = ++recogRun, status = $("#rstatus");
    if (!navigator.onLine) { status && (status.textContent = STR.offline); return; }
    status && (status.textContent = STR.recognising);
    const current = page;
    await loadLexicon();
    // Marker strokes are not handwriting. (Drawings are words the writer marked as drawing; see the word popover.)
    const found = await recognise(current.strokes.filter(s => !s.hl), lineFinder(tpl.baselines), current.words);
    if (current !== page || run !== recogRun) return;
    // Corrections made while this run was in flight win.
    const latest = new Map((page.words || []).map(w => [w.key, w]));
    const words = found.map(w => latest.has(w.key) ? { ...w, ...latest.get(w.key), line: w.line, x: w.x, y: w.y, w: w.w, h: w.h } : w);
    page.words = words; page.text = pageText(words); page.events = extractEvents();
    await putPage(page);
    renderWords();
    $("#rstatus") && ($("#rstatus").textContent = "");
  }, Math.max(0, Math.min(delay, recogSince + 2500 - now)));
}

// Corrected (or converted) words are shown on the page as typed text, sitting on the ruled line they were written on.
// Words corrected before this flag existed count as converted.
const isConverted = w => w.converted ?? !!w.fixed;
function showConverted() {
  if (!surface || !tplNow) return;
  const words = [...(page.words || [])].sort((a, b) => a.line - b.line || a.x - b.x);
  const hidden = [], labels = [], baseline = line => tplNow.baselines[line] - 10;
  const byLine = new Map((page.events || []).filter(e => e.line != null && !e.part).map(e => [e.line, e]));
  words.forEach((w, i) => {
    if (!isConverted(w) || !w.text || w.drawing) return;
    hidden.push(...w.key.split(".").map(Number));
    const prev = words[i - 1], sameLine = o => o.line === w.line;
    // A run of converted words on one line reads as one sentence: it starts at the beginning of the line
    // (unless handwriting precedes it) and each word follows the previous with a normal space.
    const first = !prev || !sameLine(prev);
    const join = !first && isConverted(prev) && !!prev.text;
    const nextInk = words.slice(i + 1).find(o => sameLine(o) && !isConverted(o));
    labels.push({ text: w.text, x: first ? tplNow.textX : w.x, join, baseline: baseline(w.line), limit: (nextInk ? nextInk.x : 1000) - 8,
                  strike: byLine.get(w.line)?.status === "cancelled" });
  });
  // Bullet-journal symbols in the margin, and items moved here from other days on free hour lines.
  const used = new Set(words.map(w => w.line));
  for (const e of page.events || []) {
    if (e.part) continue;  // one symbol per written line
    const line = e.line ??(tplNow.slots ? tplNow.slots.indexOf(+eventTime(e).slice(0, 2)) : -1);
    if (line < 0 || (e.line == null && used.has(line))) continue;
    used.add(line);
    labels.push({ text: (e.star ? "★" : "") + symbol(e), x: 56, baseline: baseline(line), limit: 78, size: 22, tone: "accent" });
    if (e.line == null) labels.push({ text: e.text, x: tplNow.textX, baseline: baseline(line), limit: 992, strike: e.status === "cancelled" });
  }
  // Hour labels in the margin show the line's time, including one changed with the time picker.
  (tplNow.slots || []).forEach((h, line) => {
    const t = marginTime(line);
    labels.push({ text: t, x: 10, baseline: tplNow.baselines[line] - 14, limit: 54, size: 15, tone: t === hm(h) ? "muted" : "accent" });
  });
  surface.setConverted(hidden, labels);
}

const marginTime = line => page.times?.[line] || (page.events || []).find(e => e.line === line && !e.part)?.time || hm(tplNow.slots[line]);

// Time picker made for a pen: a grid of hours, a grid of minutes in fives, and ±1 for an exact minute.
// `extra` is an optional second button { label, value } (reset, all day); onPick gets "HH:MM" or that value.
function timePicker(x, y, value, onPick, extra) {
  $("#pop")?.remove();
  let [h, m] = (value || hm(new Date().getHours() + 1)).split(":").map(Number);
  const pop = document.createElement("div"); pop.id = "pop"; pop.className = "pop menu tp";
  pop.innerHTML = `<div class="tp-head"><span>${STR.hour}</span><b class="tp-val"></b></div>
    <div class="tp-grid hours">${Array.from({ length: 24 }, (_, i) => `<button data-h="${i}">${String(i).padStart(2, "0")}</button>`).join("")}</div>
    <div class="tp-head"><span>${STR.minutes}</span><span><button data-d="-1">−1</button> <button data-d="1">+1</button></span></div>
    <div class="tp-grid mins">${Array.from({ length: 12 }, (_, i) => `<button data-m="${i * 5}">:${String(i * 5).padStart(2, "0")}</button>`).join("")}</div>
    <div class="row">${extra ? `<button class="ghost" data-x>${extra.label}</button>` : ""}<button class="primary" data-ok>OK</button></div>`;
  document.body.append(pop);
  const show = () => {
    $(".tp-val", pop).textContent = hm(h, m);
    pop.querySelectorAll("[data-h]").forEach(b => b.classList.toggle("on", +b.dataset.h === h));
    pop.querySelectorAll("[data-m]").forEach(b => b.classList.toggle("on", +b.dataset.m === m));
  };
  show();
  pop.style.left = Math.max(8, Math.min(x + 8, innerWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = Math.max(8, Math.min(y - 10, innerHeight - pop.offsetHeight - 8)) + "px";
  pop.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.h) h = +b.dataset.h;
    if (b.dataset.m) m = +b.dataset.m;
    if (b.dataset.d) m = (m + +b.dataset.d + 60) % 60;
    if (b.hasAttribute("data-ok")) { pop.remove(); return onPick(hm(h, m)); }
    if (b.hasAttribute("data-x")) { pop.remove(); return onPick(extra.value); }
    show();
  };
}

// Tapping the hour in the margin opens the time picker for that line.
function marginTap([, y], ev) {
  const line = lineFinder(tplNow.baselines)(y);
  if (!tplNow.slots || line >= tplNow.slots.length) return;
  timePicker(ev.clientX, ev.clientY, marginTime(line), async t => {
    const times = { ...page.times }; if (t) times[line] = t; else delete times[line];
    page.times = times; page.events = extractEvents(); await putPage(page);
    renderAgenda(); showConverted(); scheduleReminders();
  }, page.times?.[line] ? { label: STR.reset, value: "" } : null);
}

// ---------- schedule (bullet journal) ----------
// On a day page, a line becomes an item { line, time, text, kind, status, star, remind, to } when it is on an hour
// line or starts with a written time ("10:30 Οδοντίατρος", also in the notes area). The time comes from, in order:
// a time picked in the schedule list, a time written at the start of the line, the hour of the line.
// Kind, status, star and reminder live in page.meta[line], so they survive re-recognition of the line.
// Items postponed here from another day have no handwriting; they live in page.items with a `from` date.
// A line can hold several items, each starting with its own time: "7:00 Γυμναστήριο 7:30 Πρωινό".
// Each part has its own meta/picked-time key: "3" for the first part of line 3, "3.1" for the second, and so on.
const TIMES = /(?:^|\s)([01]?\d|2[0-3])\s*[:.·]\s*([0-5]\d)(?!\d)/g;
const hm = (h, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const partKey = e => e.part ? `${e.line}.${e.part}` : String(e.line);
function splitLine(text) {
  const parts = [], marks = [...text.matchAll(TIMES)];
  const head = text.slice(0, marks[0]?.index ?? text.length).trim();
  if (head) parts.push({ time: null, text: head });
  marks.forEach((m, i) => {
    const body = text.slice(m.index + m[0].length, marks[i + 1]?.index ?? text.length).trim();
    if (body) parts.push({ time: hm(+m[1], +m[2]), text: body });
  });
  return parts;
}
function extractEvents() {
  if (!tplNow?.slots) return undefined;
  const meta = page.meta || {};
  for (const e of page.events || []) if (e.done && e.line != null && !meta[e.line]) meta[e.line] = { status: "done" };  // older pages
  page.meta = meta;
  const picked = page.times || {}, lines = new Map();
  for (const w of [...(page.words || [])].sort((a, b) => a.x - b.x)) if (w.text && !w.drawing) (lines.get(w.line) || lines.set(w.line, []).get(w.line)).push(w.text);
  const events = [];
  for (const [line, ws] of lines) {
    splitLine(ws.join(" ")).forEach((p, part) => {
      const key = part ? `${line}.${part}` : String(line);
      const time = picked[key] || p.time || (line < tplNow.slots.length ? hm(tplNow.slots[line]) : null);
      if (time) events.push({ kind: "task", status: "open", ...meta[key], line, part, time, text: p.text });
    });
  }
  for (const it of page.items || []) events.push({ kind: "task", status: "open", ...it });
  events.push(...dayReps);  // repeating items; all-day ones ("" time) sort first
  return events.sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
}
// Pages saved before exact times existed have { hour } events; all-day items have time "".
const eventTime = e => e.time ?? (e.hour != null ? hm(e.hour) : "");
// • task  ○ appointment  🎂 birthday  × done  > postponed; a cancelled item keeps its symbol and is struck through.
const symbol = e => e.status === "done" || e.done ? "×" : e.status === "migrated" ? ">" : e.kind === "birthday" ? "🎂" : e.kind === "event" ? "○" : "•";
const shortDate = d => parseIso(d).toLocaleDateString(LANG, { weekday: "short", day: "numeric", month: "short" });

async function updateItem(e, patch) {
  const date = page.key.slice(4);
  if (e.rid != null) {
    await updateRecurring(e.rid, date, patch);
    dayReps = await occurrences(date);
  } else {
    // Making a one-off item repeat starts a series from the next occurrence (today's item stays as written).
    if (patch.repeat) {
      await addRecurring({ text: e.text, time: patch.kind === "birthday" ? "" : eventTime(e), kind: patch.kind || e.kind, star: !!e.star,
                           remind: e.remind || 0, repeat: patch.repeat, origin: date, start: iso(addDays(parseIso(date), 1)) });
      delete patch.repeat;
    }
    if (e.line != null) { const k = partKey(e); page.meta = { ...page.meta, [k]: { ...page.meta?.[k], ...patch } }; }
    else Object.assign(page.items.find(i => i.id === e.id), patch);
    if (patch.time && e.line != null) page.times = { ...page.times, [partKey(e)]: patch.time };
  }
  page.events = extractEvents();
  await putPage(page);
  renderAgenda(); showConverted(); scheduleReminders();
}

// Postpone: the item is copied to the chosen day (as typed text) and marked ">" here.
async function postpone(e, date, time) {
  const key = "day:" + date, target = (await getPage(key)) || { key, strokes: [], words: [], text: "" };
  const item = { id: Date.now().toString(36), time: time || eventTime(e), text: e.text, kind: e.kind || "task", status: "open",
                 star: !!e.star, remind: e.remind || 0, from: page.key.slice(4) };
  target.items = [...(target.items || []), item];
  target.events = [...(target.events || []), item].sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
  await putPage(target);
  await updateItem(e, { status: "migrated", to: date });
}

// Google Calendar's "create event" link: it opens the event pre-filled (one hour long, or all day) and you press Save.
// Repeating items carry their rule, so a birthday is created as a yearly event.
const RRULE = { daily: "FREQ=DAILY", weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY" };
function calendarLink(date, e) {
  const d = date.replace(/-/g, ""), tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let dates;
  if (!eventTime(e)) dates = `${d}/${iso(addDays(parseIso(date), 1)).replace(/-/g, "")}`;
  else {
    const [h, m] = eventTime(e).split(":").map(Number), end = Math.min(h * 60 + m + 60, 23 * 60 + 59);
    const t = mins => `${d}T${hm(Math.floor(mins / 60), mins % 60).replace(":", "")}00`;
    dates = `${t(h * 60 + m)}/${t(end)}`;
  }
  const recur = e.repeat ? `&recur=${encodeURIComponent("RRULE:" + RRULE[e.repeat])}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.text)}&dates=${dates}&ctz=${encodeURIComponent(tz)}${recur}`;
}

function renderAgenda() {
  const box = $("#agenda"); if (!box) return;
  const events = page.events || [], date = page.key.slice(4);
  const remindLabel = m => REMIND.find(([v]) => v === m)?.[1] || "";
  box.innerHTML = events.length ? events.map((e, i) => `<div class="event s-${e.status || "open"}">
      <button class="sym" data-i="${i}" aria-label="${STR.status}">${symbol(e)}</button>
      <button class="time" data-i="${i}" aria-label="${STR.time}">${eventTime(e) || STR.allDay}</button>
      <span class="etext">${e.star ? '<b class="star">★</b> ' : ""}${esc(e.text)}${e.repeat ? ` <small title="${STR["rep_" + e.repeat]}">↻</small>` : ""}
        ${e.to ? `<small>&gt; ${esc(shortDate(e.to))}</small>` : ""}${e.from ? `<small>&lt; ${esc(shortDate(e.from))}</small>` : ""}</span>
      ${e.remind ? `<span class="bell" title="${STR.remind}: ${remindLabel(e.remind)}">🔔</span>` : ""}
      <a href="${calendarLink(date, e)}" target="_blank" rel="noopener" title="${STR.addCal}" aria-label="${STR.addCal}">📅</a></div>`).join("")
    + `<p class="legend">• ${STR.task} · ○ ${STR.event} · 🎂 ${STR.birthday} · × ${STR.done} · &gt; ${STR.migrate} · ★ ${STR.star} · ↻ ${STR.repeat}</p>`
    : `<p class="hint">${STR.noAgenda}</p>`;
  // Typed entry, for any time (two things between 7 and 8), all day (empty time), repeating, or with no pen at hand.
  const next = hm(Math.min(22, new Date().getHours() + 1));
  box.insertAdjacentHTML("beforeend", `<form class="additem">
    <div class="row"><button type="button" class="time" data-v="${next}" aria-label="${STR.time}">${next}</button><input type="text" placeholder="${STR.newItem}" required></div>
    <div class="row"><select name="kind" aria-label="${STR.status}"><option value="task">• ${STR.task}</option><option value="event">○ ${STR.event}</option><option value="birthday">🎂 ${STR.birthday}</option></select>
      <select name="repeat" aria-label="${STR.repeat}"><option value="">${STR.noRepeat}</option>${REPEATS.map(r => `<option value="${r}">↻ ${STR["rep_" + r]}</option>`).join("")}</select>
      <button class="primary" aria-label="${STR.add}">+</button></div></form>`);
  const form = $(".additem", box), tbtn = $(".time", form);
  const setT = t => { tbtn.dataset.v = t; tbtn.textContent = t || STR.allDay; };
  tbtn.onclick = e => timePicker(e.clientX, e.clientY, tbtn.dataset.v, setT, { label: STR.allDay, value: "" });
  form.kind.onchange = () => { if (form.kind.value === "birthday") { form.repeat.value = "yearly"; setT(""); } };
  form.onsubmit = async ev => {
    ev.preventDefault();
    const time = tbtn.dataset.v, text = form.querySelector("[type=text]").value.trim();
    const kind = form.kind.value, repeat = form.repeat.value;
    if (repeat) {
      await addRecurring({ text, time, kind, repeat, origin: date, start: date });
      dayReps = await occurrences(date);
    } else page.items = [...(page.items || []), { id: Date.now().toString(36), time, text, kind, status: "open" }];
    page.events = extractEvents(); await putPage(page);
    renderAgenda(); showConverted(); scheduleReminders();
  };
  box.onclick = e => {
    const b = e.target.closest(".sym, .event .time"); if (!b) return;
    const ev = events[+b.dataset.i];
    if (b.classList.contains("sym")) return itemMenu(ev, b);
    timePicker(e.clientX, e.clientY, eventTime(ev), t => updateItem(ev, { time: t }), ev.line == null ? { label: STR.allDay, value: "" } : null);
  };
}

const REMIND = [[0, "—"], [10, "10′"], [30, "30′"], [60, "1h"], [1440, "1d"]];
// Item menu: kind, status, star, reminder and postpone.
function itemMenu(e, anchor) {
  $("#pop")?.remove();
  const pop = document.createElement("div"); pop.id = "pop"; pop.className = "pop menu";
  const btn = (act, label, on) => `<button data-act="${act}"${on ? ' class="on"' : ""}>${label}</button>`;
  const tomorrow = iso(addDays(parseIso(page.key.slice(4)), 1));
  const kinds = [["task", "•"], ["event", "○"], ["birthday", "🎂"]];
  pop.innerHTML = `<div class="row">${kinds.map(([k, s]) => btn("k:" + k, `${s} ${STR[k]}`, (e.kind || "task") === k)).join("")}${btn("star", "★ " + STR.star, e.star)}</div>
    <div class="row">${btn("done", "× " + STR.done, e.status === "done")}${btn("cancelled", "⊘ " + STR.cancelItem, e.status === "cancelled")}${btn("open", "↺ " + STR.reopen)}</div>
    <div class="row"><span>↻ ${STR.repeat}</span>${btn("p:", STR.noRepeat, !e.repeat)}${REPEATS.map(r => btn("p:" + r, STR["rep_" + r], e.repeat === r)).join("")}</div>
    <div class="row"><span>🔔 ${STR.remind}</span>${REMIND.map(([m, l]) => btn("r" + m, l, (e.remind || 0) === m)).join("")}</div>
    ${e.rid == null ? `<form class="row"><span>&gt; ${STR.migrate}</span><input type="date" value="${tomorrow}" required><input type="time" value="${eventTime(e)}"><button class="primary">${STR.move}</button></form>` : ""}`;
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > innerHeight ? Math.max(8, r.top - pop.offsetHeight - 6) : r.bottom + 6) + "px";
  pop.onclick = async ev => {
    const act = ev.target.closest("button[data-act]")?.dataset.act; if (!act) return;
    pop.remove();
    // A birthday repeats every year by default.
    if (act.startsWith("k:")) { const kind = act.slice(2); return updateItem(e, { kind, ...(kind === "birthday" && !e.repeat ? { repeat: "yearly" } : {}) }); }
    if (act.startsWith("p:")) { const repeat = act.slice(2); if (repeat || e.rid != null) return updateItem(e, { repeat }); return; }
    if (act === "star") return updateItem(e, { star: !e.star });
    if (act === "done" || act === "cancelled" || act === "open") return updateItem(e, { status: act, ...(act === "open" ? { to: null } : {}) });
    if (act[0] === "r") {
      const m = +act.slice(1);
      if (m && !(await askNotifications())) alert(STR.notifOff);
      return updateItem(e, { remind: m });
    }
  };
  const form = $("form", pop);
  if (form) form.onsubmit = ev => {
    ev.preventDefault();
    const [d, t] = form.querySelectorAll("input");
    pop.remove(); postpone(e, d.value, t.value);
  };
}

function renderWords() {
  if (tplNow?.slots && (page.words?.length || page.items?.length) && (!page.events || page.events.some(e => !e.time))) page.events = extractEvents();
  showConverted();
  renderAgenda();
  const box = $("#words"); if (!box) return;
  const words = page.words || [];
  if (!words.length) { box.innerHTML = `<p class="hint">${STR.empty}</p>`; return; }
  const lines = new Map();
  words.forEach((w, i) => (lines.get(w.line) || lines.set(w.line, []).get(w.line)).push([w, i]));
  box.innerHTML = [...lines.keys()].sort((a, b) => a - b).map(l => `<div class="tline">${lines.get(l).map(([w, i]) =>
    `<button class="word${w.fixed ? " fixed" : ""}${w.error ? " err" : ""}${w.drawing ? " drawing" : ""}" data-i="${i}">${w.drawing ? "🖌" : esc(w.text || "?")}</button>`).join("")}</div>`).join("");
  box.onclick = e => { const b = e.target.closest(".word"); if (b) correct(+b.dataset.i, b); };
}

// Correction popover: pick another guess or type the word. Confirmed words go into the personal dictionary.
function correct(i, anchor) {
  const w = page.words[i];
  $("#pop")?.remove();
  const pop = document.createElement("div"); pop.id = "pop"; pop.className = "pop";
  pop.innerHTML = `<div class="cands">${(w.cands || []).map(c => `<button>${esc(c)}</button>`).join("")}</div>
    <form><input value="${esc(w.text || "")}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="primary">${STR.save}</button><button type="button" class="ghost">${STR.cancel}</button></form>
    <div class="row">${isConverted(w) ? `<button type="button" class="ghost back">✍ ${STR.showInk}</button>` : ""}
      <button type="button" class="ghost drawbtn">${w.drawing ? "✍ " + STR.isText : "🖌 " + STR.isDrawing}</button></div>`;
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + "px";
  const input = $("input", pop);
  const apply = async text => {
    pop.remove();
    text = text.trim(); if (!text) return;
    w.text = text; w.fixed = true; w.converted = true; w.drawing = false; page.text = pageText(page.words); page.events = extractEvents();
    await putPage(page); await learn(text); renderWords();
  };
  $(".cands", pop).onclick = e => e.target.tagName === "BUTTON" && apply(e.target.textContent);
  $("form", pop).onsubmit = e => { e.preventDefault(); apply(input.value); };
  $("form .ghost", pop).onclick = () => pop.remove();
  const back = $(".back", pop);
  if (back) back.onclick = async () => { pop.remove(); w.converted = false; await putPage(page); renderWords(); };
  // A doodle that was read as a word: keep the ink, drop it from the text and the schedule.
  $(".drawbtn", pop).onclick = async () => {
    pop.remove(); w.drawing = !w.drawing; w.converted = false;
    page.text = pageText(page.words); page.events = extractEvents();
    await putPage(page); renderWords();
  };
}
document.addEventListener("pointerdown", e => { const p = $("#pop"); if (p && !p.contains(e.target) && !e.target.closest(".word")) p.remove(); });

// ---------- tools ----------
// Pen style is remembered per device: pen colour ("" = theme ink), marker colour, width factor.
const PEN_COLORS = ["", "#1f4fd8", "#d62f2f", "#1b8a4b", "#e07b00", "#7b3fd0", "#6b4b2a"];
const MARKER_COLORS = ["", "#7fe08a", "#ff9fd0", "#8fd3ff", "#ffb36b"];  // "" = yellow
const penPref = (k, d) => localStorage.getItem(k) ?? d;
let tool = "pen";
function applyPen() {
  if (!surface) return;
  surface.tool = tool;
  surface.color = tool === "marker" ? penPref("markerColor", "") : penPref("penColor", "");
  surface.widthFactor = +penPref("penWidth", "1");
}
function syncTools() {
  $("#tools").hidden = !surface;
  if (!surface) return;
  for (const b of document.querySelectorAll("#tools [data-tool]")) b.classList.toggle("on", tool === b.dataset.tool);
  $("#penOnly").classList.toggle("on", inkSettings.penOnly);
  $("#penStyle .swatch").style.background = surface.color || (tool === "marker" ? "#ffd54a" : "var(--ink)");
}
function penMenu(anchor) {
  $("#pop")?.remove();
  const marker = tool === "marker", colors = marker ? MARKER_COLORS : PEN_COLORS, cur = marker ? penPref("markerColor", "") : penPref("penColor", "");
  const pop = document.createElement("div"); pop.id = "pop"; pop.className = "pop menu";
  pop.innerHTML = `<div class="row swatches">${colors.map(c => `<button data-c="${c}" class="sw${c === cur ? " on" : ""}" style="background:${c || (marker ? "#ffd54a" : "var(--ink)")}" aria-label="${c || STR.auto}"></button>`).join("")}</div>
    <label class="row"><span>${STR.thickness}</span><input type="range" min="0.5" max="2.5" step="0.25" value="${penPref("penWidth", "1")}"></label>`;
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left - 60, innerWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = (r.top - pop.offsetHeight - 10) + "px";
  pop.onclick = e => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    localStorage.setItem(marker ? "markerColor" : "penColor", b.dataset.c);
    pop.querySelectorAll(".sw").forEach(x => x.classList.toggle("on", x === b));
    applyPen(); syncTools();
  };
  $("input", pop).oninput = e => { localStorage.setItem("penWidth", e.target.value); applyPen(); };
}
$("#tools").onclick = e => {
  const b = e.target.closest("button"); if (!b || !surface) return;
  if (b.dataset.tool) { tool = b.dataset.tool; applyPen(); }
  if (b.id === "penStyle") return penMenu(b);
  if (b.id === "undo") surface.undo();
  if (b.id === "redo") surface.redo();
  if (b.id === "penOnly") inkSettings.penOnly = !inkSettings.penOnly;
  // Convert the whole page to typed text; pressed again on a fully converted page, it brings the handwriting back.
  if (b.id === "convert" && page?.words?.length) {
    const all = page.words.filter(w => w.text).every(isConverted);
    for (const w of page.words) w.converted = !all;
    putPage(page); renderWords();
  }
  syncTools();
};
addEventListener("keydown", e => {
  if (!surface || e.target.closest("input")) return;
  if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); e.shiftKey ? surface.redo() : surface.undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); surface.redo(); }
});

// ---------- search ----------
async function showSearch(q) {
  header(STR.search, null, null, "search");
  $("#tools").hidden = true;
  main.innerHTML = `<div class="search"><input id="q" type="search" placeholder="${STR.searchHint}" value="${esc(q)}"><div id="results"></div></div>`;
  const pages = (await allPages()).filter(p => p.text);
  const run = () => {
    const term = strip($("#q").value.trim());
    if (!term) { $("#results").innerHTML = ""; return; }
    const hits = pages.filter(p => strip(p.text).includes(term)).sort((a, b) => b.key.localeCompare(a.key));
    $("#results").innerHTML = hits.length ? hits.map(p => {
      const line = p.text.split("\n").find(l => strip(l).includes(term)) || "";
      return `<a class="hit" href="${pageHref(p.key)}"><b>${esc(pageLabel(p.key))}</b><span>${esc(line)}</span></a>`;
    }).join("") : `<p class="hint">${STR.noResults}</p>`;
  };
  $("#q").oninput = run; $("#q").focus(); run();
}
const pageHref = k => k.startsWith("day:") ? `#/day/${k.slice(4)}` : k.startsWith("week:") ? `#/week/${k.slice(5)}`
  : k.startsWith("col:") ? `#/col/${k.split(":").slice(1).join("/")}` : "#/notes";
const pageLabel = k => k.startsWith("day:") ? parseIso(k.slice(4)).toLocaleDateString(LANG, { weekday: "short", day: "numeric", month: "long", year: "numeric" })
  : k.startsWith("week:") ? `${STR.week_n} ${k.slice(5)}`
  : k.startsWith("col:") && COLLECTIONS[k.split(":")[1]] ? `${colName(k.split(":")[1])} ${periodLabel(COLLECTIONS[k.split(":")[1]], k.split(":")[2])}` : STR.notes;

// ---------- settings ----------
$("#settingsBtn").onclick = () => {
  const dlg = $("#settings");
  dlg.innerHTML = `<form method="dialog"><h2>${STR.settings}</h2>
    <label>${STR.theme}: <select id="sTheme">${["auto", "light", "dark"].map(t => `<option value="${t}"${theme() === t ? " selected" : ""}>${STR[t]}</option>`).join("")}</select></label>
    <label>${STR.paper}: <select id="sPaper">${PAPERS.map(p => `<option value="${p}"${(localStorage.getItem("paper") || "lined") === p ? " selected" : ""}>${STR["paper_" + p]}</option>`).join("")}</select></label>
    <h3>${STR.collections}</h3>
    <div class="colpick">${Object.entries(COLLECTIONS).map(([id, c]) => `<label><input type="checkbox" data-col="${id}" ${enabledCollections().includes(id) ? "checked" : ""}> ${c.icon} ${esc(c[LANG][0])}</label>`).join("")}</div>
    <h3>${STR.writing}</h3>
    <label><input type="checkbox" id="sRecog" ${recognitionOn() ? "checked" : ""}> ${STR.recognition}</label>
    <label><input type="checkbox" id="sPen" ${inkSettings.penOnly ? "checked" : ""}> ${STR.penOnly}</label>
    <p>${STR.calib}: <b>${inkSettings.pressureMax.toFixed(2)}</b> <button type="button" id="sCal">${STR.reset}</button></p>
    <p>${matchMedia("(display-mode: standalone)").matches ? `✓ ${STR.installed}`
         : installPrompt ? `<button type="button" id="sInstall" class="primary">📲 ${STR.install}</button>` : `<span class="hint">📲 ${STR.installHint}</span>`}</p>
    <p><button type="button" id="sExport">${STR.backup}</button> <label class="file">${STR.restore}<input type="file" id="sImport" accept="application/json" hidden></label></p>
    <p class="hint">Ink Planner · MIT · <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a></p>
    <button class="primary">OK</button></form>`;
  $("#sInstall") && ($("#sInstall").onclick = async () => { await installPrompt.prompt(); installPrompt = null; dlg.close(); });
  $("#sTheme").onchange = e => { localStorage.setItem("theme", e.target.value); applyTheme(); };
  $("#sPaper").onchange = e => { localStorage.setItem("paper", e.target.value); if (location.hash.startsWith("#/notes")) route(); };
  $(".colpick").onchange = () => {
    localStorage.setItem("collections", JSON.stringify([...dlg.querySelectorAll("[data-col]:checked")].map(i => i.dataset.col)));
    if (location.hash === "#/col") route();
  };
  $("#sRecog").onchange = e => localStorage.setItem("recognition", e.target.checked ? "1" : "0");
  $("#sPen").onchange = e => { inkSettings.penOnly = e.target.checked; syncTools(); };
  $("#sCal").onclick = () => { localStorage.removeItem("pressureMax"); dlg.close(); };
  $("#sExport").onclick = async () => {
    const blob = new Blob([JSON.stringify(await exportAll())], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `ink-planner-${iso(new Date())}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  $("#sImport").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    await importAll(JSON.parse(await f.text())); alert(STR.restored); dlg.close(); route();
  };
  dlg.showModal();
};

// ---------- install ----------
// Chrome offers installation through this event; Settings shows an Install button while it is available.
let installPrompt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; });

// ---------- appearance ----------
const theme = () => localStorage.getItem("theme") || "auto";
function applyTheme() {
  const t = theme(), root = document.documentElement;
  if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t;
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = dark ? "#16171b" : "#f6f4ef";
  surface?.redraw();  // ink and typed text take the theme's colour
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
applyTheme();

// ---------- start ----------
$("#todayBtn").textContent = STR.today;
$("#todayBtn").onclick = () => {
  const v = location.hash.split("/")[1] || "day", t = new Date();
  location.hash = v === "month" ? `#/month/${iso(t).slice(0, 7)}` : v === "week" ? `#/week/${weekKey(t)}` : `#/day/${iso(t)}`;
};
for (const a of document.querySelectorAll("#views a")) a.textContent = STR[a.dataset.v];
for (const b of document.querySelectorAll("#tools [data-label]")) { b.title = STR[b.dataset.label]; b.setAttribute("aria-label", b.title); }
addEventListener("online", () => surface && page?.strokes.length && route());
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
loadLexicon();
scheduleReminders();
route();
