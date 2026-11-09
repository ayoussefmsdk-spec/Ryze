#!/usr/bin/env node
/* =====================================================================
   HDJ — demo/verifier-vitrine.js : vérifie la base « vitrine »
   (horloge réelle, après import « Remplacer toute la base ») :
   - import par Paramètres → Importer → « Remplacer toute la base » depuis
     la démonstration, reconnexion avec le code AAA111 ;
   - toutes les pages, tous les onglets de chaque dossier, détail de chaque
     séance et de chaque contrôle fait, courbes : 0 erreur JavaScript ;
   - documents en PDF : carnet A4, carnet patient (8 pages A5, aucun
     débordement), planification, relevé des bilans, compte rendu, rapport
     d'activité mois / année / 12 mois (nominatif et anonymisé), feuille du
     jour et de la semaine ;
   - aucun « (s) », « undefined », « NaN », « [object Object] », aucun nom
     de patient réel interdit ;
   - export → import « remplacer » → export : contenu identique.
   Usage : NODE_PATH=$(npm root -g) node demo/verifier-vitrine.js [fichier.json]
   PDF et captures : $VITRINE_OUT (par défaut <tmp>/vitrine-verif).
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
function chargerPlaywright() {
  try { return require('playwright'); } catch (e) { /* suite */ }
  try { const g = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); return require(path.join(g, 'playwright')); } catch (e) { /* suite */ }
  console.error('Playwright introuvable : export NODE_PATH=$(npm root -g)'); process.exit(2);
}
const { chromium } = chargerPlaywright();
const RACINE = path.resolve(__dirname, '..');
const APP_URL = 'file://' + path.join(RACINE, 'app', 'index.html');
const OUT = process.env.VITRINE_OUT || path.join(require('os').tmpdir(), 'vitrine-verif');
const CHROMIUM = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const INTERDITS_TXT = [[/\(s\)/, '(s)'], [/undefined/, 'undefined'], [/\bNaN\b/, 'NaN'], [/\[object Object\]/, '[object Object]'], [/05 XX/i, '05 XX']];
// Noms à exclure (jamais écrits dans le dépôt) : variable d'environnement HDJ_NOMS_INTERDITS, séparés par des virgules.
const NOMS_REELS = (process.env.HDJ_NOMS_INTERDITS || '').split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
const VITRINE_IPP = ['2025-00418', '2025-00534', '2026-00211', '2025-00602', '2026-00097', '2025-00655', '2025-00789', '2026-00930', '2025-00701', '2025-00745'];

async function verifier(fichier) {
  fichier = fichier || path.join(__dirname, 'vitrine.json');
  fs.mkdirSync(OUT, { recursive: true });
  const texteBase = fs.readFileSync(fichier, 'utf8');
  let ok = 0, ko = 0; const echecs = [];
  const t = (lib, cond, det) => { if (cond) ok++; else { ko++; echecs.push(lib); console.log('  FAIL  ' + lib + (det !== undefined ? ' — ' + (typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 400) : '')); } return !!cond; };
  const pdftotext = f => { try { return execFileSync('pdftotext', ['-enc', 'UTF-8', f, '-'], { encoding: 'utf8', maxBuffer: 64e6 }); } catch (e) { return null; } };
  const formats = buf => (Buffer.from(buf).toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+[\d.]+\s*\]/g) || []).map(m => { const v = m.match(/[\d.]+/g).slice(2).map(Number); return `${Math.round(v[0])}x${Math.round(v[1])}`; });
  const interdits = txt => INTERDITS_TXT.filter(([re]) => re.test(txt)).map(([re, lib]) => { const m = re.exec(txt); return `${lib} : « …${txt.slice(Math.max(0, m.index - 50), m.index + 30).replace(/\s+/g, ' ')}… »`; });

  console.log(`Vérification de ${fichier}`);
  t('aucun nom réel interdit dans le fichier', !NOMS_REELS.some(n => texteBase.toUpperCase().includes(n)), NOMS_REELS.filter(n => texteBase.toUpperCase().includes(n)));
  const base = JSON.parse(texteBase);

  const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--disable-background-networking', '--no-first-run'] });
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
  const page = await ctx.newPage(); const erreurs = [];
  page.on('pageerror', e => erreurs.push(`exception : ${e.message}`)); page.on('console', m => { if (m.type() === 'error') erreurs.push(`console : ${m.text()}`); }); page.on('dialog', d => d.dismiss().catch(() => {}));
  const R = (fn, a) => page.evaluate(fn, a);
  const connexion = async code => { await page.fill('#login-code', code); await page.click('form[data-form="loginCode"] button[type=submit]'); await page.waitForSelector('.shell', { timeout: 10000 }); };
  const importerRemplacer = async texte => {
    await R(() => window.RYZE.actions.importerBase()); await page.fill('#import-txt', texte); await page.check('input[name="import-mode"][value="remplacer"]');
    await R(() => window.RYZE.actions.importerBaseOk()); await page.waitForSelector('[data-action="importerRemplacerOk"]', { timeout: 5000 });
    const dl = page.waitForEvent('download', { timeout: 3000 }).catch(() => null); await R(() => window.RYZE.actions.importerRemplacerOk()); await dl; await page.waitForSelector('#login-code', { timeout: 10000 });
  };
  const exporter = async nom => { const [dl] = await Promise.all([page.waitForEvent('download'), R(() => window.RYZE.actions.exporterBase())]); const f = path.join(OUT, nom); await dl.saveAs(f); await R(() => window.RYZE.closeModal()); return fs.readFileSync(f, 'utf8'); };
  const aller = async (route, params) => { await R(([r, p]) => { window.RYZE.closeModal(); window.RYZE.go(r, p || {}); }, [route, params || {}]); await R(() => document.fonts.ready.then(() => true)); };
  const texteApp = () => R(() => [document.getElementById('app'), document.getElementById('modal-root')].map(e => e ? e.innerText : '').join('\n'));
  const sEcran = new Set(); /* « (s) » des libellés de l'écran (application) : relevés, non bloquants ; interdits sur les documents imprimés */
  const controlerTexte = async lib => { const tx = await texteApp(); (tx.match(/[^\s]*\(s\)[^\s]*(\s+[^\s]+)?/g) || []).forEach(x => sEcran.add(x)); const pb = interdits(tx).filter(x => !/^\(s\)/.test(x)); t(`${lib} : écran sans undefined/NaN`, !pb.length, pb.slice(0, 2)); t(`${lib} : aucun nom réel`, !NOMS_REELS.some(n => tx.toUpperCase().includes(n))); return tx; };
  const pdf = async nom => { await R(() => document.fonts.ready.then(() => true)); await page.emulateMedia({ media: 'print' }); let buf; try { buf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }); } finally { await page.emulateMedia({ media: 'screen' }); } const f = path.join(OUT, nom + '.pdf'); fs.writeFileSync(f, buf); const tx = pdftotext(f); return { buf, f, pages: formats(buf).length, formats: formats(buf), tx }; };
  const controlerPdf = (lib, d) => { if (d.tx == null) return; const pb = interdits(d.tx); t(`${lib} (PDF) : sans (s)/undefined/NaN`, !pb.length, pb.slice(0, 2)); };

  /* ---------- 1. import « remplacer » depuis la démonstration ---------- */
  await page.goto(APP_URL); await R(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload(); await page.waitForSelector('#login-code');
  await connexion('MED001'); await importerRemplacer(texteBase); await connexion('AAA111');
  t('import « Remplacer toute la base » puis connexion AAA111', await R(() => !!window.RYZE.S.user && window.RYZE.userName(window.RYZE.S.user) === 'Dr Y. MOUSSADDEK'));
  const S0 = await R(() => ({ n: window.RYZE.S.patients.length, version: window.RYZE.S.version }));
  t('31 dossiers importés, version de base de l’application', S0.n === base.patients.length && S0.version === base.version, S0);

  /* ---------- 2. pages générales ---------- */
  for (const [route, params, lib] of [['dashboard', {}, 'tableau de bord'], ['patients', {}, 'patients'], ['planning', {}, 'planning'], ['activite', {}, 'rapport d’activité'], ['protocoles', {}, 'protocoles'], ['equipe', {}, 'équipe'], ['parametres', {}, 'paramètres'], ['nouveau', {}, 'assistant'], ['carnetPatient', {}, 'carnet patient vierge']]) {
    await aller(route, params); await controlerTexte(lib);
  }
  /* tableau de bord : ma journée et alertes */
  await aller('dashboard');
  const tb = await texteApp();
  const auj = await R(() => window.RYZE.today());
  const duJour = await R(t => window.RYZE.S.patients.flatMap(p => p.cures.filter(c => c.datePrevue === t && c.statut === 'prevue').map(c => p.prenom)), auj);
  t(`tableau de bord : les ${duJour.length} patients du jour affichés`, duJour.length >= 4 && duJour.every(n => tb.includes(n)), duJour);
  t('tableau de bord : « À traiter » (retards, transition) et suspension', /Contrôle en retard/i.test(tb) && /Transition vers le service adulte/i.test(tb) && /suspendu/i.test(tb), tb.slice(0, 300));
  t('tableau de bord : « Ma journée » remplie', /Ma journée/.test(tb) && /séances?/.test(tb));
  await page.screenshot({ path: path.join(OUT, 'tableau-de-bord.png'), fullPage: true });
  /* planning : semaine en cours et suivante */
  const plan = await R(() => { const R = window.RYZE, l = R.semaineRef(), out = {}; for (let i = 0; i < 12; i++) { const d = R.addDays(l, i); if (!R.jourOuvert(d)) continue; out[d] = R.S.patients.flatMap(p => p.cures.filter(c => c.datePrevue === d && c.statut === 'prevue').map(c => ({ p: p.prenom, v: c.voie, f: c.fauteuil, h: c.heure }))); } return out; });
  const jours = Object.keys(plan); const semaine1 = jours.slice(0, 5).filter(d => d >= auj);
  t('planning : 3 à 5 séances par jour ouvré restant de la semaine en cours', semaine1.every(d => plan[d].length >= 3 && plan[d].length <= 5), semaine1.map(d => d + ':' + plan[d].length));
  t('planning : aujourd’hui 4 patients', (plan[auj] || []).length === 4, (plan[auj] || []).length);
  t('planning : au moins 2 fauteuils et une injection SC dans la semaine', new Set(jours.slice(0, 5).flatMap(d => plan[d].filter(x => x.v === 'IV').map(x => x.f))).size >= 2 && jours.slice(0, 5).some(d => plan[d].some(x => x.v === 'SC')));
  t('planning : semaine suivante remplie (≥ 2 séances par jour)', jours.slice(5, 10).every(d => plan[d].length >= 2), jours.slice(5, 10).map(d => d + ':' + plan[d].length));
  await aller('planning'); await page.screenshot({ path: path.join(OUT, 'planning.png'), fullPage: true });

  /* ---------- 3. chaque dossier : onglets, détails, courbes ---------- */
  const ids = await R(() => window.RYZE.S.patients.map(p => ({ id: p.id, ipp: p.ipp, nom: p.prenom + ' ' + p.nom })));
  for (const d of ids) {
    for (const tab of ['synthese', 'plan', 'cures', 'surveillance', 'bilans', 'traitement', 'notes']) { await aller('patient', { id: d.id, tab }); await controlerTexte(`${d.nom} / ${tab}`); }
    const n = await R(id => { const R = window.RYZE, p = R.patient(id); let n = 0;
      p.cures.forEach(c => { if (c.statut === 'realisee' || c.statut === 'annulee') { R.actions.cureDetail({ dataset: { pid: id, n: String(c.n) } }); n++; R.closeModal(); } });
      p.surveillance.forEach((s, i) => { if (s.statut === 'faite') { R.actions.survDetail({ dataset: { pid: id, i: String(i) } }); n++; R.closeModal(); } });
      ['bio', 'clinique'].forEach(q => { try { R.modalCourbes(p, q); n++; } catch (e) { console.error('courbes ' + q + ' : ' + e.message); } R.closeModal(); });
      return n; }, d.id);
    if (VITRINE_IPP.includes(d.ipp)) t(`${d.nom} : ${n} détails de séances / contrôles / courbes ouverts`, n > 0);
  }
  /* courbes d'un dossier, texte affiché */
  await aller('patient', { id: ids.find(x => x.ipp === '2025-00701').id, tab: 'bilans' }); await page.screenshot({ path: path.join(OUT, 'hiba-bilans.png'), fullPage: true });

  /* ---------- 4. documents ---------- */
  const vitrine = ids.filter(x => VITRINE_IPP.includes(x.ipp)); const docs = {}; const garde = (slug, x) => { docs[slug] = (docs[slug] || '') + '\n' + (x.tx || ''); return x; };
  for (const d of vitrine) {
    const slug = d.nom.split(' ')[0].toLowerCase();
    await aller('carnet', { id: d.id }); await controlerTexte(`carnet A4 ${d.nom}`); const c = garde(slug, await pdf(`carnet-${slug}`)); controlerPdf(`carnet A4 ${d.nom}`, c); t(`carnet A4 ${d.nom} : ${c.pages} pages A4`, c.pages >= 2 && c.formats.every(f => f === '595x842'), c.formats.slice(0, 2));
    await aller('carnetPatient', { id: d.id }); await controlerTexte(`carnet patient ${d.nom}`);
    await page.emulateMedia({ media: 'print' }); await R(() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 300))));
    const deb = await R(() => [...document.querySelectorAll('#app .livret .page')].map((pg, i) => { const r = pg.getBoundingClientRect(); let pire = 0; pg.querySelectorAll('*').forEach(e => { const b = e.getBoundingClientRect(); if (b.height && (b.bottom - r.bottom > pire)) pire = b.bottom - r.bottom; }); return { i: i + 1, scroll: pg.scrollHeight - pg.clientHeight, depasse: Math.round(pire) }; }).filter(x => x.scroll > 1 || x.depasse > 1));
    await page.emulateMedia({ media: 'screen' });
    const cp = garde(slug, await pdf(`carnet-patient-${slug}`)); controlerPdf(`carnet patient ${d.nom}`, cp);
    t(`carnet patient ${d.nom} : 8 pages A5`, cp.pages === 8 && cp.formats.every(f => f === '420x595'), cp.formats);
    t(`carnet patient ${d.nom} : aucun débordement de page`, !deb.length, deb);
    for (const quoi of ['planification', 'bilans', 'seances']) { await aller('impression', { id: d.id, quoi }); await controlerTexte(`${quoi} ${d.nom}`); const x = garde(slug, await pdf(`${quoi}-${slug}`)); controlerPdf(`${quoi} ${d.nom}`, x); t(`${quoi} ${d.nom} : PDF`, x.pages >= 1); }
    await aller('compteRendu', { id: d.id }); await controlerTexte(`compte rendu ${d.nom}`); const cr = garde(slug, await pdf(`compte-rendu-${slug}`)); controlerPdf(`compte rendu ${d.nom}`, cr); t(`compte rendu ${d.nom} : PDF`, cr.pages >= 1);
  }
  /* ce que chaque dossier illustre, lu dans ses documents imprimés */
  const plat = x => (x || '').replace(/\s+/g, ' ');
  for (const [slug, lib, re] of [['rayan', 'atteinte périnéale : dosage sous la cible ≥ 10 et remarque du médecin', /sous la cible \(≥ 10, atteinte périnéale\)[\s\S]*Optimisation à 10 mg\/kg décidée en staff/], ['rayan', 'optimisation tracée', /Posologie modifiée[^.]*10 mg\/kg/],
    ['salma', 'adalimumab dans la cible ≥ 7,5, anticorps non détectés', /dans la cible \(≥ 7,5\)[^.]*anticorps non détectés/], ['mehdi', 'changement de molécule tracé', /Ustekinumab|Ustékinumab/i], ['lina', 'suspension en cours', /suspendu/i],
    ['omar', 'réaction à la perfusion', /Réaction mineure/], ['omar', 'note épinglée allergie au latex', /Allergie au latex/], ['nour', 'note épinglée mère joignable', /Mère joignable uniquement l’après-midi/],
    ['aya', 'séance corrigée tracée', /corrigée le \d{2}\/\d{2}\/\d{4}/], ['aya', 'report pour rupture de stock', /rupture/i], ['hiba', 'traitement antérieur (adalimumab) saisi', /Adalimumab/], ['adam', 'QuantiFERON douteux dans le bilan', /QuantiFERON douteux/], ['yassine', 'taux résiduel dans la cible', /dans la cible \(≥ 5\)/]])
    t(`documents ${slug} : ${lib}`, re.test(plat(docs[slug])), plat(docs[slug]).slice(0, 120));
  /* adolescente de 16 ans : mentions de grossesse dans ses carnets */
  { const nour = ids.find(x => x.ipp === '2025-00789'); await aller('carnet', { id: nour.id }); const a4 = await texteApp(); await aller('carnetPatient', { id: nour.id }); const a5 = await texteApp();
    console.log(`  info  Nour (16 ans) : carnet A4 ${/grossesse/i.test(a4) ? 'mentionne' : 'ne mentionne pas'} la grossesse ; carnet patient ${/grossesse|enceinte/i.test(a5) ? 'la mentionne' : 'ne la mentionne pas'}`);
    const hiba = ids.find(x => x.ipp === '2025-00701'); await aller('carnet', { id: hiba.id }); const h4 = await texteApp(); console.log(`  info  Hiba (9 ans) : carnet A4 ${/grossesse/i.test(h4) ? 'mentionne' : 'ne mentionne pas'} la grossesse`); }
  /* rapport d'activité */
  const chiffres = {};
  for (const [preset, lib] of [['mois', 'mois'], ['annee', 'année'], ['perso12', '12 mois']]) {
    for (const anonyme of [false, true]) {
      await aller('activite');
      await R(([preset, anonyme]) => { const R = window.RYZE, t = R.today(); Object.assign(R.ui.rapport, preset === 'perso12' ? { preset: 'perso', debut: R.addDays(t, -364), fin: t } : { preset }, { anonyme, annexes: true, pick: null }); R.render(); }, [preset, anonyme]);
      const tx = await controlerTexte(`rapport ${lib}${anonyme ? ' anonymisé' : ''}`);
      const x = await pdf(`rapport-${preset}${anonyme ? '-anonyme' : ''}`); controlerPdf(`rapport ${lib}${anonyme ? ' anonymisé' : ''}`, x);
      if (anonyme) { const noms = await R(() => window.RYZE.S.patients.map(p => p.nom)); const fuite = noms.filter(n => (tx + (x.tx || '')).includes(n)); t(`rapport ${lib} anonymisé : aucun nom de patient`, !fuite.length, fuite); }
      else chiffres[lib] = await R(() => { const R = window.RYZE, { debut, fin } = R.periodeRapport(), st = R.statsPeriode(debut, fin); const n = v => Array.isArray(v) ? v.length : typeof v === 'number' ? v : v && typeof v === 'object' ? Object.keys(v).length : v; return { debut, fin, ivRealisees: n(st.iv.realisees), scRealisees: n(st.sc.realisees), total: n(st.toutesRealisees), tauxRealisation: st.tauxRealisation, reactions: n(st.listeReactions), reports: n(st.reports), nonVenus: n(st.nonVenus), annulees: n(st.toutesAnnulees), fileActive: n(st.fileActive), patients: st.patients.size, occupation: st.occupation, controlesFaits: n(st.ctrlFaits), nouveaux: st.nbMouv };  });
    }
  }
  /* feuille de planning */
  for (const vue of ['jour', 'semaine']) { await aller('feuillePlanning', { vue, date: auj }); const tx = await controlerTexte(`feuille ${vue}`); const x = await pdf(`feuille-${vue}`); controlerPdf(`feuille ${vue}`, x); t(`feuille ${vue} : PDF ${x.pages} page(s)`, x.pages >= 1 && (vue !== 'jour' || duJour.every(n => tx.includes(n)))); }

  /* ---------- 5. export → import « remplacer » → identique ---------- */
  const e1 = await exporter('export-1.json');
  await importerRemplacer(e1); await connexion('AAA111');
  const e2 = await exporter('export-2.json');
  const net = txt => { const s = JSON.parse(txt); delete s.journal; delete s.modifieLe; delete s.enregistreLe; delete s.derniereSauvegarde; delete s.route; delete s.dirty; (s.users || []).forEach(u => delete u.derniere); return JSON.stringify(s); };
  t('export → import « remplacer » → export : contenu identique (hors journal, horodatages, dernière connexion)', net(e1) === net(e2));
  t('base importée identique au fichier vitrine (dossiers, rendez-vous, équipe, réglages, protocoles)', ['patients', 'rdv', 'protocoles', 'settings'].every(k => JSON.stringify(JSON.parse(e1)[k]) === JSON.stringify(base[k])), ['patients', 'rdv', 'protocoles', 'settings'].filter(k => JSON.stringify(JSON.parse(e1)[k]) !== JSON.stringify(base[k])));

  console.log(`  info  « (s) » relevés dans les libellés de l’écran (application, hors documents) : ${[...sEcran].slice(0, 12).join(' | ')}`);
  t('aucune erreur JavaScript', !erreurs.length, [...new Set(erreurs)].slice(0, 6));
  await ctx.close(); await nav.close();
  console.log('Chiffres du rapport d’activité : ' + JSON.stringify(chiffres, null, 0));
  console.log(`${ok} OK, ${ko} FAIL ; erreurs JS : ${erreurs.length} ; PDF et captures : ${OUT}`);
  return ko || erreurs.length ? 1 : 0;
}
module.exports = { verifier };
if (require.main === module) verifier(process.argv[2]).then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
