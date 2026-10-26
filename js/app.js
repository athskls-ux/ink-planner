// Ink Planner: month, week and day pages you write on with a pen; handwriting becomes searchable text.
import { getPage, putPage, allPages, exportAll, importAll } from "./store.js";
import { InkSurface, inkSettings } from "./ink.js";
import { dayTemplate, weekTemplate, notesTemplate, lineFinder } from "./templates.js";
import { recognise, pageText } from "./recognize.js";
import { loadLexicon, learn, strip } from "./lexicon.js";
import { iso, parseIso, addDays, addMonths, monday, weekKey, weekStart, isoWeek, sameDay } from "./dates.js";
import { askNotifications, scheduleReminders } from "./remind.js";

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
        newItem: "Νέο ραντεβού ή δουλειά…", add: "Προσθήκη", theme: "Εμφάνιση", auto: "Αυτόματο", light: "Φωτεινό", dark: "Σκούρο" },
  en: { today: "Today", month: "Month", week: "Week", day: "Day", notes: "Notes", search: "Search", pen: "Pen", eraser: "Eraser",
        undo: "Undo", redo: "Redo", penOnly: "Pen only", text: "Text", recognising: "Recognising…", offline: "Offline: recognition will run later",
        empty: "Write with the pen; the text appears here.", fix: "Correct", save: "Save", cancel: "Cancel", searchHint: "Search your handwriting…",
        noResults: "Nothing found.", settings: "Settings", recognition: "Handwriting recognition", backup: "Backup (JSON)", restore: "Restore from backup",
        calib: "Pressure calibration", reset: "Reset", week_n: "Week", tapFix: "Tap a word to correct it.", restored: "Restore complete.",
        convert: "Convert to text", showInk: "Show handwriting", agenda: "Schedule", addCal: "Add to Google Calendar",
        noAgenda: "Write next to an hour, or start a line with a time (e.g. 10:30), to add an appointment or task.", done: "Done", time: "Time",
        status: "Status", task: "Task", event: "Appointment", star: "Important", cancelItem: "Cancel", reopen: "Reopen",
        remind: "Reminder", migrate: "Postpone", move: "Move", notifOff: "Notifications are blocked for this page in the browser.",
        newItem: "New appointment or task…", add: "Add", theme: "Appearance", auto: "Automatic", light: "Light", dark: "Dark" },
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
  if (view === "notes") return showInk("notes:inbox", notesTemplate(), STR.notes);
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
  let cells = "";
  for (let i = 0; i < 7; i++) cells += `<div class="dow">${addDays(start, i).toLocaleDateString(LANG, { weekday: "short" })}</div>`;
  for (let i = 0; i < nWeeks * 7; i++) {
    const day = addDays(start, i);
    // Appointments first (with their time), then the day's other notes.
    const p = pages.get("day:" + iso(day));
    const open = e => !e.done && !["done", "cancelled", "migrated"].includes(e.status);
    const snippet = (p?.events?.length ? p.events.filter(open).map(e => `${eventTime(e)} ${e.text}`) : (p?.text || "").split("\n").filter(Boolean)).slice(0, 3);
    const ink = p?.strokes?.length && !snippet.length;
    cells += `<a class="cell${day.getMonth() !== first.getMonth() ? " out" : ""}${sameDay(day, today) ? " today" : ""}" href="#/day/${iso(day)}">
      <span class="num">${day.getDate()}</span>${snippet.map(s => `<span class="snip">${esc(s)}</span>`).join("")}${ink ? `<span class="dot"></span>` : ""}</a>`;
  }
  const weeks = Array.from({ length: nWeeks }, (_, i) => addDays(start, i * 7));
  main.innerHTML = `<div class="month" style="--weeks:${nWeeks}">${cells}</div>
    <div class="weeklinks">${weeks.map(w => `<a href="#/week/${weekKey(w)}">${STR.week_n} ${isoWeek(w).week}</a>`).join("")}</div>`;
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

let surface = null, saveTimer = null, recogTimer = null, page = null, tplNow = null;
function closeSurface() { surface?.destroy(); surface = null; clearTimeout(saveTimer); clearTimeout(recogTimer); }

// `title` is only given for pages without dates (notes), which have no prev/next.
async function showInk(key, tpl, title) {
  if (title) header(title, null, null, "notes");
  page = (await getPage(key)) || { key, strokes: [], words: [], text: "" };
  tplNow = tpl;
  main.innerHTML = `<div class="inkview">
      <div class="scroller"><div class="sheet"><div id="ink"></div></div></div>
      <aside class="transcript">${tpl.slots ? `<h3>${STR.agenda}</h3><div id="agenda"></div>` : ""}
        <h3>${STR.text} <span id="rstatus"></span></h3><div id="words"></div><p class="hint">${STR.tapFix}</p></aside>
    </div>`;
  surface = new InkSurface($("#ink"), {
    height: tpl.height, background: tpl.background, strokes: page.strokes,
    onChange: strokes => { page.strokes = strokes; scheduleSave(); scheduleRecognition(tpl); },
  });
  syncTools();
  renderWords();
  // Pages written while offline (or before recognition was on) get recognised on open.
  if (page.strokes.length && (!page.words?.length || page.words.some(w => w.error))) scheduleRecognition(tpl, 300);
}

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => putPage(page), 500); }

function scheduleRecognition(tpl, delay = 1600) {
  clearTimeout(recogTimer);
  if (!recognitionOn()) return;
  recogTimer = setTimeout(async () => {
    const status = $("#rstatus");
    if (!navigator.onLine) { status && (status.textContent = STR.offline); return; }
    status && (status.textContent = STR.recognising);
    const current = page;
    await loadLexicon();
    const words = await recognise(current.strokes, lineFinder(tpl.baselines), current.words);
    if (current !== page) return;
    page.words = words; page.text = pageText(words); page.events = extractEvents();
    await putPage(page);
    renderWords();
    $("#rstatus") && ($("#rstatus").textContent = "");
  }, delay);
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
    if (!isConverted(w) || !w.text) return;
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
    labels.push({ text: (e.star ? "★" : "") + symbol(e), x: 56, baseline: baseline(line), limit: 78, size: 22, muted: true });
    if (e.line == null) labels.push({ text: e.text, x: tplNow.textX, baseline: baseline(line), limit: 992, strike: e.status === "cancelled" });
  }
  surface.setConverted(hidden, labels);
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
  for (const w of [...(page.words || [])].sort((a, b) => a.x - b.x)) if (w.text) (lines.get(w.line) || lines.set(w.line, []).get(w.line)).push(w.text);
  const events = [];
  for (const [line, ws] of lines) {
    splitLine(ws.join(" ")).forEach((p, part) => {
      const key = part ? `${line}.${part}` : String(line);
      const time = picked[key] || p.time || (line < tplNow.slots.length ? hm(tplNow.slots[line]) : null);
      if (time) events.push({ kind: "task", status: "open", ...meta[key], line, part, time, text: p.text });
    });
  }
  for (const it of page.items || []) events.push({ kind: "task", status: "open", ...it });
  return events.sort((a, b) => a.time.localeCompare(b.time));
}
// Pages saved before exact times existed have { hour } events.
const eventTime = e => e.time || hm(e.hour);
// • task  ○ appointment  × done  > postponed; a cancelled item keeps its symbol and is struck through.
const symbol = e => e.status === "done" || e.done ? "×" : e.status === "migrated" ? ">" : e.kind === "event" ? "○" : "•";
const shortDate = d => parseIso(d).toLocaleDateString(LANG, { weekday: "short", day: "numeric", month: "short" });

async function updateItem(e, patch) {
  if (e.line != null) { const k = partKey(e); page.meta = { ...page.meta, [k]: { ...page.meta?.[k], ...patch } }; }
  else Object.assign(page.items.find(i => i.id === e.id), patch);
  if (patch.time && e.line != null) page.times = { ...page.times, [partKey(e)]: patch.time };
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

// Google Calendar's "create event" link: it opens the event pre-filled (one hour long) and you press Save.
function calendarLink(date, e) {
  const [h, m] = eventTime(e).split(":").map(Number), end = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  const d = date.replace(/-/g, ""), t = mins => `${d}T${hm(Math.floor(mins / 60), mins % 60).replace(":", "")}00`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.text)}&dates=${t(h * 60 + m)}/${t(end)}&ctz=${encodeURIComponent(tz)}`;
}

function renderAgenda() {
  const box = $("#agenda"); if (!box) return;
  const events = page.events || [], date = page.key.slice(4);
  const remindLabel = m => REMIND.find(([v]) => v === m)?.[1] || "";
  box.innerHTML = events.length ? events.map((e, i) => `<div class="event s-${e.status || "open"}">
      <button class="sym" data-i="${i}" aria-label="${STR.status}">${symbol(e)}</button>
      <input type="time" class="time" data-i="${i}" value="${eventTime(e)}" aria-label="${STR.time}">
      <span class="etext">${e.star ? '<b class="star">★</b> ' : ""}${esc(e.text)}
        ${e.to ? `<small>&gt; ${esc(shortDate(e.to))}</small>` : ""}${e.from ? `<small>&lt; ${esc(shortDate(e.from))}</small>` : ""}</span>
      ${e.remind ? `<span class="bell" title="${STR.remind}: ${remindLabel(e.remind)}">🔔</span>` : ""}
      <a href="${calendarLink(date, e)}" target="_blank" rel="noopener" title="${STR.addCal}" aria-label="${STR.addCal}">📅</a></div>`).join("")
    + `<p class="legend">• ${STR.task} · ○ ${STR.event} · × ${STR.done} · &gt; ${STR.migrate} · ★ ${STR.star}</p>`
    : `<p class="hint">${STR.noAgenda}</p>`;
  // Typed entry, for any time (two things between 7 and 8) or when there is no pen at hand.
  const next = hm(Math.min(22, new Date().getHours() + 1));
  box.insertAdjacentHTML("beforeend", `<form class="additem"><input type="time" value="${next}" required aria-label="${STR.time}">
    <input type="text" placeholder="${STR.newItem}" required><button class="primary" aria-label="${STR.add}">+</button></form>`);
  $(".additem", box).onsubmit = async ev => {
    ev.preventDefault();
    const [t, x] = ev.target.querySelectorAll("input");
    page.items = [...(page.items || []), { id: Date.now().toString(36), time: t.value, text: x.value.trim(), kind: "task", status: "open" }];
    page.events = extractEvents(); await putPage(page);
    renderAgenda(); showConverted(); scheduleReminders();
  };
  box.onchange = e => { const ev = events[+e.target.dataset.i]; if (ev && e.target.value) updateItem(ev, { time: e.target.value }); };
  box.onclick = e => { const b = e.target.closest(".sym"); if (b) itemMenu(events[+b.dataset.i], b); };
}

const REMIND = [[0, "—"], [10, "10′"], [30, "30′"], [60, "1h"], [1440, "1d"]];
// Item menu: kind, status, star, reminder and postpone.
function itemMenu(e, anchor) {
  $("#pop")?.remove();
  const pop = document.createElement("div"); pop.id = "pop"; pop.className = "pop menu";
  const btn = (act, label, on) => `<button data-act="${act}"${on ? ' class="on"' : ""}>${label}</button>`;
  const tomorrow = iso(addDays(parseIso(page.key.slice(4)), 1));
  pop.innerHTML = `<div class="row">${btn("task", "• " + STR.task, e.kind !== "event")}${btn("event", "○ " + STR.event, e.kind === "event")}${btn("star", "★ " + STR.star, e.star)}</div>
    <div class="row">${btn("done", "× " + STR.done, e.status === "done")}${btn("cancelled", "⊘ " + STR.cancelItem, e.status === "cancelled")}${btn("open", "↺ " + STR.reopen)}</div>
    <div class="row"><span>🔔 ${STR.remind}</span>${REMIND.map(([m, l]) => btn("r" + m, l, (e.remind || 0) === m)).join("")}</div>
    <form class="row"><span>&gt; ${STR.migrate}</span><input type="date" value="${tomorrow}" required><input type="time" value="${eventTime(e)}"><button class="primary">${STR.move}</button></form>`;
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > innerHeight ? Math.max(8, r.top - pop.offsetHeight - 6) : r.bottom + 6) + "px";
  pop.onclick = async ev => {
    const act = ev.target.closest("button[data-act]")?.dataset.act; if (!act) return;
    pop.remove();
    if (act === "task" || act === "event") return updateItem(e, { kind: act });
    if (act === "star") return updateItem(e, { star: !e.star });
    if (act === "done" || act === "cancelled" || act === "open") return updateItem(e, { status: act, ...(act === "open" ? { to: null } : {}) });
    if (act[0] === "r") {
      const m = +act.slice(1);
      if (m && !(await askNotifications())) alert(STR.notifOff);
      return updateItem(e, { remind: m });
    }
  };
  $("form", pop).onsubmit = ev => {
    ev.preventDefault();
    const [d, t] = pop.querySelectorAll("form input");
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
    `<button class="word${w.fixed ? " fixed" : ""}${w.error ? " err" : ""}" data-i="${i}">${esc(w.text || "?")}</button>`).join("")}</div>`).join("");
  box.onclick = e => { const b = e.target.closest(".word"); if (b) correct(+b.dataset.i, b); };
}

// Correction popover: pick another guess or type the word. Confirmed words go into the personal dictionary.
function correct(i, anchor) {
  const w = page.words[i];
  $("#pop")?.remove();
  const pop = document.createElement("div"); pop.id = "pop"; pop.className = "pop";
  pop.innerHTML = `<div class="cands">${(w.cands || []).map(c => `<button>${esc(c)}</button>`).join("")}</div>
    <form><input value="${esc(w.text || "")}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="primary">${STR.save}</button><button type="button" class="ghost">${STR.cancel}</button></form>
    ${isConverted(w) ? `<button type="button" class="ghost back">✍ ${STR.showInk}</button>` : ""}`;
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + "px";
  const input = $("input", pop);
  const apply = async text => {
    pop.remove();
    text = text.trim(); if (!text) return;
    w.text = text; w.fixed = true; w.converted = true; page.text = pageText(page.words); page.events = extractEvents();
    await putPage(page); await learn(text); renderWords();
  };
  $(".cands", pop).onclick = e => e.target.tagName === "BUTTON" && apply(e.target.textContent);
  $("form", pop).onsubmit = e => { e.preventDefault(); apply(input.value); };
  $("form .ghost", pop).onclick = () => pop.remove();
  const back = $(".back", pop);
  if (back) back.onclick = async () => { pop.remove(); w.converted = false; await putPage(page); renderWords(); };
}
document.addEventListener("pointerdown", e => { const p = $("#pop"); if (p && !p.contains(e.target) && !e.target.closest(".word")) p.remove(); });

// ---------- tools ----------
function syncTools() {
  $("#tools").hidden = !surface;
  if (!surface) return;
  for (const b of document.querySelectorAll("#tools [data-tool]")) b.classList.toggle("on", surface.tool === b.dataset.tool);
  $("#penOnly").classList.toggle("on", inkSettings.penOnly);
}
$("#tools").onclick = e => {
  const b = e.target.closest("button"); if (!b || !surface) return;
  if (b.dataset.tool) surface.tool = b.dataset.tool;
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
const pageHref = k => k.startsWith("day:") ? `#/day/${k.slice(4)}` : k.startsWith("week:") ? `#/week/${k.slice(5)}` : "#/notes";
const pageLabel = k => k.startsWith("day:") ? parseIso(k.slice(4)).toLocaleDateString(LANG, { weekday: "short", day: "numeric", month: "long", year: "numeric" })
  : k.startsWith("week:") ? `${STR.week_n} ${k.slice(5)}` : STR.notes;

// ---------- settings ----------
$("#settingsBtn").onclick = () => {
  const dlg = $("#settings");
  dlg.innerHTML = `<form method="dialog"><h2>${STR.settings}</h2>
    <label>${STR.theme}: <select id="sTheme">${["auto", "light", "dark"].map(t => `<option value="${t}"${theme() === t ? " selected" : ""}>${STR[t]}</option>`).join("")}</select></label>
    <label><input type="checkbox" id="sRecog" ${recognitionOn() ? "checked" : ""}> ${STR.recognition}</label>
    <label><input type="checkbox" id="sPen" ${inkSettings.penOnly ? "checked" : ""}> ${STR.penOnly}</label>
    <p>${STR.calib}: <b>${inkSettings.pressureMax.toFixed(2)}</b> <button type="button" id="sCal">${STR.reset}</button></p>
    <p><button type="button" id="sExport">${STR.backup}</button> <label class="file">${STR.restore}<input type="file" id="sImport" accept="application/json" hidden></label></p>
    <p class="hint">Ink Planner · MIT · <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a></p>
    <button class="primary">OK</button></form>`;
  $("#sTheme").onchange = e => { localStorage.setItem("theme", e.target.value); applyTheme(); };
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
