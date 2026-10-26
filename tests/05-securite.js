/* =====================================================================
   05-securite : sécurité des données — base illisible (aucun remplacement,
   « base neuve » seulement après téléchargement, copie .bak signalée),
   copie de sécurité « ryze-avant-… » avant une opération destructrice,
   copie disque plus récente jamais écrasée, indicateur « dernière
   sauvegarde locale impossible », import d'éléments invalides refusé,
   utilisateur propre à l'onglet, garde multi-onglets sans faux succès,
   rotation mensuelle des copies datées, erreur disque visible par l'IDE,
   cycle supprimé archivé, cible de dosage figée, « Modifier le dossier »
   contrôlé et journalisé, alerte base volumineuse, clé KEY.m (aucune
   relecture complète de la base à chaque clic).
   Dossier de sauvegarde simulé (API File System Access, en mémoire de la
   page) ; patients : jeu de démonstration fictif et dossiers « ESSAI … ».
   ===================================================================== */
'use strict';
const { suite } = require('./lib');
const H = suite('05-securite');
const { t } = H;
const KEY = 'ryze-hdj-v1';

/* erreurs console voulues par les essais (base illisible signalée, stockage plein simulé) : retirées du décompte des erreurs JS */
const ATTENDUES = /Base locale non chargée|Sauvegarde impossible/;
const oublierAttendues = () => { for (let i = H.erreursJS.length - 1; i >= 0; i--) if (ATTENDUES.test(H.erreursJS[i])) H.erreursJS.splice(i, 1); };

/* dossier de sauvegarde simulé dans la page : window.__fs.files[nom] = { txt, t } ; fail : écriture refusée (clé USB retirée…) */
const installerFs = page => page.evaluate(() => {
  const F = window.__fs = { files: {}, fail: null, perm: { q: 'granted', r: 'granted' }, t: 1 };
  const fichier = nom => ({ name: nom, kind: 'file',
    async getFile() { if (!(nom in F.files)) throw new DOMException('introuvable', 'NotFoundError'); const x = F.files[nom]; return { size: x.txt.length, lastModified: x.t, text: async () => x.txt }; },
    async createWritable() { if (F.fail) throw new DOMException(F.fail.msg, F.fail.name); let b = ''; return { async write(v) { b += v; }, async close() { F.files[nom] = { txt: b, t: ++F.t }; } }; } });
  window.__dossier = { name: 'SAUV-TEST', kind: 'directory',
    async getFileHandle(nom, o) { if (!(o && o.create) && !(nom in F.files)) throw new DOMException('introuvable', 'NotFoundError'); return fichier(nom); },
    async *keys() { for (const k of Object.keys(F.files)) yield k; },
    async removeEntry(n) { delete F.files[n]; },
    async queryPermission() { return F.perm.q; }, async requestPermission() { return F.perm.r; } };
});
/* sauvegarde sur disque active sur le dossier simulé (sans écriture différée en attente) */
const activerFs = page => page.evaluate(() => { const R = window.RYZE; clearTimeout(R.fs._t); R.fs.handle = window.__dossier; R.fs.etat = { actif: true, nom: 'SAUV-TEST', dernier: null, erreur: '', plusRecent: '' }; });
const arreterFs = page => page.evaluate(() => { const R = window.RYZE; clearTimeout(R.fs._t); R.fs.handle = null; R.fs.etat = { actif: false, nom: '', dernier: null, erreur: '', plusRecent: '' }; try { localStorage.removeItem('ryze-hdj-v1.disque'); } catch (e) {} });
const fichiers = page => page.evaluate(() => Object.fromEntries(Object.entries((window.__fs || {}).files || {}).map(([k, v]) => [k, v.txt])));
const toastsBons = page => page.evaluate(() => [...document.querySelectorAll('#toast-root .toast.good')].map(x => x.textContent));
/* note ajoutée directement (base marquée modifiée) */
const noter = (page, txt) => page.evaluate(x => { const R = window.RYZE, p = R.S.patients[0]; p.notes.unshift({ date: R.today(), heure: '10:00', par: R.S.user, txt: x }); return R.touch(); }, txt);

/* assistant « Nouveau dossier » jusqu'à l'enregistrement (comme 02-dossier) ; renvoie l'identifiant du dossier créé */
async function creerDossier(page, d) {
  await H.aller(page, 'nouveau');
  await page.fill('#w-nom', d.nom); await page.fill('#w-prenom', d.prenom); await page.fill('#w-ddn', d.ddn);
  await page.selectOption('select[data-k="sexe"]', d.sexe);
  await page.fill('#w-poids', String(d.poids)); await page.fill('#w-taille', String(d.taille));
  await page.click('[data-action="wNext"]');
  await page.click(`[data-action="wProto"][data-id="${d.proto}"]`);
  await page.click('[data-action="wNext"]');
  await page.waitForSelector('[data-action="wCreate"]');
  const avant = await page.evaluate(() => window.RYZE.S.patients.map(p => p.id));
  await page.click('[data-action="wCreate"]');
  return page.evaluate(av => { const p = window.RYZE.S.patients.find(x => !av.includes(x.id)); return p ? p.id : null; }, avant);
}

H.executer(async () => {
  const { context, page } = await H.ouvrir();

  /* ---------------- Base illisible (D1, D13) ---------------- */
  H.section('Base illisible : rien n’est remplacé, « base neuve » après téléchargement');
  await H.demo(page);
  const BRUT = '{"version":12,"users":[{"id":"u-chef","code":"CHEF01","actif":true,"role":"complet"}],"patients":[{"id":"p1","nom":"ORIGINE","notes":['; /* base tronquée */
  await page.evaluate(([k, b]) => localStorage.setItem(k, b), [KEY, BRUT]);
  await page.reload(); await page.waitForSelector('#login-code');
  const refus = await H.connexion(page, 'CHEF01');
  const ecran = await page.evaluate(() => ({ ill: !!window.RYZE.ui.baseIllisible, note: !!document.querySelector('.demo-note'), boutons: document.querySelectorAll('[data-action="viderDemoConfirm"], [data-action="resetDemo"]').length, txt: (document.querySelector('.login') || {}).innerText || '' }));
  t('base illisible : signalée, connexion refusée, note et boutons de démonstration masqués', ecran.ill && !refus && !ecran.note && !ecran.boutons && /n’ont pas pu être chargées/.test(ecran.txt), ecran);
  await page.evaluate(() => { const R = window.RYZE; R.vider(); R.reset(); R.actions.viderDemo(); R.actions.resetDemo(); R.actions.viderDemoConfirm(); });
  const apresVider = await page.evaluate(k => ({ key: localStorage.getItem(k), modal: !!document.querySelector('#modal-root .modal') }), KEY);
  t('base illisible : base vide et réinitialisation refusées (R.vider, R.reset, viderDemo, resetDemo, viderDemoConfirm)', apresVider.key === BRUT && !apresVider.modal, { debut: (apresVider.key || '').slice(0, 30), modal: apresVider.modal });
  await installerFs(page); await activerFs(page);
  const ecrit = await page.evaluate(() => window.RYZE.fs.ecrire());
  t('base illisible : la sauvegarde sur disque n’écrit rien (dernière bonne copie conservée)', ecrit === false && !Object.keys(await fichiers(page)).length, await fichiers(page));
  const inactif = await page.$eval('[data-action="baseNeuve"]', b => b.disabled);
  const dl = await H.telecharger(page, '[data-action="telechargerBak"]');
  await page.waitForSelector('[data-action="baseNeuve"]:not([disabled])');
  t('« Continuer avec une base neuve » : inactif avant le téléchargement, actif après ; fichier = base d’origine', inactif && dl.contenu === BRUT, { inactif, n: dl.contenu.length });
  await page.click('[data-action="baseNeuve"]');
  const conf = await H.modal(page);
  await page.click('#modal-root [data-action="baseNeuveOk"]');
  await page.waitForFunction(() => window.RYZE.ui.baseIllisibleAccepte === true);
  const avantNeuve = Object.entries(await fichiers(page)).find(([k]) => /^ryze-avant-base-neuve-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(k));
  t('base neuve : confirmation, copie de sécurité ryze-avant-base-neuve-AAAA-MM-JJ-HHMM.json (base d’origine) dans le dossier', /copie de sécurité/.test(conf) && !!avantNeuve && avantNeuve[1] === BRUT, { conf: conf.slice(0, 120), fichiers: Object.keys(await fichiers(page)) });
  const okNeuve = await H.connexion(page, 'CHEF01');
  await noter(page, 'NOTE-BASE-NEUVE');
  await page.evaluate(() => window.RYZE.fs.ecrire());
  t('base neuve : connexion possible, ryze-base.json jamais écrit pendant cette session', okNeuve && !('ryze-base.json' in await fichiers(page)), Object.keys(await fichiers(page)));
  await page.evaluate(() => clearTimeout(window.RYZE.fs._t));
  await page.reload(); await page.waitForSelector('.shell');
  const apresRech = await page.evaluate(() => ({ user: window.RYZE.S.user, alerte: window.RYZE.alertes().some(a => a.t === 'Copie de la base d’origine à traiter') }));
  await H.deconnexion(page);
  const encadre = await page.evaluate(() => ({ btn: !!document.querySelector('.login [data-action="telechargerBak"]'), txt: (document.querySelector('.login') || {}).innerText || '' }));
  t('après rechargement : session de l’onglet gardée ; copie .bak signalée (alerte, puis encadré « Télécharger mes données (base d’origine) » à la connexion)', apresRech.user === 'u-chef' && apresRech.alerte && encadre.btn && /base d’origine/.test(encadre.txt), { apresRech, btn: encadre.btn });
  oublierAttendues();

  /* ---------------- .bak identique, base volumineuse (D12) ---------------- */
  H.section('Copie .bak identique supprimée, alerte base volumineuse');
  await H.demo(page);
  await H.connexion(page, 'MED001');
  await noter(page, 'NOTE-BAK');
  await page.evaluate(k => localStorage.setItem(k + '.bak', localStorage.getItem(k)), KEY);
  await page.reload(); await page.waitForSelector('.shell');
  t('copie .bak identique à la base chargée correctement : supprimée au lancement', await page.evaluate(k => localStorage.getItem(k + '.bak') === null && !window.RYZE.ui.bakPresent, KEY));
  const taille = await page.evaluate(() => { const R = window.RYZE, avant = R.ui.tailleBase, lire = n => { R.ui.tailleBase = n; return R.alertes().filter(a => /^Base volumineuse/.test(a.t)).map(a => a.sev + ' ' + a.t); }; const r = { petit: lire(3400000), moyen: lire(3600000), gros: lire(4600000) }; R.ui.tailleBase = avant; return r; });
  t('base volumineuse : aucune alerte sous 3 500 000 caractères, alerte au-delà, critique au-delà de 4 500 000 (« contactez le support »)', !taille.petit.length && /^warn Base volumineuse \(3,4 Mo\) : contactez le support pour passer au stockage étendu$/.test(taille.moyen[0] || '') && /^crit /.test(taille.gros[0] || ''), taille);

  /* ---------------- Copie de sécurité avant une opération destructrice (D2) ---------------- */
  H.section('Copie « ryze-avant-… » avant réinitialisation, base vide, remplacement');
  await installerFs(page); await activerFs(page);
  await noter(page, 'NOTE-AVANT-RESET');
  await page.evaluate(() => clearTimeout(window.RYZE.fs._t));
  const nAvant = await page.evaluate(() => window.RYZE.S.patients.length);
  await H.aller(page, 'parametres');
  await page.click('[data-action="resetDemoConfirm"]');
  const confReset = await H.modal(page);
  await page.click('#modal-root [data-action="resetDemo"]');
  await page.waitForFunction(() => !JSON.stringify(window.RYZE.S.patients).includes('NOTE-AVANT-RESET'));
  const copieReset = Object.entries(await fichiers(page)).find(([k]) => /^ryze-avant-reinitialisation-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(k));
  t('réinitialisation : la confirmation annonce la copie de sécurité et les dossiers remplacés', new RegExp(`La base actuelle \\(${nAvant} dossiers\\) sera remplacée`).test(confReset) && /copie de sécurité/.test(confReset) && /SAUV-TEST/.test(confReset), confReset.slice(0, 220));
  t('réinitialisation : base précédente écrite dans ryze-avant-reinitialisation-AAAA-MM-JJ-HHMM.json avant le remplacement', !!copieReset && copieReset[1].includes('NOTE-AVANT-RESET'), Object.keys(await fichiers(page)));
  await arreterFs(page);
  await noter(page, 'NOTE-AVANT-VIDE');
  await H.aller(page, 'parametres');
  await page.click('main [data-action="viderDemoConfirm"]');
  const confVide = await H.modal(page);
  const dlVide = await H.telecharger(page, '#modal-root [data-action="viderDemo"]');
  t('base vide sans sauvegarde disque : copie de sécurité téléchargée (ryze-avant-base-vide-…), annoncée dans la confirmation', /^ryze-avant-base-vide-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(dlVide.nom) && dlVide.contenu.includes('NOTE-AVANT-VIDE') && /copie de sécurité/.test(confVide) && await page.evaluate(() => window.RYZE.S.patients.length === 0), { nom: dlVide.nom, conf: confVide.slice(0, 160) });
  await page.evaluate(() => window.RYZE.closeModal());
  /* « Remplacer toute la base » : journal (entrée gardée) */
  const fichierImport = await page.evaluate(() => window.RYZE.texteBase());
  await H.demo(page); await H.connexion(page, 'MED001'); await noter(page, 'NOTE-AVANT-IMPORT');
  await H.aller(page, 'parametres');
  await page.click('[data-action="importerBase"]');
  await page.fill('#import-txt', fichierImport);
  await page.check('input[name="import-mode"][value="remplacer"]');
  await page.click('[data-action="importerBaseOk"]');
  await page.waitForSelector('[data-action="importerRemplacerOk"]');
  const confImp = await H.modal(page);
  const dlImp = await H.telecharger(page, '#modal-root [data-action="importerRemplacerOk"]');
  await page.waitForSelector('#login-code');
  const jImp = await page.evaluate(() => window.RYZE.S.journal.find(j => /^Base remplacée par import/.test(j.txt)) || null);
  t('« Remplacer toute la base » : copie de sécurité téléchargée, journalisé (entrée gardée), reconnexion demandée', /copie de sécurité/.test(confImp) && /^ryze-avant-import-remplacement-/.test(dlImp.nom) && dlImp.contenu.includes('NOTE-AVANT-IMPORT') && !!jImp && jImp.g === 1 && /ryze-avant-import-remplacement-/.test(jImp.txt), { nom: dlImp.nom, jImp });

  /* ---------------- Copie disque plus récente, stockage plein (D3) ---------------- */
  H.section('Copie disque plus récente jamais écrasée, indicateur « sauvegarde locale impossible »');
  await H.demo(page); await H.connexion(page, 'MED001'); await noter(page, 'NOTE-LOCALE');
  await installerFs(page); await activerFs(page);
  const DISQUE = await page.evaluate(() => { const m = new Date(Date.now() + 1500).toISOString(); window.__fs.files['ryze-base.json'] = { txt: JSON.stringify({ version: 12, modifieLe: m, patients: [{ id: 'x', nom: 'DISQUE-PLUS-RECENT' }] }), t: 1 }; return window.__fs.files['ryze-base.json'].txt; });
  const e1 = await page.evaluate(() => window.RYZE.fs.ecrire());
  const vu1 = await page.evaluate(() => ({ alerte: window.RYZE.alertes().filter(a => a.sev === 'crit').map(a => a.t), bandeau: (document.getElementById('bandeau') || {}).innerText || '' }));
  t('ryze-base.json plus récent que la base locale : non écrasé, alerte critique et bandeau « importez ryze-base.json »', e1 === false && (await fichiers(page))['ryze-base.json'] === DISQUE && vu1.alerte.includes('Copie disque plus récente que la base locale : importez ryze-base.json') && /importez ryze-base\.json/.test(vu1.bandeau), { e1, vu1 });
  await page.waitForTimeout(1600);
  await noter(page, 'NOTE-LOCALE-2'); await page.evaluate(() => clearTimeout(window.RYZE.fs._t));
  const e2 = await page.evaluate(() => window.RYZE.fs.ecrire());
  t('protection maintenue après une modification locale (base locale devenue « plus récente »), mémorisée pour les lancements suivants (KEY.disque)', e2 === false && (await fichiers(page))['ryze-base.json'] === DISQUE && await page.evaluate(k => !!localStorage.getItem(k + '.disque'), KEY), e2);
  await page.evaluate(() => window.RYZE.fs.lever()); /* ce que fait « Remplacer toute la base » */
  const e3 = await page.evaluate(() => window.RYZE.fs.ecrire());
  const f3 = await fichiers(page), ecr = Object.entries(f3).find(([k]) => /^ryze-avant-ecrasement-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(k));
  t('après un import « Remplacer toute la base » : ryze-base.json protégé copié (ryze-avant-ecrasement-…) puis remplacé', e3 === true && !!ecr && ecr[1] === DISQUE && f3['ryze-base.json'].includes('NOTE-LOCALE-2'), { e3, fichiers: Object.keys(f3) });
  /* P2 : la sauvegarde sur disque reprend la chaîne du dernier enregistrement (pas de second JSON.stringify) */
  const strf = await page.evaluate(async () => { const R = window.RYZE; R.touch(); clearTimeout(R.fs._t); const orig = JSON.stringify; let n = 0; JSON.stringify = function (...a) { const r = orig.apply(this, a); if (r && r.length > 50000) n++; return r; }; try { await R.fs.ecrire(); } finally { JSON.stringify = orig; } return n; });
  t('sauvegarde sur disque : chaîne JSON du dernier enregistrement réutilisée (aucun JSON.stringify de la base)', strf === 0, strf);
  await arreterFs(page);
  await page.evaluate(k => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (c, v) { if (c === k) throw new DOMException('espace plein (essai)', 'QuotaExceededError'); return orig.call(this, c, v); }; const R = window.RYZE, p = R.S.patients[0]; p.notes.unshift({ date: R.today(), heure: '10:00', par: R.S.user, txt: 'NOTE-QUOTA' }); R.touch(); Storage.prototype.setItem = orig; }, KEY);
  const err = await page.evaluate(k => ({ flag: localStorage.getItem(k + '.err'), bandeau: (document.getElementById('bandeau') || {}).innerText || '' }), KEY);
  await page.reload(); await page.waitForSelector('.shell');
  const err2 = await page.evaluate(() => (document.getElementById('bandeau') || {}).innerText || '');
  t('setItem en échec : indicateur KEY.err posé ; au lancement suivant, bandeau « Dernière sauvegarde locale impossible »', err.flag === '1' && /Sauvegarde impossible/.test(err.bandeau) && /Dernière sauvegarde locale impossible/.test(err2), { err, err2: err2.slice(0, 80) });
  oublierAttendues();

  /* ---------------- Import d'éléments invalides (D4) ---------------- */
  H.section('Import : éléments de liste non-objets refusés, null filtrés au chargement');
  const baseOk = await page.evaluate(() => window.RYZE.texteBase());
  const avantImp = await page.evaluate(k => localStorage.getItem(k), KEY);
  const refusImp = [];
  for (const [lib, f] of [['dossier null', s => { s.patients.push(null); }], ['séance null', s => { s.patients[0].cures.push(null); }], ['note en texte', s => { s.patients[0].notes.push('texte'); }], ['code null', s => { s.users.push(null); }]]) {
    const s = JSON.parse(baseOk); f(s);
    await H.aller(page, 'parametres'); await H.viderToasts(page);
    await page.click('[data-action="importerBase"]');
    await page.fill('#import-txt', JSON.stringify(s));
    await page.check('input[name="import-mode"][value="remplacer"]');
    await page.click('[data-action="importerBaseOk"]');
    const msg = await H.toasts(page);
    if (!/refusé : élément invalide/.test(msg) || await page.$('[data-action="importerRemplacerOk"]')) refusImp.push(`${lib} : ${msg}`);
    await page.evaluate(() => window.RYZE.closeModal());
  }
  t('import : dossier, séance, note ou code qui n’est pas un objet → fichier refusé, base intacte', !refusImp.length && await page.evaluate(([k, a]) => localStorage.getItem(k) === a, [KEY, avantImp]), refusImp);
  await page.evaluate(([k, b]) => { const s = JSON.parse(b); s.patients.push(null); s.patients[0].cures.push(null); s.patients[0].notes.push(null); s.rdv = (s.rdv || []).concat([null]); s.dirty = true; localStorage.setItem(k, JSON.stringify(s)); localStorage.removeItem(k + '.m'); }, [KEY, baseOk]);
  await page.reload(); await page.waitForSelector('.shell, #login-code');
  const nul = await page.evaluate(() => { const S = window.RYZE.S; return { ill: window.RYZE.ui.baseIllisible || null, nuls: S.patients.some(p => !p) || S.patients.some(p => p.cures.some(c => !c) || p.notes.some(n => !n)) || S.rdv.some(r => !r) }; });
  t('base enregistrée avec des éléments null : chargée (pas « illisible »), null retirés par la migration', !nul.ill && !nul.nuls, nul);

  /* ---------------- Utilisateur propre à l'onglet (D5) ---------------- */
  H.section('Utilisateur connecté propre à chaque onglet');
  await H.demo(page); await H.connexion(page, 'MED001'); await noter(page, 'NOTE-ONGLETS');
  const B = await context.newPage(); await B.goto(H.APP_URL); await B.waitForSelector('#login-code, .shell');
  const bSeul = await B.evaluate(() => ({ user: window.RYZE.S.user, login: !!document.querySelector('#login-code') }));
  t('nouvel onglet : écran de connexion (l’utilisateur de l’autre onglet n’est pas repris)', bSeul.user === null && bSeul.login, bSeul);
  await H.connexion(B, 'HDJ001');
  await B.evaluate(() => { const R = window.RYZE, p = R.S.patients[0]; p.notes.unshift({ date: R.today(), heure: '11:00', par: R.S.user, txt: 'NOTE-IDE-B' }); R.touch(); });
  await page.waitForFunction(() => JSON.stringify(window.RYZE.S.patients[0].notes).includes('NOTE-IDE-B'));
  const aApres = await page.evaluate(() => window.RYZE.S.user);
  await page.reload(); await page.waitForSelector('.shell');
  const aRech = await page.evaluate(k => ({ user: window.RYZE.S.user, stocke: 'user' in JSON.parse(localStorage.getItem(k)) }), KEY);
  t('onglet A : reste MED001 après l’enregistrement de B (événement storage) et après rechargement ; utilisateur absent de la base', aApres === 'u-med1' && aRech.user === 'u-med1' && !aRech.stocke, { aApres, aRech });
  await B.close();

  /* ---------------- Garde multi-onglets (D6) et clé KEY.m (P2) ---------------- */
  H.section('Garde multi-onglets sans faux succès, clé KEY.m');
  const p2 = await page.evaluate(k => { const R = window.RYZE; R.touch(); const orig = JSON.parse; let n = 0; JSON.parse = function (x, ...a) { if (typeof x === 'string' && x.length > 50000) n++; return orig.call(this, x, ...a); }; try { R.touch(); R.touch(); } finally { JSON.parse = orig; } return { m: localStorage.getItem(k + '.m'), mod: R.S.modifieLe, n }; }, KEY);
  t('KEY.m = modifieLe enregistré ; aucun JSON.parse de toute la base pendant les enregistrements', p2.m === p2.mod && p2.n === 0, p2);
  /* autre onglet simulé : base réécrite sans événement storage pour cet onglet (et sans mettre à jour KEY.m) */
  const autre = (txt, mod) => page.evaluate(([k, x, m]) => { const s = JSON.parse(localStorage.getItem(k)); s.patients[0].notes.unshift({ date: '2026-10-26', heure: '09:00', par: 'u-ide1', txt: x }); s.modifieLe = m || new Date(Date.now() + 1000).toISOString(); localStorage.setItem(k, JSON.stringify(s)); }, [KEY, txt, mod || null]);
  const pid0 = await page.evaluate(() => window.RYZE.S.patients[0].id);
  await H.aller(page, 'patient', { id: pid0, tab: 'notes' });
  await autre('NOTE-AUTRE-ONGLET'); await H.viderToasts(page);
  await page.fill('form[data-form="noteAdd"] textarea[name="txt"]', 'NOTE-REFUSEE');
  await page.click('form[data-form="noteAdd"] button[type=submit]');
  const c1 = await page.evaluate(k => { const s = JSON.parse(localStorage.getItem(k)); const t = JSON.stringify(s.patients[0].notes); return { autre: t.includes('NOTE-AUTRE-ONGLET'), refusee: t.includes('NOTE-REFUSEE') }; }, KEY);
  const c1t = { bons: await toastsBons(page), tous: await H.toasts(page) };
  t('conflit : version de l’autre onglet conservée, action refusée avec message, aucun message de succès', c1.autre && !c1.refusee && !c1t.bons.length && /dernière action n’a pas été enregistrée/.test(c1t.tous), { c1, c1t });
  /* horloge reculée : la base de cet onglet est datée du futur, l'autre onglet enregistre à l'heure corrigée (plus petite) */
  await page.evaluate(() => { const R = window.RYZE; R.S.modifieLe = '2099-06-01T10:00:00.000Z'; R.save(); });
  await page.waitForTimeout(1300); /* fin de la fenêtre sans message de succès du conflit précédent */
  await autre('NOTE-HORLOGE', new Date().toISOString()); await H.viderToasts(page);
  const r2 = await noter(page, 'NOTE-HORLOGE-REFUSEE');
  const c2 = await page.evaluate(k => JSON.stringify(JSON.parse(localStorage.getItem(k)).patients[0].notes), KEY);
  t('horloge reculée : conflit détecté par égalité (pas par « plus récent »), rien d’écrasé en silence', r2 === false && c2.includes('NOTE-HORLOGE') && !c2.includes('NOTE-HORLOGE-REFUSEE'), { r2 });
  /* assistant : saisie et brouillon conservés si la création est refusée */
  await page.waitForTimeout(2600);
  await H.aller(page, 'nouveau');
  await page.fill('#w-nom', 'ESSAI'); await page.fill('#w-prenom', 'Conflit'); await page.fill('#w-ddn', '2012-05-14');
  await page.selectOption('select[data-k="sexe"]', 'M'); await page.fill('#w-poids', '42'); await page.fill('#w-taille', '150');
  await page.click('[data-action="wNext"]'); await page.click('[data-action="wProto"][data-id="ifx-iv"]'); await page.click('[data-action="wNext"]');
  await page.waitForSelector('[data-action="wCreate"]');
  const nPat = await page.evaluate(() => window.RYZE.S.patients.length);
  await autre('NOTE-AVANT-CREATION'); await H.viderToasts(page);
  await page.click('[data-action="wCreate"]');
  const c3 = await page.evaluate(n => { const R = window.RYZE; return { n: R.S.patients.length - n, essai: R.S.patients.some(p => p.prenom === 'Conflit'), w: R.ui.w && R.ui.w.d && R.ui.w.d.prenom, brouillon: ((R.S.brouillons || {})[R.S.user] || { d: {} }).d.prenom, page: R.S.route.page }; }, nPat);
  t('création refusée par la garde : aucun dossier créé, saisie et brouillon de l’assistant conservés, pas de « Dossier créé »', !c3.essai && c3.n <= 0 && c3.w === 'Conflit' && c3.brouillon === 'Conflit' && c3.page === 'nouveau' && !(await toastsBons(page)).length, c3);

  /* ---------------- Rotation mensuelle des copies datées (D7) ---------------- */
  H.section('Rotation des copies datées : la plus ancienne copie de chaque mois est gardée');
  await installerFs(page); await activerFs(page);
  const rot = await page.evaluate(async () => {
    const R = window.RYZE, F = window.__fs.files; const jours = [];
    for (let i = 1; i <= 420; i++) { const d = R.addDays(R.today(), -i); const j = new Date(d + 'T12:00').getDay(); if (j !== 0 && j !== 6) jours.push(d); } /* jours ouvrés seulement : le 1er du mois manque souvent */
    jours.forEach(d => { F[`ryze-sauvegarde-${d}.json`] = { txt: '{}', t: 1 }; }); F['ryze-avant-reinitialisation-2025-01-02-1000.json'] = { txt: '{}', t: 1 }; F['ryze-base-renommee.json'] = { txt: '{}', t: 1 };
    R.fs._purge = null; const ok = await R.fs.ecrire(); const lim = R.addDays(R.today(), -90);
    const reste = Object.keys(F).filter(n => /^ryze-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(n)).map(n => n.slice(16, 26)).sort();
    const mois = [...new Set(jours.filter(d => d < lim).map(d => d.slice(0, 7)))];
    const premiere = m => jours.filter(d => d.slice(0, 7) === m).sort()[0];
    return { ok, recents: jours.filter(d => d >= lim).every(d => reste.includes(d)), moisSansCopie: mois.filter(m => !reste.includes(premiere(m))), enTrop: reste.filter(d => d < lim && d !== premiere(d.slice(0, 7))), autres: !!F['ryze-avant-reinitialisation-2025-01-02-1000.json'] && !!F['ryze-base-renommee.json'] };
  });
  t('rotation : 90 derniers jours gardés, au-delà la plus ancienne copie de chaque mois (même si le 1er manque), copies « ryze-avant » intactes', rot.ok && rot.recents && !rot.moisSansCopie.length && !rot.enTrop.length && rot.autres, rot);
  await arreterFs(page);

  /* ---------------- Erreur disque visible par l'IDE (D8) ---------------- */
  H.section('Sauvegarde sur disque : erreur et réactivation visibles par l’IDE');
  await H.deconnexion(page);
  await installerFs(page);
  await page.evaluate(() => { const R = window.RYZE; window.__fs.perm.q = 'prompt'; window.__fs.perm.r = 'granted'; R.fs.handle = window.__dossier; R.fs.etat = { actif: false, nom: 'SAUV-TEST', dernier: null, erreur: '', plusRecent: '' }; });
  await H.connexion(page, 'HDJ001');
  await page.waitForFunction(() => window.RYZE.fs.etat.actif === true && 'ryze-base.json' in window.__fs.files, null, { timeout: 5000 }).catch(() => {});
  t('connexion de l’IDE : autorisation d’écrire redemandée, sauvegarde sur disque active et écrite', await page.evaluate(() => window.RYZE.fs.etat.actif === true && 'ryze-base.json' in window.__fs.files));
  await page.evaluate(() => { window.__fs.fail = { name: 'NotFoundError', msg: 'A requested file or directory could not be found' }; });
  await page.evaluate(() => window.RYZE.fs.ecrire());
  await H.aller(page, 'dashboard');
  const ideErr = await page.evaluate(() => ({ role: window.RYZE.user().role, alertes: window.RYZE.alertes().filter(a => /Sauvegarde/.test(a.t)).map(a => a.sev + ' ' + a.t), bandeau: (document.getElementById('bandeau') || {}).innerText || '', ecran: document.querySelector('main').innerText.includes('Sauvegarde sur disque impossible') }));
  t('clé USB retirée : alerte critique au tableau de bord de l’IDE et bandeau', ideErr.role === 'hdj' && ideErr.alertes.includes('crit Sauvegarde sur disque impossible') && ideErr.ecran && /Sauvegarde sur disque impossible/.test(ideErr.bandeau), ideErr);
  await page.evaluate(() => { const R = window.RYZE; window.__fs.fail = null; R.fs.etat.erreur = ''; R.fs.etat.actif = false; R.bandeau(); });
  t('dossier à réactiver : alerte visible par l’IDE', await page.evaluate(() => window.RYZE.alertes().some(a => a.t === 'Sauvegarde automatique à réactiver')));
  await arreterFs(page);
  await H.deconnexion(page);

  /* ---------------- Cycle supprimé archivé (D9), cible figée (D10), « Modifier le dossier » (D11) ---------------- */
  H.section('Dossier d’essai : cible figée, cycle supprimé archivé, « Modifier le dossier »');
  await H.demo(page); await H.connexion(page, 'MED001');
  const iv = await creerDossier(page, { nom: 'ESSAI', prenom: 'Securite', ddn: '2012-05-14', sexe: 'M', poids: 42, taille: 150, proto: 'ifx-iv' });
  /* dosage fait : 5,5 µg/mL (cible ≥ 5), puis réglage passé à 6 */
  const iTdm = await page.evaluate(id => window.RYZE.patient(id).surveillance.findIndex(s => s.id === 'tdm' && s.statut === 'prevue'), iv);
  await H.aller(page, 'patient', { id: iv, tab: 'plan' });
  await page.click(`[data-action="survSaisir"][data-i="${iTdm}"]`);
  await page.fill('#modal-root [name="tdm_taux"]', '5.5'); await page.selectOption('#modal-root [name="tdm_ac"]', 'neg');
  await H.validerModal(page);
  const lire = () => page.evaluate(([id, i]) => { const R = window.RYZE, p = R.patient(id), s = p.surveillance[i], pr = p.surveillance.find(x => x.id === 'tdm' && x.statut === 'prevue'); return { fig: s.cibleFigee, cible: R.cibleControle(p, s), constat: R.interpTdm(s.tdm, R.ctxTdm(s, p)).constat, doc: R.lectureTdm(p, s).constat, prevue: pr ? R.cibleControle(p, pr) : '' }; }, [iv, iTdm]);
  const avantCible = await lire();
  await H.aller(page, 'parametres');
  await page.fill('form[data-form="tdmCiblesSave"] [name="tdm_infliximab_entretien"]', '6');
  await page.click('form[data-form="tdmCiblesSave"] button[type=submit]');
  const apresCible = await lire();
  t('dosage fait : cible figée à « Marquer fait » (≥ 5) ; constat écran et document inchangés après le réglage à 6', !!avantCible.fig && avantCible.fig.min === 5 && apresCible.cible === 'infliximab ≥ 5 µg/mL' && apresCible.constat === avantCible.constat && /dans la cible \(≥ 5\)/.test(apresCible.doc), { avantCible, apresCible });
  t('dosages prévus : cible mise à jour par le réglage (≥ 6)', /infliximab ≥ 6 µg\/mL/.test(apresCible.prevue), apresCible.prevue);
  /* migration : dosage déjà fait sans cible figée → figée une fois au chargement */
  await page.evaluate(([k, id, i]) => { const R = window.RYZE; delete R.patient(id).surveillance[i].cibleFigee; R.touch(); }, [KEY, iv, iTdm]);
  await page.reload(); await page.waitForSelector('.shell');
  t('migration : dosage fait sans cible figée → cible actuelle figée au chargement (idempotent)', await page.evaluate(([id, i]) => { const s = window.RYZE.patient(id).surveillance[i]; return !!s.cibleFigee && s.cibleFigee.min === 6; }, [iv, iTdm]));
  /* séance du cycle 1 réalisée, changement de protocole, séance du cycle 2 réalisée, suppression du cycle 2 */
  await H.aller(page, 'patient', { id: iv });
  await page.click('.page-actions [data-action="cureEnregistrer"]'); await page.fill('#modal-root [name="lot"]', 'LOT-C1'); await H.validerModal(page);
  await H.aller(page, 'patient', { id: iv, tab: 'plan' });
  await page.click('[data-action="protoChanger"]'); await page.waitForSelector('[data-action="chgValider"]');
  await page.selectOption('select[data-k="cause"]', { index: 1 }); await page.fill('input[data-k="motif"]', 'essai de suppression'); await page.click('[data-action="wProto"][data-id="vdz-iv"]'); await page.click('[data-action="chgValider"]');
  await H.aller(page, 'patient', { id: iv });
  await page.click('.page-actions [data-action="cureEnregistrer"]'); await page.fill('#modal-root [name="poids"]', '43'); await page.fill('#modal-root [name="lot"]', 'LOT-C2'); await H.validerModal(page);
  await H.aller(page, 'patient', { id: iv, tab: 'traitement' });
  await page.click('[data-action="cycleSupprimer"][data-cycle="2"]');
  const confCycle = await H.modal(page);
  await page.click('#modal-root [data-action="cycleSupprimerOk"]');
  const arch = await page.evaluate(id => { const R = window.RYZE, p = R.patient(id); return { cs: p.cyclesSupprimes, j: R.S.journal.find(j => /^Cycle 2 supprimé/.test(j.txt)) || null, reste: p.cures.some(c => c.lot === 'LOT-C2') }; }, iv);
  const a0 = ((arch.cs || [])[0] || {}), s0 = (a0.seances || [])[0] || {};
  t('suppression d’un cycle : la confirmation annonce les séances réalisées archivées', /1 séance réalisée sera archivée/.test(confCycle) && /LOT|du \d{2}\/\d{2}\/\d{4}/.test(confCycle), confCycle.slice(0, 300));
  t('cycle supprimé : séance réalisée archivée dans p.cyclesSupprimes (date, dose, poids, lot, IDE)', !arch.reste && a0.cycle === 2 && a0.protocoleId === 'vdz-iv' && a0.par === 'u-med1' && s0.lot === 'LOT-C2' && s0.poids === 43 && /^\d{4}-\d{2}-\d{2}$/.test(s0.dateReelle) && s0.dose > 0 && s0.ide === 'u-med1', arch.cs);
  t('cycle supprimé : journal gardé avec le nombre et le détail des séances réalisées', !!arch.j && arch.j.g === 1 && /1 séance réalisée archivée/.test(arch.j.txt) && /LOT-C2/.test(arch.j.txt), arch.j);
  await page.evaluate(id => window.RYZE.actions.cycleSupprimer({ dataset: { pid: id, cycle: '1' } }), iv);
  t('seul cycle : plus d’invitation à « supprimer le dossier lui-même »', !/dossier lui-même/.test(await H.modal(page)) && /Arrêter le traitement/.test(await H.modal(page)));
  await page.evaluate(() => window.RYZE.closeModal());
  /* « Modifier le dossier » */
  const autreIpp = await page.evaluate(id => window.RYZE.S.patients.find(p => p.id !== id && p.ipp).ipp, iv);
  const snap = () => page.evaluate(id => JSON.stringify(window.RYZE.patient(id)), iv);
  const modifier = async (champs) => { await H.aller(page, 'patient', { id: iv }); await H.viderToasts(page); await page.click('.page-actions [data-action="patientModifier"]'); for (const [k, v] of Object.entries(champs)) await page.fill(`#modal-root [name="${k}"]`, v); await H.validerModal(page); return H.toasts(page); };
  const s1 = await snap(); const m1 = await modifier({ nom: '' }); const s2 = await snap(); await page.evaluate(() => window.RYZE.closeModal());
  const m2 = await modifier({ ipp: autreIpp }); const s3 = await snap(); await page.evaluate(() => window.RYZE.closeModal());
  t('« Modifier le dossier » : nom vide et n° de dossier d’un autre patient refusés, dossier inchangé', /Nom et prénom obligatoires/.test(m1) && /déjà celui de/.test(m2) && s1 === s2 && s2 === s3, { m1, m2 });
  await modifier({ poids: '44', allergies: 'Pénicilline (essai)' });
  const jMod = await page.evaluate(() => (window.RYZE.S.journal[0] || {}).txt || '');
  t('« Modifier le dossier » : chaque champ changé journalisé (avant → après)', /^Dossier modifié — ESSAI Securite : /.test(jMod) && /poids : 43 kg → 44 kg/.test(jMod) && /allergies : — → Pénicilline \(essai\)/.test(jMod) && !/Paris|antécédent|spécialité/.test(jMod), jMod);
});
