// Ink surface for one planner page.
// Strokes live in page units (the page is always 1000 units wide), so a page looks the same on phone, tablet and laptop.
export const PAGE_W = 1000;

const settings = {
  get penOnly() { return localStorage.getItem("penOnly") !== "0"; },
  set penOnly(v) { localStorage.setItem("penOnly", v ? "1" : "0"); },
  // Pressure calibration: the device's usual firm pressure, learnt from the pen (light writers rarely pass 0.6).
  get pressureMax() { return +(localStorage.getItem("pressureMax") || 0.6); },
  set pressureMax(v) { localStorage.setItem("pressureMax", v.toFixed(3)); },
};
export { settings as inkSettings };

export class InkSurface {
  constructor(host, { height, background, strokes = [], onChange }) {
    this.host = host; this.height = height; this.onChange = onChange;
    this.strokes = strokes; this.nextId = Math.max(0, ...strokes.map(s => s.id)) + 1;
    this.undoStack = []; this.redoStack = [];
    this.tool = "pen"; this.cur = null; this.sawPen = false; this.pressures = [];
    // Converted words: their strokes are hidden and the typed text is drawn in their place.
    this.hidden = new Set(); this.labels = [];

    host.classList.add("ink-host");
    host.innerHTML = "";
    this.bg = document.createElement("div"); this.bg.className = "ink-bg"; this.bg.innerHTML = background;
    this.canvas = document.createElement("canvas"); this.canvas.className = "ink-canvas";
    host.append(this.bg, this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) this.canvas.addEventListener(ev, e => this[ev](e));
    this.resize();
  }

  destroy() { this.resizeObs.disconnect(); }

  resize() {
    const w = this.host.clientWidth; if (!w) return;
    this.scale = w / PAGE_W;
    const h = this.height * this.scale, d = devicePixelRatio || 1;
    this.host.style.height = h + "px";
    this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d);
    this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
    this.ctx.setTransform(d * this.scale, 0, 0, d * this.scale, 0, 0);
    this.redraw();
  }

  // ---------- drawing ----------
  width(p) { return 1.1 + 2.6 * Math.min(1, (p || 0.5) / settings.pressureMax); }
  ink() { return getComputedStyle(this.host).getPropertyValue("--ink").trim() || "#111"; }
  drawStroke(s, from = 1) {
    const c = this.ctx, pts = s.pts; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = this.inkColor;
    if (pts.length === 1) { c.beginPath(); c.arc(pts[0][0], pts[0][1], this.width(pts[0][3]) / 2, 0, 7); c.fillStyle = this.inkColor; c.fill(); return; }
    for (let i = Math.max(1, from); i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      c.lineWidth = this.width((a[3] + b[3]) / 2);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
  }
  redraw() {
    this.inkColor = this.ink();
    this.ctx.save(); this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.ctx.restore();
    for (const s of this.strokes) if (!this.hidden.has(s.id)) this.drawStroke(s);
    this.drawLabels();
  }

  // labels: [{ text, x, baseline, limit, join }] in page units, in reading order.
  // `join` places a word right after the previous label with a normal space; `limit` is the right edge it must not pass.
  setConverted(hiddenIds, labels) { this.hidden = new Set(hiddenIds); this.labels = labels; this.redraw(); }
  drawLabels() {
    const c = this.ctx, font = getComputedStyle(this.host).fontFamily;
    c.fillStyle = this.inkColor; c.textBaseline = "alphabetic";
    let end = 0;
    for (const l of this.labels) {
      let size = 30;
      c.font = `${size}px ${font}`;
      const x = l.join ? end + c.measureText(" ").width : l.x, w = c.measureText(l.text).width;
      if (w > l.limit - x) { size = Math.max(16, size * (l.limit - x) / w); c.font = `${size}px ${font}`; }
      c.fillText(l.text, x, l.baseline);
      end = x + c.measureText(l.text).width;
    }
  }

  // ---------- input ----------
  pt(e) {
    const r = this.canvas.getBoundingClientRect();
    return [+((e.clientX - r.left) / this.scale).toFixed(1), +((e.clientY - r.top) / this.scale).toFixed(1), Math.round(e.timeStamp), +(e.pressure || 0.5).toFixed(3)];
  }
  // Palm rejection: once a pen has been seen, fingers scroll the page instead of drawing.
  fingerScrolls(e) { return e.pointerType === "touch" && settings.penOnly && this.sawPen; }

  pointerdown(e) {
    if (e.pointerType === "pen") this.sawPen = true;
    this.canvas.setPointerCapture(e.pointerId);
    if (this.fingerScrolls(e)) { this.scrollY = e.clientY; this.cur = { scroll: true }; return; }
    if (e.button === 2) return;
    const erase = this.tool === "eraser" || (e.buttons & 32) === 32;
    this.cur = erase ? { erase: true, removed: [] } : { id: this.nextId++, pts: [this.pt(e)] };
    if (erase) this.eraseAt(this.pt(e));
  }
  pointermove(e) {
    if (!this.cur) return;
    if (this.cur.scroll) { const sc = this.host.closest(".scroller"); sc && sc.scrollBy(0, this.scrollY - e.clientY); this.scrollY = e.clientY; return; }
    for (const ev of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) {
      const p = this.pt(ev);
      if (this.cur.erase) { this.eraseAt(p); continue; }
      const last = this.cur.pts[this.cur.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) continue;
      if (e.pointerType === "pen" && p[3] > 0) this.pressures.push(p[3]);
      this.cur.pts.push(p);
      this.drawStroke(this.cur, this.cur.pts.length - 1);
    }
  }
  pointerup() {
    const c = this.cur; this.cur = null;
    if (!c || c.scroll) return;
    if (c.erase) { if (c.removed.length) this.commit({ removed: c.removed }); return; }
    this.strokes.push(c);
    this.commit({ added: [c] });
    this.calibrate();
  }
  pointercancel() { this.cur = null; this.redraw(); }

  // Learn the writer's firm pressure (90th percentile), so light writers still get full-width lines.
  calibrate() {
    if (this.pressures.length < 200) return;
    const s = [...this.pressures].sort((a, b) => a - b);
    settings.pressureMax = Math.min(1, Math.max(0.15, s[Math.floor(s.length * 0.9)]));
    this.pressures = this.pressures.slice(-2000);
  }

  eraseAt([x, y]) {
    const r = 12, hit = this.strokes.filter(s => s.pts.some(q => Math.hypot(q[0] - x, q[1] - y) < r));
    if (!hit.length) return;
    this.strokes = this.strokes.filter(s => !hit.includes(s));
    this.cur.removed.push(...hit);
    this.redraw();
  }

  // ---------- history ----------
  commit(change) { this.undoStack.push(change); this.redoStack = []; this.onChange?.(this.strokes); }
  undo() { this.apply(this.undoStack, this.redoStack, true); }
  redo() { this.apply(this.redoStack, this.undoStack, false); }
  apply(from, to, reverse) {
    const ch = from.pop(); if (!ch) return;
    const add = reverse ? ch.removed : ch.added, rem = reverse ? ch.added : ch.removed;
    if (rem) this.strokes = this.strokes.filter(s => !rem.includes(s));
    if (add) this.strokes.push(...add);
    to.push(ch); this.redraw(); this.onChange?.(this.strokes);
  }
}
