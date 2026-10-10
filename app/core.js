/* =====================================================================
   Ryze — core.js : état, accès, capacité HDJ, calendrier, coquille,
   tableau de bord
   ===================================================================== */
'use strict';
(function (R) {
  const KEY = 'ryze-hdj-v1', VERSION = 12;
  const S = {};
  R.S = S; R.ui = { filtres: {}, cal: {}, plies: {} };
  let uiInit = {}; try { uiInit = JSON.parse(localStorage.getItem('ryze-hdj-ui') || '{}') || {}; } catch (e) {} R.ui.plies = uiInit.plies || {};
  R.pages = {}; R.actions = R.actions || {};

  /* ---------- Migration des données locales ---------- */
  function migrer(s) {
    (s.patients || []).forEach(p => { p.notes = p.notes || []; p.surveillance = p.surveillance || []; p.bilan = p.bilan || []; p.cures = p.cures || []; }); s.settings = s.settings || {};
    /* capacité de l'HDJ complétée à chaque chargement et à chaque import (idempotent) : une base sans settings.hdj bloquait le rendu de toutes les pages, Paramètres compris */
    { const h = s.settings.hdj && typeof s.settings.hdj === 'object' ? s.settings.hdj : {}; s.settings.hdj = Object.assign({ jours: [1, 2, 3, 4, 5], ouverture: '08:00', fermeture: '16:00', fauteuils: s.settings.fauteuils || 6, maxParJour: 12, pas: 30 }, h); if (!Array.isArray(s.settings.hdj.jours)) s.settings.hdj.jours = [1, 2, 3, 4, 5]; }
    const seedUsers = [['u-chef', 'CHEF01', true], ['u-med1', 'MED001', true], ['u-med2', 'MED002', true], ['u-pha1', 'PUI001', false], ['u-int', 'PUI002', false], ['u-ide1', 'HDJ001', false], ['u-ide2', 'HDJ002', false], ['u-sec', 'HDJ003', false]].map(x => ({ id: x[0], code: x[1], medecin: x[2] })); /* codes du jeu de démonstration, sans régénérer toute la démo */
    if (s.version === 1) {
      const map = { medecin: 'complet', pharmacien: 'complet', admin: 'complet', ide: 'hdj', secretaire: 'hdj' };
      (s.users || []).forEach(u => { if (!R.ROLES[u.role]) { u.medecin = u.role === 'medecin'; u.role = map[u.role] || 'hdj'; } });
      s.version = 2;
    }
    (s.users || []).forEach(u => { if (!R.ROLES[u.role]) u.role = 'hdj'; const ref = seedUsers.find(x => x.id === u.id); if (!u.code) u.code = ref ? ref.code : 'HDJ' + Math.floor(100 + Math.random() * 900); if (u.medecin === undefined) u.medecin = ref ? ref.medecin : false; });
    if (s.version === 2) {
      s.settings = s.settings || {}; s.settings.hdj = s.settings.hdj || { jours: [1, 2, 3, 4, 5], ouverture: '08:00', fermeture: '16:00', fauteuils: s.settings.fauteuils || 6, maxParJour: 12, pas: 30 };
      (s.patients || []).forEach(p => { p.cures.forEach(c => { c.cycle = c.cycle || 1; c.protocoleId = c.protocoleId || p.protocoleId; }); p.cycleCourant = p.cycleCourant || 1; p.carnetMixte = !!p.carnetMixte; p.historiqueProtocoles = p.historiqueProtocoles || [{ cycle: 1, protocoleId: p.protocoleId, dateDebut: p.dateDebut, poids: p.poids, statut: 'en cours', modifications: [], planifieJusqua: p.cures.length ? p.cures[p.cures.length - 1].label : '—' }]; });
      s.version = 3;
    }
    if (s.version === 3) { s.version = 4; }
    if (s.version === 4) { try { R.purgerAncienCatalogue(s); } catch (e) { console.error('Purge des anciens contrôles', e); } s.version = 5; }
    if (s.version === 5) { (s.patients || []).forEach(p => { if (!p.paris) p.paris = R.parisDepuisTexte(p.montreal || '', p.pathologie, p.ddn, p.dateDiag, true); delete p.montreal; }); s.version = 6; }
    if (s.version === 6) { delete s.stock; delete s.mouvements; (s.patients || []).forEach(p => { try { R.alignerTdm(p); } catch (e) {} }); s.version = 7; }
    if (s.version === 7) { (s.patients || []).forEach(p => { if (!p.poidsInitial) p.poidsInitial = R.poidsInitial(p); }); s.version = 8; }
    if (s.version === 8) { /* coloscopie et fibroscopie haute deviennent deux contrôles distincts */ (s.patients || []).forEach(p => { (p.surveillance || []).forEach(x => { if (x.id === 'colo' && x.statut !== 'faite' && /fibroscopie/i.test(x.label || '')) x.label = 'Coloscopie'; }); if (p.planSurveillance && p.planSurveillance.items && !p.planSurveillance.items.fogd) p.planSurveillance.items.fogd = { on: false, periode: null }; }); s.version = 9; }
    if (s.version === 9) { /* base réelle : seuls les codes créés par le service restent ; les codes de démonstration sont retirés dès qu'un accès complet propre (BEN SABBAHIA) existe */
      const propres = (s.users || []).filter(u => !R.SEED_USER_IDS.includes(u.id)); const ref = propres.find(u => /SABBAHIA/i.test((u.nom || '') + ' ' + (u.prenom || '')));
      if (ref) { ref.actif = true; ref.role = 'complet'; s.users = propres; } s.version = 10; }
    if (s.version === 10) { /* section vaccinale du bilan pré-biothérapie : un seul examen « vacciné selon le PNI » */
      const purge = b => Array.isArray(b) ? b.filter(x => x.id !== 'vacc' && x.id !== 'fcu') : b; (s.patients || []).forEach(p => { p.bilan = purge(p.bilan || []); }); Object.values(s.brouillons || {}).forEach(w => { if (w && Array.isArray(w.bilan)) w.bilan = purge(w.bilan); }); s.version = 11; }
    if (s.version === 11) { /* coloscopie et histologie deviennent deux examens de référence distincts */
      const sep = b => { if (!Array.isArray(b)) return b; b.forEach(x => { if (x.id === 'colohisto') x.id = 'colo0'; }); return b; }; (s.patients || []).forEach(p => { p.bilan = sep(p.bilan || []); }); Object.values(s.brouillons || {}).forEach(w => { if (w && Array.isArray(w.bilan)) sep(w.bilan); }); s.version = 12; }
    if (s.brouillon) { s.brouillons = s.brouillons || {}; if (s.user && s.brouillon.d) s.brouillons[s.user] = s.brouillon; delete s.brouillon; }
    if (!s.rdv) s.rdv = []; if (!s.journal) s.journal = []; (s.patients || []).forEach(p => { p.notes = p.notes || []; p.surveillance = p.surveillance || []; p.bilan = R.completerBilan(p.bilan || []); p.cures = p.cures || []; });
    Object.values(s.brouillons || {}).forEach(w => { if (w && Array.isArray(w.bilan)) R.completerBilan(w.bilan); });
    if (s.user && !(s.users || []).some(u => u.id === s.user)) s.user = null;
    /* correction idempotente, sans changement de version : un protocole dont toutes les voies sont sous-cutanées ne peut pas être dosé en mg/kg (l'assistant refuse ensuite tout dossier) — remis en « mg fixe », les valeurs de dose sont conservées */
    (s.protocoles || []).forEach(pr => { const voies = (pr.induction || []).map(e => e.voie).concat(pr.entretien ? [pr.entretien.voie] : []); if (pr.doseType === 'mgkg' && voies.length && voies.every(v => v && v !== 'IV')) pr.doseType = 'mg'; });
    /* idem : cibles de l'adalimumab alignées sur R.TDM_CIBLES (7,5–12 µg/mL) dans la fiche protocole et les contrôles déjà générés ; seule la chaîne d'origine exacte est remplacée (fiche modifiée par le service intacte) */
    (s.protocoles || []).forEach(pr => { if (pr.id === 'ada' && typeof pr.optimisation === 'string') pr.optimisation = pr.optimisation.replace('(taux résiduel cible 8–12 µg/mL)', '(taux résiduel cible 7,5–12 µg/mL)'); });
    (s.patients || []).forEach(p => (p.surveillance || []).forEach(x => { if (x.id === 'tdm' && typeof x.cible === 'string') x.cible = x.cible.replace('adalimumab ≥ 7,5 µg/mL', 'adalimumab 7,5–12 µg/mL'); }));
    return s;
  }
  function charger() {
    let raw = null; try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    /* une base présente mais illisible n'est jamais écrasée sans copie : elle est mise de côté et signalée à la connexion */
    const illisible = raison => { let copie = false; try { localStorage.setItem(KEY + '.bak', raw); copie = localStorage.getItem(KEY + '.bak') === raw; } catch (e) {} R.ui.baseIllisible = raison; R.ui.rawIllisible = raw; R.ui.copieOk = copie; console.error('Base locale non chargée :', raison); return null; };
    let s; try { s = JSON.parse(raw); } catch (e) { return illisible('contenu illisible'); }
    if (!s || !s.users || !s.patients) return illisible('structure inattendue');
    if (+s.version > VERSION) return illisible(`base enregistrée par une version plus récente de l’application (version ${s.version}, celle-ci lit jusqu’à la version ${VERSION})`);
    if (!s.dirty && s.semaineSeed !== R.semaineRef()) return null;
    try { return migrer(s); } catch (e) { return illisible('erreur pendant la mise à niveau des données : ' + (e && e.message)); }
  }
  function remplacer(obj) { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, obj); if (R.ui) R.ui.tailleBase = 0; }
  remplacer(charger() || Object.assign(R.seed(), { semaineSeed: R.semaineRef(), version: VERSION }));
  S.version = VERSION; if (uiInit.route && uiInit.route.page) S.route = uiInit.route;
  /* si un autre onglet a enregistré une version plus récente, on l'adopte au lieu de l'écraser */
  const plusRecenteAilleurs = (ref = S.modifieLe) => { if (!ref) return null; let raw = null; try { raw = localStorage.getItem(KEY); } catch (e) { return null; } if (!raw) return null; /* seul le modifieLe de premier niveau compte (une note modifiée porte aussi un modifieLe, date seule, sérialisé avant) ; ref = valeur d'avant R.touch, qui vient de la remplacer par « maintenant » */ let m = null; try { m = JSON.parse(raw).modifieLe; } catch (e) { return null; } return typeof m === 'string' && m > ref ? raw : null; };
  R.save = base => { if (R.ui.baseIllisible && !R.ui.baseIllisibleAccepte) return; /* la base d'origine n'est jamais écrasée avant un choix explicite */ const autre = plusRecenteAilleurs(typeof base === 'string' ? base : undefined); if (autre) { try { const s = JSON.parse(autre); const route = S.route, user = S.user; remplacer(migrer(s)); S.route = route; S.user = user && S.users.some(x => x.id === user && x.actif) ? user : null; R.closeModal(); R.toast('Données mises à jour depuis un autre onglet : votre dernière action n’a pas été enregistrée, vérifiez et recommencez', 'warn'); R.render(); return false; /* l'action appelante peut s'arrêter : if (R.touch() === false) return; */ } catch (e) {} }
    try { S.enregistreLe = new Date().toISOString(); const txt = JSON.stringify(S); if (R.ui) R.ui.tailleBase = txt.length; localStorage.setItem(KEY, txt); if (R.ui.saveError) { R.ui.saveError = false; R.bandeau(); } } catch (e) { R.ui.saveError = true; R.bandeau(); console.error('Sauvegarde impossible', e); } R.fs.planifier(); /* même si localStorage est plein : le fichier sur disque reste alors le seul filet */ };
  R.touch = () => { const base = S.modifieLe; S.dirty = true; S.modifieLe = new Date().toISOString(); return R.save(base); };
  /* ---------- Sauvegarde automatique sur le disque (API File System Access : Chrome / Edge, poste de travail) ----------
     Le dossier choisi est mémorisé (IndexedDB) ; à chaque enregistrement, la base est réécrite dans ryze-base.json et dans une copie datée du jour. */
  R.fs = {
    dispo: () => typeof window.showDirectoryPicker === 'function',
    handle: null, pret: false, etat: { actif: false, nom: '', dernier: null, erreur: '' },
    db: () => new Promise((res, rej) => { try { const q = indexedDB.open('ryze-fs', 1); q.onupgradeneeded = () => q.result.createObjectStore('h'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); } catch (e) { rej(e); } }),
    get: async () => { try { const db = await R.fs.db(); return await new Promise((res, rej) => { const t = db.transaction('h', 'readonly').objectStore('h').get('dossier'); t.onsuccess = () => res(t.result || null); t.onerror = () => rej(t.error); }); } catch (e) { return null; } },
    set: async h => { try { const db = await R.fs.db(); await new Promise((res, rej) => { const t = db.transaction('h', 'readwrite'); if (h) t.objectStore('h').put(h, 'dossier'); else t.objectStore('h').delete('dossier'); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} },
    async demarrer() { R.fs.handle = await R.fs.get(); R.fs.pret = true; if (R.fs.handle) { R.fs.etat.nom = R.fs.handle.name || ''; try { R.fs.etat.actif = (await R.fs.handle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { R.fs.etat.actif = false; } } },
    async choisir() { const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'ryze-sauvegardes' }); await R.fs.set(h); R.fs.handle = h; R.fs.etat = { actif: true, nom: h.name || '', dernier: null, erreur: '' }; return R.fs.ecrire(); },
    /* au lancement, l'autorisation d'écrire doit être redemandée (une confirmation du navigateur) : appelé depuis un clic de l'utilisateur */
    async reprendre(demander) { const h = R.fs.handle || await R.fs.get(); if (!h) return false; R.fs.handle = h; R.fs.etat.nom = h.name || ''; let perm = 'prompt'; try { perm = await h.queryPermission({ mode: 'readwrite' }); if (perm !== 'granted' && demander) perm = await h.requestPermission({ mode: 'readwrite' }); } catch (e) { perm = 'denied'; } R.fs.etat.actif = perm === 'granted'; return R.fs.etat.actif; },
    async ecrire() { const h = R.fs.handle; if (!h || !R.fs.etat.actif) return false; try { const txt = JSON.stringify(S); for (const nom of ['ryze-base.json', `ryze-sauvegarde-${R.today()}.json`]) { const f = await h.getFileHandle(nom, { create: true }); const w = await f.createWritable(); await w.write(txt); await w.close(); } /* rotation des copies datées : rien n'est supprimé sous 90 copies ; au-delà, on garde les 90 derniers jours et le 1er de chaque mois ; jamais si une copie plus récente qu'aujourd'hui existe (horloge douteuse) ; ryze-base.json et les fichiers renommés ne sont jamais touchés */ if (R.fs._purge !== R.today()) { R.fs._purge = R.today(); try { const re = /^ryze-sauvegarde-(\d{4}-\d{2}-\d{2})\.json$/, dates = []; for await (const nom of h.keys()) { const m = re.exec(nom); if (m) dates.push(m[1]); } dates.sort(); const recente = dates[dates.length - 1]; if (recente === R.today() && dates.length > 90) { const lim = R.addDays(R.today(), -90); for (const d of dates) if (d < lim && !d.endsWith('-01')) await h.removeEntry(`ryze-sauvegarde-${d}.json`); } } catch (e) {} } R.fs.etat.dernier = new Date().toISOString(); R.fs.etat.erreur = ''; S.derniereSauvegarde = R.today(); return true; } catch (e) { R.fs.etat.erreur = (e && e.message) || 'écriture impossible'; if (e && e.name === 'NotAllowedError') R.fs.etat.actif = false; return false; } },
    planifier() { if (!R.fs.etat.actif) return; clearTimeout(R.fs._t); R.fs._t = setTimeout(() => R.fs.ecrire(), 4000); },
    async arreter() { clearTimeout(R.fs._t); await R.fs.set(null); R.fs.handle = null; R.fs.etat = { actif: false, nom: '', dernier: null, erreur: '' }; }
  };
  R.fs.demarrer().then(() => { /* l'état du dossier n'est connu qu'après la lecture IndexedDB : rendu relancé pour afficher l'alerte « à réactiver » (jamais sur l'écran de connexion ni sur une fenêtre ouverte) */ if (R.fs.handle && !R.fs.etat.actif && S.user && !document.querySelector('#modal-root .modal')) R.render(); }).catch(() => {});
  R.bandeau = () => { let b = document.getElementById('bandeau'); if (!R.ui.saveError) { if (b) b.remove(); return; } if (!b) { b = document.createElement('div'); b.id = 'bandeau'; b.className = 'bandeau'; document.body.appendChild(b); } b.innerHTML = '<b>Sauvegarde impossible dans ce navigateur</b> (espace plein ou stockage bloqué). Vos dernières modifications ne sont pas conservées : exportez la base depuis Paramètres avant de fermer la page.'; };
  window.addEventListener('storage', e => { if (e.key !== KEY || !e.newValue) return; try { const s = JSON.parse(e.newValue); if (s.modifieLe && s.modifieLe !== S.modifieLe) { const route = S.route, user = S.user; const fenetre = !!document.querySelector('#modal-root form'); remplacer(migrer(s)); S.route = route; S.user = user && S.users.some(x => x.id === user && x.actif) ? user : null; R.closeModal(); R.render(); R.toast(fenetre ? 'Données mises à jour depuis un autre onglet : la fenêtre ouverte a été fermée, rouvrez-la' : 'Données mises à jour depuis un autre onglet', 'warn'); } else if (s.modifieLe === S.modifieLe) { /* brouillon d'assistant enregistré ailleurs (sans changer modifieLe) : repris, le mien en cours reste prioritaire */ const mien = R.ui.w && S.user && S.brouillons ? S.brouillons[S.user] : null; S.brouillons = Object.assign({}, s.brouillons || {}); if (mien && mien === R.ui.w) S.brouillons[S.user] = mien; } } catch (x) {} });
  R.reset = () => { try { localStorage.removeItem(KEY); } catch (e) {} const u = S.user; remplacer(Object.assign(R.seed(), { semaineSeed: R.semaineRef(), version: VERSION, user: u, modifieLe: new Date().toISOString() })); R.save(); R.go('dashboard'); R.toast('Données de démonstration réinitialisées', 'good'); };
  R.vider = () => { try { localStorage.removeItem(KEY); } catch (e) {} const u = S.user; const base = R.seedVide(); const garde = { users: JSON.parse(JSON.stringify(S.users || [])), protocoles: S.protocoles, settings: S.settings }; /* codes d'accès, protocoles et paramètres de la base en cours conservés, comme l'annonce la confirmation (seedVide repart des codes et protocoles de démonstration) */
    /* sauf les codes de démonstration encore actifs (connus de tous) : désactivés ; si l'utilisateur connecté en utilise un, ou s'il ne reste aucun accès complet propre, un nouveau code d'accès complet est tiré et affiché */
    const demo = {}; base.users.forEach(x => { demo[x.id] = x.code; }); const estDemo = x => !!demo[x.id] && x.code === demo[x.id]; let neuf = null;
    if (garde.users.some(x => x.actif && estDemo(x))) { const moi = garde.users.find(x => x.id === u && x.actif && x.role === 'complet'); const cle = moi || (garde.users.some(x => x.actif && x.role === 'complet' && !estDemo(x)) ? null : garde.users.find(x => x.id === 'u-chef') || garde.users.find(x => x.role === 'complet'));
      garde.users.forEach(x => { if (x !== cle && x.actif && estDemo(x)) x.actif = false; });
      if (cle && estDemo(cle)) { const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', rnd = t => t[Math.floor(Math.random() * t.length)]; let c; do { c = rnd(L) + rnd(L) + rnd(L) + rnd(D) + rnd(D) + rnd(D); } while (garde.users.some(x => x.code === c)); cle.code = c; cle.actif = true; neuf = cle; } }
    const enLigne = garde.users.some(x => x.id === u && x.actif);
    remplacer(Object.assign(base, garde, { semaineSeed: R.semaineRef(), version: VERSION, user: enLigne ? u : null, codeNeuf: neuf && !enLigne ? neuf.code : undefined, modifieLe: new Date().toISOString() })); /* personne connecté : le nouveau code reste affiché sur l’écran de connexion jusqu’à la première connexion avec ce code */ R.save(); R.go('dashboard');
    if (neuf) { if (neuf) R.modal({ title: 'Base vide : nouveau code d’accès complet', body: `<p style="margin:0">Les codes de démonstration sont désactivés. Le code d’accès complet de ${R.esc(R.userName(neuf.id))} est désormais :</p><div class="center mono" style="font-size:32px;letter-spacing:.2em;padding:12px">${R.esc(neuf.code)}</div><p class="small muted" style="margin:0">Notez-le. Créez ensuite les codes de l’équipe dans Équipe & codes.</p>`, foot: '<button type="button" class="btn primary" data-action="closeModal">J’ai noté le code</button>' }); R.ui.modalSale = true; /* Échap ou clic à côté demandent un second geste : le code n’est montré qu’ici et sur l’écran de connexion */ }
    else R.toast(garde.users.some(x => !x.actif && estDemo(x)) ? 'Base vide : codes de démonstration désactivés ; ajoutez vos patients et rendez-vous' : 'Base vide : ajoutez vos patients et rendez-vous', 'good'); };
  R.journal = (txt, garder) => { S.journal = S.journal || []; const e = { date: R.today(), heure: new Date().toTimeString().slice(0, 5), par: S.user, txt }; if (garder) e.g = 1; /* entrée gardée (suppression) : échappe à la limite des 200 dernières */ S.journal.unshift(e); S.journal = S.journal.filter((j, i) => i < 200 || j.g); };

  /* ---------- Helpers ---------- */
  const ageOrig = R.age; R.age = ddn => { if (!ddn || isNaN(R.parse(ddn))) return '—'; return ageOrig(ddn); };
  const fmtOrig = R.fmtDate, fmtLongOrig = R.fmtDateLong, fmtMemo = new Map(); /* résultats mémorisés : toLocaleDateString recrée un formateur Intl à chaque appel (des centaines par rendu) */ R.fmtDate = (s, o) => { if (!s) return '—'; const k = o ? s + '|' + JSON.stringify(o) : s; let v = fmtMemo.get(k); if (v === undefined) { v = isNaN(R.parse(s)) ? '—' : fmtOrig(s, o); fmtMemo.set(k, v); } return v; }; R.fmtDateLong = s => { if (!s) return '—'; const k = 'L|' + s; let v = fmtMemo.get(k); if (v === undefined) { v = isNaN(R.parse(s)) ? '—' : fmtLongOrig(s); fmtMemo.set(k, v); } return v; };
  R.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  R.user = () => S.users.find(u => u.id === S.user);
  R.userById = id => S.users.find(u => u.id === id);
  R.userName = id => { const u = R.userById(id) || (id && (S.usersSupprimes || []).find(x => x.id === id)); /* code supprimé : le nom reste affiché sur ses séances, notes et entrées du journal */ return u ? `${u.titre ? u.titre + ' ' : ''}${u.prenom ? u.prenom[0] + '. ' : ''}${u.nom || '—'}` : '—'; };
  R.initials = (p, n) => R.esc((((p || '')[0] || '') + ((n || '')[0] || '')).toUpperCase()); /* insérées dans du HTML */
  R.can = (mod, lvl) => { const u = R.user(); if (!u) return false; const p = (R.PERMS[u.role] || {})[mod] || '-'; if (lvl === 'w') return p === 'rw'; return p !== '-'; };
  R.patient = id => S.patients.find(p => p.id === id);
  R.proto = id => S.protocoles.find(p => p.id === id);
  R.imc = p => { const w = (R.dernierPoids(p) || {}).poids || p.poids; return w && p.taille ? (w / Math.pow(p.taille / 100, 2)).toFixed(1) : '—'; };
  /* date par défaut d'un examen du bilan marqué fait : la date de saisie du dossier */
  R.dateBilanDefaut = p => (p && p.creeLe && p.creeLe <= R.today()) ? p.creeLe : R.today();
  /* poids initial et dernier poids mesuré en séance, côte à côte */
  R.poidsHTML = p => { const i = R.poidsInitial(p), d = R.dernierPoids(p), f = v => String(+v).replace('.', ','); if (!d && !i && !(+p.poids > 0)) return '— kg'; if (!d || !i) return `${f(d ? d.poids : (i || p.poids))} kg`; const ec = Math.round((d.poids - i) * 10) / 10; return `<span title="Poids à l’inclusion">initial ${f(i)} kg</span> · <span title="Dernier poids mesuré en séance"><b>dernier ${f(d.poids)} kg</b> <span class="muted">(${R.fmtDate(d.date)}${ec ? `, ${ec > 0 ? '+' : ''}${f(ec)} kg` : ''})</span></span>`; };
  R.uid = (pfx) => pfx + Math.random().toString(36).slice(2, 8);
  R.nomComplet = p => `${p.nom || '—'} ${p.prenom || '—'}`;
  R.ageTxt = ddn => { const a = R.age(ddn); return a === '—' ? '—' : a + ' ans'; };
  R.params = obj => R.esc(JSON.stringify(obj || {}));
  R.prochaineCure = p => p.cures.find(c => c.statut === 'reportee' || c.statut === 'manquee') || p.cures.find(c => c.statut === 'prevue') || null;
  R.derniereCure = p => [...p.cures].reverse().find(c => c.statut === 'realisee') || null;
  R.badge = (cls, txt) => `<span class="badge ${cls}"><i class="dot"></i>${R.esc(txt)}</span>`;
  R.statutPatientBadge = p => p.statut === 'suspendu' ? R.badge('crit', 'Suspendu') : p.statut === 'induction' ? R.badge('info', 'Induction') : p.statut === 'termine' ? R.badge('', 'Terminé') : R.badge('good', 'Entretien');
  R.statutCureBadge = c => { const t = R.today(); if (c.statut === 'realisee') return R.badge('good', 'Réalisée'); if (c.statut === 'manquee') return R.badge('crit', 'Manquée'); if (c.statut === 'reportee') return R.badge('warn', 'Reportée'); if (c.statut === 'annulee') return R.badge('', 'Annulée'); if (c.datePrevue < t) return R.badge('crit', 'En retard'); if (c.datePrevue === t) return R.badge('accent', 'Aujourd’hui'); return R.badge('', 'Prévue'); };
  R.statutSurvBadge = s => { const t = R.today(); if (s.statut === 'faite') return R.badge('good', 'Fait'); if (s.statut === 'annulee') return R.badge('', 'Annulé'); if (s.echeance < t) return R.badge('crit', `En retard (${R.diffDays(s.echeance, t)} j)`); if (s.echeance === t) return R.badge('accent', 'Aujourd’hui'); if (R.diffDays(t, s.echeance) <= 14) return R.badge('warn', `Dans ${R.diffDays(t, s.echeance)} j`); return R.badge('', 'Prévu'); };
  R.pathoBadge = p => `<span class="badge ${p.pathologie === 'MC' ? 'info' : 'accent'}">${R.esc(R.PATHOS[p.pathologie]?.court || p.pathologie)}</span>`;
  R.protoDeCure = (p, c) => R.proto(c.protocoleId || p.protocoleId);

  /* ---------- Semaine, cures, contrôles, rendez-vous ---------- */
  R.semaine = (lundi) => { lundi = lundi || R.semaineRef(); return { lundi, dimanche: R.addDays(lundi, 6), jours: [0, 1, 2, 3, 4, 5, 6].map(i => R.addDays(lundi, i)) }; };
  R.curesEntre = (a, b) => S.patients.flatMap(p => p.cures.filter(c => c.datePrevue >= a && c.datePrevue <= b && c.statut !== 'annulee').map(c => ({ cure: c, patient: p }))).sort((x, y) => (x.cure.datePrevue + (x.cure.heure || '99')).localeCompare(y.cure.datePrevue + (y.cure.heure || '99')));
  R.controlesEntre = (a, b) => S.patients.flatMap(p => p.surveillance.filter(s => s.mode === 'echeance' && s.statut !== 'annulee' && s.echeance >= a && s.echeance <= b).map(s => ({ surv: s, patient: p }))).sort((x, y) => x.surv.echeance.localeCompare(y.surv.echeance));
  R.rdvEntre = (a, b) => S.rdv.filter(r => r.date >= a && r.date <= b).sort((x, y) => (x.date + x.heure).localeCompare(y.date + y.heure));

  /* ---------- Capacité de l'hôpital de jour ---------- */
  const pad = n => String(n).padStart(2, '0');
  R.toMin = h => { const [a, b] = String(h || '00:00').split(':').map(Number); return a * 60 + (b || 0); };
  R.toH = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  R.hdj = () => S.settings.hdj;
  R.jourOuvert = d => R.hdj().jours.includes(R.parse(d).getDay());
  R.finSemaine = sem => sem.jours.filter(d => R.jourOuvert(d)).pop() || sem.jours[4]; /* dernier jour d'ouverture (samedi possible), vendredi si aucun */
  R.dureeSeance = (proto, cure) => (cure && cure.voie !== 'IV') ? 0 : (proto && proto.dureeSeanceMin != null ? proto.dureeSeanceMin : 180);
  /* séances IV d'une date : { deb, fin, fauteuil, patient, cure } ; exclude = { pid, n } ; extra = séances virtuelles */
  R.seances = (date, exclude, extra) => {
    const out = [];
    S.patients.forEach(p => p.cures.forEach(c => { if (c.datePrevue !== date || c.voie !== 'IV' || c.statut === 'annulee' || c.statut === 'reportee' || c.statut === 'manquee' || c._reserv) return; if (exclude && exclude.pid === p.id && exclude.n === c.n) return; const deb = R.toMin(c.heure || R.hdj().ouverture); out.push({ deb, fin: deb + R.dureeSeance(R.protoDeCure(p, c), c), fauteuil: c.fauteuil || 0, patient: p, cure: c }); }));
    (extra || []).filter(x => x.date === date).forEach(x => out.push({ deb: R.toMin(x.heure), fin: R.toMin(x.heure) + x.duree, fauteuil: x.fauteuil, patient: null, cure: null }));
    return out.sort((a, b) => a.deb - b.deb);
  };
  R.verifierCreneau = (date, heure, duree, exclude, extra, sj) => { /* sj : séances du jour déjà calculées (prochainCreneau) */
    const h = R.hdj(); if (!R.jourOuvert(date)) return { ok: false, motif: 'hôpital de jour fermé ce jour' };
    const deb = R.toMin(heure), fin = deb + duree;
    if (deb < R.toMin(h.ouverture) || fin > R.toMin(h.fermeture)) return { ok: false, motif: `hors horaires (${h.ouverture}–${h.fermeture}, séance de ${duree} min)` };
    const s = sj || R.seances(date, exclude, extra);
    if (s.length >= h.maxParJour) return { ok: false, motif: `journée complète (${h.maxParJour} séances)` };
    const chev = s.filter(x => x.deb < fin && deb < x.fin);
    if (chev.length >= h.fauteuils) return { ok: false, motif: `les ${h.fauteuils} fauteuils sont occupés à ${heure}` };
    const pris = new Set(chev.map(x => x.fauteuil)); let f = 1; while (pris.has(f)) f++;
    return { ok: true, fauteuil: Math.min(f, h.fauteuils), occupes: chev.length };
  };
  R.prochainCreneau = (date, duree, heureSouhaitee, exclude, extra) => {
    const h = R.hdj(); const pas = h.pas || 30;
    for (let i = 0; i < 90; i++) {
      const d = R.addDays(date, i); if (!R.jourOuvert(d)) continue; const sj = R.seances(d, exclude, extra);
      const ouv = R.toMin(h.ouverture), fer = R.toMin(h.fermeture); const hs = heureSouhaitee ? R.toMin(heureSouhaitee) : ouv; const mins = [];
      for (let m = hs; m + duree <= fer; m += pas) mins.push(m);
      for (let m = ouv; m < hs && m + duree <= fer; m += pas) mins.push(m);
      for (const m of mins) { const v = R.verifierCreneau(d, R.toH(m), duree, exclude, extra, sj); if (v.ok) return { date: d, heure: R.toH(m), fauteuil: v.fauteuil, decale: i > 0 }; }
    }
    return null;
  };
  /* Réserve un créneau pour chaque cure IV d'une liste (dans l'ordre), en tenant compte des cures déjà réservées de la liste */
  R.reserverCures = (cures, heureSouhaitee, extra) => {
    const virt = [...(extra || [])];
    cures.forEach(c => { c._reserv = true; });
    try { cures.forEach(c => {
      if (c.voie !== 'IV' || c.statut === 'annulee' || c.statut === 'realisee') { delete c._reserv; return; }
      const duree = R.dureeSeance(R.proto(c.protocoleId), c);
      const cr = R.prochainCreneau(c.datePrevue, duree, heureSouhaitee, null, virt);
      if (cr) { if (cr.date !== c.datePrevue) { c.dateTheorique = c.datePrevue; c.datePrevue = cr.date; c.decalee = true; } c.heure = cr.heure; c.fauteuil = cr.fauteuil; virt.push({ date: cr.date, heure: cr.heure, duree, fauteuil: cr.fauteuil }); }
      else { c.heure = heureSouhaitee || R.hdj().ouverture; c.fauteuil = 0; c.sansCreneau = true; }
      delete c._reserv;
    }); } finally { cures.forEach(c => { delete c._reserv; }); }
    return cures;
  };
  R.occupationJour = d => { const s = R.seances(d); const h = R.hdj(); let max = 0; s.forEach(x => { const n = s.filter(y => y.deb < x.fin && x.deb < y.fin).length; if (n > max) max = n; }); return { seances: s.length, max: h.maxParJour, fauteuilsMax: max, fauteuils: h.fauteuils, ouvert: R.jourOuvert(d) }; };

  /* ---------- Calendrier mensuel ---------- */
  R.calendrierMois = ({ mois, selection, compter, actionJour, actionNav }) => {
    const [y, m] = mois.split('-').map(Number); const premier = new Date(y, m - 1, 1); const nb = new Date(y, m, 0).getDate();
    const decal = (premier.getDay() + 6) % 7; const t = R.today(); const cells = [];
    for (let i = 0; i < decal; i++) cells.push('<div class="cal-cell vide"></div>');
    for (let d = 1; d <= nb; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`; const c = compter(iso); const ferme = !R.jourOuvert(iso);
      cells.push(`<button type="button" class="cal-cell${iso === t ? ' today' : ''}${iso === selection ? ' sel' : ''}${ferme ? ' ferme' : ''}" data-action="${actionNav ? actionJour : 'calJour'}" data-date="${iso}"><span class="n">${d}</span><span class="dots">${c.seances ? `<i class="d-seance" title="${c.seances} séance(s)"></i><b>${c.seances}</b>` : ''}${c.controles ? `<i class="d-ctrl" title="${c.controles} contrôle(s)"></i>` : ''}${c.rdv ? `<i class="d-rdv" title="${c.rdv} rendez-vous"></i>` : ''}${c.plein ? '<span class="plein">plein</span>' : ''}</span></button>`);
    }
    const nomMois = premier.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); const nav = actionNav || 'calMois';
    const pk = R.ui.cal.picker; const pickerOpen = pk && pk.nav === nav; const pkYear = pickerOpen ? pk.annee : y;
    const picker = pickerOpen ? `<div class="cal-picker"><div class="row between mb8"><button type="button" class="btn sm" data-action="calPickerAnnee" data-delta="-1">${R.icon('chevL')}</button><b>${pkYear}</b><button type="button" class="btn sm" data-action="calPickerAnnee" data-delta="1">${R.icon('chevR')}</button></div><div class="cal-months">${Array.from({ length: 12 }, (_, i) => { const mm = `${pkYear}-${pad(i + 1)}`; return `<button type="button" class="btn sm${mm === mois ? ' primary' : ''}" data-action="${nav}" data-mois="${mm}">${new Date(pkYear, i, 1).toLocaleDateString('fr-FR', { month: 'short' })}</button>`; }).join('')}</div><div class="row mt8" style="justify-content:space-between"><span class="xs muted">Choisissez le mois, puis le jour dans la grille</span><button type="button" class="btn sm ghost" data-action="calPickerFermer">Fermer</button></div></div>` : '';
    return `<div class="cal"><div class="cal-head"><button type="button" class="btn sm" data-action="${nav}" data-delta="-1">${R.icon('chevL')}</button><button type="button" class="cal-title" data-action="calPicker" data-nav="${nav}" data-annee="${y}" title="Choisir le mois et l’année"><b style="text-transform:capitalize">${nomMois}</b> ${R.icon('chevD', 'ico')}</button><div class="row" style="gap:4px"><button type="button" class="btn sm ghost" data-action="${nav}" data-delta="0">Aujourd’hui</button><button type="button" class="btn sm" data-action="${nav}" data-delta="1">${R.icon('chevR')}</button></div></div>${picker}
      <div class="cal-grid">${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(j => `<div class="cal-dow">${j}</div>`).join('')}${cells.join('')}</div>
      <div class="legend" style="margin-top:10px"><span><i class="sw" style="background:var(--accent)"></i>Séance de perfusion</span><span><i class="sw" style="background:var(--info)"></i>Contrôle</span><span><i class="sw" style="background:var(--warn)"></i>Rendez-vous</span></div></div>`;
  };
  R.compterJour = (iso, patientId) => {
    const pats = patientId ? S.patients.filter(p => p.id === patientId) : S.patients;
    const seances = pats.reduce((n, p) => n + p.cures.filter(c => c.datePrevue === iso && c.statut !== 'annulee' && c.statut !== 'reportee' && c.statut !== 'manquee' && (c.voie === 'IV' || patientId)).length, 0);
    const controles = pats.reduce((n, p) => n + p.surveillance.filter(s => s.mode === 'echeance' && s.echeance === iso && s.statut !== 'annulee').length, 0);
    const rdv = S.rdv.filter(r => r.date === iso && (!patientId || r.patientId === patientId)).length;
    return { seances, controles, rdv, plein: !patientId && seances >= R.hdj().maxParJour };
  };
  /* même résultat que R.compterJour (sans patientId), mais l'index est construit une fois par rendu du calendrier du planning : compter: R.compteurJours() */
  R.compteurJours = () => { const m = {}; const g = d => m[d] = m[d] || { seances: 0, controles: 0, rdv: 0 }; const max = R.hdj().maxParJour;
    S.patients.forEach(p => { p.cures.forEach(c => { if (c.voie === 'IV' && c.statut !== 'annulee' && c.statut !== 'reportee' && c.statut !== 'manquee') g(c.datePrevue).seances++; }); p.surveillance.forEach(s => { if (s.mode === 'echeance' && s.statut !== 'annulee' && s.echeance) g(s.echeance).controles++; }); });
    S.rdv.forEach(r => { g(r.date).rdv++; });
    return iso => { const c = m[iso] || { seances: 0, controles: 0, rdv: 0 }; return { seances: c.seances, controles: c.controles, rdv: c.rdv, plein: c.seances >= max }; }; };

  /* ---------- Prolongation de la planification ---------- */
  R.prolonger = (p, mois) => {
    const pr0 = R.proto(p.protocoleId); if (!pr0 || !pr0.entretien) return 0;
    const cyc = p.cycleCourant || 1; const hist = (p.historiqueProtocoles || []).find(x => x.cycle === cyc) || {}; const pr = R.appliquerVariante(pr0, hist.variante || null); const curesCyc = p.cures.filter(c => (c.cycle || 1) === cyc && c.statut !== 'annulee');
    const derniere = curesCyc[curesCyc.length - 1]; const heure = (derniere || p.cures.filter(c => (c.cycle || 1) === cyc).slice(-1)[0] || {}).heure; /* dossier rouvert sans séance active : l'entretien repart de J0 ou de demain */
    let ref = curesCyc.filter(c => c.phase === 'Entretien').slice(-1)[0];
    if (!ref) { const d0 = R.doseEtape(pr, { dose: pr.entretien.dose, doseType: pr.entretien.doseType, texte: pr.entretien.texte }, p.poids, 'entretien'); ref = { voie: pr.entretien.voie, dose: d0.dose, doseTexte: d0.texte, flacons: d0.flacons, articleId: d0.articleId || pr.articleEntretienId || pr.articleId, heure }; } /* aucune séance d'entretien active : dose et voie d'entretien du protocole, jamais celles de l'induction */
    const inter = Math.max(7, +hist.intervalle || +pr.entretien.intervalleJours || 56); const t = R.today();
    const base = derniere && derniere.datePrevue > t ? derniere.datePrevue : t; const fin = R.addDays(base, Math.round((mois || 12) * 30.4)); const j0 = R.j0(p, cyc); const nouvelles = [];
    let debut = derniere ? R.addDays(derniere.datePrevue, inter) : (j0 > t ? j0 : t); if (debut <= t) debut = R.jourOuvre(R.addDays(t, 1)); /* un plan échu reprend demain, jamais dans le passé */
    for (let d = debut; d <= fin; d = R.addDays(d, inter)) { const dd = R.jourOuvre(d); nouvelles.push({ n: 0, cycle: cyc, protocoleId: pr.id, phase: 'Entretien', label: R.libelleJour(R.diffDays(j0, dd)), jour: R.diffDays(j0, dd), datePrevue: dd, voie: ref.voie, dose: ref.dose, doseTexte: ref.doseTexte, flacons: ref.flacons, articleId: ref.articleId, statut: 'prevue' }); }
    R.reserverCures(nouvelles, ref.heure); p.cures.push(...nouvelles); p.cures.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue)); p.cures.forEach((c, i) => c.n = i + 1);
    /* contrôles périodiques selon le plan de surveillance du dossier */
    const cfg = p.planSurveillance || R.cfgDepuisPatient(p); const cle = s => s.id + (s.nom ? '|' + s.nom : ''); const dernier = {};
    p.surveillance.filter(s => s.echeance && s.statut !== 'annulee').forEach(s => { const k = cle(s); if (!dernier[k] || s.echeance > dernier[k]) dernier[k] = s.echeance; });
    R.genererSurveillanceCfg(cfg, j0, R.diffDays(j0, fin), cyc).filter(s => s.mode === 'echeance' && s.echeance > (dernier[cle(s)] || R.today()) && !R.bloqueParAnnulation(p, s)).forEach(s => p.surveillance.push(s)); R.alignerTdm(p);
    const h = (p.historiqueProtocoles || []).find(x => x.statut === 'en cours'); if (h && nouvelles.length) h.planifieJusqua = nouvelles[nouvelles.length - 1].label;
    return nouvelles.length;
  };
  let alertesCache = null; /* l'état de la sauvegarde sur disque fait partie de la clé : l'alerte « à réactiver » en dépend */
  R.alertes = () => { const k = [S.modifieLe || '', S.enregistreLe ? '' : 'x', S.derniereSauvegarde || '', R.today(), S.user, S.patients.length, R.fs.handle ? (R.fs.etat.actif ? 'fa' : 'fi') : 'f0', R.fs.etat.nom || ''].join('|'); if (alertesCache && alertesCache.k === k) return alertesCache.v; const v = R.alertesBrut(); alertesCache = { k, v }; return v; };
  R.finPlanification = p => { const c = p.cures.filter(x => x.statut === 'prevue'); return c.length ? c[c.length - 1].datePrevue : null; };
  R.conflitsCapacite = () => {
    /* un seul passage sur les séances, regroupées par jour (au lieu de R.seances pour chacun des 90 à 400 jours) ; mêmes filtres que R.seances + statut prévu */
    const out = [], t = R.today(), h = R.hdj(), parJour = {}; let derniere = t;
    S.patients.forEach(p => p.cures.forEach(c => { if (c.statut !== 'prevue') return; if (c.datePrevue > derniere) derniere = c.datePrevue; if (c.voie !== 'IV' || c._reserv || !/^\d{4}-\d{2}-\d{2}$/.test(c.datePrevue || '') || c.datePrevue < t) return; const deb = R.toMin(c.heure || h.ouverture); (parJour[c.datePrevue] = parJour[c.datePrevue] || []).push({ deb, fin: deb + R.dureeSeance(R.protoDeCure(p, c), c), cure: c }); }));
    const nJ = Math.min(400, Math.max(90, R.diffDays(t, derniere) + 1)), limite = R.addDays(t, nJ);
    Object.keys(parJour).filter(d => d < limite).sort().forEach(d => { const s = parJour[d]; if (!R.jourOuvert(d)) { out.push({ date: d, motif: `${s.length} séance(s) un jour de fermeture` }); return; } const trop = s.filter(x => (x.cure.fauteuil || 0) > h.fauteuils); if (trop.length) out.push({ date: d, motif: `${trop.length} séance(s) sur un fauteuil qui n’existe plus (n° > ${h.fauteuils})` }); if (s.length > h.maxParJour) { out.push({ date: d, motif: `${s.length} séances pour ${h.maxParJour} maximum` }); return; } let max = 0; s.forEach(x => { const n = s.filter(y => y.deb < x.fin && x.deb < y.fin).length; if (n > max) max = n; }); if (max > h.fauteuils) out.push({ date: d, motif: `${max} séances simultanées pour ${h.fauteuils} fauteuils` }); });
    return out;
  };

  /* ---------- Alertes ---------- */
  R.alertesBrut = () => {
    const out = [], t = R.today();
    R.conflitsCapacite().forEach(c => out.push({ sev: 'crit', t: `Capacité dépassée le ${R.fmtDate(c.date)}`, d: `${c.motif} — déplacez des séances ou ajustez la capacité`, go: ['planning', { date: c.date }] }));
    if (R.can('equipe', 'w') && R.fs.handle && !R.fs.etat.actif) out.push({ sev: 'warn', t: 'Sauvegarde automatique à réactiver', d: `Le dossier « ${R.fs.etat.nom || 'sauvegardes'} » est connu mais l’autorisation d’y écrire doit être redonnée — Paramètres → Réactiver`, go: ['parametres', {}] });
    if (R.can('equipe', 'w') && (S.derniereSauvegarde ? R.diffDays(S.derniereSauvegarde, t) > 7 : S.patients.some(p => p.creePar))) out.push({ sev: 'info', t: 'Sauvegarde recommandée', d: S.derniereSauvegarde ? `Dernier export le ${R.fmtDate(S.derniereSauvegarde)} — exportez la base depuis Paramètres` : 'Aucun export de la base encore réalisé — Paramètres → Exporter', go: ['parametres', {}] });
    S.patients.forEach(p => {
      { const tr = R.transition(p); if (tr) out.push(tr.etat === 'due' ? { sev: 'crit', t: `Transition vers le service adulte — ${R.nomComplet(p)}`, d: `${tr.age} ans révolus depuis le ${R.fmtDate(tr.date16)} : organiser le relais vers la gastro-entérologie adulte, puis clôturer le dossier avec le motif « Transition vers le service adulte »`, go: ['patient', { id: p.id }] } : { sev: 'warn', t: `Transition à préparer — ${R.nomComplet(p)}`, d: `16 ans le ${R.fmtDate(tr.date16)} (dans ${tr.jours} jour(s)) : préparer le relais vers le service adulte`, go: ['patient', { id: p.id }] }); }
      if (p.statut !== 'suspendu') { p.cures.filter(c => c.statut === 'prevue' && c.datePrevue < t && c.voie === 'IV').forEach(c => out.push({ sev: 'crit', t: `Séance n°${c.n} non réalisée — ${R.nomComplet(p)}`, d: `${R.protoDeCure(p, c)?.dci} ${c.label} prévue le ${R.fmtDate(c.datePrevue)}`, go: ['patient', { id: p.id, tab: 'plan' }] }));
        const dom = p.cures.filter(c => c.statut === 'prevue' && c.datePrevue < t && c.voie !== 'IV'); if (dom.length) out.push({ sev: 'info', t: `${dom.length} injection(s) à domicile à confirmer — ${R.nomComplet(p)}`, d: `${R.protoDeCure(p, dom[0])?.dci} ${dom[0].label} du ${R.fmtDate(dom[0].datePrevue)}${dom.length > 1 ? ' et suivantes' : ''} : à cocher « Fait » après vérification avec le patient`, go: ['patient', { id: p.id, tab: 'plan' }] }); }
      p.cures.filter(c => (c.statut === 'reportee' || c.statut === 'manquee') && !c.parSuspension).forEach(c => out.push({ sev: 'warn', t: `${c.statut === 'manquee' ? 'Séance manquée' : 'Séance'} à replanifier — ${R.nomComplet(p)}`, d: `${c.label} · ${c.motif || ''}`, go: ['patient', { id: p.id, tab: 'plan' }] }));
      p.cures.filter(c => c.sansCreneau && c.statut === 'prevue').forEach(c => out.push({ sev: 'warn', t: `Aucun créneau trouvé — ${R.nomComplet(p)}`, d: `Séance ${c.label} du ${R.fmtDate(c.datePrevue)} : capacité dépassée, à replacer manuellement`, go: ['patient', { id: p.id, tab: 'plan' }] }));
      p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance < t).forEach(s => out.push({ sev: 'warn', t: `Contrôle en retard — ${R.nomComplet(p)}`, d: `${s.label} · échéance ${R.fmtDate(s.echeance)}`, go: ['patient', { id: p.id, tab: 'surveillance' }] }));
      /* dépistage avant la 1re séance : induction, ou entretien direct pas encore commencé */
      if (p.statut === 'induction' || (p.statut === 'entretien' && !p.cures.some(c => c.statut === 'realisee'))) { const manq = p.bilan.filter(b => R.bilanEnCours(b) && ['igra', 'rxt', 'vhb'].includes(b.id)); if (manq.length) out.push({ sev: 'warn', t: `Bilan pré-biothérapie incomplet — ${R.nomComplet(p)}`, d: manq.map(b => R.BILAN_PRE.find(x => x.id === b.id)?.label.split(' (')[0] + (b.date ? ' (' + R.bilanDemandeTxt(b) + ')' : '')).join(' · '), go: ['patient', { id: p.id, tab: 'bilans' }] }); }
      if (p.statut === 'suspendu') out.push({ sev: 'info', t: `Traitement suspendu — ${R.nomComplet(p)}`, d: p.motifSuspension, go: ['patient', { id: p.id }] });
      if (p.statut !== 'termine' && p.statut !== 'suspendu') { const fin = R.finPlanification(p); if (!fin || R.diffDays(t, fin) < 60) out.push({ sev: 'warn', t: `Planification à prolonger — ${R.nomComplet(p)}`, d: fin ? `Dernière séance planifiée le ${R.fmtDate(fin)}` : 'Aucune séance planifiée', go: ['patient', { id: p.id, tab: 'plan' }] }); }
    });
    const rank = { crit: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  };
  document.documentElement.lang = 'fr';


  /* ---------- Icônes ---------- */
  const ICONS = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    proto: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    team: '<path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>', chevL: '<polyline points="15 18 9 12 15 6"/>', chevR: '<polyline points="9 18 15 12 9 6"/>', chevD: '<polyline points="6 9 12 15 18 9"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    drop: '<path d="M12 2.7s-6 6.3-6 10.3a6 6 0 0 0 12 0c0-4-6-10.3-6-10.3z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    lab: '<path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3"/>'
  };
  R.icon = (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  /* ---------- Sélecteur de patient avec recherche (pour les formulaires) ---------- */
  R.patientPicker = (name, selId) => { const p = selId ? R.patient(selId) : null; return `<div class="picker"><input type="text" class="picker-input" placeholder="Tapez un nom, un prénom ou un n° de dossier…" data-input="pickPatient" data-target="${name}" value="${p ? R.esc(R.nomComplet(p) + ' — ' + p.ipp) : ''}" autocomplete="off"><input type="hidden" name="${name}" value="${R.esc(selId || '')}"><div class="picker-results"></div></div>`; };
  R.numeroDossier = () => { const y = R.today().slice(0, 4); let n = S.patients.filter(p => String(p.ipp).startsWith('RZ-' + y)).length + 1; let code; do { code = `RZ-${y}-${String(n).padStart(4, '0')}`; n++; } while (S.patients.some(p => p.ipp === code)); return code; };
  R.noteLigne = n => `<div class="when">${R.fmtDateLong(n.date)}${n.heure ? ' à ' + R.esc(n.heure) : ''} · <b>${R.esc(R.userName(n.par))}</b>${(() => { const a = R.userById(n.par) || (S.usersSupprimes || []).find(x => x.id === n.par); return a && a.fonction ? ` <span class="muted">(${R.esc(a.fonction)})</span>` : ''; })()}${n.modifieLe ? ` <span class="muted">· modifiée le ${R.fmtDate(n.modifieLe)}${n.modifiePar ? ' par ' + R.esc(R.userName(n.modifiePar)) : ''}</span>` : ''}</div>`;

  /* ---------- Modale, toast ---------- */
  R.modal = ({ title, body, foot, wide, form }) => {
    if (!document.querySelector('#modal-root .modal')) { R.ui.modalSale = false; R.ui.focusAvant = document.activeElement; }
    document.getElementById('modal-root').innerHTML = `<div class="modal-overlay"><form class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-titre" ${form ? `data-form="${form}"` : ''}>
      <div class="modal-head"><h3 id="modal-titre">${title}</h3><button type="button" class="x-btn" data-action="closeModal" aria-label="Fermer">${R.icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</form></div>`;
    R.pliables(document.getElementById('modal-root')); R.accessibilite(document.getElementById('modal-root'));
    const first = document.querySelector('#modal-root input:not([readonly]):not([type=hidden]), #modal-root select, #modal-root textarea') || document.querySelector('#modal-root .x-btn'); /* sans champ (confirmation) : focus sur « Fermer », jamais sur l'action */ if (first) first.focus();
  };
  /* plan d'un import « en ajout » : un dossier du fichier est déjà présent s'il a le même identifiant, le même n° de dossier, ou le même nom + prénom + date de naissance ; ignoré si un protocole qu'il référence (actuel, séances, cycles antérieurs, instantané) n'existe pas ici */
  R.planImportAjout = s => {
    const nt = R.normTexte; const meme = (p, q) => p.id === q.id ? 'même identifiant' : (q.ipp && String(p.ipp || '').trim() === String(q.ipp).trim()) ? ((nt(p.nom) === nt(q.nom) && nt(p.prenom) === nt(q.prenom)) ? 'même n° de dossier' : 'conflit : n° de dossier ' + R.esc(String(q.ipp)) + ' déjà attribué à ' + R.esc(R.nomComplet(p))) : (nt(p.nom) && nt(p.nom) === nt(q.nom) && nt(p.prenom) === nt(q.prenom) && (p.ddn || '') === (q.ddn || '')) ? 'même nom, prénom et date de naissance' : '';
    const ajouts = [], presents = [], ignores = [];
    (s.patients || []).forEach(q => {
      let motif = ''; for (const p of S.patients) { motif = meme(p, q); if (motif) break; }
      if (motif) { (/^conflit/.test(motif) ? ignores : presents).push({ q, motif }); return; }
      if (ajouts.some(x => meme(x.q, q))) { ignores.push({ q, motif: 'en double dans le fichier' }); return; }
      const manque = [...new Set([q.protocoleId, ...(q.cures || []).map(c => c && c.protocoleId), ...(q.curesRetro || []).map(c => c && c.protocoleId), ...(q.historiqueProtocoles || []).map(x => x && x.protocoleId), q.protocoleSnapshot && q.protocoleSnapshot.protocoleId].filter(Boolean))].filter(id => !R.proto(id)); /* mêmes références que protoSupprimer : aucune référence orpheline importée */
      if (!q.protocoleId || manque.length) { ignores.push({ q, motif: `protocole${manque.length > 1 ? 's' : ''} « ${R.esc((manque.length ? manque : ['—']).join(', '))} » absent${manque.length > 1 ? 's' : ''} de cette base` }); return; }
      ajouts.push({ q, medecinRemplace: !!q.medecinId && !S.users.some(u => u.id === q.medecinId) });
    });
    const ids = new Set(ajouts.map(x => x.q.id)); const cle = r => [r.date, r.heure, r.patientId, r.type].join('|'); const deja = new Set((S.rdv || []).map(cle));
    const rdv = (s.rdv || []).filter(r => ids.has(r.patientId) && !deja.has(cle(r)));
    return { ajouts, presents, ignores, rdv };
  };
  R.closeModal = () => { const ouverte = !!document.querySelector('#modal-root .modal'); document.getElementById('modal-root').innerHTML = ''; R.ui.modalSale = false; if (ouverte && R.ui.focusAvant && document.contains(R.ui.focusAvant)) { try { R.ui.focusAvant.focus(); } catch (e) {} } R.ui.focusAvant = null; };
  /* Échap ou clic à côté : si une saisie est en cours, il faut confirmer par un second geste */
  R.fermerModalDemande = () => { if (!document.querySelector('#modal-root .modal')) return; if (R.ui.modalSale && !(R.ui.confirmFermeture && Date.now() - R.ui.confirmFermeture < 4000)) { R.ui.confirmFermeture = Date.now(); R.toast('Saisie en cours : recommencez (Échap ou clic à côté) pour fermer sans enregistrer', 'warn'); return; } R.ui.confirmFermeture = 0; R.closeModal(); };
  /* Accès clavier et étiquettes : lignes cliquables focalisables, libellés reliés à leur champ */
  R.accessibilite = root => { root = root || document.getElementById('app'); if (!root) return; root.querySelectorAll('[data-go]:not(button):not(a):not(input):not(select):not(textarea):not([tabindex]), [data-action]:not(button):not(a):not(input):not(select):not(textarea):not(h2):not(h3):not(label):not([tabindex])').forEach(el => { el.tabIndex = 0; el.setAttribute('role', el.dataset.go ? 'link' : 'button'); }); root.querySelectorAll('.field').forEach(f => { const lab = f.querySelector(':scope > label'); const ctl = f.querySelector(':scope > input:not([type=hidden]), :scope > select, :scope > textarea'); if (lab && ctl && !lab.htmlFor) { if (!ctl.id) ctl.id = 'c-' + Math.random().toString(36).slice(2, 9); lab.htmlFor = ctl.id; } }); };
  /* Toute carte avec un titre peut être réduite (clic sur le titre ou le chevron) ; l'état est mémorisé par page et par titre */
  R.pliables = root => {
    root = root || document.getElementById('app'); if (!root) return; const page = (S.route && S.route.page) || '';
    root.querySelectorAll('.card, .cycle-card').forEach(card => {
      if (card.closest('.carnet-wrap') || card.closest('.login-wrap') || card.dataset.fixe) return;
      const head = card.querySelector(':scope > .card-head, :scope > .row.between'); if (!head) return; const h = head.querySelector('h2, h3'); if (!h || head.querySelector('.plier')) return;
      if (!card.querySelector(':scope > .card-body, :scope > .card-foot, :scope > .dl, :scope > form, :scope > .tbl-wrap')) return;
      const key = page + '|' + h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60); const ferme = !!R.ui.plies[key];
      card.classList.toggle('plie', ferme);
      h.classList.add('pli-titre'); h.dataset.action = 'plier'; h.dataset.key = key; h.title = ferme ? 'Cliquer pour développer' : 'Cliquer pour réduire';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'plier'; b.dataset.action = 'plier'; b.dataset.key = key; b.setAttribute('aria-label', ferme ? 'Développer' : 'Réduire'); b.setAttribute('aria-expanded', ferme ? 'false' : 'true'); b.innerHTML = R.icon('chevD'); head.appendChild(b);
    });
  };
  R.actions.plier = el => { const k = el.dataset.key; if (R.ui.plies[k]) delete R.ui.plies[k]; else R.ui.plies[k] = 1; R.saveUi(); const card = el.closest('.card, .cycle-card'); if (card) { card.classList.toggle('plie', !!R.ui.plies[k]); const f = !!R.ui.plies[k]; card.querySelectorAll('.plier, .pli-titre').forEach(x => { x.title = f ? 'Cliquer pour développer' : 'Cliquer pour réduire'; if (x.classList.contains('plier')) { x.setAttribute('aria-label', f ? 'Développer' : 'Réduire'); x.setAttribute('aria-expanded', f ? 'false' : 'true'); } }); } };
  R.toast = (msg, type) => { const root = document.getElementById('toast-root'); const el = document.createElement('div'); el.className = 'toast ' + (type || ''); el.textContent = msg; root.appendChild(el); setTimeout(() => el.remove(), 4200); };
  R.confirmer = (titre, texte, action, params) => R.modal({ title: titre, body: `<p style="margin:0">${texte}</p>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="button" class="btn primary" data-action="${action}" data-params='${R.params(params)}'>Confirmer</button>` });

  /* ---------- Graphique en colonnes ---------- */
  function topRect(x, y, w, h, r) { r = Math.min(r, w / 2, h); return `M${x},${y + h} V${y + r} a${r},${r} 0 0 1 ${r},-${r} H${x + w - r} a${r},${r} 0 0 1 ${r},${r} V${y + h} Z`; }
  R.columnChart = ({ labels, series, height }) => {
    const W = 680, H = height || 230, padL = 30, padR = 6, padT = 14, padB = 24, n = labels.length;
    const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const max = Math.max(1, ...totals); const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10; const yMax = Math.ceil(max / step) * step;
    const plotW = W - padL - padR, plotH = H - padT - padB, band = plotW / n, bw = Math.min(24, band * 0.62);
    const y = v => padT + plotH - (v / yMax) * plotH;
    let g = ''; for (let v = 0; v <= yMax; v += step) g += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${padL - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
    let bars = ''; const iMax = totals.indexOf(Math.max(...totals));
    labels.forEach((lab, i) => {
      let acc = 0; const x = padL + band * i + (band - bw) / 2;
      series.forEach(s => { const v = s.values[i] || 0; if (!v) return; const yTop = y(acc + v), yBot = y(acc) - (acc ? 2 : 0); const h = Math.max(0.5, yBot - yTop); const last = acc + v === totals[i]; const tip = `${R.esc(lab)} · ${R.esc(s.name)} : ${v} (total ${totals[i]})`; bars += last ? `<path class="bar" d="${topRect(x, yTop, bw, h, 4)}" fill="${s.color}" data-tip="${tip}"/>` : `<rect class="bar" x="${x}" y="${yTop}" width="${bw}" height="${h}" fill="${s.color}" data-tip="${tip}"/>`; acc += v; });
      bars += `<text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle">${R.esc(lab)}</text>`;
      if (totals[i] && (i === n - 1 || i === iMax)) bars += `<text x="${x + bw / 2}" y="${(y(totals[i]) - 5).toFixed(1)}" text-anchor="middle" style="fill:var(--ink-2);font-weight:600">${totals[i]}</text>`;
    });
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="sw" style="background:${s.color}"></i>${R.esc(s.name)}</span>`).join('')}</div>` : '';
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Séances réalisées par mois">${g}<line class="axis" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>${bars}</svg>${legend}</div>`;
  };
  R.curesParMois = () => {
    const mois = []; const d = new Date(); for (let i = 11; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); mois.push(R.iso(m).slice(0, 7)); }
    const series = [{ key: 'Infliximab', name: 'Infliximab', color: 'var(--s1)' }, { key: 'Vedolizumab', name: 'Vedolizumab', color: 'var(--s2)' }, { key: 'Ustekinumab', name: 'Ustekinumab', color: 'var(--s3)' }, { key: 'autres', name: 'Autres', color: 'var(--s4)' }];
    series.forEach(s => s.values = mois.map(() => 0));
    S.patients.forEach(p => p.cures.filter(c => c.statut === 'realisee' && c.voie === 'IV').forEach(c => { const i = mois.indexOf((c.dateReelle || c.datePrevue).slice(0, 7)); if (i < 0) return; const dci = (R.protoDeCure(p, c)?.dci || '').split(' ')[0]; (series.find(x => x.key === dci) || series[3]).values[i]++; }));
    return { labels: mois.map(m => R.fmtMois(m + '-01')), series };
  };

  /* ---------- Navigation et rendu ---------- */
  const NAV = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'dash', mod: 'dashboard' },
    { id: 'planning', label: 'Planning HDJ', icon: 'cal', mod: 'planning' },
    { id: 'patients', label: 'Patients', icon: 'users', mod: 'patients' },
    { id: 'nouveau', label: 'Nouveau dossier', icon: 'plus', mod: 'dossier', w: true },
    { id: 'protocoles', label: 'Protocoles', icon: 'proto', mod: 'protocoles' },
    { id: 'activite', label: 'Activité & rapports', icon: 'chart', mod: 'dashboard' },
    { id: 'equipe', label: 'Équipe & codes', icon: 'team', mod: 'equipe' }
  ];
  R.saveUi = () => { try { localStorage.setItem('ryze-hdj-ui', JSON.stringify({ plies: R.ui.plies || {}, route: S.route })); } catch (e) {} };
  R.go = (page, params) => { R.closeModal(); S.route = { page, params: params || {} }; R.saveUi(); R.render(); window.scrollTo(0, 0); };
  R.render = () => {
    try { rendre(); R.pliables(); R.accessibilite(); } catch (e) {
      console.error('Rendu impossible', e);
      /* on ne supprime jamais les données : on propose de revenir à l'accueil ou d'exporter la base */
      document.getElementById('app').innerHTML = `<div class="login-wrap"><div class="card" style="max-width:520px;margin:40px auto"><div class="card-head"><h2>Erreur d’affichage</h2></div><div class="card-body"><p class="small">Cette page n’a pas pu être affichée. Vos données sont conservées.</p><pre class="small muted" style="white-space:pre-wrap">${R.esc(e && e.message || e)}</pre><div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-action="secoursAccueil">Revenir à l’accueil</button>${R.can('equipe', 'w') ? '<button type="button" class="btn" data-action="exporterBase">Exporter la base</button>' : ''}<button type="button" class="btn ghost" data-action="secoursRecharger">Recharger la page</button></div></div></div></div>`;
    }
  };
  function rendre() {
    const bd = document.getElementById('rail-backdrop'); if (bd) bd.remove(); /* le menu est reconstruit fermé */
    const app = document.getElementById('app');
    const uc = S.user ? S.users.find(x => x.id === S.user) : null;
    if (!uc || uc.actif === false) { if (S.user) { S.user = null; R.save(); } app.innerHTML = loginView(); return; }
    let page = R.pages[S.route.page] ? S.route.page : 'dashboard';
    const item = NAV.find(i => i.id === page);
    if ((item && !R.can(item.mod, item.w ? 'w' : 'r')) || (page === 'parametres' && !R.can('equipe', 'w'))) { page = 'dashboard'; S.route = { page, params: {} }; }
    const pg = R.pages[page]; const alertes = R.alertes(); const nCrit = alertes.filter(a => a.sev === 'crit').length; const u = R.user(); const sem = R.semaine();
    app.innerHTML = `<div class="shell">
      <aside class="rail" id="rail">
        <div class="brand"><div class="brand-mark">Rz</div><div><b>Ryze</b><span>Biothérapies · Hôpital de jour</span></div></div>
        <nav class="nav"><div style="height:8px"></div>${NAV.filter(i => R.can(i.mod, i.w ? 'w' : 'r')).map(i => `<button class="nav-item${(page === i.id || (i.id === 'patients' && (page === 'patient' || page === 'carnet' || page === 'carnetPatient' || page === 'compteRendu' || page === 'impression' || page === 'changement'))) ? ' active' : ''}" data-go="${i.id}">${R.icon(i.icon)}<span>${i.label}</span>${i.id === 'dashboard' && nCrit ? `<span class="count">${nCrit}</span>` : ''}</button>`).join('')}</nav>
        <div class="rail-foot">${R.esc(S.settings.service)}<br>${R.esc(S.settings.unite)}</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="menu-btn" data-action="toggleRail" aria-label="Menu">${R.icon('menu')}</button>
          <div class="search">${R.icon('search')}<input type="search" id="global-search" placeholder="Rechercher un patient (nom, IPP)…" data-input="globalSearch" autocomplete="off"><div id="search-results"></div></div>
          <span class="week-chip">Semaine du ${R.fmtDate(sem.lundi, { day: 'numeric', month: 'short' })} au ${R.fmtDate(R.finSemaine(sem), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <div class="user-chip"><div class="who"><b>${R.esc(R.userName(u.id))}</b><span>${R.esc((R.ROLES[u.role] || R.ROLES.hdj).label)} · ${R.esc(u.fonction)}</span></div><div class="avatar">${R.initials(u.prenom, u.nom)}</div>${R.can('equipe', 'w') ? `<button class="btn sm ghost" data-go="parametres" title="Paramètres et capacité de l’HDJ">${R.icon('cog')}</button>` : ''}<button class="btn sm ghost" data-action="logout" title="Se déconnecter">${R.icon('logout')}</button></div>
        </header>
        <main class="content">${pg.render(S.route.params)}</main>
      </div></div>`;
  }

  function loginView() {
    const actifs = S.users.filter(u => u.actif);
    return `<div class="login"><div class="login-box">${R.ui.baseIllisible ? `<div class="callout crit mb16"><b>Vos données précédentes n’ont pas pu être chargées</b> — ${R.esc(R.ui.baseIllisible)}. ${R.ui.baseIllisibleAccepte ? 'Vous travaillez sur une base neuve.' : `Elles n’ont pas été modifiées. ${R.ui.copieOk ? 'Une copie a aussi été mise de côté dans ce navigateur.' : 'Aucune copie supplémentaire n’a pu être faite (espace plein) : téléchargez-les maintenant.'}`}<div class="row mt8" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn sm primary" data-action="telechargerBak">Télécharger mes données</button>${R.ui.baseIllisibleAccepte ? '' : '<button type="button" class="btn sm danger" data-action="baseNeuve">Continuer avec une base neuve</button>'}</div><div class="small mt8">Importez ensuite le fichier depuis Paramètres, une fois l’application mise à jour.</div></div>` : ''}
      <div class="login-left">
        <div class="brand" style="padding:0"><div class="brand-mark">Rz</div><div><b>Ryze</b><span>Suivi biothérapique</span></div></div>
        <h1>Gestion des biothérapies en hôpital de jour</h1>
        <p>${R.esc(S.settings.service)} — ${R.esc(S.settings.unite)}.</p>
        <ul class="feature-list">
          <li>${R.icon('check')}<span>Dossier patient et protocole par cycles, doses calculées au poids, historique des changements.</span></li>
          <li>${R.icon('check')}<span>Planning des fauteuils sans double réservation, calendrier mensuel navigable.</span></li>
          <li>${R.icon('check')}<span>Séances et contrôles dans une seule planification, marqués réalisés avec notes.</span></li>
          <li>${R.icon('check')}<span>Carnet de suivi imprimable pour chaque patient.</span></li>
        </ul>
        ${(() => { const c = S.codeNeuf && (S.users || []).some(x => x.actif && x.role === 'complet' && x.code === S.codeNeuf) ? S.codeNeuf : null; return c ? `<div class="demo-note">Base vide : nouveau code d’accès complet <b class="mono">${R.esc(c)}</b> — notez-le, il n’est plus affiché après la première connexion.</div>` : ''; })()}
        ${S.dirty ? '' : `<div class="demo-note">${S.vide ? 'Base vide : aucun patient. ' : 'Prototype de démonstration — patients et effectifs fictifs. '}<button type="button" class="btn sm ghost" data-action="${S.vide ? 'resetDemo' : 'viderDemoConfirm'}">${S.vide ? 'Recharger la démonstration' : 'Démarrer avec une base vide'}</button></div>`}
      </div>
      <div class="login-right">
        <form data-form="loginCode" class="stack">
          <div class="caps">Connexion</div>
          <div class="field"><label for="login-code">Code d’accès personnel</label><input type="text" id="login-code" name="code" class="mono" style="font-size:18px;letter-spacing:.12em;text-transform:uppercase" placeholder="ex. ABC234" autocomplete="off" autofocus></div>
          <button type="submit" class="btn primary" style="justify-content:center">Entrer</button>
        </form>
        ${S.dirty ? '' : `<div class="subtle mt24"><div class="caps mb8">Codes de démonstration (cliquer pour entrer)</div>
          <div class="stack" style="gap:6px">${actifs.map(u => `<div class="row between small" style="flex-wrap:nowrap"><span class="grow" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${R.esc(R.userName(u.id))} <span class="muted">· ${R.esc(u.fonction)}</span></span><span class="row" style="gap:6px;flex-wrap:nowrap"><span class="badge ${u.role === 'complet' ? 'accent' : ''}">${(R.ROLES[u.role] || R.ROLES.hdj).court}</span><button type="button" class="tag" data-action="loginFill" data-code="${R.esc(u.code)}" style="cursor:pointer">${R.esc(u.code)}</button></span></div>`).join('')}</div>
          <p class="xs muted" style="margin:10px 0 0">Les codes sont créés dans Équipe & codes par un accès complet. Cette liste disparaît dès que la base contient des données réelles.</p></div>`}
      </div></div></div>`;
  }

  /* ---------- Tableau de bord ---------- */
  R.pages.dashboard = {
    render() {
      const sem = R.semaine(), t = R.today();
      const actifs = S.patients.filter(p => p.statut !== 'termine');
      const curesSem = R.curesEntre(sem.lundi, sem.dimanche); const iv = curesSem.filter(x => x.cure.voie === 'IV');
      const faites = iv.filter(x => x.cure.statut === 'realisee').length;
      const ctrl = R.controlesEntre(sem.lundi, sem.dimanche); const rdv = R.rdvEntre(sem.lundi, sem.dimanche);
      const alertes = R.alertes(); const retards = S.patients.filter(p => p.statut !== 'suspendu').reduce((n, p) => n + p.cures.filter(c => c.statut === 'prevue' && c.datePrevue < t && c.voie === 'IV').length, 0) + S.patients.reduce((n, p) => n + p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance < t).length, 0);
      const chart = R.curesParMois();
      return `
      <div class="page-head"><div><h1>Tableau de bord</h1><p>${R.esc(S.settings.unite)} · semaine du ${R.fmtDateLong(sem.lundi)} au ${R.fmtDateLong(R.finSemaine(sem))}</p></div>
        <div class="page-actions">${R.can('dossier', 'w') ? `<button class="btn primary" data-go="nouveau">${R.icon('plus')}Nouveau dossier</button>` : ''}<button class="btn" data-go="planning">${R.icon('cal')}Planning</button></div></div>
      <div class="kpis">
        <button class="kpi" data-go="patients"><div class="label">Patients suivis</div><div class="value">${actifs.length}<small>${actifs.filter(p => p.statut === 'induction').length} en induction</small></div><div class="sub">${S.patients.filter(p => p.statut === 'suspendu').length} traitement(s) suspendu(s)</div></button>
        <button class="kpi" data-go="planning"><div class="label">Séances de perfusion cette semaine</div><div class="value">${iv.length}<small>${faites} réalisée${faites > 1 ? 's' : ''}</small></div><div class="sub">${R.hdj().fauteuils} fauteuils · ${R.hdj().maxParJour} séances max/jour</div></button>
        <button class="kpi" data-go="planning"><div class="label">Contrôles et rendez-vous</div><div class="value">${ctrl.length + rdv.length}</div><div class="sub">${ctrl.length} contrôle(s) · ${rdv.length} rendez-vous cette semaine</div></button>
        <button class="kpi${retards ? ' attention' : ''}" data-go="patients"><div class="label">Retards</div><div class="value">${retards}</div><div class="sub">séances non réalisées et contrôles dépassés</div></button>
      </div>
      ${(() => { const jour = R.jourOuvert(t) ? t : null; const sIV = R.curesEntre(t, t); const sCtrl = R.controlesEntre(t, t); const rdvJ = R.rdvEntre(t, t); const rows = [...sIV.map(x => ({ h: x.cure.heure || (x.cure.voie !== 'IV' ? x.cure.voie : '—'), sort: x.cure.heure || '98', badge: '<span class="badge type-seance" style="padding:1px 7px">Séance</span>', t: R.nomComplet(x.patient), d: `${R.protoDeCure(x.patient, x.cure)?.dci} ${x.cure.label} · ${x.cure.doseTexte}${x.cure.voie === 'IV' ? ' · fauteuil ' + (x.cure.fauteuil || '—') : ''}`, pid: x.patient.id, st: R.statutCureBadge(x.cure), act: x.cure.statut === 'prevue' && R.can('cures', 'w') ? `<button class="btn sm primary" data-action="cureEnregistrer" data-pid="${R.esc(x.patient.id)}" data-n="${R.esc(x.cure.n)}">${R.icon('check', 'ico')}Fait</button><button class="btn sm" data-action="cureReporter" data-pid="${R.esc(x.patient.id)}" data-n="${R.esc(x.cure.n)}">Reporter</button>` : '' })), ...sCtrl.map(x => ({ h: '—', sort: '97', tab: 'surveillance', badge: '<span class="badge type-ctrl" style="padding:1px 7px">Contrôle</span>', t: R.nomComplet(x.patient), d: x.surv.label, pid: x.patient.id, st: R.statutSurvBadge(x.surv), act: x.surv.statut === 'prevue' && R.can('cures', 'w') ? `<button class="btn sm primary" data-action="survSaisir" data-pid="${R.esc(x.patient.id)}" data-i="${x.patient.surveillance.indexOf(x.surv)}">${R.icon('check', 'ico')}Fait</button><button class="btn sm" data-action="survReporter" data-pid="${R.esc(x.patient.id)}" data-i="${x.patient.surveillance.indexOf(x.surv)}">Reporter</button>` : '' })), ...rdvJ.map(r => ({ h: r.heure, sort: r.heure, badge: '<span class="badge type-rdv" style="padding:1px 7px">RDV</span>', t: R.nomComplet(R.patient(r.patientId) || { nom: '?', prenom: '' }), d: `${r.type} · ${r.objet}`, pid: r.patientId, st: '', act: '' }))].sort((a, b) => a.sort.localeCompare(b.sort));
        return `<section class="card mb16"><div class="card-head"><div><h2>Ma journée — ${R.fmtDateLong(t)}</h2><div class="sub">${sIV.length} séance(s) · ${sCtrl.length} contrôle(s) · ${rdvJ.length} rendez-vous${jour ? ' — cochez « Fait » ou « Reporter » directement ici' : ' · hôpital de jour fermé aujourd’hui'}</div></div><button class="btn sm" data-go="planning">Voir le planning</button></div><div class="card-body" style="padding-top:2px;padding-bottom:2px">${rows.map(x => `<div class="jour-row"><span class="mono muted">${R.esc(x.h)}</span><div><div class="row" style="gap:6px">${x.badge}<button type="button" style="border:0;background:none;padding:0;cursor:pointer;font:inherit;font-weight:600;color:inherit" data-go="patient" data-params='${R.params({ id: x.pid, tab: x.tab || 'plan' })}'>${R.esc(x.t)}</button></div><div class="small ink2">${R.esc(x.d)}</div></div><div class="row" style="gap:6px">${x.st}${x.act}</div></div>`).join('') || '<div class="empty">Rien de programmé aujourd’hui</div>'}</div></section>`; })()}
      <div class="grid c21">
        <section class="card"><div class="card-head"><div><h2>Séances de perfusion réalisées par mois</h2><div class="sub">12 derniers mois</div></div></div><div class="card-body">${R.columnChart(chart)}</div></section>
        <section class="card"><div class="card-head"><h2>À traiter</h2><span class="badge ${alertes.some(a => a.sev === 'crit') ? 'crit' : alertes.length ? 'warn' : 'good'}">${alertes.length}</span></div>
          <div class="card-body" style="padding-top:4px;padding-bottom:4px">${!S.patients.length ? `<div class="empty">Aucun patient. ${R.can('dossier', 'w') ? '<br><button class="btn sm primary mt8" data-go="nouveau">Créer le premier dossier</button>' : ''}</div>` : alertes.length ? alertes.slice(0, R.ui.alertesTout ? alertes.length : 8).map(a => `<button class="alert-row" data-go="${a.go[0]}" data-params='${R.params(a.go[1])}'><i class="sev ${a.sev}"></i><div><div class="t">${R.esc(a.t)}</div><div class="d">${R.esc(a.d)}</div></div></button>`).join('') : '<div class="empty">Rien à signaler</div>'}</div>
          ${alertes.length > 8 ? `<div class="card-foot"><button type="button" class="btn sm ghost" data-action="alertesTout">${R.ui.alertesTout ? 'Réduire la liste' : `Afficher les ${alertes.length - 8} autre(s)`}</button></div>` : ''}</section>
      </div>
      <div class="stack" style="margin-bottom:16px">
        <section class="card"><div class="card-head"><div><h2>Séances de la semaine</h2><div class="sub">perfusions à l’hôpital de jour</div></div><button class="btn sm" data-go="planning">Ouvrir le planning</button></div>
          <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Jour</th><th>Heure</th><th>Patient</th><th>Biothérapie</th><th>Dose</th><th>Fauteuil</th><th>Statut</th>${R.can('cures', 'w') ? '<th></th>' : ''}</tr></thead><tbody>
          ${iv.map(x => { const c = x.cure, p = x.patient, pr = R.protoDeCure(p, c); return `<tr class="row-link${c.datePrevue === t ? ' today' : ''}${c.statut === 'realisee' ? ' done' : ''}" data-go="patient" data-params='${R.params({ id: p.id, tab: 'plan' })}'>
            <td class="nowrap">${R.fmtDate(c.datePrevue, { weekday: 'short', day: 'numeric' })}</td><td class="mono">${R.esc(c.heure || '—')}</td>
            <td class="name">${R.esc(R.nomComplet(p))}<small>${R.esc(p.ipp)}</small></td>
            <td>${R.esc(pr?.dci || '')} <span class="tag">${R.esc(c.label)}</span></td>
            <td class="small dose">${R.esc(c.doseTexte)}</td><td class="num">${R.esc(c.fauteuil || '—')}</td>
            <td>${R.statutCureBadge(c)}</td>${R.can('cures', 'w') ? `<td class="actions">${c.statut === 'prevue' ? `<button class="btn sm primary" data-action="cureEnregistrer" data-pid="${R.esc(p.id)}" data-n="${R.esc(c.n)}">Marquer réalisée</button>` : ''}</td>` : ''}</tr>`; }).join('') || '<tr><td colspan="8" class="empty">Aucune séance cette semaine</td></tr>'}
          </tbody></table></div></section>
        <section class="card"><div class="card-head"><div><h2>Contrôles de la semaine</h2><div class="sub">biologie, calprotectine, endoscopie…</div></div></div>
          <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Jour</th><th>Patient</th><th>Contrôle</th><th>Statut</th></tr></thead><tbody>${ctrl.map(x => `<tr class="row-link${x.surv.statut === 'faite' ? ' done' : ''}" data-go="patient" data-params='${R.params({ id: x.patient.id, tab: 'surveillance' })}'><td class="nowrap">${R.fmtDate(x.surv.echeance, { weekday: 'short', day: 'numeric' })}</td><td class="name">${R.esc(R.nomComplet(x.patient))}</td><td class="small">${R.esc(x.surv.label)}</td><td>${R.statutSurvBadge(x.surv)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucun contrôle cette semaine</td></tr>'}</tbody></table></div></section>
      </div>`;
    }
  };

  /* ---------- Sélecteur de période (deux mois côte à côte) ---------- */
  R.rangePicker = ({ debut, fin, mois }) => {
    const t = R.today(); const [y, m] = mois.split('-').map(Number); const pick = R.ui.rapport.pick;
    const moisHTML = (yy, mm) => { const premier = new Date(yy, mm - 1, 1), nb = new Date(yy, mm, 0).getDate(), decal = (premier.getDay() + 6) % 7; let cells = ''; for (let i = 0; i < decal; i++) cells += '<div class="rp-cell vide"></div>'; for (let dd = 1; dd <= nb; dd++) { const iso = `${yy}-${pad(mm)}-${pad(dd)}`; const inR = debut && fin && iso >= debut && iso <= fin; const edge = iso === debut || iso === fin; cells += `<button type="button" class="rp-cell${inR ? ' in' : ''}${edge ? ' edge' : ''}${iso === t ? ' today' : ''}${iso === pick ? ' pick' : ''}" data-action="rapportJour" data-date="${iso}">${dd}</button>`; } return `<div class="rp-month"><div class="rp-title">${premier.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div><div class="rp-grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<div class="rp-dow">${x}</div>`).join('')}${cells}</div></div>`; };
    const m2 = new Date(y, m, 1);
    return `<div class="rp"><div class="row between mb8"><button type="button" class="btn sm" data-action="rapportMois" data-delta="-1">${R.icon('chevL')}</button><span class="small muted">${pick ? 'Choisissez la date de fin' : 'Cliquez une date de début, puis une date de fin'}</span><button type="button" class="btn sm" data-action="rapportMois" data-delta="1">${R.icon('chevR')}</button></div><div class="rp-months">${moisHTML(y, m)}${moisHTML(m2.getFullYear(), m2.getMonth() + 1)}</div></div>`;
  };
  R.ui.rapport = { preset: 'mois', pick: null };
  R.periodeRapport = () => {
    const r = R.ui.rapport, t = R.today(); const dt = R.parse(t); const y = dt.getFullYear(), m = dt.getMonth();
    if (r.preset === 'mois') return { debut: R.iso(new Date(y, m, 1)), fin: R.iso(new Date(y, m + 1, 0)) };
    if (r.preset === 'precedent') return { debut: R.iso(new Date(y, m - 1, 1)), fin: R.iso(new Date(y, m, 0)) };
    if (r.preset === '15j') return { debut: R.addDays(t, -14), fin: t };
    if (r.preset === '30j') return { debut: R.addDays(t, -29), fin: t };
    if (r.preset === 'trimestre') return { debut: R.iso(new Date(y, m - 2, 1)), fin: R.iso(new Date(y, m + 1, 0)) };
    if (r.preset === 'annee') return { debut: `${y}-01-01`, fin: `${y}-12-31` };
    return { debut: r.debut || R.iso(new Date(y, m, 1)), fin: r.fin || R.iso(new Date(y, m + 1, 0)) };
  };
  R.statsPeriode = (debut, fin) => {
    const t = R.today(); const cures = S.patients.flatMap(p => p.cures.map(c => ({ c, p }))).filter(x => x.c.voie === 'IV');
    const realisees = cures.filter(x => x.c.statut === 'realisee' && x.c.dateReelle >= debut && x.c.dateReelle <= fin);
    const prevues = cures.filter(x => x.c.datePrevue >= debut && x.c.datePrevue <= fin && x.c.statut !== 'annulee');
    const manquees = cures.filter(x => (x.c.absences || []).some(a => a.date >= debut && a.date <= fin) || (x.c.datePrevue >= debut && x.c.datePrevue <= fin && (x.c.statut === 'manquee' || (x.c.statut === 'prevue' && x.c.datePrevue < t))));
    const aVenir = prevues.filter(x => x.c.statut === 'prevue' && x.c.datePrevue >= t);
    const annulees = cures.filter(x => x.c.statut === 'annulee' && x.c.datePrevue >= debut && x.c.datePrevue <= fin);
    const reports = cures.flatMap(x => (x.c.reports || []).filter(r => r.date >= debut && r.date <= fin).map(r => ({ r, c: x.c, p: x.p })));
    const cat = {}; reports.forEach(x => { cat[x.r.categorie || 'autre'] = (cat[x.r.categorie || 'autre'] || 0) + 1; });
    const patients = new Set(realisees.map(x => x.p.id)); const nouveaux = S.patients.filter(p => p.creeLe >= debut && p.creeLe <= fin);
    const controles = S.patients.flatMap(p => p.surveillance.filter(s => s.mode === 'echeance' && s.echeance >= debut && s.echeance <= fin && s.statut !== 'annulee'));
    const ctrlFaits = S.patients.flatMap(p => p.surveillance.filter(s => s.statut === 'faite' && s.dateFaite >= debut && s.dateFaite <= fin));
    const parMol = {}; realisees.forEach(x => { const k = R.protoDeCure(x.p, x.c)?.dci || '?'; parMol[k] = (parMol[k] || 0) + 1; });
    let joursOuverts = 0; for (let d = debut; d <= fin; d = R.addDays(d, 1)) if (R.jourOuvert(d)) joursOuverts++;
    const capacite = joursOuverts * R.hdj().maxParJour; const passees = cures.filter(x => { const d = x.c.dateReelle || x.c.datePrevue; return d >= debut && d <= fin && (x.c.statut === 'realisee' || x.c.statut === 'manquee' || (x.c.statut === 'prevue' && d < t)); /* une séance du jour encore prévue reste « à venir » */ }).length;
    const reactions = realisees.filter(x => /Réaction/.test(x.c.tolerance || '')).length;
    const changements = S.patients.flatMap(p => (p.historiqueProtocoles || []).filter(h => h.cycle > 1 && h.dateDebut >= debut && h.dateDebut <= fin));
    const parJour = {}; realisees.forEach(x => { parJour[x.c.dateReelle] = (parJour[x.c.dateReelle] || 0) + 1; });
    /* consommation : flacons (IV) et unités SC réellement utilisés, par présentation, toutes voies confondues */
    const conso = {}; S.patients.forEach(p => p.cures.forEach(c => { if (c.statut !== 'realisee' || !c.dateReelle || c.dateReelle < debut || c.dateReelle > fin) return; const pr = R.protoDeCure(p, c) || {}; const art = R.article(c.articleId) || R.article(pr.articleId); if (!art) return; const k = art.id; const o = conso[k] = conso[k] || { art, dci: art.dci, seances: 0, flacons: 0, prevus: 0, mg: 0, patients: new Set(), saisis: 0 }; o.seances++; o.flacons += R.flaconsCure(c); o.prevus += +c.flacons || 0; o.mg += +c.dose || 0; o.patients.add(p.id); if (c.flaconsUtilises != null) o.saisis++; }));
    return { conso: Object.values(conso).sort((a, b) => a.dci.localeCompare(b.dci) || a.art.unite - b.art.unite), realisees, prevues, manquees, aVenir, annulees, reports, cat, patients, nouveaux, controles, ctrlFaits, parMol, joursOuverts, capacite, passees, reactions, changements, parJour, tauxRealisation: passees ? Math.round(realisees.length / passees * 100) : null, occupation: capacite ? Math.round(prevues.length / capacite * 100) : null };
  };
  const CATS = { stock: 'Rupture de stock', patient: 'Indisponibilité du patient', clinique: 'État clinique / infection', capacite: 'Capacité de l’HDJ', autre: 'Autre' };
  R.CATS_REPORT = CATS;
  R.pages.activite = {
    render() {
      const r = R.ui.rapport; const { debut, fin } = R.periodeRapport(); const st = R.statsPeriode(debut, fin);
      const presets = [['mois', 'Ce mois'], ['precedent', 'Mois précédent'], ['15j', '15 derniers jours'], ['30j', '30 derniers jours'], ['trimestre', 'Trimestre'], ['annee', 'Année'], ['perso', 'Personnalisé']];
      const nbJ = R.diffDays(debut, fin) + 1; const semaines = [];
      for (let d = debut; d <= fin; d = R.addDays(d, nbJ > 45 ? 7 : 1)) { const f = nbJ > 45 ? R.addDays(d, 6) : d; let n = 0; for (let x = d; x <= f && x <= fin; x = R.addDays(x, 1)) n += st.parJour[x] || 0; semaines.push({ label: nbJ > 45 ? R.fmtDate(d, { day: 'numeric', month: 'short' }) : R.fmtDate(d, { day: 'numeric' }), n }); }
      const chart = R.columnChart({ labels: semaines.map(s => s.label), series: [{ name: 'Séances réalisées', color: 'var(--s1)', values: semaines.map(s => s.n) }], height: 200 });
      const tile = (label, val, sub, cls) => `<div class="kpi${cls ? ' ' + cls : ''}"><div class="label">${label}</div><div class="value">${val}</div><div class="sub">${sub || ''}</div></div>`;
      return `<div class="page-head no-print"><div><h1>Activité & rapports</h1><p>Performance de l’hôpital de jour sur la période choisie</p></div><div class="page-actions">${R.boutonsDoc('Imprimer le rapport')}</div></div>
      <section class="card mb16 no-print"><div class="card-body"><div class="row" style="gap:6px;flex-wrap:wrap">${presets.map(x => `<button type="button" class="btn sm${r.preset === x[0] ? ' primary' : ''}" data-action="rapportPreset" data-v="${x[0]}">${x[1]}</button>`).join('')}<span class="grow"></span><span class="badge accent">${R.fmtDateLong(debut)} → ${R.fmtDateLong(fin)} · ${nbJ} j</span></div>
        ${r.preset === 'perso' ? `<div class="mt16">${R.rangePicker({ debut, fin, mois: r.mois || debut.slice(0, 7) })}</div>` : ''}</div></section>
      <div class="rapport">
      <div class="doc-band print-only" style="display:none"><div><b>${R.esc(S.settings.etablissement)}</b>${R.esc(S.settings.service)} · ${R.esc(S.settings.unite)}</div><div class="r"><b>Rapport d’activité</b>${R.fmtDate(debut)} → ${R.fmtDate(fin)}<br>Édité le ${R.fmtDate(R.today())}</div></div>
      <div class="kpis">
        ${tile('Séances réalisées', st.realisees.length, `${st.patients.size} patients distincts · ${Object.keys(st.parMol).length} molécules`)}
        ${tile('Séances programmées', st.prevues.length, `${st.aVenir.length} encore à venir · ${st.occupation === null ? '—' : st.occupation + ' %'} de la capacité (${st.capacite} séances possibles sur ${st.joursOuverts} j ouverts)`)}
        ${tile('Taux de réalisation', st.tauxRealisation === null ? '—' : st.tauxRealisation + ' %', `${st.realisees.length} réalisées sur ${st.passees} passées`, st.tauxRealisation !== null && st.tauxRealisation < 85 ? 'attention' : '')}
        ${tile('Séances manquées', st.manquees.length, 'patient non venu ou séance non tracée', st.manquees.length ? 'attention' : '')}
        ${tile('Reports / déplacements', st.reports.length, Object.keys(st.cat).map(k => `${R.esc(CATS[k] || k)} : ${st.cat[k]}`).join(' · ') || 'aucun', st.cat.stock ? 'attention' : '')}
        ${tile('Nouveaux dossiers', st.nouveaux.length, `${st.changements.length} changement(s) de protocole · ${st.annulees.length} séance(s) annulée(s)`)}
        ${tile('Contrôles', `${st.ctrlFaits.length}<small>faits</small>`, `${st.controles.length} attendus sur la période`)}
        ${tile('Réactions à la perfusion', st.reactions, 'signalées lors des séances réalisées', st.reactions ? 'attention' : '')}
      </div>
      <div class="grid c21">
        <section class="card"><div class="card-head"><div><h2>Séances réalisées ${nbJ > 45 ? 'par semaine' : 'par jour'}</h2><div class="sub">${R.fmtDate(debut)} → ${R.fmtDate(fin)}</div></div></div><div class="card-body">${chart}</div></section>
        <section class="card"><div class="card-head"><h2>Par biothérapie</h2></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Molécule</th><th class="right">Séances</th><th class="right">Part</th></tr></thead><tbody>${Object.entries(st.parMol).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${R.esc(k)}</td><td class="right num">${v}</td><td class="right num">${Math.round(v / st.realisees.length * 100)} %</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Aucune séance</td></tr>'}</tbody></table></div></section>
      </div>
      <section class="card"><div class="card-head"><div><h2>Consommation de médicaments</h2><div class="sub">flacons (perfusions) et unités sous-cutanées réellement utilisés lors des séances réalisées · ${R.fmtDate(debut)} → ${R.fmtDate(fin)}</div></div></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Médicament</th><th>Présentation</th><th>Voie</th><th class="right">Séances</th><th class="right">Patients</th><th class="right">Flacons / unités utilisés</th><th class="right">Prévus</th><th class="right">Dose totale</th></tr></thead><tbody>${st.conso.map(o => `<tr><td class="name">${R.esc(o.dci)}</td><td class="small">${R.esc(o.art.libelle)}</td><td>${R.esc(o.art.voie)}</td><td class="right num">${o.seances}</td><td class="right num">${o.patients.size}</td><td class="right num"><b>${o.flacons}</b>${o.saisis < o.seances ? `<div class="xs muted">${o.seances - o.saisis} séance(s) sans saisie : prévu retenu</div>` : ''}</td><td class="right num">${o.prevus}</td><td class="right num">${o.mg ? (o.mg >= 10000 ? (o.mg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' g' : o.mg.toLocaleString('fr-FR') + ' mg') : '—'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucune séance réalisée sur la période</td></tr>'}${st.conso.length ? `<tr><td colspan="5"><b>Total</b></td><td class="right num"><b>${st.conso.reduce((a, o) => a + o.flacons, 0)}</b></td><td class="right num">${st.conso.reduce((a, o) => a + o.prevus, 0)}</td><td></td></tr>` : ''}</tbody></table></div></section>
      <div class="grid c11">
        <section class="card"><div class="card-head"><div><h2>Reports et déplacements</h2><div class="sub">motif catégorisé lors du déplacement d’une séance</div></div></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Patient</th><th>Séance</th><th>Catégorie</th><th>Motif</th></tr></thead><tbody>${st.reports.sort((a, b) => b.r.date.localeCompare(a.r.date)).map(x => `<tr><td class="nowrap">${R.fmtDate(x.r.date)}</td><td class="name">${R.esc(R.nomComplet(x.p))}</td><td>${R.esc(x.c.label)} <span class="muted small">(${R.fmtDate(x.r.de)} → ${R.fmtDate(x.c.datePrevue)})</span></td><td>${R.badge(x.r.categorie === 'stock' ? 'crit' : x.r.categorie === 'capacite' ? 'warn' : 'info', CATS[x.r.categorie] || x.r.categorie || 'Autre')}</td><td class="small">${R.esc(x.r.motif || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Aucun report sur la période</td></tr>'}</tbody></table></div></section>
        <section class="card"><div class="card-head"><div><h2>Séances manquées et non tracées</h2><div class="sub">à replanifier ou à régulariser</div></div></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Patient</th><th>Séance</th><th>Statut</th><th>Motif</th></tr></thead><tbody>${st.manquees.map(x => { const ab = (x.c.absences || []).filter(a => a.date >= debut && a.date <= fin).pop(); const replan = ab && x.c.statut !== 'manquee'; /* absence dans la période : sa date et son motif, puis ce que la séance est devenue */ return `<tr class="row-link" data-go="patient" data-params='${R.params({ id: x.p.id, tab: 'plan' })}'><td class="nowrap">${R.fmtDate(ab ? ab.date : x.c.datePrevue)}</td><td class="name">${R.esc(R.nomComplet(x.p))}</td><td>${R.esc(R.protoDeCure(x.p, x.c)?.dci || '')} ${R.esc(x.c.label)}</td><td>${replan ? R.badge('crit', 'Non venu') + ` <span class="xs muted">${x.c.statut === 'realisee' ? 'réalisée le ' + R.fmtDate(x.c.dateReelle) : x.c.statut === 'annulee' ? 'annulée ensuite' : x.c.statut === 'reportee' ? 'reportée, sans date' : 'replanifiée le ' + R.fmtDate(x.c.datePrevue)}</span>` : R.statutCureBadge(x.c)}</td><td class="small">${R.esc(ab ? (ab.motif || 'patient non venu') : (x.c.motif || 'non marquée réalisée'))}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">Aucune séance manquée</td></tr>'}</tbody></table></div></section>
      </div>
      <section class="card"><div class="card-head"><h2>Synthèse pour le rapport</h2></div><div class="card-body"><dl class="dl">
        <div><dt>Période</dt><dd>du ${R.fmtDateLong(debut)} au ${R.fmtDateLong(fin)} (${nbJ} jours, ${st.joursOuverts} jours d’ouverture)</dd></div>
        <div><dt>Activité</dt><dd>${st.realisees.length} séances de perfusion réalisées pour ${st.patients.size} patients ; ${st.prevues.length} programmées ; taux de réalisation ${st.tauxRealisation === null ? '—' : st.tauxRealisation + ' %'} ; occupation ${st.occupation === null ? '—' : st.occupation + ' %'} de la capacité théorique.</dd></div>
        <div><dt>Qualité</dt><dd>${st.manquees.length} séance(s) manquée(s), ${st.reports.length} report(s) dont ${st.cat.stock || 0} pour rupture de stock, ${st.reactions} réaction(s) à la perfusion, ${st.ctrlFaits.length} contrôle(s) réalisés sur ${st.controles.length} attendus.</dd></div>
        <div><dt>Consommation</dt><dd>${st.conso.length ? st.conso.map(o => `${R.esc(o.dci)} ${R.esc(o.art.unite + ' ' + o.art.uniteLib)} (${R.esc(o.art.voie)}) : ${o.flacons} ${o.art.voie === 'IV' ? 'flacon(s)' : 'unité(s)'}`).join(' ; ') : 'aucune séance réalisée'}.</dd></div>
        <div><dt>File active</dt><dd>${S.patients.filter(p => p.statut !== 'termine').length} patients suivis au ${R.fmtDate(R.today())}, ${st.nouveaux.length} nouveau(x) dossier(s) et ${st.changements.length} changement(s) de protocole sur la période.</dd></div></dl></div></section></div>`;
    }
  };
  Object.assign(R.actions, {
    alertesTout() { R.ui.alertesTout = !R.ui.alertesTout; R.render(); },
    rapportPreset(el) { R.ui.rapport.preset = el.dataset.v; R.ui.rapport.pick = null; if (el.dataset.v === 'perso' && !R.ui.rapport.debut) { const p = R.periodeRapport(); R.ui.rapport.debut = p.debut; R.ui.rapport.fin = p.fin; } R.render(); },
    rapportMois(el) { const r = R.ui.rapport; const base = r.mois || (r.debut || R.today()).slice(0, 7); const [y, m] = base.split('-').map(Number); r.mois = R.iso(new Date(y, m - 1 + (+el.dataset.delta), 1)).slice(0, 7); R.render(); },
    rapportJour(el) { const r = R.ui.rapport; const d = el.dataset.date; if (!r.pick) { r.pick = d; } else { const a = r.pick < d ? r.pick : d, b = r.pick < d ? d : r.pick; r.debut = a; r.fin = b; r.pick = null; r.preset = 'perso'; } R.render(); }
  });

  /* ---------- Impression et téléchargement du document affiché ---------- */
  R.boutonsDoc = lib => `<button class="btn" data-action="telechargerDoc" title="Fichier à ouvrir puis imprimer depuis l’ordinateur">${R.icon('download')}Télécharger</button><button class="btn primary" data-action="imprimer">${R.icon('print')}${lib || 'Imprimer / PDF'}</button>`;
  /* une impression bloquée (page intégrée dans un cadre isolé) échoue sans erreur : sans « beforeprint » on propose le fichier */
  R.imprimer = () => {
    let vu = false; const f = () => { vu = true; }; window.addEventListener('beforeprint', f);
    try { window.print(); } catch (e) {}
    setTimeout(() => { window.removeEventListener('beforeprint', f); if (vu) return;
      R.modal({ title: 'Impression directe indisponible ici', body: `<p style="margin:0 0 8px">Le navigateur bloque l’impression dans cette fenêtre (application affichée dans une page intégrée).</p><p class="small" style="margin:0">Téléchargez le document, ouvrez le fichier téléchargé puis <b>Ctrl+P</b> (ou <b>Cmd+P</b>) → imprimante ou « Enregistrer en PDF ».</p>`, foot: `<button type="button" class="btn" data-action="closeModal">Fermer</button><button type="button" class="btn primary" data-action="telechargerDoc">${R.icon('download')}Télécharger le document</button>` }); }, 500);
  };
  const CSS_EXPORT = `@media screen{body.export{background:#E4E9E7}.export-barre{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;padding:10px 16px;background:#fff;border-bottom:1px solid #DCE3E0;font-size:13px;color:#4E5E59}.export-barre button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:7px 18px;background:#1C6B62;color:#fff;cursor:pointer}.export .carnet-wrap{background:none;padding:22px 0 6px}.export-rapport{background:#fff;max-width:1180px;margin:22px auto;padding:24px 28px;box-shadow:0 8px 28px rgba(0,0,0,.12)}}
.export .rapport .print-only{display:flex!important}
@media print{.export-rapport{margin:0;padding:0}}`;
  const sansAccents = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  /* fichier HTML autonome du document affiché : styles et mode de rendu de l'application (sans doctype = même pagination), thème clair, zones modifiables figées */
  R.docExport = () => {
    const r = S.route || {}, par = r.params || {}; const p = par.id ? R.patient(par.id) : null;
    const type = r.page === 'impression' ? (par.quoi === 'seances' ? ['Seances', 'Historique des séances'] : ['Bilans', 'Bilans et contrôles']) : { carnet: ['Carnet', 'Carnet de suivi biothérapique'], carnetPatient: ['Carnet-patient', 'Carnet patient (français / arabe)'], compteRendu: ['Compte-rendu', 'Compte rendu de suivi'], activite: ['Rapport-activite', 'Rapport d’activité'] }[r.page];
    const root = type && document.querySelector(r.page === 'activite' ? '#app .rapport' : '#app .carnet-wrap'); if (!root) return null;
    const doc = root.cloneNode(true);
    doc.querySelectorAll('.no-print, button, script').forEach(x => x.remove());
    doc.querySelectorAll('[data-placeholder]').forEach(x => { if (x.textContent.trim()) return; const sec = x.closest('.cr-sec'); x.remove(); if (sec && !sec.querySelector('li, table, .doc-box')) sec.remove(); }); /* zone facultative laissée vide : rien à imprimer */
    doc.querySelectorAll('*').forEach(x => { [...x.attributes].forEach(a => { if (/^data-|^(contenteditable|spellcheck|tabindex|title)$/.test(a.name) || (a.name === 'role' && /^(button|link)$/.test(a.value))) x.removeAttribute(a.name); }); x.classList.remove('cr-edit', 'vide', 'plie', 'pli-titre'); if (x.getAttribute('class') === '') x.removeAttribute('class'); });
    const titre = type[1] + (p ? ' — ' + R.nomComplet(p) : ''); const css = [...document.querySelectorAll('style')].filter(s => !root.contains(s)).map(s => s.textContent).join('\n'); /* le <style> interne au document reste dans la copie */
    const polices = window.RYZE_FONTS_CSS ? `<style>${window.RYZE_FONTS_CSS}</style>` : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">'; /* document autonome : polices intégrées si fonts/fonts-embed.js est chargé (poste hors ligne), sinon Google Fonts */
    const html = `${document.compatMode === 'CSS1Compat' ? '<!doctype html>' : ''}<html lang="fr" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${R.esc(titre)}</title>${polices}<style>${css}\n${CSS_EXPORT}</style></head><body class="export"><div class="export-barre no-print"><button type="button" onclick="window.print()">Imprimer</button><span>${R.esc(titre)} — exporté de Ryze le ${R.fmtDate(R.today())}. Ctrl+P (ou Cmd+P) : imprimante ou « Enregistrer en PDF ».</span></div>${r.page === 'activite' ? `<div class="export-rapport">${doc.outerHTML}</div>` : doc.outerHTML}</body></html>`;
    return { html, nom: ['Ryze', type[0], p && sansAccents(p.nom), p && sansAccents(p.prenom), R.today()].filter(Boolean).join('_') + '.html', droit: r.page === 'activite' ? 'dashboard' : 'carnet' };
  };
  /* dernier recours si le téléchargement est impossible ou peut-être bloqué : le contenu à copier dans un fichier */
  R.exportTexte = (nom, txt, lance) => { R.modal({ title: 'Télécharger le document', wide: true, body: `<p class="small" style="margin:0 0 8px">${lance ? `Le fichier <b>${R.esc(nom)}</b> a été proposé au téléchargement : ouvrez-le puis <b>Ctrl+P</b> (ou <b>Cmd+P</b>). Si aucun fichier n’apparaît (téléchargements bloqués dans cette fenêtre), copiez` : `Le téléchargement n’a pas pu démarrer. Copiez`} le contenu ci-dessous dans un fichier texte nommé <b>${R.esc(nom)}</b>, ouvrez-le dans le navigateur puis imprimez.</p><textarea id="export-txt" readonly style="min-height:160px;font-family:'IBM Plex Mono',monospace;font-size:11px"></textarea>`, foot: `<button type="button" class="btn" data-action="copierExport">Copier</button><button type="button" class="btn primary" data-action="closeModal">Fermer</button>` }); const ta = document.getElementById('export-txt'); if (ta) ta.value = txt; };
  /* charge une seule fois, au moment d'un export, les polices intégrées (1,7 Mo) ; continue sans elles si le fichier manque */
  R.chargerPolicesExport = cb => { if (window.RYZE_FONTS_CSS || R.ui.policesExportKo) { cb(); return; } const sc = document.createElement('script'); sc.src = 'fonts/fonts-embed.js'; sc.onload = () => cb(); sc.onerror = () => { R.ui.policesExportKo = true; cb(); }; document.head.appendChild(sc); };
  R.telechargerDoc = () => R.chargerPolicesExport(() => {
    const d = R.docExport(); if (!d) { R.toast('Aucun document à télécharger sur cette page', 'crit'); return; }
    if (!R.can(d.droit, 'r')) { R.toast('Action réservée : accès au document requis', 'crit'); return; }
    try { const url = URL.createObjectURL(new Blob([d.html], { type: 'text/html;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = d.nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { R.exportTexte(d.nom, d.html, false); return; }
    let cadre = false; try { cadre = window.self !== window.top; } catch (e) { cadre = true; }
    if (cadre) { R.exportTexte(d.nom, d.html, true); return; } /* dans un cadre, un téléchargement bloqué ne se détecte pas */
    R.closeModal(); R.toast('Fichier téléchargé : ouvrez-le puis imprimez (Ctrl+P)', 'good');
  });

  /* ---------- Actions globales ---------- */
  Object.assign(R.actions, {
    loginCode(f, fd) { if (R.ui.baseIllisible && !R.ui.baseIllisibleAccepte) { R.toast('Téléchargez d’abord vos données, ou choisissez « Continuer avec une base neuve »', 'crit'); return; } const code = String(fd.get('code') || '').trim().toUpperCase(); const u = S.users.find(x => x.actif && String(x.code).toUpperCase() === code); if (!u) { R.toast('Code inconnu ou désactivé', 'crit'); return; } u.derniere = R.today(); S.user = u.id; if (S.codeNeuf && String(u.code) === S.codeNeuf) delete S.codeNeuf; S.route = { page: 'dashboard', params: {} }; R.ui.w = null; R.ui.cfgEdit = null; R.ui.synthOpen = {}; R.ui.filtres = {}; R.saveUi(); R.save(); R.render(); if (R.fs.handle && R.can('equipe', 'w')) R.fs.reprendre(true).then(ok => { if (ok) { R.fs.ecrire(); R.toast(`Sauvegarde automatique active dans « ${R.fs.etat.nom} »`, 'good'); } R.render(); }); },
    loginFill(el) { const i = document.getElementById('login-code'); i.value = el.dataset.code; i.form.requestSubmit(); },
    logout() { S.user = null; S.route = { page: 'dashboard', params: {} }; R.ui.w = null; R.ui.cfgEdit = null; R.ui.synthOpen = {}; R.ui.filtres = {}; R.saveUi(); R.save(); R.render(); },
    closeModal() { R.closeModal(); },
    imprimer() { R.imprimer(); }, telechargerDoc() { R.telechargerDoc(); },
    toggleRail() { const r = document.getElementById('rail'); r.classList.toggle('open'); let b = document.getElementById('rail-backdrop'); if (r.classList.contains('open')) { if (!b) { b = document.createElement('div'); b.id = 'rail-backdrop'; b.className = 'rail-backdrop'; b.setAttribute('data-action', 'toggleRail'); document.body.appendChild(b); } } else if (b) b.remove(); },
    globalSearch(el) {
      const q = el.value.trim().toLowerCase(); const box = document.getElementById('search-results'); if (q.length < 2) { box.innerHTML = ''; return; }
      const res = S.patients.filter(p => (p.nom + ' ' + p.prenom + ' ' + p.ipp).toLowerCase().includes(q)).slice(0, 6);
      box.innerHTML = res.length ? `<div class="search-results">${res.map(p => `<button type="button" data-go="patient" data-params='${R.params({ id: p.id })}'><div class="avatar" style="width:26px;height:26px;font-size:10px">${R.initials(p.prenom, p.nom)}</div><div><b>${R.esc(R.nomComplet(p))}</b> <span class="mono muted">${R.esc(p.ipp)}</span></div><span class="muted small" style="margin-left:auto">${R.esc(R.proto(p.protocoleId)?.dci || '')}</span></button>`).join('')}</div>` : `<div class="search-results"><div class="empty" style="padding:14px">Aucun patient</div></div>`;
    },
    calPicker(el) { const pk = R.ui.cal.picker; R.ui.cal.picker = pk && pk.nav === el.dataset.nav ? null : { nav: el.dataset.nav, annee: +el.dataset.annee }; R.render(); },
    calPickerAnnee(el) { if (R.ui.cal.picker) { R.ui.cal.picker.annee += +el.dataset.delta; R.render(); } },
    calPickerFermer() { R.ui.cal.picker = null; R.render(); },
    pickPatient(el) {
      const q = el.value.trim().toLowerCase(); const box = el.parentElement.querySelector('.picker-results'); const hidden = el.parentElement.querySelector('input[type=hidden]'); hidden.value = '';
      if (q.length < 1) { box.innerHTML = ''; return; }
      const res = S.patients.filter(p => (p.nom + ' ' + p.prenom + ' ' + p.ipp).toLowerCase().includes(q)).sort((a, b) => a.nom.localeCompare(b.nom)).slice(0, 8);
      box.innerHTML = res.length ? res.map(p => `<button type="button" data-action="pickPatientChoisir" data-id="${R.esc(p.id)}" data-label="${R.esc(R.nomComplet(p) + ' — ' + p.ipp)}"><span class="avatar" style="width:24px;height:24px;font-size:10px">${R.initials(p.prenom, p.nom)}</span><b>${R.esc(R.nomComplet(p))}</b> <span class="mono muted small">${R.esc(p.ipp)}</span> <span class="muted small">· ${R.esc(R.proto(p.protocoleId)?.dci || '')}</span></button>`).join('') : '<div class="empty" style="padding:10px">Aucun patient</div>';
    },
    pickPatientChoisir(el) { const box = el.closest('.picker'); box.querySelector('input[type=hidden]').value = el.dataset.id; box.querySelector('.picker-input').value = el.dataset.label; box.querySelector('.picker-results').innerHTML = ''; },
    secoursAccueil() { S.route = { page: 'dashboard', params: {} }; R.save(); R.render(); }, secoursRecharger() { location.reload(); },
    exporterBase() { if (!R.can('equipe', 'w')) { R.toast('Connectez-vous avec un accès complet pour exporter', 'crit'); return; } S.derniereSauvegarde = R.today(); R.save(); const txt = JSON.stringify(S); const nom = `ryze-sauvegarde-${R.today()}.json`; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {} R.modal({ title: 'Export de la base', body: `<p class="small" style="margin:0 0 8px">Le fichier <b>${nom}</b> a été proposé au téléchargement. Si rien ne s’est passé, copiez le contenu ci-dessous dans un fichier texte.</p><textarea id="export-txt" readonly style="min-height:160px;font-family:'IBM Plex Mono',monospace;font-size:11px"></textarea>`, foot: `<button type="button" class="btn" data-action="copierExport">Copier</button><button type="button" class="btn primary" data-action="closeModal">Fermer</button>` }); const ta = document.getElementById('export-txt'); if (ta) ta.value = txt; R.render(); },
    copierExport() { const t = document.getElementById('export-txt'); t.select(); try { document.execCommand('copy'); R.toast('Copié dans le presse-papiers', 'good'); } catch (e) { R.toast('Sélectionnez le texte et copiez-le manuellement', 'warn'); } },
    /* import d'un fichier Ryze : soit ajout des seuls dossiers absents (codes, protocoles, paramètres et dossiers actuels conservés), soit remplacement complet (restauration d'une sauvegarde) */
    importerBase() { if (!R.can('equipe', 'w')) { R.toast('Réservé à l’accès complet', 'crit'); return; } R.modal({ title: 'Importer un fichier Ryze', body: `<p class="small" style="margin:0 0 8px">Choisissez un fichier exporté par Ryze <b>ou</b> collez son contenu (texte copié depuis « Exporter la base »), puis la façon de l’importer.</p><input type="file" id="import-file" accept="application/json,.json" aria-label="Fichier exporté par Ryze"><textarea id="import-txt" aria-label="Contenu exporté à coller" placeholder="…ou collez ici le contenu exporté (commence par {&quot;version&quot;:…)" style="min-height:90px;margin-top:8px;font-family:'IBM Plex Mono',monospace;font-size:11px"></textarea><div class="stack" style="margin-top:12px;gap:8px"><label class="row" style="gap:8px;align-items:flex-start;cursor:pointer"><input type="radio" name="import-mode" value="ajouter" checked style="margin-top:3px"><span><b>Ajouter seulement les dossiers absents</b><br><span class="small ink2">Vos codes d’accès, protocoles, paramètres et dossiers actuels sont conservés ; seuls les dossiers du fichier qui n’existent pas encore ici sont ajoutés. Un récapitulatif est affiché avant.</span></span></label><label class="row" style="gap:8px;align-items:flex-start;cursor:pointer"><input type="radio" name="import-mode" value="remplacer" style="margin-top:3px"><span><b>Remplacer toute la base</b><br><span class="small ink2">Restauration d’une sauvegarde : <b>toutes les données actuelles sont remplacées</b> par celles du fichier.</span></span></label></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="button" class="btn primary" data-action="importerBaseOk">Continuer</button>` }); },
    importerBaseOk() {
      if (!R.can('equipe', 'w')) return; const f = (document.getElementById('import-file') || {}).files ? document.getElementById('import-file').files[0] : null; const colle = ((document.getElementById('import-txt') || {}).value || '').trim();
      if (!f && !colle) { R.toast('Choisissez un fichier ou collez le contenu exporté', 'crit'); return; }
      if (f && colle) { R.toast('Choisissez un fichier OU collez le contenu, pas les deux : videz la zone de texte ou retirez le fichier', 'warn'); return; }
      const mode = (document.querySelector('input[name="import-mode"]:checked') || {}).value || 'ajouter';
      /* même traitement pour un fichier choisi ou un texte collé (poste où les fichiers sont bloqués) */
      const traiter = (texte, nom) => {
        let s; try { s = JSON.parse(texte); if (!s || !Array.isArray(s.patients) || !Array.isArray(s.users) || !s.settings || typeof s.settings !== 'object' || !Array.isArray(s.protocoles)) throw new Error('format'); } catch (e) { R.toast(f ? 'Fichier invalide' : 'Texte collé invalide : copiez tout le contenu affiché par « Exporter la base »', 'crit'); return; }
        if (+s.version > VERSION) { R.toast('Ce fichier vient d’une version plus récente de Ryze : mettez à jour l’application avant de l’importer', 'crit'); return; }
        try { s = migrer(s); } catch (e) { R.toast('Fichier impossible à mettre à niveau : ' + (e && e.message), 'crit'); return; }
        /* identifiants insérés tels quels dans les attributs HTML (data-pid, data-id…) : refusés s'ils sortent du format produit par l'application (R.uid, démonstration) ; numéros de séance entiers */
        { const ID = /^[A-Za-z0-9_-]{1,64}$/, bad = new Set(); const walk = (o, chemin) => { if (Array.isArray(o)) return o.forEach(x => walk(x, chemin)); if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === 'object') walk(v, chemin + '.' + k); else if ((k === 'id' || /Id$/.test(k)) && v != null && v !== '' && !ID.test(String(v))) bad.add(chemin + '.' + k); } }; walk(s.patients, 'patients'); walk(s.rdv, 'rdv'); walk(s.users, 'users'); walk(s.protocoles, 'protocoles'); if (s.user != null && !ID.test(String(s.user))) bad.add('user'); s.patients.forEach(p => (p.cures || []).forEach(c => { if (c && c.n != null && !Number.isInteger(+c.n)) bad.add('patients.cures.n'); })); if (bad.size) { R.toast((f ? 'Fichier refusé' : 'Texte collé refusé') + ' : identifiants invalides (' + [...bad].slice(0, 4).join(', ') + ')', 'crit'); return; } }
        if (mode === 'remplacer' && !(s.users || []).some(u => u && u.actif && u.role === 'complet')) { R.toast('Ce fichier ne contient aucun accès complet actif : le remplacer bloquerait l’administration de la base (Équipe, export, import)', 'crit'); return; }
        R.ui.importBase = { s, nom, mode };
        if (mode === 'remplacer') { R.modal({ title: 'Remplacer toute la base ?', body: `<p style="margin:0 0 8px">${f ? `Le fichier <b>${R.esc(nom)}</b>` : 'Le contenu collé'} contient ${s.patients.length} dossier(s), ${(s.protocoles || []).length} protocole(s) et ${s.users.length} code(s) d’accès.</p><p class="small" style="margin:0"><b>Vos ${S.patients.length} dossier(s), protocoles, codes d’accès et paramètres actuels seront remplacés.</b> Exportez d’abord votre base si vous avez un doute.</p>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="button" class="btn danger" data-action="importerRemplacerOk">Remplacer toute la base</button>` }); return; }
        const plan = R.planImportAjout(s); R.ui.importBase.plan = plan;
        const li = (l, cls) => l.length ? `<ul class="doc-list" style="margin:4px 0 10px;padding-left:18px">${l.map(x => `<li${cls ? ` class="${cls}"` : ''}>${x}</li>`).join('')}</ul>` : '';
        R.modal({ title: 'Ajouter les dossiers absents', wide: true, body: `<p style="margin:0 0 8px">${f ? `Fichier <b>${R.esc(nom)}</b>` : 'Contenu collé'} : ${s.patients.length} dossier(s).</p>
          <div><b>${plan.ajouts.length} à ajouter</b></div>${li(plan.ajouts.map(x => `${R.esc(R.nomComplet(x.q))} · n° ${R.esc(x.q.ipp || '—')} · ${R.esc((R.proto(x.q.protocoleId) || {}).dci || x.q.protocoleId || '—')}${x.medecinRemplace ? ' <span class="small ink2">(médecin référent inconnu ici : vous serez indiqué)</span>' : ''}`))}
          <div><b>${plan.presents.length} déjà présent(s)</b> <span class="small ink2">— conservés tels quels, rien n’est modifié</span></div>${li(plan.presents.map(x => `${R.esc(R.nomComplet(x.q))} <span class="small ink2">(${x.motif})</span>`))}
          <div><b>${plan.ignores.length} ignoré(s)</b></div>${li(plan.ignores.map(x => `${R.esc(R.nomComplet(x.q))} <span class="small ink2">(${x.motif})</span>`))}
          ${plan.rdv.length ? `<p class="small ink2" style="margin:0">${plan.rdv.length} rendez-vous de ces dossiers seront aussi ajoutés.</p>` : ''}
          <p class="small ink2" style="margin:8px 0 0">Codes d’accès, protocoles, paramètres et dossiers actuels : inchangés.</p>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="button" class="btn primary" data-action="importerAjoutOk"${plan.ajouts.length ? '' : ' disabled'}>Ajouter ${plan.ajouts.length} dossier(s)</button>` });
      };
      if (f) { const rd = new FileReader(); rd.onload = () => traiter(rd.result, f.name); rd.readAsText(f); } else traiter(colle, 'texte collé');
    },
    fsChoisir() { if (!R.fs.dispo()) { R.toast('Sauvegarde automatique non disponible dans ce navigateur : utilisez Chrome ou Edge sur le poste de travail', 'crit'); return; } R.fs.choisir().then(ok => { R.toast(ok ? `Sauvegarde automatique activée dans « ${R.fs.etat.nom} »` : 'Dossier choisi, mais l’écriture a échoué : ' + R.fs.etat.erreur, ok ? 'good' : 'crit'); R.render(); }).catch(e => { if (!(e && e.name === 'AbortError')) R.toast('Impossible de choisir un dossier ici : ' + ((e && e.message) || ''), 'crit'); }); },
    fsReprendre() { R.fs.reprendre(true).then(ok => { if (ok) R.fs.ecrire().then(() => R.render()); R.toast(ok ? 'Sauvegarde automatique réactivée' : 'Autorisation refusée : choisissez à nouveau le dossier', ok ? 'good' : 'warn'); R.render(); }); },
    fsEcrire() { R.fs.ecrire().then(ok => { R.toast(ok ? `Base enregistrée dans « ${R.fs.etat.nom} »` : 'Écriture impossible : ' + R.fs.etat.erreur, ok ? 'good' : 'crit'); R.render(); }); },
    fsArreter() { R.fs.arreter().then(() => { R.toast('Sauvegarde automatique arrêtée (les fichiers déjà écrits sont conservés)', 'warn'); R.render(); }); },
    importerRemplacerOk() { if (!R.can('equipe', 'w')) return; const b = R.ui.importBase; if (!b || b.mode !== 'remplacer') return; if (!(b.s.users || []).some(u => u && u.actif && u.role === 'complet')) return; remplacer(b.s); S.user = null; S.dirty = true; S.modifieLe = new Date().toISOString(); R.ui.importBase = null; R.save(); R.closeModal(); R.render(); R.toast('Base importée : reconnectez-vous', 'good'); },
    importerAjoutOk() {
      if (!R.can('equipe', 'w')) return; const b = R.ui.importBase; if (!b || !b.plan || !b.plan.ajouts.length) return; const plan = b.plan;
      plan.ajouts.forEach(x => { const q = JSON.parse(JSON.stringify(x.q)); if (x.medecinRemplace) q.medecinId = S.user; S.patients.push(q); });
      S.rdv = S.rdv || []; plan.rdv.forEach(r => S.rdv.push(JSON.parse(JSON.stringify(r))));
      R.journal(`Import en ajout — ${plan.ajouts.length} dossier(s) ajouté(s) depuis ${b.nom}${plan.presents.length ? `, ${plan.presents.length} déjà présent(s)` : ''}${plan.ignores.length ? `, ${plan.ignores.length} ignoré(s)` : ''}`);
      R.ui.importBase = null; R.touch(); R.closeModal(); R.go('patients'); R.toast(`${plan.ajouts.length} dossier(s) ajouté(s)`, 'good');
    },
    resetDemo() { if (S.dirty && !R.can('equipe', 'w')) return; R.reset(); }, viderDemo() { if (S.dirty && !R.can('equipe', 'w')) return; R.vider(); },
    baseNeuve() { R.ui.baseIllisibleAccepte = true; R.render(); R.toast('Base neuve : pensez à réimporter vos données une fois l’application mise à jour', 'warn'); },
    telechargerBak() { let raw = R.ui.rawIllisible || null; try { raw = raw || localStorage.getItem(KEY + '.bak'); } catch (e) {} if (!raw) { R.toast('Aucune copie trouvée', 'crit'); return; } try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); a.download = `ryze-copie-${R.today()}.json`; document.body.appendChild(a); a.click(); a.remove(); R.toast('Copie téléchargée', 'good'); } catch (e) { R.toast('Téléchargement impossible', 'crit'); } },
    viderDemoConfirm() { if (S.dirty && !R.can('equipe', 'w')) { R.toast('Réservé à l’accès complet', 'crit'); return; } R.confirmer('Démarrer avec une base vide ?', `${S.dirty && S.patients.length ? `<b>Les ${S.patients.length} dossier(s) et tous les rendez-vous de cette base seront définitivement supprimés.</b> Exportez d’abord la base (Paramètres → Exporter).` : 'Les patients et rendez-vous de démonstration seront supprimés.'} Les protocoles, les paramètres et les codes d’accès sont conservés, sauf les codes de démonstration : ils sont désactivés et, si vous en utilisez un, un nouveau code d’accès complet vous sera donné.`, 'viderDemo'); }
  });

  /* ---------- Délégation d'événements ---------- */
  /* actions réservées : vérifiées ici quel que soit le bouton qui les déclenche */
  let pointeurDebut = null; document.addEventListener('pointerdown', e => { pointeurDebut = e.target; }, true);
  document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#modal-root form')) R.ui.modalSale = true; }, true);
  document.addEventListener('change', e => { if (e.target.closest && e.target.closest('#modal-root form')) R.ui.modalSale = true; }, true);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('tabindex') === '0' && (e.target.dataset.go || e.target.dataset.action) && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); e.target.click(); } });
  const DROITS = { userSave: ['equipe', 'w'], userRole: ['equipe', 'w'], userToggle: ['equipe', 'w'], userSupprimer: ['equipe', 'w'], userSupprimerOk: ['equipe', 'w'], userCode: ['equipe', 'w'], settingsSave: ['equipe', 'w'], protoEditer: ['protocoles', 'w'], protoSupprimer: ['protocoles', 'w'], protoSupprimerOk: ['protocoles', 'w'], protoArchiver: ['protocoles', 'w'], protoReactiver: ['protocoles', 'w'], protoSave: ['protocoles', 'w'], protoAddStep: ['protocoles', 'w'], protoDelStep: ['protocoles', 'w'], protoAddVariante: ['protocoles', 'w'], patientModifier: ['dossier', 'w'], patientSave: ['dossier', 'w'], protoChanger: ['dossier', 'w'], chgValider: ['dossier', 'w'], protoChangerSave: ['dossier', 'w'], posologieModifier: ['dossier', 'w'], posologieSave: ['dossier', 'w'], patientTerminer: ['dossier', 'w'], patientTerminerSave: ['dossier', 'w'], patientRouvrir: ['dossier', 'w'], cycleEditer: ['dossier', 'w'], cycleSave: ['dossier', 'w'], planModifier: ['dossier', 'w'], planSave: ['dossier', 'w'], wCreate: ['dossier', 'w'], wCreatePrint: ['dossier', 'w'], patientSuspendre: ['dossier', 'w'], patientSuspendreSave: ['dossier', 'w'], patientReprendre: ['dossier', 'w'], prolongerPlan: ['dossier', 'w'], cureModifier: ['dossier', 'w'], cureModifierSave: ['dossier', 'w'], cureAjouter: ['dossier', 'w'], cureAjouterSave: ['dossier', 'w'], survAjouter: ['dossier', 'w'], survAjouterSave: ['dossier', 'w'], bilanAjouter: ['cures', 'w'], bilanAjoutOuvrir: ['cures', 'w'], bilanCorriger: ['cures', 'w'], wHomonyme: ['dossier', 'w'], wAtcd: ['dossier', 'w'], wPremiereOn: ['dossier', 'w'], wPremiere: ['dossier', 'w'], retroOuvrir: ['dossier', 'w'], retroModifier: ['dossier', 'w'], retroModifierW: ['dossier', 'w'], retroSupprimerW: ['dossier', 'w'], retroChamp: ['dossier', 'w'], retroGenerer: ['dossier', 'w'], retroEcart: ['dossier', 'w'], retroAjouterLigne: ['dossier', 'w'], retroSupprimerLigne: ['dossier', 'w'], retroLigne: ['dossier', 'w'], retroEnregistrer: ['dossier', 'w'], retroSupprimer: ['dossier', 'w'], retroSupprimerOk: ['dossier', 'w'], bilanSupprimer: ['cures', 'w'], survAnnuler: ['dossier', 'w'], survAnnulerConfirm: ['dossier', 'w'], survRetablir: ['dossier', 'w'], rdvAjouter: ['planning', 'w'], rdvSave: ['planning', 'w'], rdvSupprimer: ['planning', 'w'], rdvSupprimerOk: ['planning', 'w'], importerBase: ['equipe', 'w'], importerBaseOk: ['equipe', 'w'], importerRemplacerOk: ['equipe', 'w'], importerAjoutOk: ['equipe', 'w'], noteModifier: ['equipe', 'w'], noteModifierSave: ['equipe', 'w'], noteSupprimer: ['equipe', 'w'], noteSupprimerOk: ['equipe', 'w'], fsChoisir: ['equipe', 'w'], fsReprendre: ['equipe', 'w'], fsEcrire: ['equipe', 'w'], fsArreter: ['equipe', 'w'], cureSupprimer: ['equipe', 'w'], cureSupprimerOk: ['equipe', 'w'], cycleSupprimer: ['equipe', 'w'], cycleSupprimerOk: ['equipe', 'w'], cureAjouterDose: ['dossier', 'w'], exporterBase: ['equipe', 'w'], crChamp: ['dossier', 'w'], crRegenerer: ['dossier', 'w'], crRestaurer: ['dossier', 'w'] };
  R.autorise = nom => { const d = DROITS[nom]; if (!d || R.can(d[0], d[1])) return true; R.toast('Action réservée à l’accès complet', 'crit'); return false; };
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-go],[data-action]');
    if (!t) { if (e.target.classList.contains('modal-overlay') && pointeurDebut === e.target) R.fermerModalDemande(); return; }
    if (t.dataset.go) { let p = {}; try { p = t.dataset.params ? JSON.parse(t.dataset.params) : {}; } catch (err) {} R.go(t.dataset.go, p); return; }
    const fn = R.actions[t.dataset.action]; if (fn && R.autorise(t.dataset.action)) fn(t, e);
  });
  document.addEventListener('submit', e => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); const fn = R.actions[f.dataset.form]; if (fn && R.autorise(f.dataset.form)) fn(f, new FormData(f)); });
  document.addEventListener('change', e => { const t = e.target.closest('[data-change]'); if (t) { const fn = R.actions[t.dataset.change]; if (fn && R.autorise(t.dataset.change)) fn(t, e); } });
  document.addEventListener('input', e => { const t = e.target.closest('[data-input]'); if (t) { const fn = R.actions[t.dataset.input]; if (fn) fn(t, e); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { R.fermerModalDemande(); return; } if (e.key !== 'Tab') return; /* fenêtre ouverte : Tab et Maj+Tab restent dans la fenêtre */ const m = document.querySelector('#modal-root .modal'); if (!m) return; const f = [...m.querySelectorAll('button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, a[href], [contenteditable="true"], [tabindex="0"]')].filter(x => x.getClientRects().length); if (!f.length) { e.preventDefault(); return; } const a = f[0], z = f[f.length - 1], cur = document.activeElement; if (!m.contains(cur)) { e.preventDefault(); (e.shiftKey ? z : a).focus(); } else if (e.shiftKey && cur === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); } });
  document.addEventListener('mousemove', e => { const tip = document.getElementById('tooltip'); const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px'; });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) { const b = document.getElementById('search-results'); if (b) b.innerHTML = ''; } });

  window.addEventListener('DOMContentLoaded', R.render);
  if (document.readyState !== 'loading') setTimeout(R.render, 0);
})(window.RYZE);
