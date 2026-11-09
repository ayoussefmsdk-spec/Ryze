/* =====================================================================
   HDJ — video/studio.js : « studio » d'enregistrement des films de
   démonstration (Playwright + Chromium + ffmpeg, sans son).

   Principe : l'application (app/index.html) est ouverte dans un profil
   jetable ; des calques (curseur, anneau de clic, sous-titre, pastille de
   chapitre, barre de progression, carton, voile, image de fondu enchaîné)
   sont injectés dans la page, hors de #app ; chaque image du film est un
   pas de temps déterministe : l'état des calques est calculé ici (Node),
   appliqué dans la page, puis capturé (JPEG) et envoyé directement à
   ffmpeg par un tube (image2pipe) — aucune image n'est écrite sur le disque.
   Chaque chapitre est un fichier seg-XX-nom.mp4 ; assembler() les
   concatène sans ré-encodage et écrit minutage.json.

   API (toutes les méthodes sont async, durées en secondes) : voir
   video/README.md. Aucune donnée réelle : base de démonstration fictive.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

function chargerPlaywright() {
  try { return require('playwright'); } catch (e) { /* suite */ }
  try { const g = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); return require(path.join(g, 'playwright')); } catch (e) { /* suite */ }
  throw new Error('Playwright introuvable : export NODE_PATH=$(npm root -g)');
}

const RACINE = path.resolve(__dirname, '..');
const APP_URL = 'file://' + path.join(RACINE, 'app', 'index.html');
const CLE_BASE = 'ryze-hdj-v1';
const VERT = '#14332E', ACCENT = '#1C9C8A';
const SOUS_TITRE_MIN = 2.5, ENTREE_ST = 0.35, SORTIE_ST = 0.25;
const ACCEL = (3 - 1) / 0.6; /* rampes : 1× → 3× en 0,6 s */

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const borne = (v, a, b) => Math.max(a, Math.min(b, v));
const lisse = t => { t = borne(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }; /* ease in-out cubique */
const sortieDouce = t => { t = borne(t, 0, 1); return 1 - Math.pow(1 - t, 3); }; /* ease out */
const deux = n => String(n).padStart(2, '0');
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'segment';
const arrondi = v => Math.round(v * 1000) / 1000;

/* ---------------------------------------------------------------------
   Code exécuté dans la page (installé à chaque document par addInitScript) :
   window.__studio.appliquer(etat) injecte les calques s'ils manquent,
   applique l'état de l'image courante puis attend 2 requestAnimationFrame
   et les polices.
   --------------------------------------------------------------------- */
function installerDansLaPage() {
  if (window.__studio) return;
  const CSS = `
#vs-racine{position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;font-family:'IBM Plex Sans',system-ui,sans-serif;color:#fff;overflow:hidden}
#vs-racine *{box-sizing:border-box;pointer-events:none}
#vs-racine>div,#vs-racine>img{position:absolute}
#vs-snap{left:0;top:0;width:100%;height:100%;display:none;z-index:1}
#vs-chap{z-index:2;display:none;background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#14332E;font-size:18px;font-weight:600;line-height:1;min-width:218px;padding:15px 20px 15px 18px;border-radius:14px;box-shadow:0 4px 16px rgba(16,28,26,.2);white-space:nowrap;letter-spacing:.01em}
#vs-chap b{font-weight:600;color:#1C9C8A;margin-right:2px}
#vs-st{z-index:3;display:none;left:56px;bottom:56px;max-width:1180px;background:rgba(16,28,26,.88);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-radius:14px;padding:20px 32px 21px 33px;box-shadow:0 10px 30px rgba(0,0,0,.25);overflow:hidden}
#vs-st::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:#1C9C8A}
#vs-st .l1{font-size:34px;font-weight:600;line-height:1.2;color:#fff;letter-spacing:-.005em}
#vs-st .l2{font-size:22px;font-weight:400;line-height:1.35;color:rgba(255,255,255,.82);margin-top:6px}
#vs-st .l2:empty{display:none}
#vs-ring{z-index:4;display:none;width:46px;height:46px;margin:-23px 0 0 -23px;left:0;top:0;border-radius:50%;border:3px solid #1C9C8A;background:rgba(28,156,138,.12)}
#vs-cur{z-index:5;display:none;left:0;top:0;width:26px;height:26px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
#vs-voile{z-index:6;display:none;left:0;top:0;width:100%;height:100%}
#vs-carton{z-index:7;display:none;left:0;top:0;width:100%;height:100%;background:#14332E;align-items:center;justify-content:center}
#vs-prog{z-index:8;display:none;left:0;bottom:0;height:4px;background:#1C9C8A}
.vs-c{display:flex;flex-direction:column;align-items:center;text-align:center;gap:30px;max-width:1560px;padding:0 60px}
.vs-c>*{margin:0}
.vs-plaque{background:#fff;border-radius:24px;padding:22px 34px;box-shadow:0 14px 40px rgba(0,0,0,.28)}
.vs-plaque img{display:block;height:150px;width:auto}
.vs-plaque.petite{border-radius:18px;padding:14px 22px}.vs-plaque.petite img{height:88px}
.vs-titre{font-size:96px;font-weight:600;line-height:1.04;letter-spacing:-.015em;color:#fff}
.vs-sous{font-size:38px;font-weight:400;line-height:1.25;color:rgba(255,255,255,.94)}
.vs-ligne{font-size:23px;font-weight:400;line-height:1.5;color:rgba(255,255,255,.76);max-width:1400px;text-wrap:balance}
.vs-titre,.vs-sous{text-wrap:balance}
.vs-ligne.forte{font-size:34px;font-weight:600;color:#fff}
.vs-num{font-size:30px;font-weight:600;letter-spacing:.18em;color:#7FD3C4}
.vs-mots{display:grid;grid-template-columns:repeat(4,330px);gap:26px;margin-top:10px}
.vs-mot{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-top:5px solid #1C9C8A;border-radius:18px;padding:30px 26px 32px;text-align:left}
.vs-mot b{display:block;font-size:46px;font-weight:600;line-height:1.1;color:#fff}
.vs-mot span{display:block;margin-top:12px;font-size:22px;line-height:1.4;color:rgba(255,255,255,.82)}
`;
  const SVG_CURSEUR = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.5 L12 13.8 L19 13.8 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const $ = id => document.getElementById(id);
  const S = window.__studio = { injections: 0 };
  /* calques présents ? sinon (premier appel, body remplacé, rechargement) : injection */
  S.injecter = () => {
    if (!document.body) return false;
    if ($('vs-racine') && $('vs-style') && $('vs-racine').parentNode === document.body) return false;
    ['vs-racine', 'vs-style'].forEach(id => { const x = $(id); if (x) x.remove(); });
    const st = document.createElement('style'); st.id = 'vs-style'; st.textContent = CSS; (document.head || document.body).appendChild(st);
    const r = document.createElement('div'); r.id = 'vs-racine'; r.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img'); img.id = 'vs-snap'; img.alt = ''; r.appendChild(img);
    ['vs-chap', 'vs-st', 'vs-ring', 'vs-cur', 'vs-voile', 'vs-carton', 'vs-prog'].forEach(id => { const d = document.createElement('div'); d.id = id; r.appendChild(d); });
    r.querySelector('#vs-cur').innerHTML = SVG_CURSEUR;
    const l1 = document.createElement('div'); l1.className = 'l1'; const l2 = document.createElement('div'); l2.className = 'l2'; r.querySelector('#vs-st').append(l1, l2);
    document.body.appendChild(r); S.injections++; return true;
  };
  const vis = (el, on) => { const d = on ? (el.id === 'vs-carton' ? 'flex' : 'block') : 'none'; if (el.style.display !== d) el.style.display = d; };
  /* caméra : contenu de l'application (#app et fenêtres #modal-root) mis à l'échelle s, rectangle visible (rx, ry) en coordonnées d'écran non zoomées */
  S.camera = c => {
    const app = $('app'), modales = [...document.querySelectorAll('#modal-root > *')];
    const neutre = !c || (Math.abs(c.s - 1) < 1e-4 && Math.abs(c.rx) < 0.01 && Math.abs(c.ry) < 0.01);
    const poser = (el, tx, ty, s) => { if (!el) return; if (neutre) { if (el.dataset.vsZoom) { el.style.transform = ''; el.style.transformOrigin = ''; delete el.dataset.vsZoom; } return; } el.dataset.vsZoom = '1'; el.style.transformOrigin = '0 0'; el.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; };
    if (app) { const ox = app.offsetLeft - window.scrollX, oy = app.offsetTop - window.scrollY; poser(app, neutre ? 0 : (c.s - 1) * ox - c.s * c.rx, neutre ? 0 : (c.s - 1) * oy - c.s * c.ry, neutre ? 1 : c.s); }
    modales.forEach(m => poser(m, neutre ? 0 : -c.s * c.rx, neutre ? 0 : -c.s * c.ry, neutre ? 1 : c.s));
  };
  /* conteneur défilant : ancêtre défilable de l'élément (ou du point), sinon la fenêtre */
  S.defilant = (el, x, y) => {
    document.querySelectorAll('[data-vs-defil]').forEach(e => e.removeAttribute('data-vs-defil'));
    if (!el) el = document.elementFromPoint(x, y);
    if (el && el.closest && el.closest('#vs-racine')) el = null;
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) { el.setAttribute('data-vs-defil', '1'); return { fenetre: false, top: el.scrollTop, max: el.scrollHeight - el.clientHeight, haut: el.getBoundingClientRect().top, hauteur: el.clientHeight }; }
      el = el.parentElement;
    }
    const se = document.scrollingElement || document.documentElement; return { fenetre: true, top: se.scrollTop, max: se.scrollHeight - se.clientHeight, haut: 0, hauteur: window.innerHeight };
  };
  const posDefil = d => { if (!d) return; const el = d.fenetre ? (document.scrollingElement || document.documentElement) : document.querySelector('[data-vs-defil]'); if (el) el.scrollTop = d.top; };
  S.appliquer = e => {
    const reinjecte = S.injecter(); const r = $('vs-racine'); if (!r) return Promise.resolve({ reinjecte, absent: true });
    posDefil(e.defil); S.camera(e.cam);
    const cur = $('vs-cur'); vis(cur, !!e.cur); if (e.cur) cur.style.transform = `translate(${e.cur.x - 4.3}px,${e.cur.y - 2.2}px)`;
    const ring = $('vs-ring'); vis(ring, !!e.ring); if (e.ring) { ring.style.left = e.ring.x + 'px'; ring.style.top = e.ring.y + 'px'; ring.style.opacity = e.ring.o; ring.style.transform = `scale(${e.ring.s})`; }
    const st = $('vs-st'); vis(st, !!e.st); if (e.st) { const a = st.children[0], b = st.children[1]; if (a.textContent !== e.st.l1) a.textContent = e.st.l1; if (b.textContent !== e.st.l2) b.textContent = e.st.l2; st.style.opacity = e.st.o; st.style.transform = `translateX(${e.st.x}px)`; }
    const ch = $('vs-chap'); vis(ch, !!e.chap); if (e.chap) { if (ch.dataset.t !== e.chap.num + '|' + e.chap.t) { ch.textContent = ''; const b = document.createElement('b'); b.textContent = e.chap.num; ch.append(b, document.createTextNode(' · ' + e.chap.t)); ch.dataset.t = e.chap.num + '|' + e.chap.t; } ch.style.left = e.chap.left + 'px'; ch.style.top = e.chap.top + 'px'; ch.style.opacity = e.chap.o; }
    const v = $('vs-voile'); vis(v, !!e.voile); if (e.voile) { v.style.background = e.voile.c; v.style.opacity = e.voile.o; }
    const sn = $('vs-snap'); vis(sn, !!e.snap && !!sn.getAttribute('src')); if (e.snap) sn.style.opacity = e.snap.o;
    const ca = $('vs-carton'); vis(ca, !!e.carton); if (e.carton) {
      if (ca.dataset.v !== String(e.carton.v)) { ca.innerHTML = e.carton.html; ca.dataset.v = String(e.carton.v); const logo = window.RYZE && window.RYZE.etab ? window.RYZE.etab().logo : ''; ca.querySelectorAll('img[data-logo]').forEach(i => { if (logo) i.src = logo; else { const p = i.closest('.vs-plaque'); (p || i).remove(); } }); }
      ca.style.opacity = e.carton.o; ca.querySelectorAll('[data-i]').forEach(el => { const it = e.carton.items[+el.dataset.i] || { o: 1, y: 0 }; el.style.opacity = it.o; el.style.transform = it.y ? `translateY(${it.y}px)` : ''; });
    }
    const pg = $('vs-prog'); vis(pg, e.prog != null); if (e.prog != null) pg.style.width = (e.prog * 100).toFixed(3) + '%';
    if (e.attendre === false) return Promise.resolve({ reinjecte });
    return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => res({ reinjecte })))));
  };
  S.snap = src => { S.injecter(); const sn = $('vs-snap'); if (src) sn.src = src; else { sn.removeAttribute('src'); sn.style.display = 'none'; } return sn.decode ? sn.decode().catch(() => {}) : null; };
  S.cacher = on => { const r = $('vs-racine'); if (r) r.style.visibility = on ? 'hidden' : ''; };
}

/* ===================================================================== */
class Studio {
  constructor(o) {
    this.o = o; this.ips = o.ips; this.W = o.largeur; this.H = o.hauteur; this.sortie = o.sortie;
    this.f = 0;                  /* image courante (temps du film = f / ips) */
    this.cur = { x: this.W * 0.62, y: this.H * 0.58, visible: true };
    this.ring = null; this.subs = []; this.chaps = []; this.voile = { c: VERT, a: 0, b: 0, f0: 0, f1: 0 };
    this.cartonEtat = null; this.cartonV = 0; this.snap = null; this.defil = null;
    this.cam = { s: 1, cx: this.W / 2, cy: this.H / 2 };
    this.segments = []; this.seg = null; this.coulisseN = 0;
    this.journal = { cartons: [], zooms: [], rampes: [], textesInterdits: [] };
    this.interdits = o.interdits || [/\bryze\b/i, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/];
    this.stats = { captures: 0, msCapture: 0, debut: Date.now() };
    this.erreursJS = [];
  }

  get t() { return this.f / this.ips; }               /* temps courant du film (s) */
  n(sec) { return Math.max(0, Math.round(sec * this.ips)); } /* secondes → nombre d'images */

  async init() {
    const { chromium } = chargerPlaywright();
    fs.mkdirSync(this.sortie, { recursive: true });
    this.navigateur = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-domain-reliability', '--no-pings', '--no-first-run', '--hide-scrollbars', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-features=OptimizationHints,MediaRouter,Translate,AutofillServerCommunication'] });
    this.contexte = await this.navigateur.newContext({ viewport: { width: this.W, height: this.H }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'fr-FR', timezoneId: this.o.fuseau || undefined, acceptDownloads: true });
    await this.contexte.addInitScript(installerDansLaPage);
    this.page = await this.contexte.newPage();
    this.page.on('pageerror', e => this.erreursJS.push(e.message));
    this.page.on('dialog', d => (this.o.dialogues === 'refuser' ? d.dismiss() : d.accept()).catch(() => {}));
    this.cdp = await this.contexte.newCDPSession(this.page);
    const p = this.page;
    await p.goto(APP_URL);
    await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    if (this.o.base) {
      const s = JSON.parse(fs.readFileSync(this.o.base, 'utf8')); s.dirty = true; /* base non « dirty » d'une autre semaine : l'application la remplacerait par la démo */
      delete s.user;
      await p.evaluate(([k, v]) => localStorage.setItem(k, v), [CLE_BASE, JSON.stringify(s)]);
      await p.reload();
    } else {
      await p.reload();
      await p.evaluate(() => { window.RYZE.S.dirty = true; window.RYZE.save(); }); /* démo intégrée figée : plus de bandeau « démonstration », même base au rechargement */
      await p.reload();
    }
    await p.waitForSelector('#login-code, .shell', { timeout: 15000 });
    await p.evaluate(async () => { await document.fonts.ready; await Promise.all(['400 22px "IBM Plex Sans"', '600 34px "IBM Plex Sans"'].map(f => document.fonts.load(f))); });
    const n = await p.evaluate(() => window.RYZE.S.patients.length);
    if (!n && !this.o.base) throw new Error('Base de démonstration vide');
    await this.appliquer(true);
    return this;
  }

  /* ---------------- État d'une image ---------------- */
  etat() {
    const f = this.f, ips = this.ips, e = { cam: this.rect(), defil: this.defil };
    if (this.cur.visible) e.cur = { x: borne(this.cur.x, 4, this.W - 26), y: borne(this.cur.y, 4, this.H - 30) };
    if (this.ring) { const k = (f - this.ring.f0) / Math.max(1, this.n(0.2)); if (k >= 0 && k <= 1) e.ring = { x: this.ring.x, y: this.ring.y, o: (0.95 * (1 - k)).toFixed(3), s: (0.45 + sortieDouce(k) * 1.0).toFixed(3) }; }
    const st = this.subs.find(s => s.f0 <= f && (s.f1 == null || f < s.f1 + this.n(SORTIE_ST)));
    if (st) { const ke = lisse((f - st.f0) / Math.max(1, this.n(ENTREE_ST))), ks = st.f1 == null || f < st.f1 ? 1 : 1 - (f - st.f1) / Math.max(1, this.n(SORTIE_ST)); e.st = { l1: st.l1, l2: st.l2, o: +(ke * ks).toFixed(3), x: +(-24 * (1 - ke)).toFixed(2) }; }
    const ch = this.chaps.find(c => c.f0 <= f && (c.f1 == null || f < c.f1));
    if (ch) { const pos = this.o.pastille || {}; e.chap = { num: ch.num, t: ch.titre, o: +lisse((f - ch.f0) / Math.max(1, this.n(0.3))).toFixed(3), left: pos.left != null ? pos.left : 8, top: pos.top != null ? pos.top : 8 }; }
    { const v = this.voile, k = v.f1 > v.f0 ? lisse((f - v.f0) / (v.f1 - v.f0)) : 1, o = v.a + (v.b - v.a) * k; if (o > 0.001) e.voile = { c: v.c, o: +o.toFixed(3) }; }
    if (this.snap) { const k = (f - this.snap.f0) / Math.max(1, this.snap.f1 - this.snap.f0); if (k < 1) e.snap = { o: +(1 - lisse(k)).toFixed(3) }; }
    if (this.cartonEtat) e.carton = this.etatCarton();
    if (this.o.dureeTotale) e.prog = +borne(this.t / this.o.dureeTotale, 0, 1).toFixed(5);
    return e;
  }

  /* applique l'état courant dans la page (attendre : 2 rAF + polices) */
  async appliquer(attendre) {
    const e = this.etat(); e.attendre = !!attendre;
    let r; try { r = await this.page.evaluate(x => window.__studio.appliquer(x), e); }
    catch (err) { /* navigation en cours : on attend le nouveau document puis on réessaie */ await this.page.waitForLoadState('domcontentloaded').catch(() => {}); r = await this.page.evaluate(x => window.__studio.appliquer(x), e); }
    if (r && r.reinjecte && this.f > 0) this.reinjections = (this.reinjections || 0) + 1;
    return r;
  }

  /* une image du film : appliquer → capturer → ffmpeg */
  async image() {
    if (this.coulisseN) { await this.appliquer(false); return; }
    if (!this.seg) await this.segment('film');
    if (this.seg.muet) { await this.appliquer(false); this.f++; this.seg.images++; return; }
    const t0 = Date.now();
    await this.appliquer(true);
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: this.o.qualite || 90 });
    this.stats.msCapture += Date.now() - t0; this.stats.captures++;
    await this.ecrire(Buffer.from(data, 'base64'));
    this.f++; this.seg.images++;
  }
  async images(n) { for (let i = 0; i < n; i++) await this.image(); }

  ecrire(buf) {
    const s = this.seg; if (s.erreur) throw s.erreur;
    return new Promise((res, rej) => {
      const ok = s.proc.stdin.write(buf, err => { if (err) rej(err); });
      if (ok) res(); else s.proc.stdin.once('drain', res);
    });
  }

  /* ---------------- Segments ---------------- */
  async segment(nom) {
    if (this.seg) await this.finSegment();
    const i = this.segments.length + 1, fichier = path.join(this.sortie, `seg-${deux(i)}-${slug(nom)}.mp4`);
    const muet = Array.isArray(this.o.seulement) && this.o.seulement.length > 0 && !this.o.seulement.some(x => x === nom || x === slug(nom) || x === String(i));
    const s = { nom, numero: i, fichier, f0: this.f, images: 0, muet, debutRendu: Date.now() };
    if (muet) { if (!fs.existsSync(fichier)) throw new Error(`Segment « ${nom} » non rendu (--segment) mais ${fichier} absent : rendre d'abord le film entier`); }
    else {
      s.tmp = fichier.replace(/\.mp4$/, '.partiel.mp4');
      s.proc = spawn(this.o.ffmpeg || '/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(this.ips), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', this.o.preset || 'slow', '-crf', String(this.o.crf || 19), '-pix_fmt', 'yuv420p', '-r', String(this.ips), '-movflags', '+faststart', '-f', 'mp4', s.tmp], { stdio: ['pipe', 'ignore', 'pipe'] });
      s.stderr = ''; s.proc.stderr.on('data', d => { s.stderr += d; });
      s.fin = new Promise(res => s.proc.on('close', code => res(code)));
      s.proc.on('error', err => { s.erreur = err; }); s.proc.stdin.on('error', err => { s.erreur = new Error('ffmpeg : ' + err.message + ' ' + s.stderr); });
    }
    this.seg = s;
    return s;
  }
  async finSegment() {
    const s = this.seg; if (!s) return null;
    await this.controlerTexte();
    this.seg = null;
    if (!s.muet) {
      s.proc.stdin.end(); const code = await s.fin;
      if (code !== 0) throw new Error(`ffmpeg a échoué pour ${s.fichier} (code ${code}) : ${s.stderr}`);
      if (!s.images) { fs.rmSync(s.tmp, { force: true }); } else fs.renameSync(s.tmp, s.fichier);
    }
    if (s.muet) { /* segment repris : le fichier existant doit avoir le même nombre d'images (sinon le minutage et la barre de progression seraient faux) */
      try { const n = +execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of csv=p=0 "${s.fichier}"`, { encoding: 'utf8' }).trim(); if (n && n !== s.images) console.log(`  attention : ${path.basename(s.fichier)} contient ${n} images, le scénario en produit ${s.images} : rendre aussi ce segment`); } catch (e) { /* ffprobe absent */ }
    }
    const duree = (Date.now() - s.debutRendu) / 1000;
    const rec = { numero: s.numero, nom: s.nom, fichier: path.basename(s.fichier), debut: arrondi(s.f0 / this.ips), fin: arrondi(this.f / this.ips), duree: arrondi(s.images / this.ips), images: s.images, rendu: s.muet ? 'repris' : 'rendu', secondesDeRendu: +duree.toFixed(1), imagesParSeconde: s.muet ? null : +(s.images / Math.max(0.001, duree)).toFixed(2) };
    if (s.images) this.segments.push(rec);
    if (!this.o.silencieux) console.log(`  segment ${deux(s.numero)} « ${s.nom} » : ${rec.duree.toFixed(2)} s, ${s.images} images${s.muet ? ' (repris tel quel)' : `, rendu en ${duree.toFixed(1)} s (${rec.imagesParSeconde} i/s)`}`);
    return rec;
  }

  /* concaténation sans ré-encodage + minutage.json */
  async assembler(nomFinal = 'HDJ.mp4') {
    if (this.seg) await this.finSegment();
    this.fermerSousTitre(); this.chaps.forEach(c => { if (c.f1 == null) c.f1 = this.f; });
    const liste = path.join(this.sortie, 'concat.txt');
    fs.writeFileSync(liste, this.segments.map(s => `file '${path.join(this.sortie, s.fichier).replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    const sortieFilm = path.join(this.sortie, nomFinal);
    await new Promise((res, rej) => { const p = spawn(this.o.ffmpeg || '/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', '-movflags', '+faststart', sortieFilm], { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => { err += d; }); p.on('close', c => c === 0 ? res() : rej(new Error('concat : ' + err))); });
    fs.rmSync(liste, { force: true });
    const minutage = this.minutage(nomFinal);
    fs.writeFileSync(path.join(this.sortie, 'minutage.json'), JSON.stringify(minutage, null, 2));
    return { film: sortieFilm, minutage: path.join(this.sortie, 'minutage.json'), duree: minutage.duree };
  }
  minutage(nomFinal) {
    const s = x => arrondi(x / this.ips);
    return {
      film: nomFinal, ips: this.ips, largeur: this.W, hauteur: this.H, duree: s(this.f), dureeAnnoncee: this.o.dureeTotale || null,
      segments: this.segments,
      chapitres: this.chaps.map(c => ({ numero: c.num, titre: c.titre, debut: s(c.f0), fin: s(c.f1) })),
      sousTitres: this.subs.map(x => ({ ligne1: x.l1, ligne2: x.l2, debut: s(x.f0), fin: s(x.f1 + this.n(SORTIE_ST)), affichage: s(x.f1 - x.f0), complement: x.complement ? arrondi(x.complement) : 0 })),
      cartons: this.journal.cartons, zooms: this.journal.zooms, rampes: this.journal.rampes, textesInterdits: this.journal.textesInterdits,
      rendu: this.bilanRendu()
    };
  }
  bilanRendu() { const sec = (Date.now() - this.stats.debut) / 1000; return { images: this.stats.captures, secondes: +sec.toFixed(1), imagesParSeconde: +(this.stats.captures / Math.max(0.001, sec)).toFixed(2), msParCapture: +(this.stats.msCapture / Math.max(1, this.stats.captures)).toFixed(1) }; }

  /* ---------------- Coulisse : actions sans image (ni temps qui passe) ---------------- */
  async coulisse(fn) { this.coulisseN++; try { return await fn(this.page, this); } finally { this.coulisseN--; await this.appliquer(false); } }
  async evaluer(fn, arg) { return this.page.evaluate(fn, arg); }
  /* navigation interne sans image (R.go), caméra remise à 1× */
  async allerA(route, params) { this.cam = { s: 1, cx: this.W / 2, cy: this.H / 2 }; await this.appliquer(false); await this.page.evaluate(([r, p]) => window.RYZE.go(r, p || {}), [route, params || {}]); await this.stable(); }

  async stable() { await this.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => (document.fonts ? document.fonts.ready : Promise.resolve()).then(r))))); }
  async attendre(duree) { await this.images(this.n(duree)); }

  /* ---------------- Curseur ---------------- */
  async boite(cible) {
    if (cible && typeof cible === 'object' && 'x' in cible) return { x: cible.x, y: cible.y, width: 0, height: 0 };
    const loc = this.page.locator(cible).first();
    await loc.waitFor({ state: 'visible', timeout: this.o.delai || 10000 });
    const b = await loc.boundingBox(); if (!b) throw new Error(`Élément sans boîte : ${cible}`); return b;
  }
  pointDe(b) { return { x: b.x + (b.width > 280 ? Math.min(b.width / 2, 140) : b.width / 2), y: b.y + b.height / 2 }; }
  async vers(cible, duree) {
    let b = await this.boite(cible), p = this.pointDe(b);
    /* cible hors de la zone utile (sous la barre du haut ou derrière le sous-titre) : défilement doux d'abord */
    if (typeof cible === 'string' && this.cam.s < 1.001 && (p.y < 80 || p.y > this.H - 240)) { await this.defiler(cible); b = await this.boite(cible); p = this.pointDe(b); }
    await this.deplacer(p.x, p.y, duree);
  }
  async deplacer(x, y, duree) {
    x = borne(x, 4, this.W - 26); y = borne(y, 4, this.H - 30);
    const x0 = this.cur.x, y0 = this.cur.y, d = Math.hypot(x - x0, y - y0);
    if (duree == null) duree = borne(0.45 + d / 1900, 0.5, 1.1);
    const N = Math.max(1, this.n(duree)), courbe = Math.min(70, d * 0.12), nx = d ? -(y - y0) / d : 0, ny = d ? (x - x0) / d : 0;
    this.cur.visible = true;
    for (let i = 1; i <= N; i++) { const k = lisse(i / N), b = Math.sin(Math.PI * k) * courbe; this.cur.x = x0 + (x - x0) * k + nx * b; this.cur.y = y0 + (y - y0) * k + ny * b; await this.image(); }
    this.cur.x = x; this.cur.y = y;
    await this.page.mouse.move(x, y); /* survol réel : styles :hover, infobulles */
  }
  async survoler(cible, duree = 0.6) { await this.vers(cible); await this.attendre(duree); }
  cacherCurseur() { this.cur.visible = false; }
  montrerCurseur() { this.cur.visible = true; }

  async clic(opts = {}) {
    /* zoom en cours et cible de navigation (data-go) : retour à 1× puis on retrouve la cible */
    if (this.cam.s > 1.001) {
      const nav = await this.page.evaluate(([x, y]) => { document.querySelectorAll('[data-vs-cible]').forEach(e => e.removeAttribute('data-vs-cible')); const el = document.elementFromPoint(x, y); const g = el && el.closest('[data-go]'); if (g) g.setAttribute('data-vs-cible', '1'); return !!g; }, [this.cur.x, this.cur.y]);
      if (nav) { await this.dezoom(0.8); await this.vers('[data-vs-cible]', 0.5); }
    }
    this.ring = { f0: this.f, x: this.cur.x, y: this.cur.y };
    await this.images(this.n(0.1));
    await this.page.mouse.click(this.cur.x, this.cur.y, { button: opts.button || 'left', clickCount: opts.clickCount || 1 });
    await this.page.evaluate(() => document.querySelectorAll('[data-vs-cible]').forEach(e => e.removeAttribute('data-vs-cible'))).catch(() => {});
    await this.stable().catch(() => {});
    await this.images(this.n(opts.apres != null ? opts.apres : 0.15));
  }
  async cliquer(cible, opts) { await this.vers(cible); await this.clic(opts); }
  async naviguer(cible, opts = {}) {
    if (this.cam.s > 1.001) await this.dezoom(0.8);
    await this.vers(cible); await this.clic({ apres: 0 });
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.stable();
    await this.appliquer(false); /* ré-injection des calques si le document a changé */
    await this.controlerTexte();
    await this.attendre(opts.attente != null ? opts.attente : 0.4);
  }
  /* textes interdits à l'écran (« Ryze », undefined, NaN…) : relevés dans minutage.json (textesInterdits) et signalés */
  async controlerTexte() {
    let txt = ''; try { txt = await this.page.evaluate(() => ['app', 'modal-root', 'toast-root'].map(id => { const e = document.getElementById(id); return e ? e.innerText : ''; }).join('\n')); } catch (e) { return; }
    for (const re of this.interdits) { const m = re.exec(txt); if (!m) continue; const i = Math.max(0, m.index - 30), extrait = txt.slice(i, m.index + 30).replace(/\s+/g, ' '); const seg = this.seg ? this.seg.nom : ''; if (!this.journal.textesInterdits.some(x => x.trouve === extrait)) { this.journal.textesInterdits.push({ segment: seg, temps: arrondi(this.t), motif: String(re), trouve: extrait }); if (!this.o.silencieux) console.log(`  attention : texte interdit à l'écran (${seg}, ${this.t.toFixed(1)} s) : « …${extrait}… »`); } }
  }

  /* ---------------- Saisie ---------------- */
  async taper(cible, texte, opts = {}) {
    const rampe = opts.rampe !== false, base = opts.caracteresParSeconde || 9, vmax = opts.vitesseMax || 3;
    if (typeof cible === 'string') { await this.vers(cible); await this.clic({ apres: 0.1 }); await this.page.locator(cible).first().focus().catch(() => {}); }
    if (opts.effacer) { await this.page.keyboard.press('Control+A'); await this.page.keyboard.press('Backspace'); }
    const car = [...String(texte)], dt = 1 / this.ips, f0 = this.f; let virt = 0, tv = 0, tapes = 0, vpic = 1;
    while (tapes < car.length) {
      const reste = (car.length - tapes) / base; /* secondes « réelles » restant à taper */
      const v = rampe ? Math.max(1, Math.min(vmax, 1 + ACCEL * tv, Math.sqrt(1 + 2 * ACCEL * Math.max(0, reste - dt)))) : 1;
      vpic = Math.max(vpic, v); virt += v * dt; tv += dt;
      const doit = Math.min(car.length, Math.floor(virt * base + 1e-9) + 1);
      if (doit > tapes) { await this.page.keyboard.type(car.slice(tapes, doit).join('')); tapes = doit; }
      await this.image();
    }
    if (rampe) this.journal.rampes.push({ type: 'saisie', debut: arrondi(f0 / this.ips), fin: arrondi(this.f / this.ips), caracteres: car.length, vitesseMax: +vpic.toFixed(2) });
    await this.attendre(opts.apres != null ? opts.apres : 0.25);
  }
  async appuyer(touche, apres = 0.3) { await this.page.keyboard.press(touche); await this.stable(); await this.attendre(apres); }
  async choisir(cible, valeur, opts = {}) {
    await this.vers(cible);
    this.ring = { f0: this.f, x: this.cur.x, y: this.cur.y };
    await this.page.locator(cible).first().focus();
    await this.images(this.n(0.3));
    await this.page.locator(cible).first().selectOption(valeur);
    await this.stable(); await this.attendre(opts.apres != null ? opts.apres : 0.4);
  }

  /* ---------------- Caméra (zoom) ---------------- */
  rect() { const s = this.cam.s, w = this.W / s, h = this.H / s; return { s, rx: borne(this.cam.cx - w / 2, 0, this.W - w), ry: borne(this.cam.cy - h / 2, 0, this.H - h) }; }
  /* point d'écran actuel → point du contenu non zoomé */
  versContenu(x, y) { const r = this.rect(); return { x: r.rx + x / r.s, y: r.ry + y / r.s }; }
  versEcran(u) { const r = this.rect(); return { x: (u.x - r.rx) * r.s, y: (u.y - r.ry) * r.s }; }
  async zoom(cible, echelle, duree = 1.0) {
    const b = await this.boite(cible), c = this.versContenu(b.x + b.width / 2, b.y + b.height / 2);
    if (echelle == null) { const u = { w: b.width / this.cam.s, h: b.height / this.cam.s }; echelle = Math.min(1.8, (this.W * 0.86) / Math.max(1, u.w), (this.H * 0.72) / Math.max(1, u.h)); }
    echelle = borne(echelle, 1, 1.8);
    const t0 = this.t; await this.camera(echelle, c.x, c.y, duree);
    this.journal.zooms.push({ cible: typeof cible === 'string' ? cible : `${Math.round(cible.x)},${Math.round(cible.y)}`, echelle: +echelle.toFixed(2), debut: arrondi(t0), atteint: arrondi(this.t), fin: null });
  }
  async dezoom(duree = 0.8) {
    if (this.cam.s === 1 && this.cam.cx === this.W / 2 && this.cam.cy === this.H / 2) return;
    await this.camera(1, this.W / 2, this.H / 2, duree);
    const z = this.journal.zooms[this.journal.zooms.length - 1]; if (z && z.fin == null) z.fin = arrondi(this.t);
  }
  async camera(s1, cx1, cy1, duree) {
    const a = { ...this.cam }, N = Math.max(1, this.n(duree)), u = this.versContenu(this.cur.x, this.cur.y);
    /* le centre visé est d'abord ramené dans les bornes (sinon la caméra « attendrait » à mi-chemin) */
    const w1 = this.W / s1, h1 = this.H / s1; cx1 = borne(cx1, w1 / 2, this.W - w1 / 2); cy1 = borne(cy1, h1 / 2, this.H - h1 / 2);
    const ra = this.rect();
    for (let i = 1; i <= N; i++) {
      const k = lisse(i / N);
      /* interpolation du rectangle visible (largeur en 1/s) : mouvement régulier sans « dérive » */
      const wa = this.W / ra.s, wb = w1, w = wa + (wb - wa) * k, s = this.W / w;
      const ca = { x: ra.rx + wa / 2, y: ra.ry + (this.H / ra.s) / 2 };
      this.cam = { s, cx: ca.x + (cx1 - ca.x) * k, cy: ca.y + (cy1 - ca.y) * k };
      const p = this.versEcran(u); this.cur.x = p.x; this.cur.y = p.y; /* le curseur reste sur le même point du contenu */
      await this.image();
    }
    this.cam = { s: s1, cx: cx1, cy: cy1 }; void a;
    const p = this.versEcran(u); this.cur.x = borne(p.x, 4, this.W - 26); this.cur.y = borne(p.y, 4, this.H - 30);
    await this.page.mouse.move(this.cur.x, this.cur.y);
  }

  /* ---------------- Défilement ---------------- */
  async defiler(cible, opts = {}) {
    /* conteneur : celui de l'élément visé (ou opts.conteneur), sinon celui qui est sous le curseur, sinon la fenêtre */
    const selC = typeof cible === 'string' ? cible : (opts.conteneur || null);
    const info = selC ? await this.page.locator(selC).first().evaluate((el, xy) => window.__studio.defilant(el, xy[0], xy[1]), [this.cur.x, this.cur.y])
      : await this.page.evaluate(([x, y]) => window.__studio.defilant(null, x, y), [this.cur.x, this.cur.y]);
    let delta;
    if (typeof cible === 'string') {
      const b = await this.boite(cible), viser = opts.position != null ? opts.position : 0.36; /* haut de l'élément à 36 % de la zone visible */
      delta = (b.y - info.haut) / this.cam.s - info.hauteur * viser;
    } else delta = +cible || 0;
    const de = info.top, vers = borne(de + delta, 0, Math.max(0, info.max)), D = vers - de;
    if (Math.abs(D) < 1) return;
    const rampe = opts.rampe != null ? opts.rampe : Math.abs(D) > 1400;
    let T = opts.duree, pos;
    if (rampe) {
      /* profil trapézoïdal : 1× → 3× (0,6 s), palier, 3× → 1× (0,6 s) */
      let v0 = opts.vitesse || 650; if (T) v0 = Math.abs(D) / Math.max(0.6, 3 * T - 1.2);
      const dRampes = 2 * v0 * 0.6 * 2; let Tp;
      if (Math.abs(D) >= dRampes) { Tp = (Math.abs(D) - dRampes) / (3 * v0); T = 1.2 + Tp; }
      else { T = T || borne(0.6 + Math.abs(D) / 1500, 0.6, 2.2); }
      if (Tp != null) pos = t => { const a = v0 * ACCEL; if (t < 0.6) return v0 * t + a * t * t / 2; const d1 = v0 * 0.6 + a * 0.36 / 2; if (t < 0.6 + Tp) return d1 + 3 * v0 * (t - 0.6); const t2 = t - 0.6 - Tp; return d1 + 3 * v0 * Tp + 3 * v0 * t2 - a * t2 * t2 / 2; };
      this.journal.rampes.push({ type: 'defilement', debut: arrondi(this.t), fin: arrondi(this.t + T), pixels: Math.round(Math.abs(D)) });
    }
    if (!T) T = borne(0.5 + Math.abs(D) / 1400, 0.5, 2.5);
    const N = Math.max(1, this.n(T)), sens = Math.sign(D);
    for (let i = 1; i <= N; i++) {
      const t = i / N * T, k = pos ? borne(pos(t) / Math.abs(D), 0, 1) : lisse(i / N);
      this.defil = { fenetre: info.fenetre, top: de + sens * Math.abs(D) * k };
      await this.image();
    }
    this.defil = { fenetre: info.fenetre, top: vers }; await this.appliquer(false); this.defil = null;
    await this.page.mouse.move(this.cur.x, this.cur.y);
  }

  /* ---------------- Sous-titres ---------------- */
  sousTitreActif() { return this.subs.find(s => s.f1 == null); }
  async effacerSousTitre() {
    const s = this.sousTitreActif(); if (!s) return;
    const visible = (this.f - s.f0) / this.ips;
    if (visible < SOUS_TITRE_MIN - 1e-6) { const c = SOUS_TITRE_MIN - visible; s.complement = (s.complement || 0) + c; await this.images(Math.ceil(c * this.ips - 1e-6)); }
    s.f1 = this.f;
  }
  fermerSousTitre() { const s = this.sousTitreActif(); if (s) s.f1 = this.f; }
  async sousTitre(ligne1, ligne2 = '') {
    const prec = this.sousTitreActif(); if (prec) await this.effacerSousTitre();
    const last = this.subs[this.subs.length - 1], f0 = last ? Math.max(this.f, last.f1 + this.n(SORTIE_ST)) : this.f; /* jamais deux sous-titres superposés */
    this.subs.push({ l1: String(ligne1), l2: String(ligne2 || ''), f0, f1: null });
  }

  /* ---------------- Chapitre (pastille) ---------------- */
  chapitre(numero, titre) {
    const c = this.chaps.find(x => x.f1 == null); if (c) c.f1 = this.f;
    if (numero == null) return;
    this.chaps.push({ num: deux(numero), titre: String(titre), f0: this.f, f1: null });
  }

  /* ---------------- Voile, fondus ---------------- */
  opaciteVoile() { const v = this.voile, k = v.f1 > v.f0 ? lisse((this.f - v.f0) / (v.f1 - v.f0)) : 1; return v.a + (v.b - v.a) * k; }
  async voiler(cible, duree, couleur) { const a = this.opaciteVoile(); this.voile = { c: couleur || this.voile.c || VERT, a, b: cible, f0: this.f, f1: this.f + Math.max(1, this.n(duree)) }; await this.images(Math.max(1, this.n(duree))); }
  async fondu(duree = 0.4, couleur = VERT) { await this.voiler(1, duree, couleur); }
  async retourFondu(duree = 0.4) { await this.voiler(0, duree); }
  /* fondu enchaîné : image figée de l'écran actuel (sans calques), action en coulisse, puis l'image s'efface */
  async fonduEnchaine(duree, action) {
    await this.page.evaluate(() => window.__studio.cacher(true));
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    await this.page.evaluate(() => window.__studio.cacher(false));
    await this.coulisse(async () => { if (action) await action(this.page, this); });
    await this.page.evaluate(src => window.__studio.snap(src), 'data:image/jpeg;base64,' + data);
    this.snap = { f0: this.f, f1: this.f + Math.max(1, this.n(duree)) };
    await this.images(Math.max(1, this.n(duree)));
    this.snap = null; await this.page.evaluate(() => window.__studio.snap(null)).catch(() => {});
  }

  /* ---------------- Cartons ---------------- */
  etatCarton() {
    const c = this.cartonEtat, f = this.f, ips = this.ips;
    let o = 1; if (f < c.fIn) o = lisse((f - c.f0) / Math.max(1, c.fIn - c.f0)); if (c.fOut != null && f >= c.fOut && !c.sortieContenu) o = 1 - lisse((f - c.fOut) / Math.max(1, c.fEnd - c.fOut));
    const items = c.delais.map(d => { const k = c.cascade ? sortieDouce((f - (c.fIn + d * ips)) / (0.5 * ips)) : lisse((f - c.f0) / Math.max(1, c.fIn - c.f0 || 1)); let io = borne(k, 0, 1), y = 12 * (1 - io); if (c.fOut != null && f >= c.fOut && c.sortieContenu) { const ks = 1 - lisse((f - c.fOut) / Math.max(1, c.fEnd - c.fOut)); io *= ks; } return { o: +io.toFixed(3), y: +y.toFixed(2) }; });
    return { v: c.v, html: c.html, o: +o.toFixed(3), items };
  }
  htmlCarton(o) {
    /* chaque élément animé porte data-i (ordre de la cascade) ; tout texte est échappé */
    let n = 0; const di = () => `data-i="${n++}"`, parts = [];
    if (o.logo !== false) parts.push(`<div class="vs-plaque${o.petitLogo ? ' petite' : ''}" ${di()}><img data-logo alt=""></div>`);
    if (o.numero != null) parts.push(`<div class="vs-num" ${di()}>${esc(deux(o.numero))}</div>`);
    if (o.titre) parts.push(`<h1 class="vs-titre" ${di()} style="font-size:${+o.tailleTitre || 96}px">${esc(o.titre)}</h1>`);
    if (o.sousTitre) parts.push(`<p class="vs-sous" ${di()}>${esc(o.sousTitre)}</p>`);
    if (Array.isArray(o.mots) && o.mots.length) {
      const m = o.mots.map(x => typeof x === 'string' ? { mot: x, detail: MOTS[x] || '' } : x);
      parts.push(`<div class="vs-mots">${m.map(x => `<div class="vs-mot" ${di()}><b>${esc(x.mot)}</b>${x.detail ? `<span>${esc(x.detail)}</span>` : ''}</div>`).join('')}</div>`);
    }
    (o.lignes || []).forEach(l => { const forte = l && typeof l === 'object' && l.forte; const t = l && typeof l === 'object' ? l.texte : l; parts.push(`<p class="vs-ligne${forte ? ' forte' : ''}" ${di()}>${esc(t)}</p>`); });
    return { html: `<div class="vs-c">${parts.join('')}</div>`, n };
  }
  /* carton plein écran ; options : titre, sousTitre, lignes[], logo, numero, mots[], duree (tenue), entree (fondu au vert), sortie (fondu vers l'application),
     sortieContenu (seul le contenu s'efface, le vert reste), cascade, pendant(page, studio) : actions en coulisse quand le carton couvre tout l'écran */
  async carton(o = {}) {
    if (this.sousTitreActif()) await this.effacerSousTitre();
    const entree = o.entree != null ? o.entree : 0, sortie = o.sortie != null ? o.sortie : 0.4, duree = o.duree != null ? o.duree : 3;
    const { html, n } = this.htmlCarton(o);
    const delais = Array.from({ length: n }, (_, i) => (o.cascade === false ? 0 : i * (o.ecart || 0.3)));
    const c = { v: ++this.cartonV, html, cascade: o.cascade !== false, delais, f0: this.f, fIn: this.f + this.n(entree), fOut: null, fEnd: null, sortieContenu: !!o.sortieContenu };
    this.cartonEtat = c; const debut = this.t;
    if (this.n(entree)) await this.images(this.n(entree)); else await this.appliquer(false);
    this.voile = { c: this.voile.c, a: 0, b: 0, f0: 0, f1: 0 }; /* le carton couvre le voile éventuel */
    if (o.pendant) await this.coulisse(async () => { await o.pendant(this.page, this); });
    await this.images(this.n(duree));
    if (sortie > 0) { c.fOut = this.f; c.fEnd = this.f + this.n(sortie); await this.images(this.n(sortie)); }
    if (o.sortieContenu) this.voile = { c: VERT, a: 1, b: 1, f0: this.f, f1: this.f }; /* le vert reste : voile opaque */
    this.cartonEtat = null;
    this.journal.cartons.push({ type: o.type || 'carton', titre: o.titre || null, debut: arrondi(debut), fin: arrondi(this.t) });
  }
  async cartonChapitre(numero, titre, o = {}) {
    this.chapitre(null); /* la pastille du chapitre précédent s'arrête avec l'arrivée du carton */
    await this.carton({ type: 'chapitre', numero, titre, tailleTitre: 84, logo: o.logo !== false, petitLogo: true, entree: o.entree != null ? o.entree : 0.4, duree: o.duree != null ? o.duree : 1.0, sortie: o.sortie != null ? o.sortie : 0.4, ecart: 0.15, pendant: async (p, st) => { if (this.cam.s !== 1) { this.cam = { s: 1, cx: this.W / 2, cy: this.H / 2 }; } if (o.pendant) await o.pendant(p, st); } });
    this.chapitre(numero, titre);
  }
  /* carton de fin : 1) « HDJ en quatre mots » (pastilles en cascade) ; 2) générique ; se termine sur le vert */
  async cartonFin(o = {}) {
    const mots = o.mots || ['Sûr', 'Organisé', 'Documenté', 'Autonome'];
    this.chapitre(null);
    await this.carton({ type: 'fin-mots', titre: o.titreMots || 'HDJ en quatre mots', tailleTitre: 72, logo: false, mots, entree: o.entree != null ? o.entree : 0.4, duree: o.dureeMots != null ? o.dureeMots : 6, sortie: 0.35, sortieContenu: true, ecart: 0.3 });
    const lignes = [];
    if (o.auteurs) lignes.push({ texte: o.auteurs, forte: true });
    if (o.encadrant) lignes.push(o.encadrant);
    if (o.service) lignes.push(o.service);
    if (o.note) lignes.push(o.note);
    await this.carton({ type: 'fin-generique', titre: o.titre || 'HDJ — Gestion des biothérapies', tailleTitre: 64, lignes, logo: true, entree: 0, duree: o.dureeCredits != null ? o.dureeCredits : 9, sortie: o.sortieFinale != null ? o.sortieFinale : 0.6, sortieContenu: true, ecart: 0.3 });
  }

  /* connexion avec le code de ouvrir({ code }) : saisie filmée (visible, rampe) ou en coulisse ({ visible: false }) */
  async connexion(opts = {}) {
    const code = opts.code || this.o.code;
    if (opts.visible === false) { await this.coulisse(async p => { await p.fill('#login-code', code); await p.click('form[data-form="loginCode"] button[type=submit]'); await p.waitForSelector('.shell'); }); return; }
    await this.taper('#login-code', code, { rampe: opts.rampe !== false, caracteresParSeconde: opts.caracteresParSeconde || 6 });
    await this.naviguer('form[data-form="loginCode"] button[type=submit]', { attente: 0 });
    await this.page.waitForSelector('.shell', { timeout: 10000 }); await this.stable();
    await this.attendre(opts.apres != null ? opts.apres : 0.3);
  }

  /* contrôle : calques toujours présents dans le document (après navigation, document imprimable…) */
  async verifierCalques() { return this.page.evaluate(() => ({ present: !!document.getElementById('vs-racine') && document.getElementById('vs-racine').parentNode === document.body, injections: window.__studio ? window.__studio.injections : 0 })); }

  async fermer() {
    try { if (this.seg) { if (this.seg.proc) { this.seg.proc.stdin.end(); await this.seg.fin; } this.seg = null; } } catch (e) { /* déjà fermé */ }
    try { await this.navigateur.close(); } catch (e) { /* déjà fermé */ }
    if (this.erreursJS.length && !this.o.silencieux) console.log('Erreurs JavaScript de la page :\n  ' + [...new Set(this.erreursJS)].slice(0, 10).join('\n  '));
    return this.bilanRendu();
  }
}

/* détails par défaut des quatre mots du carton de fin (scénario, § 9) */
const MOTS = { 'Sûr': 'doses au poids, cibles pédiatriques', 'Organisé': 'fauteuils, contrôles, rappels', 'Documenté': 'carnets, comptes rendus, rapport', 'Autonome': 'local, sans Internet, sauvegardé' };

async function ouvrir(options = {}) {
  const o = Object.assign({ base: null, code: 'MED001', ips: 60, largeur: 1920, hauteur: 1080, dureeTotale: null, sortie: path.join(process.cwd(), 'video-sortie') }, options);
  o.ips = +o.ips; if (!(o.ips > 0)) throw new Error('ips invalide');
  if (o.sortie && path.resolve(o.sortie).startsWith(RACINE + path.sep)) throw new Error('Sortie dans le dépôt refusée : choisir un dossier hors de ' + RACINE);
  const s = new Studio(o); await s.init();
  return s;
}

/* arguments communs des scénarios : --ips N, --segment nom (répétable), --sortie dossier */
function arguments_(argv = process.argv.slice(2)) {
  const r = { seulement: [] };
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a === '--ips') r.ips = +argv[++i]; else if (a === '--segment') r.seulement.push(argv[++i]); else if (a === '--sortie') r.sortie = argv[++i]; else if (a === '--base') r.base = argv[++i]; }
  return r;
}

module.exports = { ouvrir, arguments: arguments_, esc, VERT, ACCENT, APP_URL };
