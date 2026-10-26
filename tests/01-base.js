/* =====================================================================
   01-base : chargement, connexion et droits, sauvegarde locale et
   rechargement, export / import de la base, base vide, migration
   idempotente, identité de l'établissement (avec et sans etablissement.js)
   Patients : jeu de démonstration fictif uniquement.
   ===================================================================== */
'use strict';
const { suite } = require('./lib');
const H = suite('01-base');
const { t } = H;

H.executer(async () => {
  /* ---------------- Chargement ---------------- */
  H.section('Chargement de l’application');
  const { page } = await H.ouvrir();
  await H.demo(page);
  t('écran de connexion affiché', await page.isVisible('#login-code'));
  const info = await page.evaluate(() => { const R = window.RYZE; return { pages: Object.keys(R.pages), n: R.S.patients.length, version: R.S.version, codes: [...document.querySelectorAll('[data-action="loginFill"]')].map(b => b.dataset.code), dirty: !!R.S.dirty }; });
  const routes = ['dashboard', 'patients', 'patient', 'planning', 'feuillePlanning', 'protocoles', 'equipe', 'parametres', 'nouveau', 'changement', 'carnet', 'impression', 'compteRendu', 'carnetPatient', 'activite'];
  t('toutes les pages de l’application sont déclarées (R.pages)', routes.every(r => info.pages.includes(r)), routes.filter(r => !info.pages.includes(r)));
  t('jeu de démonstration chargé (au moins 10 dossiers fictifs, base non modifiée)', info.n >= 10 && !info.dirty, info);
  t('codes de démonstration proposés sur l’écran de connexion (MED001, CHEF01, HDJ001)', ['MED001', 'CHEF01', 'HDJ001'].every(c => info.codes.includes(c)), info.codes);

  /* ---------------- Connexion ---------------- */
  H.section('Connexion et droits');
  const refus = await H.connexion(page, 'ZZZ999');
  t('code inconnu refusé (message « Code inconnu », écran de connexion conservé)', !refus && /Code inconnu/.test(await H.toasts(page)) && await page.isVisible('#login-code'));
  await H.viderToasts(page);
  t('code en minuscules accepté (med001)', await H.connexion(page, 'med001'));
  await H.deconnexion(page);

  t('connexion du médecin MED001', await H.connexion(page, 'MED001'));
  const med = await page.evaluate(() => { const R = window.RYZE; const nav = [...document.querySelectorAll('.nav [data-go]')].map(b => b.dataset.go); return { id: R.S.user, nav, dossier: R.can('dossier', 'w'), equipe: R.can('equipe', 'w'), protocoles: R.can('protocoles', 'w') }; });
  t('médecin : accès complet (dossier, équipe, protocoles en écriture ; menu complet)', med.id === 'u-med1' && med.dossier && med.equipe && med.protocoles && ['nouveau', 'equipe', 'activite'].every(x => med.nav.includes(x)), med);
  await H.aller(page, 'parametres');
  t('médecin : page Paramètres accessible', (await page.evaluate(() => window.RYZE.S.route.page)) === 'parametres' && /Paramètres/.test(await H.texte(page, 'main h1')));
  await H.deconnexion(page);

  t('connexion de l’IDE HDJ001', await H.connexion(page, 'HDJ001'));
  const ide = await page.evaluate(() => { const R = window.RYZE; const nav = [...document.querySelectorAll('.nav [data-go]')].map(b => b.dataset.go); return { role: R.user().role, nav, cures: R.can('cures', 'w'), dossier: R.can('dossier', 'w'), equipe: R.can('equipe', 'r'), carnet: R.can('carnet', 'r') }; });
  t('IDE : séances en écriture, dossier en lecture seule, ni équipe ni « Nouveau dossier » dans le menu', ide.role === 'hdj' && ide.cures && !ide.dossier && !ide.equipe && ide.carnet && !ide.nav.includes('nouveau') && !ide.nav.includes('equipe'), ide);
  await H.aller(page, 'parametres');
  const pIde1 = await page.evaluate(() => window.RYZE.S.route.page);
  await H.aller(page, 'nouveau');
  const pIde2 = await page.evaluate(() => window.RYZE.S.route.page);
  t('IDE : Paramètres et Nouveau dossier redirigés vers le tableau de bord', pIde1 === 'dashboard' && pIde2 === 'dashboard', [pIde1, pIde2]);
  await H.aller(page, 'patient', { id: 'p1' });
  const ideDossier = await page.evaluate(() => ({ modifier: !!document.querySelector('[data-action="patientModifier"]'), suspendre: !!document.querySelector('[data-action="patientSuspendre"]'), fait: !!document.querySelector('[data-action="cureEnregistrer"]'), autoriseSusp: window.RYZE.autorise('patientSuspendre'), autoriseExport: window.RYZE.autorise('exporterBase') }));
  t('IDE : dossier sans « Modifier » ni « Suspendre », avec « séance réalisée » ; actions réservées refusées', !ideDossier.modifier && !ideDossier.suspendre && ideDossier.fait && !ideDossier.autoriseSusp && !ideDossier.autoriseExport, ideDossier);
  await H.viderToasts(page);
  await H.deconnexion(page);

  /* ---------------- Sauvegarde locale et rechargement ---------------- */
  H.section('Sauvegarde locale (localStorage) et rechargement');
  await H.connexion(page, 'MED001');
  await H.aller(page, 'patient', { id: 'p1', tab: 'notes' });
  const NOTE = 'Note de test 01-base — sauvegarde locale';
  await page.fill('form[data-form="noteAdd"] textarea[name="txt"]', NOTE);
  await page.click('form[data-form="noteAdd"] button[type=submit]');
  const stocke = await page.evaluate(n => { const raw = localStorage.getItem('ryze-hdj-v1') || ''; return { dans: raw.includes(n), dirty: window.RYZE.S.dirty === true }; }, NOTE);
  t('note enregistrée dans localStorage (ryze-hdj-v1), base marquée modifiée', stocke.dans && stocke.dirty, stocke);
  await page.reload(); await page.waitForSelector('.shell');
  const apres1 = await page.evaluate(() => { const R = window.RYZE; return { note: (R.patient('p1').notes[0] || {}).txt, user: R.S.user, settings: JSON.stringify(R.S.settings), patients: JSON.stringify(R.S.patients), protocoles: JSON.stringify(R.S.protocoles), version: R.S.version }; });
  t('après rechargement : session et note conservées', apres1.note === NOTE && apres1.user === 'u-med1', { note: apres1.note, user: apres1.user });

  /* migrer() à chaque chargement : un second chargement ne change rien */
  await page.evaluate(() => window.RYZE.save());
  await page.reload(); await page.waitForSelector('.shell');
  const apres2 = await page.evaluate(() => { const R = window.RYZE; return { settings: JSON.stringify(R.S.settings), patients: JSON.stringify(R.S.patients), protocoles: JSON.stringify(R.S.protocoles), version: R.S.version }; });
  t('migration idempotente : deux chargements donnent les mêmes réglages', apres1.settings === apres2.settings, [apres1.settings.length, apres2.settings.length]);
  t('migration idempotente : mêmes dossiers et protocoles, même version de base', apres1.patients === apres2.patients && apres1.protocoles === apres2.protocoles && apres1.version === apres2.version && apres2.version >= 12, apres2.version);

  /* ---------------- Export de la base ---------------- */
  H.section('Export de la base');
  await H.aller(page, 'parametres');
  const exp = await H.telecharger(page, '[data-action="exporterBase"]');
  let base = null; try { base = JSON.parse(exp.contenu); } catch (e) { base = null; }
  const nPat = await page.evaluate(() => window.RYZE.S.patients.length);
  t('export : fichier ryze-sauvegarde-AAAA-MM-JJ.json proposé au téléchargement', /^ryze-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(exp.nom), exp.nom);
  t('export : texte JSON valide avec tous les dossiers, codes, protocoles et réglages', !!base && Array.isArray(base.patients) && base.patients.length === nPat && Array.isArray(base.users) && Array.isArray(base.protocoles) && !!base.settings, base && base.patients && base.patients.length);
  const zone = await page.evaluate(() => (document.getElementById('export-txt') || {}).value || '');
  let zoneOk = false; try { zoneOk = JSON.parse(zone).patients.length === nPat; } catch (e) { zoneOk = false; }
  t('export : contenu aussi affiché à copier dans la fenêtre, date du dernier export notée', zoneOk && await page.evaluate(() => window.RYZE.S.derniereSauvegarde === window.RYZE.today()));
  await page.click('#modal-root [data-action="closeModal"]');

  /* ---------------- Import « ajouter les dossiers absents » ---------------- */
  H.section('Import : ajouter les dossiers absents (texte collé)');
  const APRES_EXPORT = 'Note ajoutée après l’export (doit rester)';
  const retire = await page.evaluate(n => { const R = window.RYZE, S = R.S; const p = S.patients[S.patients.length - 1]; S.patients = S.patients.filter(x => x !== p); R.patient('p1').notes.unshift({ date: R.today(), heure: '10:00', par: S.user, txt: n }); R.touch(); R.render(); return { id: p.id, n: S.patients.length }; }, APRES_EXPORT);
  await page.click('[data-action="importerBase"]');
  await page.fill('#import-txt', '{pas du json');
  await page.click('[data-action="importerBaseOk"]');
  t('import : texte collé invalide refusé avec un message', /Texte collé invalide/.test(await H.toasts(page)));
  await H.viderToasts(page);
  await page.fill('#import-txt', exp.contenu);
  await page.check('input[name="import-mode"][value="ajouter"]');
  await page.click('[data-action="importerBaseOk"]');
  await page.waitForSelector('[data-action="importerAjoutOk"]');
  const plan = await H.modal(page);
  t('import en ajout : récapitulatif « 1 à ajouter », les autres déjà présents', /1 à ajouter/.test(plan) && new RegExp(`${retire.n} déjà présent`).test(plan), plan.slice(0, 200));
  await page.click('[data-action="importerAjoutOk"]');
  const ajout = await page.evaluate(([id, n]) => { const R = window.RYZE; return { revenu: !!R.patient(id), total: R.S.patients.length, garde: R.patient('p1').notes.some(x => x.txt === n), route: R.S.route.page, journal: (R.S.journal[0] || {}).txt || '' }; }, [retire.id, APRES_EXPORT]);
  t('import en ajout : dossier absent ajouté, dossiers actuels intacts (note postérieure à l’export conservée)', ajout.revenu && ajout.total === nPat && ajout.garde, ajout);
  t('import en ajout : tracé dans le journal, retour à la liste des patients', /Import en ajout/.test(ajout.journal) && ajout.route === 'patients', ajout);

  /* ---------------- Import « remplacer toute la base » ---------------- */
  H.section('Import : remplacer toute la base (texte collé)');
  const reduit = JSON.parse(exp.contenu); reduit.patients = reduit.patients.slice(0, reduit.patients.length - 2);
  await H.aller(page, 'parametres');
  await page.click('[data-action="importerBase"]');
  await page.fill('#import-txt', JSON.stringify(reduit));
  await page.check('input[name="import-mode"][value="remplacer"]');
  await page.click('[data-action="importerBaseOk"]');
  await page.waitForSelector('[data-action="importerRemplacerOk"]');
  t('import en remplacement : confirmation explicite demandée', /Remplacer toute la base/.test(await H.modal(page)));
  await page.click('[data-action="importerRemplacerOk"]');
  await page.waitForSelector('#login-code');
  const rempl = await page.evaluate(() => ({ n: window.RYZE.S.patients.length, user: window.RYZE.S.user }));
  t('import en remplacement : base remplacée, reconnexion demandée', rempl.n === reduit.patients.length && !rempl.user, rempl);
  t('import en remplacement : connexion avec les codes du fichier', await H.connexion(page, 'MED001'));

  /* ---------------- Base vide ---------------- */
  H.section('Démarrer avec une base vide');
  await H.demo(page);
  await page.click('[data-action="viderDemoConfirm"]');
  await page.click('#modal-root [data-action="viderDemo"]');
  const vide = await page.evaluate(() => { const S = window.RYZE.S; const b = document.querySelector('.demo-note b.mono'); return { n: S.patients.length, code: S.codeNeuf || '', affiche: b ? b.textContent : '', fenetre: (document.querySelector('#modal-root .modal') || {}).innerText || '' }; });
  t('base vide : aucun dossier, nouveau code d’accès complet affiché (écran et fenêtre)', vide.n === 0 && /^[A-Z]{3}\d{3}$/.test(vide.code) && vide.affiche === vide.code && vide.fenetre.includes(vide.code), vide);
  await page.click('#modal-root [data-action="closeModal"]');
  const refusDemo = [];
  for (const c of ['MED001', 'CHEF01', 'HDJ001']) { await H.viderToasts(page); if (await H.connexion(page, c)) { refusDemo.push(c); await H.deconnexion(page); } }
  t('base vide : codes de démonstration refusés', refusDemo.length === 0, refusDemo);
  const okNeuf = await H.connexion(page, vide.code);
  const apresNeuf = await page.evaluate(() => ({ user: window.RYZE.S.user, n: window.RYZE.S.patients.length, erreur: /Erreur d’affichage/.test(document.body.innerText) }));
  t('base vide : connexion avec le nouveau code (accès complet), tableau de bord affiché', okNeuf && apresNeuf.n === 0 && !apresNeuf.erreur && await page.evaluate(() => window.RYZE.can('equipe', 'w')), apresNeuf);

  /* ---------------- Identité de l'établissement (etablissement.js chargé) ---------------- */
  H.section('Identité de l’établissement et logo (etablissement.js)');
  await H.demo(page);
  const id1 = await page.evaluate(() => { const R = window.RYZE, e = R.etab(), E = window.RYZE_ETABLISSEMENT || {}, ic = document.querySelector('link[rel~="icon"]'); return { charge: !!window.RYZE_ETABLISSEMENT, etab: e.etablissement, attendu: E.etablissement || '', logo: e.logo.slice(0, 22), logoE: (E.logo || '').slice(0, 22), img: !!document.querySelector('.login-etab img.login-logo'), connexion: (document.querySelector('.login-etab') || {}).innerText || '', titre: document.title, icone: ic ? (ic.getAttribute('href') || '').slice(0, 15) : '' }; });
  t('etablissement.js chargé : identité reprise dans les réglages', id1.charge && !!id1.attendu && id1.etab === id1.attendu, id1);
  t('etablissement.js : logo enregistré et affiché à la connexion avec le nom de l’établissement', /^data:image\//.test(id1.logo) && id1.logo === id1.logoE && id1.img && id1.connexion.includes(id1.attendu), id1);
  t('etablissement.js : titre « HDJ — Hôpital de jour · Biothérapies » et icône de la fenêtre', id1.titre === 'HDJ — Hôpital de jour · Biothérapies' && id1.icone.startsWith('data:image'), [id1.titre, id1.icone]);
  await H.connexion(page, 'MED001');
  await H.aller(page, 'carnet', { id: 'p1' });
  const ent1 = await page.evaluate(() => { const w = document.querySelector('#app .carnet-wrap'); return { txt: w ? w.innerText : '', logo: !!(w && w.querySelector('img.doc-logo')) }; });
  t('etablissement.js : en-tête des documents avec l’établissement et le logo', ent1.logo && ent1.txt.includes(id1.attendu), ent1.logo);

  /* ---------------- Application SANS etablissement.js ---------------- */
  H.section('Application sans etablissement.js (requête bloquée)');
  const avant = H.erreursJS.length;
  const B = await H.ouvrir({ etab: false });
  await B.page.goto(H.APP_URL);
  await H.demo(B.page);
  const id2 = await B.page.evaluate(() => { const R = window.RYZE, e = R.etab(), ic = document.querySelector('link[rel~="icon"]'); return { charge: !!window.RYZE_ETABLISSEMENT, etab: e.etablissement, hopital: e.hopital, logo: e.logo, img: !!document.querySelector('img.login-logo'), titre: document.title, icone: ic ? ic.getAttribute('href') : '' }; });
  t('sans etablissement.js : chargement sans erreur JavaScript', H.erreursJS.length === avant && !id2.charge, H.erreursJS.slice(avant));
  t('sans etablissement.js : identité générique (aucun établissement réel, aucun logo)', !!id2.etab && !/Ibn Rochd|Harouchi/i.test(id2.etab + id2.hopital) && id2.logo === '' && !id2.img, id2);
  t('sans etablissement.js : titre et icône d’origine (Ryze, ryze.svg)', id2.titre === 'Ryze Biothérapies' && id2.icone === 'ryze.svg', [id2.titre, id2.icone]);
  await H.connexion(B.page, 'MED001');
  await H.aller(B.page, 'carnet', { id: 'p1' });
  const ent2 = await B.page.evaluate(() => { const w = document.querySelector('#app .carnet-wrap'); return { txt: w ? w.innerText : '', logo: !!(w && w.querySelector('img.doc-logo')) }; });
  t('sans etablissement.js : carnet imprimable, en-tête générique sans logo ni « undefined » / « 05 XX »', ent2.txt.length > 500 && !ent2.logo && ent2.txt.includes(id2.etab) && !/undefined|05 XX/i.test(ent2.txt), { logo: ent2.logo, n: ent2.txt.length });
  t('sans etablissement.js : aucune erreur JavaScript après connexion et carnet', H.erreursJS.length === avant, H.erreursJS.slice(avant));
});
