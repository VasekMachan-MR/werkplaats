/* Podpisové pole pro prst / Apple Pencil. Vrací PNG s průhledným pozadím, oříznuté na podpis. */
window.PodpisPad = class PodpisPad {
  constructor(canvas, { barva = "#1372e8", onZmena } = {}) {   // stejná modrá jako Vaškův podpis
    this.c = canvas; this.barva = barva; this.onZmena = onZmena;
    this.tahy = []; this.tah = null;
    this.prizpusob();
    this._resize = () => this.prizpusob();
    window.addEventListener("resize", this._resize);
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", e => this.zacni(e));
    canvas.addEventListener("pointermove", e => this.pokracuj(e));
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => canvas.addEventListener(t, () => this.skonci()));
  }
  prizpusob() {
    const r = this.c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(r.height * dpr);
    this.ctx = this.c.getContext("2d"); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.prekresli();
  }
  bod(e) {
    const r = this.c.getBoundingClientRect();
    const tlak = e.pointerType === "pen" && e.pressure ? e.pressure : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: 1.4 + tlak * 2.4 };
  }
  zacni(e) { e.preventDefault(); this.c.setPointerCapture?.(e.pointerId); this.tah = [this.bod(e)]; this.tahy.push(this.tah); this.prekresli(); }
  pokracuj(e) {
    if (!this.tah) return; e.preventDefault();
    for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) this.tah.push(this.bod(ev));
    this.prekresli();
  }
  skonci() { if (this.tah) { this.tah = null; this.onZmena?.(!this.prazdny()); } }
  prekresli(ctx = this.ctx, posun = { x: 0, y: 0 }) {
    if (!ctx) return;
    if (ctx === this.ctx) ctx.clearRect(0, 0, this.c.width, this.c.height);
    ctx.strokeStyle = this.barva; ctx.fillStyle = this.barva; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const t of this.tahy) {
      if (t.length === 1) { ctx.beginPath(); ctx.arc(t[0].x - posun.x, t[0].y - posun.y, t[0].w / 2, 0, 7); ctx.fill(); continue; }
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1], b = t[i];
        ctx.lineWidth = (a.w + b.w) / 2;
        ctx.beginPath(); ctx.moveTo(a.x - posun.x, a.y - posun.y); ctx.lineTo(b.x - posun.x, b.y - posun.y); ctx.stroke();
      }
    }
  }
  prazdny() { return this.tahy.reduce((n, t) => n + t.length, 0) < 3; }
  smazat() { this.tahy = []; this.prekresli(); this.onZmena?.(false); }
  /* PNG oříznuté na podpis, ve 3× rozlišení kvůli tisku */
  png() {
    if (this.prazdny()) return null;
    const vse = this.tahy.flat(), okraj = 6, S = 3;
    const x0 = Math.min(...vse.map(p => p.x)) - okraj, y0 = Math.min(...vse.map(p => p.y)) - okraj;
    const x1 = Math.max(...vse.map(p => p.x)) + okraj, y1 = Math.max(...vse.map(p => p.y)) + okraj;
    const c = document.createElement("canvas");
    c.width = Math.ceil((x1 - x0) * S); c.height = Math.ceil((y1 - y0) * S);
    const ctx = c.getContext("2d"); ctx.scale(S, S);
    this.prekresli(ctx, { x: x0, y: y0 });
    return c.toDataURL("image/png");
  }
  zrus() { window.removeEventListener("resize", this._resize); }
};
