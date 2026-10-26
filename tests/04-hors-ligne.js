/* =====================================================================
   04-hors-ligne : poste sans Internet (réseau coupé : requêtes non
   file:// refusées, navigateur hors ligne) — toutes les pages, documents
   et PDF, polices locales (latin et arabe), export d'un document et de la
   base, sauvegarde locale et sauvegarde sur disque ; aucune requête réseau.
   Patients : jeu de démonstration fictif uniquement.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { suite } = require('./lib');
const H = suite('04-hors-ligne');
const { t } = H;

H.executer(async () => {
  const X = await H.ouvrir({ horsLigne: true });
  const { page } = X;
  const fichiers = []; page.on('request', r => { if (r.url().startsWith('file:')) fichiers.push(r.url()); });

  /* ---------------- Chargement hors ligne ---------------- */
  H.section('Chargement sans réseau');
  await page.goto(H.APP_URL);
  await H.demo(page);
  t('réseau coupé : le navigateur se sait hors ligne', await page.evaluate(() => navigator.onLine === false));
  t('application chargée hors ligne (écran de connexion, démonstration)', await page.isVisible('#login-code') && await page.evaluate(() => window.RYZE.S.patients.length >= 10));
  await page.evaluate(() => document.fonts.ready.then(() => true));
  /* code de l'application : aucune ressource Internet chargée par la page (seul repli : Google Fonts dans un document exporté sans fonts-embed.js) */
  const html = fs.readFileSync(path.join(H.APP_DIR, 'index.html'), 'utf8');
  t('index.html : scripts, styles et icône locaux (aucun src/href Internet)', !/(src|href)\s*=\s*["']?https?:/i.test(html) && (html.match(/<script src="[^"]+"/g) || []).length >= 8);
  const js = fs.readdirSync(H.APP_DIR).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(H.APP_DIR, f), 'utf8')]);
  const appels = js.filter(([, c]) => /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket|importScripts\s*\(/.test(c)).map(([f]) => f);
  const urls = js.flatMap(([f, c]) => (c.match(/https?:\/\/[^\s'"`)<]+/g) || []).filter(u => !/^https?:\/\/(fonts\.googleapis\.com|www\.w3\.org)\//.test(u)).map(u => f + ' : ' + u));
  t('scripts de l’application : aucun appel réseau (fetch, XHR…) ni adresse Internet chargée', !appels.length && !urls.length, { appels, urls: urls.slice(0, 5) });
  const css = fs.readFileSync(path.join(H.APP_DIR, 'fonts', 'fonts.css'), 'utf8');
  t('fonts.css : polices locales seulement (aucune adresse Internet)', (css.match(/url\(/g) || []).length >= 10 && !/https?:/i.test(css));
  const polices = await page.evaluate(() => ({ sans: document.fonts.check('16px "IBM Plex Sans"'), chargees: [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')))] }));
  t('police IBM Plex Sans chargée depuis app/fonts (fichiers .woff2 locaux)', polices.sans && polices.chargees.includes('IBM Plex Sans') && fichiers.some(u => /\/fonts\/[^/]+\.woff2$/.test(u)), polices);
  const logo = await page.evaluate(() => { const i = document.querySelector('img.login-logo'); return !!i && i.complete && i.naturalWidth > 0 && i.src.startsWith('data:image/'); });
  t('logo de l’établissement affiché hors ligne (image intégrée)', logo);
  t('connexion hors ligne (MED001)', await H.connexion(page, 'MED001'));
  const mono = await page.evaluate(() => document.fonts.ready.then(() => [...document.fonts].some(f => f.family.replace(/"/g, '') === 'IBM Plex Mono' && f.status === 'loaded')));
  t('police IBM Plex Mono (codes, numéros) chargée localement', mono);

  /* ---------------- Toutes les pages ---------------- */
  H.section('Toutes les pages de l’application');
  const pid2 = await page.evaluate(() => (window.RYZE.S.patients.find(p => !p.carnetMixte) || {}).id);
  const routes = [['dashboard'], ['planning'], ['patients'], ['patient', { id: 'p1' }], ['patient', { id: 'p1', tab: 'plan' }], ['patient', { id: 'p1', tab: 'bilans' }], ['patient', { id: 'p1', tab: 'traitement' }], ['patient', { id: 'p1', tab: 'notes' }], ['patient', { id: pid2, tab: 'cures' }], ['patient', { id: pid2, tab: 'surveillance' }], ['nouveau'], ['changement', { id: 'p1' }], ['protocoles'], ['activite'], ['equipe'], ['parametres'], ['feuillePlanning', { vue: 'jour' }], ['feuillePlanning', { vue: 'semaine' }], ['carnet', { id: 'p1' }], ['impression', { id: 'p1', quoi: 'seances' }], ['impression', { id: 'p1', quoi: 'bilans' }], ['impression', { id: 'p1', quoi: 'planification' }], ['compteRendu', { id: 'p1' }], ['carnetPatient', { id: 'p1' }], ['carnetPatient', { id: 'vierge' }]];
  const ratees = { ecrans: [], dossier: [], documents: [] }, n = { ecrans: 0, dossier: 0, documents: 0 };
  for (const [r, par] of routes) {
    const g = ['patient', 'changement', 'nouveau'].includes(r) ? 'dossier' : ['carnet', 'impression', 'compteRendu', 'carnetPatient', 'feuillePlanning'].includes(r) ? 'documents' : 'ecrans'; n[g]++;
    await H.aller(page, r, par);
    const v = await page.evaluate(() => { const m = document.querySelector('#app main'); return { page: window.RYZE.S.route.page, n: m ? m.innerText.trim().length : 0, erreur: /Erreur d’affichage/.test(document.body.innerText) }; });
    if (v.erreur || v.n < 50 || v.page !== r) ratees[g].push(`${r}${par ? ' ' + JSON.stringify(par) : ''} (${v.page}, ${v.n} car.)`);
  }
  t(`écrans (tableau de bord, planning, patients, protocoles, activité, équipe, paramètres) hors ligne : ${n.ecrans} pages sans erreur`, !ratees.ecrans.length, ratees.ecrans);
  t(`dossier patient (tous les onglets), assistant et changement de protocole hors ligne : ${n.dossier} vues sans erreur`, !ratees.dossier.length, ratees.dossier);
  t(`documents (carnets, impressions, compte rendu, feuilles de planning) hors ligne : ${n.documents} vues sans erreur`, !ratees.documents.length, ratees.documents);

  /* ---------------- Documents et PDF ---------------- */
  H.section('Documents imprimés hors ligne');
  await H.aller(page, 'carnetPatient', { id: 'p1' });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const arabe = await page.evaluate(() => ({ check: document.fonts.check('16px "IBM Plex Sans Arabic"', 'مرض'), charge: [...document.fonts].some(f => f.family.replace(/"/g, '') === 'IBM Plex Sans Arabic' && f.status === 'loaded') }));
  const pcp = await H.pdf(page, 'carnet-patient-p1');
  t('carnet patient hors ligne : police arabe locale chargée, 8 pages A5', arabe.check && arabe.charge && pcp.pages === 8 && pcp.formats.every(f => f === '420x595'), { arabe, pages: pcp.pages });
  await H.aller(page, 'carnet', { id: 'p1' });
  const pca = await H.pdf(page, 'carnet-p1');
  await H.aller(page, 'compteRendu', { id: 'p1' });
  const pcr = await H.pdf(page, 'compte-rendu-p1');
  t('carnet A4 et compte rendu imprimés hors ligne', pca.pages >= 2 && pcr.pages >= 1, [pca.pages, pcr.pages]);
  await H.aller(page, 'activite');
  const pra = await H.pdf(page, 'rapport');
  await H.aller(page, 'feuillePlanning', { vue: 'semaine' });
  const pfp = await H.pdf(page, 'planning-semaine');
  t('rapport d’activité et feuille de planning imprimés hors ligne', pra.pages >= 1 && pfp.pages >= 1 && pfp.formats.every(f => f === '842x595'), [pra.pages, pfp.pages]);

  /* ---------------- Exports ---------------- */
  H.section('Exports hors ligne');
  await H.aller(page, 'carnet', { id: 'p1' });
  const doc = await H.telecharger(page, '#app [data-action="telechargerDoc"]');
  t('export d’un document hors ligne : polices intégrées depuis fonts-embed.js, sans Google Fonts', /url\(data:font\/woff2;base64,/.test(doc.contenu) && !/googleapis/.test(doc.contenu) && fichiers.some(u => /\/fonts\/fonts-embed\.js$/.test(u)), doc.nom);
  await H.aller(page, 'parametres');
  const base = await H.telecharger(page, '[data-action="exporterBase"]');
  let nBase = -1; try { nBase = JSON.parse(base.contenu).patients.length; } catch (e) { nBase = -1; }
  t('export de la base hors ligne : JSON complet', nBase === await page.evaluate(() => window.RYZE.S.patients.length), nBase);
  await page.click('#modal-root [data-action="closeModal"]');
  /* fichier exporté rouvert sur le même poste, toujours sans réseau */
  const vue = await X.context.newPage();
  await vue.goto('file://' + doc.fichier);
  const ouvert = await vue.evaluate(() => document.fonts.ready.then(() => ({ police: [...document.fonts].some(f => f.family.replace(/"/g, '') === 'IBM Plex Sans' && f.status === 'loaded'), logo: !!document.querySelector('img.doc-logo') && document.querySelector('img.doc-logo').naturalWidth > 0, n: document.body.innerText.length })));
  t('document exporté rouvert hors ligne : polices et logo intégrés affichés', ouvert.police && ouvert.logo && ouvert.n > 1000, ouvert);
  await vue.close();

  /* ---------------- Sauvegardes ---------------- */
  H.section('Sauvegarde locale et sauvegarde sur disque');
  await H.aller(page, 'patient', { id: 'p1', tab: 'notes' });
  const NOTE = 'Note saisie hors ligne (04-hors-ligne)';
  await page.fill('form[data-form="noteAdd"] textarea[name="txt"]', NOTE);
  await page.click('form[data-form="noteAdd"] button[type=submit]');
  await page.reload(); await page.waitForSelector('.shell');
  t('sauvegarde locale hors ligne : note conservée après rechargement', await page.evaluate(n => (window.RYZE.patient('p1').notes[0] || {}).txt === n && (localStorage.getItem('ryze-hdj-v1') || '').includes(n), NOTE));
  /* dossier de sauvegarde simulé (API File System Access) : ryze-base.json et la copie datée du jour */
  const disque = await page.evaluate(async () => {
    const R = window.RYZE, ecrits = {};
    const h = { name: 'sauvegardes-test', async getFileHandle(nom) { return { async createWritable() { let b = ''; return { async write(x) { b += x; }, async close() { ecrits[nom] = b; } }; } }; }, async *keys() { for (const k of Object.keys(ecrits)) yield k; }, async removeEntry(n) { delete ecrits[n]; }, async queryPermission() { return 'granted'; } };
    const avant = { handle: R.fs.handle, etat: R.fs.etat }; R.fs.handle = h; R.fs.etat = { actif: true, nom: h.name, dernier: null, erreur: '' };
    let ok = false; try { ok = await R.fs.ecrire(); } finally { R.fs.handle = avant.handle; R.fs.etat = avant.etat; }
    let n = -1; try { n = JSON.parse(ecrits['ryze-base.json']).patients.length; } catch (e) { n = -1; }
    return { ok, noms: Object.keys(ecrits).sort(), n, attendu: R.S.patients.length, today: R.today(), copieIdentique: ecrits['ryze-base.json'] === ecrits[`ryze-sauvegarde-${R.today()}.json`] };
  });
  t('sauvegarde sur disque : ryze-base.json et ryze-sauvegarde-AAAA-MM-JJ.json écrits, base complète', disque.ok && disque.noms.join(',') === `ryze-base.json,ryze-sauvegarde-${disque.today}.json` && disque.n === disque.attendu && disque.copieIdentique, disque);

  /* ---------------- Bilan réseau ---------------- */
  H.section('Requêtes réseau');
  t('aucune requête réseau pendant toute la suite (seulement des fichiers locaux)', X.reseau.length === 0 && fichiers.length > 10, X.reseau.slice(0, 5));
});
