/* =====================================================================
   Ryze / HDJ — tests/lib.js : harnais commun des suites de non-régression
   - lance Chromium (Playwright), charge l'application (file://…/app/index.html),
     remet la démonstration (patients FICTIFS uniquement), se connecte ;
   - t(nom, condition, détail) : un contrôle ; aCorriger(…) : contrôle d'un bug
     connu de l'application (signalé, sans faire échouer la suite) ;
   - compte les pages d'un PDF, extrait son texte page par page (pdftotext) ;
   - résumé final « N OK, M FAIL; erreurs JS : K » puis process.exit
     (code 1 si un contrôle échoue ou si une erreur JavaScript est survenue).
   Aucune donnée réelle : seuls les dossiers de démonstration et des dossiers
   d'essai créés par les tests (noms « ESSAI … ») sont utilisés.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

/* ---------- Playwright : module local, NODE_PATH, sinon installation globale (npm root -g) ---------- */
function chargerPlaywright() {
  try { return require('playwright'); } catch (e) { /* suite */ }
  try { const g = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); return require(path.join(g, 'playwright')); } catch (e) { /* suite */ }
  console.error('Playwright introuvable : installez-le (npm install -g playwright) ou définissez NODE_PATH=$(npm root -g)');
  process.exit(2);
}
const { chromium } = chargerPlaywright();

const RACINE = path.resolve(__dirname, '..');
/* application testée : app/ du dépôt, ou une autre copie (RYZE_APP_DIR, ex. paquet HDJ décompressé) */
const APP_DIR = process.env.RYZE_APP_DIR ? path.resolve(process.env.RYZE_APP_DIR) : path.join(RACINE, 'app');
const APP_URL = 'file://' + path.join(APP_DIR, 'index.html');
/* captures, PDF et fichiers exportés des tests : hors dépôt (tests/out/ est ignoré par git) */
const OUT = process.env.RYZE_TESTS_OUT || path.join(__dirname, 'out');
const VERBEUX = !!process.env.RYZE_VERBEUX;
const DELAI_SUITE = +(process.env.RYZE_DELAI_SUITE || 240) * 1000;

function cheminChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const c = '/opt/pw-browsers/chromium';
  return fs.existsSync(c) ? c : undefined; /* sinon : navigateur fourni par Playwright (npx playwright install chromium) */
}

/* aucun trafic de fond du navigateur (mises à jour, services Google) : seules les requêtes de la page comptent */
const ARGS_CHROMIUM = ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-domain-reliability', '--no-pings', '--no-first-run', '--disable-features=OptimizationHints,MediaRouter,Translate,AutofillServerCommunication'];

/* ---------- Outils PDF ---------- */
const pagesPdf = buf => (Buffer.from(buf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
/* formats des pages : ['420x595', …] (points, arrondis) */
const formatsPdf = buf => (Buffer.from(buf).toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+[\d.]+\s*\]/g) || []).map(m => { const v = m.match(/[\d.]+/g).slice(2).map(Number); return `${Math.round(v[0])}x${Math.round(v[1])}`; });
let PDFTOTEXT = null;
function pdftotextDispo() { if (PDFTOTEXT === null) { try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); PDFTOTEXT = true; } catch (e) { PDFTOTEXT = false; } } return PDFTOTEXT; }
/* texte de chaque page d'un PDF enregistré (pdftotext, poppler-utils) ; null si l'outil manque */
function textePdf(fichier) {
  if (!pdftotextDispo()) return null;
  const txt = execFileSync('pdftotext', ['-enc', 'UTF-8', fichier, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const pages = txt.split('\f'); if (pages.length && !pages[pages.length - 1].trim()) pages.pop();
  return pages;
}

/* ---------- Textes interdits sur un document imprimé ---------- */
const INTERDITS = [[/\(s\)/, '« (s) »'], [/05 XX/i, '« 05 XX »'], [/undefined/, '« undefined »'], [/\bNaN\b/, '« NaN »'], [/\[object Object\]/, '« [object Object] »']];
const interditsDans = txt => INTERDITS.filter(([re]) => re.test(txt)).map(([re, lib]) => { const m = re.exec(txt); const i = Math.max(0, m.index - 40); return `${lib} dans « …${txt.slice(i, m.index + 40).replace(/\s+/g, ' ')}… »`; });

/* dates jj/mm/aaaa d'un texte → AAAA-MM-JJ */
const datesDans = txt => (String(txt).match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || []).map(d => d.split('/').reverse().join('-'));

const fmt = v => { if (v === undefined) return ''; if (typeof v === 'string') return v; try { return JSON.stringify(v); } catch (e) { return String(v); } };

/* ---------- Une suite ---------- */
function suite(nom) {
  fs.mkdirSync(OUT, { recursive: true });
  const H = { nom, ok: 0, ko: 0, corriger: 0, erreursJS: [], echecs: [], debut: Date.now(), navigateur: null, contextes: [], out: OUT, APP_URL, APP_DIR, RACINE };
  console.log(`Suite ${nom} — ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);

  /* contrôle : condition vraie = OK ; détail affiché en cas d'échec */
  H.t = (lib, cond, detail) => {
    if (cond) { H.ok++; if (VERBEUX) console.log('  ok    ' + lib); }
    else { H.ko++; H.echecs.push(lib); console.log('  FAIL  ' + lib + (detail !== undefined && detail !== '' ? ' — ' + fmt(detail) : '')); }
    return !!cond;
  };
  /* contrôle d'un bug CONNU de l'application, à corriger dans app/ : un échec est signalé « À CORRIGER » sans faire échouer la suite ;
     s'il passe, il compte comme OK et un rappel invite à retirer la marque (le bug est corrigé) */
  H.aCorriger = (lib, cond, detail, bug) => {
    if (cond) { H.ok++; console.log(`  ok    ${lib} (marqué « à corriger » : le bug semble corrigé, retirer la marque${bug ? ' — ' + bug : ''})`); }
    else { H.corriger++; console.log(`  À CORRIGER  ${lib}${bug ? ' [' + bug + ']' : ''}${detail !== undefined && detail !== '' ? ' — ' + fmt(detail) : ''}`); }
    return !!cond;
  };
  H.section = titre => console.log(`· ${titre}  [${((Date.now() - H.debut) / 1000).toFixed(1)} s]`);
  H.note = txt => console.log('  note  ' + txt);

  /* navigateur partagé par la suite, un contexte (stockage local neuf) par appel
     opts : { etab: false } bloque etablissement.js ; { bloquer: [RegExp] } bloque d'autres fichiers ;
            { horsLigne: true } coupe le réseau (requêtes non file:// refusées et comptées) */
  H.ouvrir = async (opts = {}) => {
    if (!H.navigateur) H.navigateur = await chromium.launch({ executablePath: cheminChromium(), args: ARGS_CHROMIUM });
    const context = await H.navigateur.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true, locale: 'fr-FR', timezoneId: process.env.TZ || undefined });
    context.setDefaultTimeout(10000); /* application cassée : échec rapide plutôt qu'une attente de 30 s par action */
    const bloques = [...(opts.bloquer || [])]; if (opts.etab === false) bloques.push(/\/etablissement\.js(\?|$)/);
    const reseau = []; /* requêtes vers le réseau (ni file:, ni data:, ni blob:) */
    if (bloques.length || opts.horsLigne) await context.route(() => true, route => {
      const url = route.request().url();
      if (bloques.some(re => re.test(url))) return route.abort();
      if (opts.horsLigne && !/^(file|data|blob):/.test(url)) { reseau.push(url); return route.abort('internetdisconnected'); }
      return route.continue();
    });
    if (opts.horsLigne) await context.setOffline(true);
    /* les messages (toasts, 4 s) ne masquent pas les boutons pour les clics des tests */
    await context.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#toast-root, #toast-root * { pointer-events: none !important; }'; document.head.appendChild(st); }); });
    const brancher = page => {
      page.on('pageerror', e => H.erreursJS.push(`exception : ${e.message}`));
      page.on('console', m => { if (m.type() !== 'error') return; const url = (m.location() || {}).url || ''; if (/Failed to load resource/.test(m.text()) && (bloques.some(re => re.test(url)) || (opts.horsLigne && !/^(file|data|blob):/.test(url)))) return; /* requête bloquée exprès */ H.erreursJS.push(`console.error : ${m.text()}${url ? ' @ ' + url : ''}`); });
      page.on('request', r => { const url = r.url(); if (!/^(file|data|blob|about):/.test(url) && !reseau.includes(url)) reseau.push(url); });
      page.on('dialog', d => d.dismiss().catch(() => {}));
    };
    context.on('page', brancher);
    const page = await context.newPage();
    const ctx = { context, page, reseau, opts };
    H.contextes.push(ctx);
    return ctx;
  };

  /* application chargée avec la démonstration neuve (localStorage vidé) */
  H.demo = async page => {
    if (!page.url().startsWith('file:')) await page.goto(APP_URL);
    await page.evaluate(() => { window.addEventListener('pagehide', () => { try { localStorage.clear(); } catch (e) {} }); localStorage.clear(); });
    await page.reload();
    await page.waitForSelector('#login-code', { timeout: 15000 });
  };
  H.connexion = async (page, code) => {
    await page.evaluate(() => { const r = document.getElementById('toast-root'); if (r) r.innerHTML = ''; }); /* un ancien message ne doit pas passer pour la réponse */
    await page.fill('#login-code', code);
    await page.click('form[data-form="loginCode"] button[type=submit]');
    await page.waitForFunction(() => !!document.querySelector('.shell') || !!document.querySelector('#toast-root .toast'), null, { timeout: 10000 });
    return page.evaluate(() => !!(window.RYZE.S.user && document.querySelector('.shell')));
  };
  H.deconnexion = async page => { await page.click('[data-action="logout"]'); await page.waitForSelector('#login-code'); };
  /* navigation interne (R.go) puis attente des polices */
  H.aller = async (page, route, params) => { await page.evaluate(([r, p]) => window.RYZE.go(r, p || {}), [route, params || {}]); await page.evaluate(() => document.fonts.ready.then(() => true)); };
  H.toasts = page => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(x => x.textContent).join(' | '));
  H.viderToasts = page => page.evaluate(() => { document.getElementById('toast-root').innerHTML = ''; });
  H.modal = page => page.evaluate(() => { const m = document.querySelector('#modal-root .modal'); return m ? m.innerText : ''; });
  /* soumission de la fenêtre ouverte (bouton submit) */
  H.validerModal = async page => { await page.click('#modal-root .modal button[type=submit]'); };
  /* texte affiché d'un sélecteur ('' s'il manque) */
  H.texte = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : ''; }, sel);

  /* PDF de la page affichée (média print) : { buf, pages, formats, fichier, textes (par page, null sans pdftotext) } */
  H.pdf = async (page, nomFichier) => {
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await page.emulateMedia({ media: 'print' });
    let buf; try { buf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }); } finally { await page.emulateMedia({ media: 'screen' }); }
    const fichier = path.join(OUT, `${nom}-${nomFichier}.pdf`); fs.writeFileSync(fichier, buf);
    let textes = null; try { textes = textePdf(fichier); } catch (e) { textes = null; }
    return { buf, pages: pagesPdf(buf), formats: formatsPdf(buf), fichier, textes };
  };
  /* téléchargement déclenché par un clic : { nom, contenu, fichier } */
  H.telecharger = async (page, selecteur) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click(selecteur)]);
    const fichier = path.join(OUT, `${nom}-${dl.suggestedFilename()}`); await dl.saveAs(fichier);
    return { nom: dl.suggestedFilename(), contenu: fs.readFileSync(fichier, 'utf8'), fichier };
  };
  H.capture = async (page, nomFichier) => { const f = path.join(OUT, `${nom}-${nomFichier}.png`); await page.screenshot({ path: f, fullPage: true }); return f; };

  H.fin = async () => {
    for (const c of H.contextes) { try { await c.context.close(); } catch (e) { /* déjà fermé */ } }
    if (H.navigateur) { try { await H.navigateur.close(); } catch (e) { /* déjà fermé */ } }
    const n = H.erreursJS.length;
    if (n) { console.log('Erreurs JavaScript :'); [...new Set(H.erreursJS)].slice(0, 15).forEach(e => console.log('  ' + e)); }
    const duree = ((Date.now() - H.debut) / 1000).toFixed(1);
    console.log(`Durée : ${duree} s`);
    console.log(`${H.ok} OK, ${H.ko} FAIL; erreurs JS : ${n}${H.corriger ? ` ; à corriger : ${H.corriger}` : ''}`);
    process.exit(H.ko || n ? 1 : 0);
  };
  /* exécute le corps de la suite : une exception imprévue compte comme un échec, le résumé est toujours imprimé */
  H.executer = corps => {
    const minuteur = setTimeout(() => { H.t(`suite terminée en moins de ${DELAI_SUITE / 1000} s`, false); H.fin(); }, DELAI_SUITE);
    Promise.resolve().then(() => corps(H)).catch(e => { H.t('déroulement sans exception imprévue', false, (e && e.stack || String(e)).split('\n').slice(0, 4).join(' ⏎ ')); }).finally(() => { clearTimeout(minuteur); H.fin(); });
  };
  return H;
}

module.exports = { suite, pagesPdf, formatsPdf, textePdf, pdftotextDispo, interditsDans, datesDans, APP_URL, APP_DIR, RACINE, OUT };
