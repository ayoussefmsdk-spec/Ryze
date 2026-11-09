/* =====================================================================
   HDJ — video/scenes.js : les scènes des films de démonstration
   (docs/VIDEO-SCENARIO.md), communes à la version longue (video/longue.js)
   et à la version courte (video/courte.js).

   Chaque scène est une fonction async (st, v) :
     st : le studio ouvert par studio.ouvrir() ;
     v  : { variante: 'longue' | 'courte', ... } — la variante choisit les
          durées, les sous-titres et les passages montrés.
   Les scènes n'utilisent que l'API du studio (et les sélecteurs de
   l'application). Base vitrine fictive (demo/vitrine.json), code AAA111,
   horloge figée au lundi 9/11/2026 10:00. Tous les textes saisis sont
   neutres et fictifs.
   ===================================================================== */
'use strict';

const W = 1920, H = 1080;
/* zone utile d'une image : sous la barre du haut, au-dessus du sous-titre (bas gauche) */
const ZONE = { haut: 74, bas: H - 236 };

const ETAB = {
  service: 'Unité de Gastro-entérologie, Hépatologie et Nutrition Pédiatrique — Service de Pédiatrie 3 — Hôpital d’Enfants Abderrahim El Harouchi — CHU Ibn Rochd, Casablanca',
  ligne: 'Unité de Gastro-entérologie, Hépatologie et Nutrition Pédiatrique · Hôpital d’Enfants Abderrahim El Harouchi · CHU Ibn Rochd, Casablanca'
};
const HORLOGE = '2026-11-09T10:00:00';
const CODE = 'AAA111';
const longue = v => !v || v.variante !== 'courte';

/* ---------------------------------------------------------------------
   Outils de mise en scène (au-dessus de l'API du studio)
   --------------------------------------------------------------------- */

/* identifiant d'un patient de la base vitrine par « Prénom NOM » */
async function idDe(st, nom) {
  const id = await st.evaluer(n => { const p = window.RYZE.S.patients.find(x => `${x.prenom} ${x.nom}` === n); return p ? p.id : null; }, nom);
  if (!id) throw new Error('Patient introuvable dans la base : ' + nom);
  return id;
}

/* cadrer : amène l'élément dans la zone utile (défilement doux si besoin) puis zoom
   centré sur lui, au-dessus du sous-titre. echelle absente : ajustée à l'élément (≤ 1,8). */
async function cadrer(st, cible, echelle, o = {}) {
  if (st.cam.s > 1.001) await st.dezoom(o.dezoom || 0.5);
  const haut = o.haut || ZONE.haut, bas = o.bas || ZONE.bas;
  let b = await st.boite(cible);
  if (!o.fixe) {
    const yZ = (haut + bas) / 2, delta = b.height > bas - haut - 20 ? b.y - haut - 12 : (b.y + b.height / 2) - yZ;
    if (Math.abs(delta) > 30) { await st.defiler(delta, { conteneur: typeof cible === 'string' ? cible : null, duree: o.dureeDefil }); b = await st.boite(cible); }
  }
  if (echelle == null) echelle = Math.min(1.8, (W * 0.92) / Math.max(1, b.width), (bas - haut - 16) / Math.max(1, b.height));
  echelle = Math.max(1, Math.min(1.8, echelle));
  /* centre de la caméra : l'élément est centré dans la zone utile (ou sur o.ancre : 0 = haut de l'élément en haut de zone) */
  const yZ = (haut + bas) / 2, uc = { x: b.x + b.width / 2 + (o.dx || 0), y: b.y + b.height / 2 };
  let cy = uc.y + H / (2 * echelle) - yZ / echelle;
  if (o.hautEnHaut) cy = b.y + H / (2 * echelle) - (haut + 8) / echelle;
  if (o.curseur !== false) await st.deplacer(Math.min(W - 60, b.x + Math.min(b.width * 0.5, 260)), Math.min(bas - 20, Math.max(haut + 10, b.y + Math.min(b.height / 2, 60))), o.dureeCurseur);
  await st.zoom({ x: uc.x, y: cy }, echelle, o.duree || 1.0);
}

/* pose data-vs="nom" sur l'élément renvoyé par fn (sélection par le texte, sans rien modifier à l'écran) */
async function marquer(st, nom, fn, arg) {
  const h = await st.page.evaluateHandle(fn, arg);
  const el = h.asElement(); if (!el) throw new Error('Élément introuvable pour ' + nom);
  await el.evaluate((e, n) => { document.querySelectorAll(`[data-vs="${n}"]`).forEach(x => x.removeAttribute('data-vs')); e.setAttribute('data-vs', n); }, nom);
  return `[data-vs="${nom}"]`;
}

/* ouverture de la page à l'heure du film, connexion éventuelle en coulisse */
async function preparer(st, o = {}) {
  await st.coulisse(async p => {
    await p.waitForSelector('#login-code, .shell');
    if (o.connecter) { await p.fill('#login-code', CODE); await p.click('form[data-form="loginCode"] button[type=submit]'); await p.waitForSelector('.shell'); await st.allerA('dashboard'); }
  });
}

/* ---------------------------------------------------------------------
   0 · Ouverture
   --------------------------------------------------------------------- */
async function ouverture(st, v) {
  st.cacherCurseur();
  await st.carton({ titre: 'HDJ', sousTitre: 'Gestion des biothérapies · Hôpital de jour', lignes: [ETAB.ligne], duree: longue(v) ? 7.5 : 4.4, sortie: 0.5 });
  st.montrerCurseur();
}

/* ---------------------------------------------------------------------
   1 · Connexion (version longue)
   --------------------------------------------------------------------- */
async function connexion(st) {
  st.chapitre(1, 'Connexion');
  await st.attendre(0.6);
  await st.sousTitre('Un code personnel par soignant', 'deux niveaux d’accès : médecins et équipe de l’HDJ');
  await st.vers('.login-etab', 1.0);
  await cadrer(st, '.login-box', 1.35, { fixe: true, curseur: false, duree: 1.1 });
  await st.attendre(2.6);
  await st.dezoom(0.8);
  await st.connexion({ caracteresParSeconde: 5 });
  await st.attendre(1.2);
}

/* ---------------------------------------------------------------------
   2 · Tableau de bord
   --------------------------------------------------------------------- */
const SEL = {
  journee: 'section.card:has(h2:has-text("Ma journée"))',
  aTraiter: 'section.card:has(h2:has-text("À traiter"))',
  graphe: 'section.card:has(h2:has-text("Séances de perfusion réalisées par mois"))'
};
async function tableauDeBord(st, v) {
  const L = longue(v);
  if (L) await st.cartonChapitre(2, 'Tableau de bord', { duree: 1.0, pendant: () => st.allerA('dashboard') });
  else st.chapitre(1, 'Tableau de bord');
  await st.attendre(L ? 1.2 : 0.4);
  await st.sousTitre('Tout ce qui se passe aujourd’hui', L ? 'séances du jour, patients attendus, fauteuils' : 'séances, retards, contrôles, alertes');
  await cadrer(st, SEL.journee, 1.5, { hautEnHaut: true, duree: 1.0 });
  await st.vers(`${SEL.journee} .jour-row:has-text("BENNANI") >> nth=0`, 0.7);
  await st.attendre(L ? 1.4 : 0.6);
  if (L) { await st.vers(`${SEL.journee} .jour-row:has-text("Ustekinumab")`, 0.8); await st.attendre(0.8); }
  await st.dezoom(0.7);
  if (L) await st.sousTitre('Rien n’est oublié', 'retards, contrôles à faire et alertes remontent d’eux-mêmes');
  await cadrer(st, SEL.aTraiter, 1.45, { duree: 1.0 });
  await st.vers(`${SEL.aTraiter} .alert-row:has-text("BERRADA")`, 0.7);
  await st.attendre(L ? 1.0 : 0.5);
  await st.vers(`${SEL.aTraiter} .alert-row:has-text("Transition")`, 0.7);
  await st.attendre(L ? 1.2 : 0.4);
  if (!L) { await st.dezoom(0.6); return; }
  await st.dezoom(0.7);
  await st.sousTitre('L’activité en un coup d’œil', 'séances de perfusion réalisées, mois par mois et par molécule');
  await cadrer(st, SEL.graphe, 1.3, { duree: 1.0 });
  await st.survoler(`${SEL.graphe} svg`, 1.2);
  await st.deplacer(900, 520, 0.9);
  await st.attendre(0.8);
  await st.dezoom(0.7);
  await st.defiler(-2000, { duree: 0.8 });
}

/* ---------------------------------------------------------------------
   3 · Dossier patient
   --------------------------------------------------------------------- */
const MODAL = '#modal-root';
async function seanceRealisee(st, v) {
  const L = longue(v);
  await st.cliquer('[data-action="cureEnregistrer"]', { apres: 0.4 });
  await st.sousTitre(L ? 'La dose se calcule toute seule' : 'La dose se calcule au poids', 'mg/kg × poids du jour → mg → flacons · alerte si l’écart dépasse 10 %');
  await st.taper(`${MODAL} input[name="poids"]`, '43.8', { effacer: true, rampe: false, caracteresParSeconde: 6 });
  await cadrer(st, `${MODAL} #calc-dose`, 1.6, { fixe: true, duree: 1.0 });
  await st.attendre(L ? 2.4 : 2.0);
  await st.dezoom(0.7);
  await st.sousTitre('Une séance en 30 secondes', 'poids, lot, tolérance, constantes, examen clinique');
  const vite = { rampe: true, caracteresParSeconde: 12, vitesseMax: 3, apres: 0 };
  await st.taper(`${MODAL} input[name="lot"]`, 'RMS26K118', vite);
  await st.taper(`${MODAL} input[name="ta"]`, '108/64', vite);
  await st.taper(`${MODAL} input[name="temp"]`, '36.7', vite);
  await st.choisir(`${MODAL} select[name="cl_puberte"]`, 'Tanner 3', { apres: 0.2 });
  await st.taper(`${MODAL} input[name="cl_digestif"]`, '1 à 2 selles/j, moulées, sans sang', vite);
  await st.cliquer(`${MODAL} button[type=submit]`, { apres: 0.3 });
  await st.stable();
}

async function dossierPatient(st, v) {
  const L = longue(v);
  const yassine = await idDe(st, 'Yassine BENNANI'), rayan = await idDe(st, 'Rayan EL IDRISSI');
  if (L) {
    await st.cartonChapitre(3, 'Dossier patient', { duree: 1.0, pendant: () => st.allerA('dashboard') });
    /* 3.1 file active, recherche (le filtre de la liste est différé : on lui laisse le temps réel) */
    await st.naviguer('.nav [data-go="patients"]', { attente: 0.2 });
    await st.sousTitre('La file active', 'recherche, pathologie, biothérapie, prochaine séance');
    await st.taper('#f-q', 'BENN', { rampe: false, caracteresParSeconde: 7, apres: 0 });
    await st.page.waitForTimeout(600); await st.stable();
    await st.attendre(0.3);
    await st.naviguer('tbody tr.row-link:has-text("BENNANI Yassine")', { attente: 0.3 });
    /* 3.2 en-tête */
    await st.sousTitre('Le dossier en un coup d’œil', 'maladie (classification de Paris), phase, molécule, poids récent');
    await cadrer(st, 'section.card.mb16', 1.4, { duree: 0.9 });
    await st.vers('section.card.mb16 .badge:has-text("Entretien")', 0.7);
    await st.attendre(0.5);
    await st.dezoom(0.6);
  } else {
    st.chapitre(2, 'Dossier patient');
    await st.fonduEnchaine(0.4, () => st.allerA('patient', { id: yassine }));
  }
  /* 3.3–3.5 dose au poids, séance réalisée */
  await seanceRealisee(st, v);
  if (L) {
    await st.sousTitre('Et la prochaine séance est déjà planifiée', 'S70 le 4 janvier 2027 : dans le dossier, le planning et le carnet');
    const ech = 'section.card:has(h2:has-text("Prochaines échéances"))';
    await cadrer(st, ech, 1.35, { hautEnHaut: true, duree: 0.9 });
    await st.vers(`${ech} :text("Séance S70") >> nth=0`, 0.7);
    await st.attendre(0.5);
    await st.dezoom(0.6);
    /* 3.7 courbes : croissance puis calprotectine (2 fenêtres) */
    await st.naviguer('.tabs button:has-text("Bilans")', { attente: 0.2 });
    await st.sousTitre('Les courbes qui comptent', 'croissance et inflammation, zones de référence pédiatriques');
    await st.cliquer('[data-action="cliniqueCourbes"]', { apres: 0.8 });
    /* fermeture par la croix du haut : le bouton du bas est dans la zone du sous-titre, « vers » ferait d'abord défiler la fenêtre */
    await st.cliquer(`${MODAL} .modal-head [data-action="closeModal"]`, { apres: 0.1 });
    await st.cliquer('[data-action="bioCourbes"]', { apres: 0.1 });
    await st.cliquer(`${MODAL} [data-action="courbesPeriode"][data-mois="24"]`, { apres: 0.1 });
    await cadrer(st, `${MODAL} .courbe-card:has-text("Calprotectine")`, 1.5, { duree: 0.9 });
    await st.attendre(1.0);
    await st.dezoom(0.4);
    /* 3.4 Rayan : traitement par cycles */
    await st.fonduEnchaine(0.4, () => st.allerA('patient', { id: rayan, tab: 'traitement' }));
    await st.sousTitre('Le traitement par cycles', 'optimisation, changement de molécule, suspension : tout est tracé et daté');
    const cycle = await marquer(st, 'cycle', () => [...document.querySelectorAll('main *')].filter(e => /^Cycle 1/.test(e.innerText || '') && /Modifications/.test(e.innerText)).pop());
    await cadrer(st, cycle, 1.35, { duree: 0.9 });
    await st.vers(':text("Posologie modifiée à partir de la séance") >> nth=0', 0.7);
    await st.attendre(0.8);
    await st.dezoom(0.6);
    await st.naviguer('.tabs button:has-text("Planification")', { attente: 0.2 });
  } else {
    await st.attendre(0.4);
    await st.fonduEnchaine(0.4, () => st.allerA('patient', { id: rayan, tab: 'plan' }));
  }
  /* 3.6 dosage avec cible pédiatrique : 6,2 sous la cible (détail), puis 13,7 dans la cible */
  await st.sousTitre('Dosages avec cibles pédiatriques', 'cible ≥ 10 µg/mL (atteinte périnéale), figée au moment du dosage');
  const ligne = 'tbody tr:has-text("résiduel 6,2")';
  await st.cliquer(`${ligne} details.menu summary`, { apres: 0.1 });
  await st.cliquer(`${ligne} [data-action="survDetail"]`, { apres: 0.2 });
  await cadrer(st, `${MODAL} .modal-body`, 1.55, { fixe: true, duree: 0.9 });
  await st.vers(`${MODAL} :text("Optimisation à 10 mg/kg") >> nth=0`, 0.7);
  await st.attendre(L ? 1.0 : 1.7);
  await st.dezoom(0.4);
  await st.cliquer(`${MODAL} .modal-foot button:has-text("Fermer")`, { apres: 0 });
  if (L) {
    const l2 = 'tbody tr:has-text("résiduel 13,7") >> nth=0';
    await cadrer(st, l2, 1.6, { duree: 0.8 });
    await st.vers(`${l2} >> :text("13,7")`, 0.5);
    await st.attendre(0.5);
    await st.dezoom(0.4);
    /* 3.8 sécurité : allergie, réaction, prémédication (Omar CHRAIBI) */
    const omar = await idDe(st, 'Omar CHRAIBI');
    await st.fonduEnchaine(0.4, () => st.allerA('patient', { id: omar }));
    await st.sousTitre('La sécurité d’abord', 'allergies, réactions et prémédication toujours visibles');
    await cadrer(st, 'section.card.mb16', 1.4, { duree: 0.7 });
    await st.vers('section.card.mb16 .badge:has-text("Allergie")', 0.4);
    await st.attendre(0.2);
    await cadrer(st, 'section.card:has(h2:has-text("À retenir"))', 1.35, { hautEnHaut: true, duree: 0.7, dezoom: 0.4, dureeDefil: 0.6 });
    await st.vers(':text("Réaction à la perfusion") >> nth=0', 0.4);
    await st.attendre(0.4);
    await st.dezoom(0.4);
  }
}

/* ---------------------------------------------------------------------
   4 · Nouveau dossier (version longue) — enfant fictif, profil jetable
   --------------------------------------------------------------------- */
async function nouveauDossier(st) {
  await st.cartonChapitre(4, 'Nouveau dossier', { duree: 1.0, pendant: () => st.allerA('patients') });
  await st.naviguer('.nav [data-go="nouveau"]', { attente: 0.2 });
  await st.sousTitre('Un dossier en trois étapes', 'identité, maladie, protocole');
  const r = { rampe: true, caracteresParSeconde: 14, vitesseMax: 3, apres: 0 };
  await st.taper('#w-nom', 'BOUAZZA', r);
  await st.appuyer('Tab', 0.05); await st.taper(null, 'Ilyas', r);
  await st.appuyer('Tab', 0.05); await st.taper(null, '2026-01260', r);
  await st.taper('#w-ddn', '14022015', r);
  await st.choisir('select[data-k="sexe"]', 'M', { apres: 0 });
  await st.taper('#w-poids', '34.5', r);
  await st.naviguer('[data-action="wNext"]', { attente: 0.2 });
  /* étape 2 : protocole, doses calculées */
  await st.sousTitre('Le protocole propose, le médecin décide', 'doses, induction, plan de surveillance ajustables');
  await st.cliquer('[data-action="wProto"]:has-text("Infliximab") >> nth=0', { apres: 0.2 });
  await cadrer(st, ':text("5 mg/kg × 34,5 kg = ") >> nth=0', 1.6, { duree: 0.9, dx: -150 });
  await st.attendre(1.0);
  await st.dezoom(0.4);
  /* saisie rétrospective */
  await st.sousTitre('La saisie rétrospective', 'un traitement antérieur et ses séances sont repris sans rien perdre');
  await st.cliquer('summary:has-text("Traitement(s) antérieur(s)")', { apres: 0.1 });
  await st.cliquer('[data-action="retroOuvrir"]', { apres: 0.2 });
  await cadrer(st, `${MODAL} .callout >> nth=0`, 1.5, { fixe: true, duree: 0.7 });
  await st.attendre(0.6);
  await st.dezoom(0.4);
  await st.cliquer(`${MODAL} .modal-head [data-action="closeModal"]`, { apres: 0.1 });
  /* étape 3 : carnet, création */
  await st.naviguer('[data-action="wNext"]', { attente: 0.2 });
  await st.sousTitre('Le carnet est prêt, le dossier est créé', 'séances, contrôles et doses calculées avant la première perfusion');
  await st.naviguer('[data-action="wCreate"]', { attente: 0.3 });
  await st.attendre(1.5);
}

/* ---------------------------------------------------------------------
   5 · Planning et feuille du jour
   --------------------------------------------------------------------- */
async function planning(st, v) {
  const L = longue(v);
  if (L) await st.cartonChapitre(5, 'Planning et feuille du jour', { duree: 1.0, pendant: () => st.allerA('dashboard') });
  else { st.chapitre(3, 'Planning'); await st.effacerSousTitre(); }
  if (L) await st.naviguer('.nav [data-go="planning"]', { attente: 0.3 });
  else await st.fonduEnchaine(0.4, () => st.allerA('planning'));
  await st.sousTitre('Les fauteuils, sans double réservation', 'capacité, créneaux, jours d’ouverture');
  await cadrer(st, 'section.day-panel', 1.4, { duree: 1.0 });
  await st.vers('section.day-panel .agenda-row:has-text("BENNANI") >> nth=0', 0.7);
  await st.attendre(L ? 1.6 : 0.4);
  await st.dezoom(0.6);
  if (!L) { await cadrer(st, '.week', 1.3, { hautEnHaut: true, duree: 0.8 }); await st.attendre(0.5); await st.dezoom(0.5); }
  if (L) {
    await st.sousTitre('La semaine et le mois en un écran', '4, 3, 4, 3 et 3 séances cette semaine, dont 2 injections SC');
    await cadrer(st, '.week', 1.3, { hautEnHaut: true, duree: 0.9 });
    await st.attendre(0.9);
    await st.dezoom(0.5);
    await st.defiler(-2000, { duree: 0.6 });
    await cadrer(st, '.cal', 1.3, { duree: 0.8 });
    await st.survoler('.cal :text("16") >> nth=0', 0.3);
    await st.dezoom(0.5);
  }
  await st.naviguer('button:has-text("Imprimer la feuille")', { attente: 0.4 });
  await st.sousTitre('La feuille de l’infirmier·ère', 'dose recalculée, flacons, prélèvements, alertes · colonnes à remplir à la main');
  /* ligne de Yassine (séance faite : poids, lot et heure reportés) puis ligne suivante (dose recalculée sur le dernier poids) */
  const ligne = await marquer(st, 'feuille-ligne', () => [...document.querySelectorAll('tr')].find(r => /BENNANI Yassine/.test(r.innerText) && /Infliximab/.test(r.innerText)));
  const suivante = await marquer(st, 'feuille-suivante', () => [...document.querySelectorAll('tr')].find(r => /AMRANI Anas/.test(r.innerText) && /mg\/kg/.test(r.innerText)));
  await cadrer(st, ligne, 1.5, { duree: 1.0, hautEnHaut: true });
  await st.vers(`${ligne} >> td >> nth=3`, 0.7);
  await st.attendre(0.6);
  await st.vers(`${ligne} >> td >> nth=4`, 0.6);
  await st.attendre(0.6);
  await st.vers(`${suivante} >> td >> nth=2`, 0.7);
  await st.attendre(L ? 1.2 : 0.6);
  await st.dezoom(0.6);
  if (L) {
    await cadrer(st, ':text("À préparer (estimation sur le dernier poids)") >> nth=0', 1.5, { duree: 0.8 });
    await st.attendre(0.9);
    await st.dezoom(0.5);
    await st.naviguer('[data-go="feuillePlanning"]:has-text("Semaine")', { attente: 0.2 });
    await st.sousTitre('Ou la semaine entière', 'une feuille par jour, à imprimer d’un seul geste');
    await st.defiler(900, { duree: 1.4 });
    await st.attendre(0.6);
  }
}

/* ---------------------------------------------------------------------
   6 · Documents
   --------------------------------------------------------------------- */
async function carnetPatient(st, v) {
  const L = longue(v);
  await st.sousTitre('Le carnet de la famille, en français et en arabe', L ? '8 pages, remis une seule fois, dates à venir laissées en blanc' : '8 pages A5 et la carte « Je suis sous biothérapie »');
  await cadrer(st, '.page.p1 .couv', 1.45, { duree: L ? 1.0 : 0.8, hautEnHaut: true });
  await st.attendre(L ? 1.2 : 0.5);
  await st.dezoom(0.5);
  if (L) {
    await st.defiler('.spread >> nth=0', { duree: 1.1, position: 0.05 });
    await st.attendre(0.9);
  }
  await cadrer(st, '.page.conseils-page', 1.4, { duree: L ? 1.1 : 0.9, hautEnHaut: true });
  await st.vers('.page.conseils-page :text("Avant chaque séance, je coche") >> nth=0', 0.6);
  await st.attendre(L ? 1.1 : 0.4);
  await st.dezoom(0.5);
  if (L) await st.sousTitre('La carte « Je suis sous biothérapie »', 'à détacher et garder sur soi');
  const carte = '.carte-in:has-text("Je suis sous biothérapie")';
  await cadrer(st, carte, 1.8, { duree: L ? 1.1 : 0.9 });
  await st.vers(`${carte} :text("Je suis sous biothérapie")`, 0.6);
  await st.attendre(L ? 1.7 : 1.1);
  await st.dezoom(0.6);
}

async function documents(st) {
  const yassine = await idDe(st, 'Yassine BENNANI'), aya = await idDe(st, 'Aya SEBTI'), rayan = await idDe(st, 'Rayan EL IDRISSI');
  await st.cartonChapitre(6, 'Documents', { duree: 1.0, pendant: () => st.allerA('patient', { id: yassine }) });
  /* 6.1 carnet A4 */
  await st.naviguer('[data-go="carnet"]', { attente: 0.4 });
  await st.sousTitre('Le carnet des soignants', 'statut et sécurité, à faire, séances, contrôles, bilans, courbes');
  await st.attendre(0.4);
  await st.defiler(':text("PLANIFICATION DU TRAITEMENT") >> nth=0', { rampe: true, position: 0.1 });
  await cadrer(st, '.ca4-plan', 1.3, { hautEnHaut: true, duree: 0.8 });
  await st.attendre(0.8);
  await st.dezoom(0.5);
  await st.defiler(':text("ÉVOLUTION CLINIQUE ET BIOLOGIQUE") >> nth=0', { rampe: true, position: 0.08 });
  await cadrer(st, '.doc-courbes >> nth=0', 1.3, { hautEnHaut: true, duree: 0.8 });
  await st.attendre(1.0);
  await st.dezoom(0.5);
  /* 6.2 carnet patient bilingue */
  await st.fonduEnchaine(0.4, () => st.allerA('carnetPatient', { id: yassine }));
  await carnetPatient(st, { variante: 'longue' });
  /* 6.3 planification complète (Aya SEBTI) */
  await st.fonduEnchaine(0.4, () => st.allerA('impression', { id: aya, quoi: 'planification' }));
  await st.sousTitre('Séances et contrôles sur une même page', 'séance décalée pour rupture de stock, correction tracée « corrigée le … par … »');
  const rupt = await marquer(st, 'aya-rupture', () => [...document.querySelectorAll('tr')].find(r => /S31/.test(r.innerText) && /rupture/.test(r.innerText)));
  await cadrer(st, rupt, 1.6, { duree: 0.9 });
  await st.vers(`${rupt} :text("rupture")`, 0.6);
  await st.attendre(0.6);
  const corr = await marquer(st, 'aya-corrigee', () => [...document.querySelectorAll('tr')].find(r => /S38/.test(r.innerText) && /corrigée/.test(r.innerText)));
  await st.vers(`${corr} :text("corrigée")`, 0.6);
  await st.attendre(0.8);
  await st.dezoom(0.6);
  /* 6.4 compte rendu (Rayan) */
  await st.fonduEnchaine(0.4, () => st.allerA('compteRendu', { id: rayan }));
  await st.sousTitre('Le compte rendu, prérempli et modifiable', 'dosages, tolérance, traitement · conclusion libre du médecin');
  await cadrer(st, '.cr-tdm', 1.5, { duree: 0.9 });
  await st.attendre(0.8);
  await st.dezoom(0.5);
  await st.vers('.cr-edit[data-k="conclusion"]');
  await st.clic({ apres: 0.1 });
  await st.page.keyboard.press('Control+A');
  await cadrer(st, '.cr-edit[data-k="conclusion"]', 1.5, { fixe: true, curseur: false, duree: 0.8 });
  await st.taper(null, 'Évolution favorable : rémission clinique et biologique, taux résiduel dans la cible. Poursuite du traitement.', { rampe: true, caracteresParSeconde: 11, vitesseMax: 3 });
  await st.attendre(0.8);
  await st.dezoom(0.6);
  /* 6.5 télécharger */
  await st.sousTitre('Imprimable ou exportable, en couleur ou en noir et blanc', 'un fichier .html autonome, à ouvrir sur n’importe quel poste');
  await st.defiler(-6000, { duree: 0.8 });
  await st.survoler('.imp-modifier', 0.3);
  await st.cliquer('[data-action="telechargerDoc"]', { apres: 0.3 });
  await st.attendre(1.1);
}

/* ---------------------------------------------------------------------
   7 · Rapport d'activité
   --------------------------------------------------------------------- */
async function rapport(st, v) {
  const L = longue(v);
  if (L) await st.cartonChapitre(7, 'Rapport d’activité', { duree: 1.0, pendant: () => st.allerA('dashboard') });
  else { st.chapitre(5, 'Rapport d’activité'); await st.effacerSousTitre(); }
  if (L) await st.naviguer('.nav [data-go="activite"]', { attente: 0.3 });
  else await st.fonduEnchaine(0.4, () => st.allerA('activite'));
  await st.cliquer('[data-action="rapportPreset"][data-v="annee"]', { apres: 0.3 });
  await st.sousTitre(L ? 'L’activité de l’HDJ, chiffrée' : 'L’activité chiffrée, version anonymisée', L ? 'IV et SC, réalisation, réactions, reports, consommation, heures-fauteuil' : 'IV et SC, taux de réalisation, consommation · aucun nom');
  await cadrer(st, '.kpis', 1.5, { duree: 0.9 });
  await st.vers('.kpis > *:has-text("Taux de réalisation")', 0.6);
  await st.attendre(L ? 1.4 : 0.4);
  if (L) {
    await st.dezoom(0.5);
    await cadrer(st, 'section.card:has(h2:has-text("Par molécule"))', 1.4, { duree: 0.9 });
    await st.vers('section.card:has(h2:has-text("Par molécule")) tr:has-text("Infliximab")', 0.6);
    await st.attendre(1.0);
    await st.dezoom(0.5);
    await st.defiler(-4000, { duree: 0.7 });
  } else await st.dezoom(0.6);
  /* version anonymisée */
  if (L) await st.sousTitre('Une version anonymisée pour l’administration', 'aucun nom, les mêmes chiffres');
  await st.cliquer('[data-change="rapportAnonyme"]', { apres: 0.3 });
  await cadrer(st, '.rap-annexe-t', 1.6, { hautEnHaut: true, duree: 0.9 });
  await st.vers(':text("Patient A") >> nth=0', 0.5);
  await st.attendre(L ? 1.0 : 0.5);
  await st.dezoom(0.5);
  if (L) {
    await st.sousTitre('Prête à coller dans le rapport annuel', 'synthèse rédigée de la période');
    await cadrer(st, 'section.card:has(h2:has-text("Synthèse pour le rapport"))', 1.3, { duree: 0.9, hautEnHaut: true });
    await st.survoler('[data-action="rapportCopier"]', 0.8);
    await st.dezoom(0.5);
  }
}

/* ---------------------------------------------------------------------
   8 · Sécurité et autonomie
   La carte « Sauvegarde automatique » est montrée repliée : son texte cite le
   nom technique des fichiers de sauvegarde, qui ne doit pas apparaître à l'image.
   --------------------------------------------------------------------- */
const AUTO = 'section.card:has(h2:has-text("Sauvegarde automatique"))';
const EXPORT = 'section.card:has(h2:has-text("Sauvegarde des données"))';
async function replierSauvegardeAuto(st) {
  await st.allerA('parametres');
  const ouverte = await st.page.locator(`${AUTO} [data-action="plier"]`).first().getAttribute('aria-expanded');
  if (ouverte !== 'false') await st.page.locator(`${AUTO} [data-action="plier"]`).first().click();
  await st.stable();
}
async function securite(st, v) {
  const L = longue(v);
  if (L) await st.cartonChapitre(8, 'Sécurité et autonomie', { duree: 1.0, pendant: async () => { await replierSauvegardeAuto(st); await st.allerA('dashboard'); } });
  else { st.chapitre(6, 'Sécurité'); await st.effacerSousTitre(); await st.fonduEnchaine(0.4, () => replierSauvegardeAuto(st)); }
  if (L) await st.naviguer('.user-chip [data-go="parametres"]', { attente: 0.3 });
  await st.sousTitre(L ? 'Sauvegarde automatique sur clé ou disque' : 'Local, sans Internet, sauvegardé', L ? 'à activer sur le poste de l’HDJ : une copie par jour, 90 jours puis une par mois' : 'un seul poste, export en un clic, copie automatique sur clé ou disque');
  await cadrer(st, `${EXPORT}`, 1.45, { duree: 0.9, hautEnHaut: true });
  await st.vers(`${AUTO} h2`, 0.6);
  await st.attendre(L ? 1.0 : 1.2);
  if (L) {
    await st.sousTitre('Aucune donnée ne sort de l’hôpital', 'un seul PC, sans Internet ni serveur · export manuel en un clic');
    await st.vers(`${EXPORT} [data-action="exporterBase"]`, 0.6);
    await st.attendre(1.3);
  }
  await st.dezoom(0.5);
  if (!L) return;
  await st.naviguer('.nav [data-go="equipe"]', { attente: 0.3 });
  await st.sousTitre('Un code par personne, deux niveaux d’accès', 'accès complet pour les médecins, accès hôpital de jour pour l’équipe');
  await cadrer(st, '.grid.c11', 1.4, { duree: 0.8 });
  await st.attendre(0.8);
  await st.dezoom(0.5);
  /* qui a fait quoi : la trace d'une correction dans le détail de séance */
  const aya = await idDe(st, 'Aya SEBTI');
  await st.fonduEnchaine(0.4, () => st.allerA('patient', { id: aya, tab: 'plan' }));
  await st.sousTitre('Qui a fait quoi', 'chaque séance garde son auteur et ses corrections, datées et signées');
  const l = 'tbody tr:has-text("S38"):has-text("Séance")';
  await st.cliquer(`${l} details.menu summary`, { apres: 0.2 });
  await st.cliquer(`${l} [data-action="cureDetail"]`, { apres: 0.3 });
  await cadrer(st, `${MODAL} .modal-body`, 1.45, { fixe: true, duree: 0.8 });
  await st.vers(`${MODAL} :text("Corrigée le") >> nth=0`, 0.5);
  await st.attendre(1.0);
  await st.dezoom(0.5);
}

/* ---------------------------------------------------------------------
   9 · Fin
   --------------------------------------------------------------------- */
async function fin(st, v) {
  const L = longue(v);
  st.cacherCurseur();
  await st.cartonFin({
    mots: ['Sûr', 'Organisé', 'Documenté', 'Autonome'],
    auteurs: 'Youssef Moussaddek · Ahmed Traifi',
    encadrant: 'Encadrement : Pr Bensabahia',
    service: ETAB.service,
    note: 'Démonstration réalisée avec des patients fictifs',
    dureeMots: L ? 5.4 : 2.4, dureeCredits: L ? 7.8 : 2.6
  });
}

module.exports = {
  HORLOGE, CODE, ETAB, ZONE,
  idDe, cadrer, marquer, preparer,
  ouverture, connexion, tableauDeBord, seanceRealisee, dossierPatient, nouveauDossier,
  planning, carnetPatient, documents, rapport, securite, fin
};
