// Ink Planner: month, week and day pages you write on with a pen; handwriting becomes searchable text.
import { getPage, putPage, allPages, exportAll, importAll } from "./store.js";
import { InkSurface, inkSettings } from "./ink.js";
import { dayTemplate, weekTemplate, notesTemplate, lineFinder } from "./templates.js";
import { recognise, pageText } from "./recognize.js";
import { loadLexicon, learn, strip } from "./lexicon.js";
import { iso, parseIso, addDays, addMonths, monday, weekKey, weekStart, isoWeek, sameDay } from "./dates.js";

// ---------- language ----------
const LANG = (navigator.language || "en").startsWith("el") ? "el" : "en";
const STR = {
  el: { today: "Σήμερα", month: "Μήνας", week: "Εβδομάδα", day: "Ημέρα", notes: "Σημειώσεις", search: "Αναζήτηση", pen: "Στυλό", eraser: "Γόμα",
        undo: "Αναίρεση", redo: "Επανάληψη", penOnly: "Μόνο γραφίδα", text: "Κείμενο", recognising: "Αναγνώριση…", offline: "Εκτός σύνδεσης: η αναγνώριση θα γίνει αργότερα",
        empty: "Γράψε με τη γραφίδα· το κείμενο εμφανίζεται εδώ.", fix: "Διόρθωση", save: "Αποθήκευση", cancel: "Άκυρο", searchHint: "Ψάξε στις χειρόγραφες σημειώσεις…",
        noResults: "Δεν βρέθηκε τίποτα.", settings: "Ρυθμίσεις", recognition: "Αναγνώριση χειρογράφου", backup: "Αντίγραφο ασφαλείας (JSON)", restore: "Επαναφορά από αντίγραφο",
        calib: "Βαθμονόμηση πίεσης", reset: "Επαναφορά", week_n: "Εβδομάδα", tapFix: "Πάτα μια λέξη για να τη διορθώσεις.", restored: "Η επαναφορά ολοκληρώθηκε.",
        convert: "Μετατροπή σε κείμενο", showInk: "Δείξε το χειρόγραφο", agenda: "Πρόγραμμα", addCal: "Πρόσθεσε στο Google Calendar",
        noAgenda: "Γράψε δίπλα σε μια ώρα για να κλείσεις ραντεβού ή δουλειά.", done: "Έγινε" },
  en: { today: "Today", month: "Month", week: "Week", day: "Day", notes: "Notes", search: "Search", pen: "Pen", eraser: "Eraser",
        undo: "Undo", redo: "Redo", penOnly: "Pen only", text: "Text", recognising: "Recognising…", offline: "Offline: recognition will run later",
        empty: "Write with the pen; the text appears here.", fix: "Correct", save: "Save", cancel: "Cancel", searchHint: "Search your handwriting…",
        noResults: "Nothing found.", settings: "Settings", recognition: "Handwriting recognition", backup: "Backup (JSON)", restore: "Restore from backup",
        calib: "Pressure calibration", reset: "Reset", week_n: "Week", tapFix: "Tap a word to correct it.", restored: "Restore complete.",
        convert: "Convert to text", showInk: "Show handwriting", agenda: "Schedule", addCal: "Add to Google Calendar",
        noAgenda: "Write next to an hour to add an appointment or task.", done: "Done" },
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
    const snippet = (p?.events?.length ? p.events.filter(e => !e.done).map(e => `${hh(e.hour)} ${e.text}`) : (p?.text || "").split("\n").filter(Boolean)).slice(0, 3);
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
  const hidden = [], labels = [];
  words.forEach((w, i) => {
    if (!isConverted(w) || !w.text) return;
    hidden.push(...w.key.split(".").map(Number));
    const prev = words[i - 1], sameLine = o => o.line === w.line;
    // A run of converted words on one line reads as one sentence: each follows the previous with a normal space.
    const join = !!prev && sameLine(prev) && isConverted(prev) && !!prev.text;
    const nextInk = words.slice(i + 1).find(o => sameLine(o) && !isConverted(o));
    labels.push({ text: w.text, x: w.x, join, baseline: (tplNow.baselines[w.line] ?? w.y + w.h) - 10, limit: (nextInk ? nextInk.x : 1000) - 8 });
  });
  surface.setConverted(hidden, labels);
}

// ---------- schedule ----------
// On a day page, each hour line with writing on it is an appointment or task: { hour, text, done }.
function extractEvents() {
  if (!tplNow?.slots) return undefined;
  const done = new Set((page.events || []).filter(e => e.done).map(e => e.hour + "|" + e.text));
  return tplNow.slots.map((hour, line) => {
    const text = (page.words || []).filter(w => w.line === line && w.text).sort((a, b) => a.x - b.x).map(w => w.text).join(" ");
    return text && { hour, text, done: done.has(hour + "|" + text) };
  }).filter(Boolean);
}

const hh = h => String(h).padStart(2, "0") + ":00";
// Google Calendar's "create event" link: it opens the event pre-filled and you press Save. No account setup needed.
function calendarLink(date, e) {
  const d = date.replace(/-/g, ""), t = h => `${d}T${String(h).padStart(2, "0")}0000`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.text)}&dates=${t(e.hour)}/${t(e.hour + 1)}&ctz=${encodeURIComponent(tz)}`;
}

function renderAgenda() {
  const box = $("#agenda"); if (!box) return;
  const events = page.events || [], date = page.key.slice(4);
  box.innerHTML = events.length ? events.map((e, i) => `<div class="event${e.done ? " done" : ""}">
      <label><input type="checkbox" data-i="${i}" ${e.done ? "checked" : ""} aria-label="${STR.done}"><b>${hh(e.hour)}</b> <span>${esc(e.text)}</span></label>
      <a href="${calendarLink(date, e)}" target="_blank" rel="noopener" title="${STR.addCal}" aria-label="${STR.addCal}">📅</a></div>`).join("")
    : `<p class="hint">${STR.noAgenda}</p>`;
  box.onchange = async e => { const ev = events[+e.target.dataset.i]; if (!ev) return; ev.done = e.target.checked; await putPage(page); renderAgenda(); };
}

function renderWords() {
  showConverted();
  if (tplNow?.slots && !page.events && page.words?.length) page.events = extractEvents();
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
    <label><input type="checkbox" id="sRecog" ${recognitionOn() ? "checked" : ""}> ${STR.recognition}</label>
    <label><input type="checkbox" id="sPen" ${inkSettings.penOnly ? "checked" : ""}> ${STR.penOnly}</label>
    <p>${STR.calib}: <b>${inkSettings.pressureMax.toFixed(2)}</b> <button type="button" id="sCal">${STR.reset}</button></p>
    <p><button type="button" id="sExport">${STR.backup}</button> <label class="file">${STR.restore}<input type="file" id="sImport" accept="application/json" hidden></label></p>
    <p class="hint">Ink Planner · MIT · <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a></p>
    <button class="primary">OK</button></form>`;
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
route();
