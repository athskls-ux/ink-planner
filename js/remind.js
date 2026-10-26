// Reminders: a notification some minutes before an appointment.
// A web app can only fire them while the browser is running (also in the background); when the browser has been
// closed they are missed, and a missed reminder is shown on the next start if it is less than 15 minutes late.
// Reliable reminders come with Google Calendar sync.
import { allPages } from "./store.js";
import { occurrences } from "./recurring.js";
import { iso, addDays } from "./dates.js";

const FIRED = "remindersFired";
let timers = [];

export async function askNotifications() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "default") await Notification.requestPermission();
  return Notification.permission === "granted";
}

const fired = () => new Set(JSON.parse(localStorage.getItem(FIRED) || "[]"));

export async function scheduleReminders() {
  timers.forEach(clearTimeout); timers = [];
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const done = fired(), now = Date.now();
  // Day pages hold one-off items; repeating items are expanded for today and tomorrow.
  const days = (await allPages()).filter(p => p.key.startsWith("day:")).map(p => [p.key.slice(4), (p.events || []).filter(e => e.rid == null)]);
  for (const d of [0, 1].map(n => iso(addDays(new Date(), n)))) days.push([d, await occurrences(d)]);
  for (const [date, events] of days) {
    for (const e of events) {
      if (!e.remind || !e.time || ["done", "cancelled", "migrated"].includes(e.status)) continue;
      const at = new Date(`${date}T${e.time}`).getTime() - e.remind * 60000;
      const id = `${date}|${e.time}|${e.text}|${e.remind}`;
      if (done.has(id) || at < now - 15 * 60000 || at > now + 2 * 864e5) continue;
      timers.push(setTimeout(() => fire(id, e, date), Math.max(0, at - now)));
    }
  }
}

async function fire(id, e, date) {
  const done = fired(); if (done.has(id)) return;
  done.add(id); localStorage.setItem(FIRED, JSON.stringify([...done].slice(-300)));
  const opts = { body: `${e.time} · ${e.text}`, tag: id, icon: "icon.svg", data: { url: `./#/day/${date}` } };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification(e.text, opts); else new Notification(e.text, opts);
}

addEventListener("visibilitychange", () => document.visibilityState === "visible" && scheduleReminders());
