// Repeating items (birthdays, weekly classes, monthly bills...), kept in one record with key "recurring".
// A series { id, text, time ("" = all day), kind, star, remind, repeat, origin, start, done: {date: true} } shows up on
// every matching day page; ticking it off marks only that day.
import { getPage, putPage } from "./store.js";
import { parseIso } from "./dates.js";

export const REPEATS = ["daily", "weekdays", "weekly", "monthly", "yearly"];
let cache = null;

export async function loadRecurring() { cache ||= (await getPage("recurring"))?.list || []; return cache; }
const save = () => putPage({ key: "recurring", list: cache });

// `origin` is the date the series is measured from (a birthday's date); `start` is the first day it is shown.
export function occurs(r, date) {
  if (date < r.start) return false;
  const d = parseIso(date), o = parseIso(r.origin || r.start);
  switch (r.repeat) {
    case "daily": return true;
    case "weekdays": return d.getDay() % 6 !== 0;
    case "weekly": return d.getDay() === o.getDay();
    case "monthly": return d.getDate() === o.getDate();
    case "yearly": return d.getDate() === o.getDate() && d.getMonth() === o.getMonth();
    default: return false;
  }
}

export async function occurrences(date) {
  return (await loadRecurring()).filter(r => occurs(r, date)).map(r => ({
    rid: r.id, time: r.time || "", text: r.text, kind: r.kind || "task", star: !!r.star, remind: r.remind || 0,
    repeat: r.repeat, status: r.done?.[date] === true ? "done" : r.done?.[date] || "open",
  }));
}

export async function addRecurring(r) { await loadRecurring(); cache.push({ id: Date.now().toString(36), done: {}, ...r }); await save(); }

// Status changes (done, cancelled) apply to one day; everything else (time, kind, star, reminder, repeat) to the series.
export async function updateRecurring(id, date, patch) {
  const r = (await loadRecurring()).find(x => x.id === id); if (!r) return;
  const { status, to, ...rest } = patch;
  if (status) { r.done = { ...r.done }; if (status === "open") delete r.done[date]; else r.done[date] = status; }
  if (rest.repeat === "") cache = cache.filter(x => x !== r);  // "no repeat" ends the series
  else Object.assign(r, rest);
  await save();
}
