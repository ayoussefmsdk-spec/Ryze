#!/usr/bin/env node
/* =====================================================================
   HDJ — demo/construire-vitrine.js : construit la base de démonstration
   « vitrine » (dossiers d'enfants et d'adolescents ENTIÈREMENT FICTIFS)
   avec les vraies fonctions de l'application, dans Chromium (Playwright).

   Principe : on part de « Démarrer avec une base vide », puis on rejoue
   ~15 mois de vie de l'hôpital de jour, jour après jour, horloge de la page
   avancée (page.clock) : création des dossiers par l'assistant, séances
   marquées réalisées par les IDE (fenêtre « Marquer réalisée »), contrôles
   « Marquer fait », reports, patient non venu, correction, réaction,
   optimisation, changement de molécule, suspension, notes, rendez-vous…
   Toutes les données ont donc la forme exacte produite par l'application.

   Usage :
     export NODE_PATH=$(npm root -g)
     node demo/construire-vitrine.js            construit + vérifie
     node demo/construire-vitrine.js --sans-verif
   Sortie : demo/vitrine.json (export « Exporter la base », à importer par
   Paramètres → Importer un fichier → « Remplacer toute la base »).
   Les dates sont calculées depuis la date du jour : relancer le script un
   autre jour redonne une base « à jour » (semaine en cours remplie).
   Aucune donnée réelle : noms et prénoms marocains courants, inventés.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function chargerPlaywright() {
  try { return require('playwright'); } catch (e) { /* suite */ }
  try { const g = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); return require(path.join(g, 'playwright')); } catch (e) { /* suite */ }
  console.error('Playwright introuvable : export NODE_PATH=$(npm root -g)'); process.exit(2);
}
const { chromium } = chargerPlaywright();
const RACINE = path.resolve(__dirname, '..');
const APP_URL = 'file://' + path.join(RACINE, 'app', 'index.html');
const SORTIE = path.join(__dirname, 'vitrine.json');
const OUT = process.env.VITRINE_OUT || path.join(require('os').tmpdir(), 'vitrine-verif');
const VERIFIER = !process.argv.includes('--sans-verif');
const CHROMIUM = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const ARGS = ['--disable-background-networking', '--disable-component-update', '--no-first-run'];
const log = (...a) => console.log(...a);

/* ---------- dates (chaînes AAAA-MM-JJ, calcul en UTC) ---------- */
const dt = s => new Date(s + 'T00:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
const add = (s, n) => iso(new Date(dt(s).getTime() + n * 864e5));
const diff = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
const dow = s => dt(s).getUTCDay();
const ouvert = s => dow(s) >= 1 && dow(s) <= 5;
const AUJ = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
/* lundi de la semaine en cours (le week-end : semaine à venir), comme R.semaineRef */
const LUNDI = (() => { const w = dow(AUJ); return w === 0 ? add(AUJ, 1) : w === 6 ? add(AUJ, 2) : add(AUJ, -(w - 1)); })();
const L = n => add(LUNDI, n); /* jour relatif au lundi de la semaine en cours */
const T0 = add(LUNDI, -448); /* début de la simulation : ~15 mois avant */
const instant = (date, heure) => { const [h, m] = (heure || '08:00').split(':').map(Number); const d = dt(date); d.setUTCHours(h, m, 0, 0); return d; };

/* ---------- hasard déterministe ---------- */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const bruit = (...k) => (hash(k.join('|')) % 10000) / 5000 - 1; /* [-1, 1[ */
const fr = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', ',');
const decr = (t, a, b, tau) => b + (a - b) * Math.exp(-Math.max(0, t) / tau); /* de a vers b */
const lin = (date, pts) => { /* interpolation linéaire [[date, v], …] */ const t = dt(date).getTime(); if (t <= dt(pts[0][0]).getTime()) return pts[0][1]; for (let i = 1; i < pts.length; i++) { const a = dt(pts[i - 1][0]).getTime(), b = dt(pts[i][0]).getTime(); if (t <= b) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (t - a) / (b - a); } return pts[pts.length - 1][1]; };
const palier = (date, pts) => { let v = pts[0][1]; pts.forEach(([d, x]) => { if (date >= d) v = x; }); return v; };

/* ---------- équipe (codes d'accès de la vitrine) ---------- */
const EQUIPE = [
  { k: 'moussaddek', titre: 'Dr', prenom: 'Y.', nom: 'MOUSSADDEK', fonction: 'Gastro-entérologue pédiatre — HDJ biothérapies', role: 'complet', medecin: true, code: 'AAA111' },
  { k: 'traifi', titre: 'Dr', prenom: 'A.', nom: 'TRAIFI', fonction: 'Gastro-entérologue pédiatre', role: 'complet', medecin: true, code: 'BBB222' },
  { k: 'bensabahia', titre: 'Pr', prenom: '', nom: 'BENSABAHIA', fonction: 'Chef de service — Pédiatrie 3', role: 'complet', medecin: true, code: 'CCC333' },
  { k: 'ide1', titre: '', prenom: 'Samira', nom: 'OUAHBI', fonction: 'IDE — Hôpital de jour', role: 'hdj', medecin: false, code: 'IDE444' },
  { k: 'ide2', titre: '', prenom: 'Hanane', nom: 'ZEMMOURI', fonction: 'IDE — Hôpital de jour', role: 'hdj', medecin: false, code: 'IDE555' },
  { k: 'sec', titre: '', prenom: 'Meryem', nom: 'SQALLI', fonction: 'Secrétaire — Hôpital de jour', role: 'hdj', medecin: false, code: 'SEC666' }
];
const REGLAGES = { telHDJ: '05 22 48 20 20', telUrgences: '05 22 29 46 30', chef: 'Pr BENSABAHIA', fauteuils: '4', maxParJour: '8', ouverture: '08:00', fermeture: '16:00', pas: '30' };

/* ---------- lots fictifs par article et période ---------- */
const LOTS = {
  IFX100: [['2000-01-01', 'RMS25H112'], ['2025-12-01', 'RMS25L307'], ['2026-03-15', 'RMS26C045'], ['2026-07-01', 'RMS26G218'], ['2026-10-01', 'RMS26J406']],
  VDZ300: [['2000-01-01', 'ENT25H220'], ['2026-02-01', 'ENT26B118'], ['2026-08-01', 'ENT26H302']],
  UST130: [['2000-01-01', 'STL26E077']], UST90: [['2000-01-01', 'STL26F210']],
  ADA80: [['2000-01-01', 'AMG26F331']], ADA40: [['2000-01-01', 'AMG26F331'], ['2026-09-01', 'AMG26I512']]
};
const lotDe = (art, date) => palier(date, LOTS[art] || [['2000-01-01', '']]);

/* =====================================================================
   Modèles cliniques et biologiques
   ===================================================================== */
/* bilan pré-biothérapie complet (tout fait, normal) ; surcharges par dossier */
function bilanPre(sp, date) {
  const F = sp.sexe === 'F', A = s => ({ statut: 'fait_anormal', date, commentaire: s }), N = s => ({ statut: 'fait_normal', date, commentaire: s || '' }), NA = s => ({ statut: 'na', date: '', commentaire: s || '' });
  const mc = sp.patho === 'MC';
  const b = {
    igra: N('QuantiFERON négatif'), rxt: N('Normale'), vhb: N('Ag HBs négatif, anti-HBc négatif, anti-HBs 86 UI/L (vacciné)'), vhc: N('Négatif'), vih: N('Négatif (accord des parents)'),
    ebv: N('IgG anti-VCA positives (immunisé)'), cmv: N('IgG positives, IgM négatives'), vzv: N('IgG positives (varicelle à 4 ans)'), sero2: N('Rougeole IgG positives, VHA IgG positives'),
    hb: A(`Hb ${fr(sp.hb0 || 10.6)} g/dL, microcytaire`), nfs: N('GB 9,8 G/L, plaquettes 486 G/L'), crp: A(`${sp.crp0 || 32} mg/L`), vs: A('38 mm à la 1re heure'),
    ferr: A('Ferritine 9 ng/mL, CST 8 % (carence martiale)'), bh: N('ASAT 28, ALAT 19 UI/L ; GGT 14 UI/L'), alb: A(`${sp.alb0 || 31} g/L`), renal: N('Créatinine 5 mg/L, DFG normal'), iono: N('Normal'),
    lip: NA('sans objet (anti-TNF)'), sinus: N('Sinus clairs'), foyer: N('Pas de carie, ECBU stérile'),
    croiss: N(`Taille et poids dans le couloir habituel ; ${sp.tanner0 || 'Tanner 2'}`), hcg: F && sp.age >= 12 ? N('Négative') : NA(F ? 'non réglée' : 'garçon'),
    derm: N('Peau saine'), ecg: NA(), oph: NA(), pni: N('Calendrier PNI à jour (BCG, ROR ×2) ; grippe faite'),
    calpro0: A(`${sp.calpro0 || 1180} µg/g`), endo0: A(mc ? 'SES-CD 16 : ulcérations iléales et coliques' : 'Mayo endoscopique 3, pancolite'), colo0: A(mc ? 'Iléo-coloscopie : ulcérations aphtoïdes et serpigineuses, iléon terminal et côlon droit' : 'Colite continue, ulcérations, friabilité'),
    histo0: A(mc ? 'Granulomes épithélioïdes sans nécrose, activité modérée' : 'Colite chronique active, abcès cryptiques'), clostr: N('Toxine C. difficile négative, coproculture négative')
  };
  Object.assign(b, (sp.bilan && sp.bilan(date)) || {});
  return Object.keys(b).map(id => Object.assign({ id }, b[id]));
}

/* valeurs biologiques d'un dossier à une date (t = jours depuis le début du traitement du cycle 1) */
function bio(sp, date) {
  const t = diff(sp.j0, date), n = k => bruit(sp.k, date, k), m = sp.bio || {};
  const v = {
    crp: Math.max(0.6, decr(t, m.crp0 || 30, 2.2, 45) + n('crp') * 0.8),
    calpro: Math.max(25, decr(t, m.cal0 || 1100, m.calFin || 70, 75) * (1 + n('cal') * 0.12)),
    hb: decr(t, m.hb0 || 10.4, m.hbFin || 12.9, 90) + n('hb') * 0.25,
    alb: decr(t, m.alb0 || 31, 41, 70) + n('alb'),
    ferr: decr(t, m.ferr0 || 9, 48, 120) + n('ferr') * 4,
    asat: 24 + n('asat') * 5, alat: 17 + n('alat') * 5, b12: 380 + n('b12') * 60,
    gb: 7.2 + n('gb') * 1.4, plq: 340 + n('plq') * 50,
    vitd: decr(t, m.vitd0 || 13, 33, 150) + n('vitd') * 2,
    tdm: (m.tdm || 7.2) + n('tdm') * 1.1
  };
  if (sp.bioFn) Object.assign(v, sp.bioFn(t, date, v) || {});
  return v;
}
/* clinique d'une séance */
function clinique(sp, date) {
  const t = diff(sp.j0, date);
  const c = { cl_taille: fr(sp.taille(date), 1).replace(',', '.'), cl_puberte: sp.puberte(date), cl_digestif: t < 20 ? (sp.patho === 'RCH' ? '5 selles/j glairo-sanglantes, réveil nocturne' : '4 selles/j, douleurs abdominales post-prandiales') : t < 75 ? '2 selles/j, molles, sans sang' : '1 à 2 selles/j, moulées, sans sang', cl_fievre: 'non', cl_remarques: '' };
  if (sp.clinique) Object.assign(c, sp.clinique(t, date) || {});
  return c;
}
/* résultat d'un contrôle « Marquer fait » : valeurs du formulaire (champs name=…) */
function resultatControle(sp, s, date) {
  const v = bio(sp, date), t = diff(sp.j0, date);
  const sur = sp.controle && sp.controle(s, date, v, t); if (sur) return sur;
  switch (s.id) {
    case 'biostd': {
      const r = { val_nfs: `Hb ${fr(v.hb)} g/dL · GB ${fr(v.gb)} G/L · plaquettes ${Math.round(v.plq)} G/L`, val_crp: fr(v.crp), val_transa: `${Math.round(v.asat)} / ${Math.round(v.alat)}`, val_b12: String(Math.round(v.b12)), val_alb: fr(v.alb, 0), val_ferr: fr(v.ferr, 0) };
      r.note = v.ferr < 15 ? 'Carence martiale : fer per os 3 mois' : v.hb < 11.5 ? 'Anémie en cours de correction' : ''; return r; }
    case 'calpro': return { resultat: `${Math.round(v.calpro)} µg/g`, note: v.calpro > 500 ? 'Inflammation muqueuse active' : v.calpro < 150 ? 'Normalisée' : '' };
    case 'vit': return { resultat: `${fr(v.vitd, 0)} ng/mL`, note: v.vitd < 20 ? 'Carence : cholécalciférol 100 000 UI, contrôle à 6 mois' : '' };
    case 'tdm': return { tdm_mol: sp.molTdm || 'Infliximab', tdm_taux: (Math.round(v.tdm * 10) / 10).toFixed(1), tdm_ac: 'neg', tdm_titre: '', note: '' };
    case 'actnf': return { resultat: `Anticorps anti-${(sp.molTdm || 'Infliximab').toLowerCase()} non détectés`, note: '' };
    case 'colo': return { resultat: sp.patho === 'MC' ? 'Cicatrisation muqueuse (SES-CD 2), biopsies sans activité' : 'Mayo endoscopique 1, muqueuse cicatricielle', note: 'Maintien du traitement' };
    case 'recto': return { resultat: 'Muqueuse rectale normale', note: '' };
    case 'irm': return { resultat: 'Pas d’épaississement ni d’hyperhémie pariétale (MaRIA < 7)', note: '' };
    case 'echo': return { resultat: `Paroi iléale ${fr(2.3 + bruit(sp.k, date, 'echo') * 0.3)} mm, doppler normal`, note: '' };
    default: return { resultat: 'Normal', note: '' };
  }
}

/* =====================================================================
   Les 10 dossiers « vitrine » (fictifs)
   ===================================================================== */
const DEC = { tanner: (pts) => d => palier(d, pts) };
const VITD = { vit: { on: true, entries: [{ nom: 'Vitamine D', periode: 182 }] } };
const SUIVI_RAPPROCHE = { biostd: { periode: 56 }, calpro: { periode: 91 } };
const VITRINE = [
  { /* modèle parfait */
    k: 'P1', ipp: '2025-00418', prenom: 'Yassine', nom: 'BENNANI', sexe: 'M', ddn: '2013-03-22', age: 13, tel: '06 61 24 38 90', medecin: 'moussaddek',
    patho: 'MC', paris: { A: 'A1b', L: 'L3', B: 'B1', G: 'G0', sev: 'une', score: 35 }, dateDiag: '2025-05-12', proto: 'ifx-iv', specialite: 'Remsima®', j0: add(L(0), -434), heure: '08:00',
    tt: 'Azathioprine 2 mg/kg/j (75 mg/j)', allergies: 'Aucune allergie connue', consang: 'non', comorb: '—', atcd: { oui: false },
    poids: d => lin(d, [[T0, 37.5], [AUJ, 44.2]]) + bruit('P1p', d) * 0.2, taille: d => lin(d, [[T0, 150.2], [AUJ, 158.6]]), puberte: DEC.tanner([[T0, 'Tanner 2'], ['2026-04-01', 'Tanner 3']]),
    cfg: Object.assign({}, VITD, SUIVI_RAPPROCHE), bio: { crp0: 34, cal0: 1240, calFin: 45, tdm: 7.4 }, molTdm: 'Infliximab',
    controle: (s, d) => s.id === 'colo' ? { resultat: 'Cicatrisation muqueuse complète (SES-CD 0), biopsies normales', note: 'Rémission profonde à 1 an : poursuite à l’identique' } : null
  },
  { /* atteinte périnéale : cible ≥ 10, dosage sous la cible, optimisation */
    k: 'P2', ipp: '2025-00534', prenom: 'Rayan', nom: 'EL IDRISSI', sexe: 'M', ddn: '2011-06-03', age: 15, tel: '06 70 15 42 08', medecin: 'traifi',
    patho: 'MC', paris: { A: 'A1b', L: 'L3', B: 'B3', p: true, G: 'G0', sev: 'une', score: 45 }, dateDiag: '2025-08-20', proto: 'ifx-iv', specialite: 'Remsima®', j0: add(L(3), -378), heure: '09:00',
    tt: 'Azathioprine 2,5 mg/kg/j ; ciprofloxacine 3 mois (fistule)', allergies: 'Aucune allergie connue', consang: 'oui2', comorb: 'Fistule périnéale trans-sphinctérienne drainée par séton (09/2025)', atcd: { oui: true, type: 'Maladie de Crohn', qui: 'oncle paternel' },
    poids: d => lin(d, [[T0, 44.5], ['2026-01-15', 46], [AUJ, 52.4]]) + bruit('P2p', d) * 0.3, taille: d => lin(d, [[T0, 160.5], [AUJ, 168.2]]), puberte: DEC.tanner([[T0, 'Tanner 3'], ['2026-06-01', 'Tanner 4']]),
    cfg: Object.assign({}, VITD, SUIVI_RAPPROCHE), bio: { crp0: 41, cal0: 1450, calFin: 110 }, molTdm: 'Infliximab',
    clinique: (t) => t < 120 ? { cl_perineal: ['fistule'], cl_cutaneNote: t < 40 ? 'fistule périnéale productive, séton en place' : 'fistule peu productive, séton en place' } : t < 230 ? { cl_perineal: ['fistule'], cl_cutaneNote: 'fistule non productive, séton retiré' } : {},
    bioFn: (t) => ({ tdm: t < 150 ? 6.2 : 13.8 }),
    controle: (s, d, v, t) => s.id === 'tdm' && t < 150 ? { tdm_mol: 'Infliximab', tdm_taux: '6.2', tdm_ac: 'neg', tdm_titre: '', note: 'Optimisation à 10 mg/kg décidée en staff (atteinte périnéale : cible ≥ 10 µg/mL)' } : s.id === 'tdm' ? { tdm_mol: 'Infliximab', tdm_taux: (13.6 + bruit('P2tdm', d)).toFixed(1), tdm_ac: 'neg', tdm_titre: '', note: t < 250 ? 'Dans la cible après optimisation : poursuite 10 mg/kg toutes les 8 semaines' : '' } : null
  },
  { /* adalimumab SC à l'HDJ */
    k: 'P3', ipp: '2026-00211', prenom: 'Salma', nom: 'ALAOUI', sexe: 'F', ddn: '2014-01-17', age: 12, tel: '06 62 90 11 47', medecin: 'moussaddek',
    patho: 'MC', paris: { A: 'A1b', L: 'L1', B: 'B1', G: 'G0', sev: 'jamais', score: 30 }, dateDiag: '2026-04-28', proto: 'ada', specialite: 'Amgevita®', j0: add(L(2), -126), heure: '14:00',
    tt: 'Méthotrexate 15 mg/m²/sem SC ; acide folique', allergies: 'Aucune allergie connue', consang: 'non', comorb: '—', atcd: { oui: false },
    poids: d => lin(d, [[T0, 39.5], ['2026-07-01', 41.2], [AUJ, 43.6]]) + bruit('P3p', d) * 0.2, taille: d => lin(d, [[T0, 146], [AUJ, 152.8]]), puberte: DEC.tanner([[T0, 'Tanner 2'], ['2026-09-01', 'Tanner 3']]),
    cfg: Object.assign({}, VITD), bio: { crp0: 22, cal0: 760, calFin: 60, tdm: 9.4 }, molTdm: 'Adalimumab'
  },
  { /* changement de molécule infliximab → ustékinumab */
    k: 'P4', ipp: '2025-00602', prenom: 'Mehdi', nom: 'TAZI', sexe: 'M', ddn: '2012-09-08', age: 14, tel: '06 66 03 58 21', medecin: 'traifi',
    patho: 'MC', paris: { A: 'A1b', L: 'L3', L4a: true, B: 'B1', G: 'G0', sev: 'plusieurs', sevN: 2, score: 40 }, dateDiag: '2025-06-30', proto: 'ifx-iv', specialite: 'Remsima®', j0: add(L(0), -399), heure: '10:30',
    tt: 'Azathioprine 2 mg/kg/j (arrêtée 06/2026)', allergies: 'Aucune allergie connue', consang: 'non', comorb: '—', atcd: { oui: false },
    poids: d => lin(d, [[T0, 40.5], ['2026-02-01', 43.2], ['2026-06-10', 41.4], [AUJ, 45.8]]) + bruit('P4p', d) * 0.2, taille: d => lin(d, [[T0, 154.5], [AUJ, 161.4]]), puberte: DEC.tanner([[T0, 'Tanner 3']]),
    cfg: Object.assign({}, VITD, SUIVI_RAPPROCHE), bio: { crp0: 28, cal0: 980 }, molTdm: 'Infliximab',
    bioFn: (t, d, v) => { const rel = d >= '2026-03-15' && d < '2026-06-22', apres = d >= '2026-06-22';
      if (rel) return { crp: 14 + diff('2026-03-15', d) / 12 + bruit('P4c', d), calpro: 420 + diff('2026-03-15', d) * 6.5, hb: 11.2, alb: 34 };
      if (apres) { const u = diff('2026-06-22', d); return { crp: decr(u, 19, 2.5, 40), calpro: decr(u, 980, 120, 70), hb: decr(u, 11.0, 12.8, 80), alb: decr(u, 34, 41, 60) }; }
      return { calpro: decr(t, 980, 160, 60) }; },
    clinique: (t, d) => d >= '2026-04-01' && d < '2026-06-22' ? { cl_digestif: '4 selles/j, douleurs abdominales, réveil nocturne', cl_douleur: true, cl_remarques: 'Perte de poids de 1,5 kg' } : null,
    controle: (s, d, v, t) => s.id === 'tdm' && d >= '2026-04-01' && d < '2026-06-22' ? { tdm_mol: 'Infliximab', tdm_taux: '6.1', tdm_ac: 'neg', tdm_titre: '', note: 'Taux dans la cible sans anticorps malgré une maladie active : échec de mécanisme → changement de classe (ustékinumab) décidé en staff' } : s.id === 'calpro' && d >= '2026-04-01' && d < '2026-06-22' ? { resultat: `${Math.round(v.calpro)} µg/g`, note: 'Perte de réponse secondaire' } : null
  },
  { /* suspension en cours */
    k: 'P5', ipp: '2026-00097', prenom: 'Lina', nom: 'BERRADA', sexe: 'F', ddn: '2016-04-25', age: 10, tel: '06 68 77 20 13', medecin: 'moussaddek',
    patho: 'RCH', paris: { E: 'E4', sev: 'une', score: 65 }, dateDiag: '2026-01-06', proto: 'ifx-iv', specialite: 'Inflectra®', j0: add(L(1), -266), heure: '09:30',
    tt: 'Mésalazine 60 mg/kg/j', allergies: 'Aucune allergie connue', consang: 'oui1', comorb: '—', atcd: { oui: true, type: 'Rectocolite hémorragique', qui: 'mère' },
    poids: d => lin(d, [[T0, 27.5], ['2026-02-15', 28.4], ['2026-10-25', 31.6], [AUJ, 30.8]]) + bruit('P5p', d) * 0.2, taille: d => lin(d, [[T0, 133], [AUJ, 139.6]]), puberte: DEC.tanner([[T0, 'Tanner 1']]),
    cfg: Object.assign({}, VITD), bio: { crp0: 45, cal0: 1650, calFin: 95 }, molTdm: 'Infliximab'
  },
  { /* réaction à la perfusion, prémédication ensuite ; allergie au latex */
    k: 'P6', ipp: '2025-00655', prenom: 'Omar', nom: 'CHRAIBI', sexe: 'M', ddn: '2015-02-11', age: 11, tel: '06 64 31 09 75', medecin: 'traifi',
    patho: 'MC', paris: { A: 'A1b', L: 'L2', B: 'B1', G: 'G0', sev: 'jamais', score: 32.5 }, dateDiag: '2025-08-04', proto: 'ifx-iv', specialite: 'Remsima®', j0: add(L(1), -378), heure: '08:30',
    tt: 'Azathioprine 2 mg/kg/j', allergies: 'Latex (urticaire de contact)', consang: 'non', comorb: 'Asthme léger (salbutamol à la demande)', atcd: { oui: false },
    poids: d => lin(d, [[T0, 31.5], [AUJ, 36.2]]) + bruit('P6p', d) * 0.2, taille: d => lin(d, [[T0, 140.5], [AUJ, 147.3]]), puberte: DEC.tanner([[T0, 'Tanner 1'], ['2026-08-01', 'Tanner 2']]),
    cfg: Object.assign({}, VITD), bio: { crp0: 26, cal0: 890, calFin: 65 }, molTdm: 'Infliximab'
  },
  { /* adolescente de 16 ans, séance manquée */
    k: 'P7', ipp: '2025-00789', prenom: 'Nour', nom: 'FASSI', sexe: 'F', ddn: '2010-08-29', age: 16, tel: '06 61 58 26 34', medecin: 'bensabahia',
    patho: 'RCH', paris: { E: 'E3', sev: 'jamais', score: 45 }, dateDiag: '2025-10-14', proto: 'ifx-iv', specialite: 'Remsima®', j0: add(L(7), -322), heure: '10:00',
    tt: 'Mésalazine 4 g/j', allergies: 'Aucune allergie connue', consang: 'non', comorb: '—', atcd: { oui: false },
    poids: d => lin(d, [[T0, 49.6], [AUJ, 53.4]]) + bruit('P7p', d) * 0.3, taille: d => lin(d, [[T0, 160.1], [AUJ, 161.8]]), puberte: DEC.tanner([[T0, 'Tanner 4'], ['2026-05-01', 'Tanner 5']]),
    cfg: Object.assign({}, VITD, { biostd: { periode: 56 } }), bio: { crp0: 18, cal0: 1320, calFin: 140 }, molTdm: 'Infliximab'
  },
  { /* induction en cours : J0 fait, S2 cette semaine ; bilan avec anomalie et examen en attente */
    k: 'P8', ipp: '2026-00930', prenom: 'Adam', nom: 'KETTANI', sexe: 'M', ddn: '2018-05-30', age: 8, tel: '06 65 42 87 19', medecin: 'bensabahia',
    patho: 'MC', paris: { A: 'A1a', L: 'L3', B: 'B1', G: 'G1', sev: 'jamais', score: 37.5 }, dateDiag: '2026-08-25', proto: 'ifx-iv', specialite: 'Remsima®', j0: add(L(2), -14), heure: '09:00',
    tt: 'Nutrition entérale exclusive (8 semaines, terminée) ; fer per os', allergies: 'Aucune allergie connue', consang: 'oui1', comorb: '—', atcd: { oui: false },
    poids: d => lin(d, [[T0, 20.2], [AUJ, 21.6]]), taille: d => lin(d, [[T0, 117.2], [AUJ, 118.4]]), puberte: DEC.tanner([[T0, 'Tanner 1']]), tanner0: 'Tanner 1',
    cfg: Object.assign({}, VITD), bio: { crp0: 38, cal0: 1520 }, molTdm: 'Infliximab', hb0: 9.8, alb0: 29, calpro0: 1520,
    bilan: d => ({ igra: { statut: 'fait_anormal', date: add(d, -6), commentaire: 'QuantiFERON douteux (indéterminé, mitogène faible) → avis pneumo-pédiatrique demandé' }, vzv: { statut: 'attente', date: add(d, -2), commentaire: 'Sérologie VZV prélevée, résultat attendu (pas d’antécédent certain de varicelle)' }, croiss: { statut: 'fait_anormal', date: d, commentaire: 'Taille −2,1 DS, ralentissement statural sur 12 mois (G1) ; Tanner 1' } })
  },
  { /* traitement antérieur saisi (séances rétrospectives) et arrêté ; cassure staturale puis rattrapage */
    k: 'P9', ipp: '2025-00701', prenom: 'Hiba', nom: 'LAHLOU', sexe: 'F', ddn: '2017-07-12', age: 9, tel: '06 63 19 74 52', medecin: 'moussaddek',
    patho: 'MC', paris: { A: 'A1a', L: 'L3', L4a: true, B: 'B1', G: 'G1', sev: 'une', score: 42.5 }, dateDiag: '2024-11-18', proto: 'ifx-iv', specialite: 'Remsima®', j0: add(L(8), -378), heure: '08:30',
    tt: 'Fer per os ; vitamine D', allergies: 'Aucune allergie connue', consang: 'non', comorb: '—', atcd: { oui: false }, antecedentsBio: '',
    poids: d => lin(d, [[T0, 22.8], ['2026-02-10', 23.6], [AUJ, 27.4]]) + bruit('P9p', d) * 0.15, taille: d => lin(d, [[T0, 124.8], ['2025-11-04', 125.0], ['2026-02-10', 125.5], ['2026-04-07', 126.6], ['2026-07-28', 129.4], [AUJ, 131.4]]), puberte: DEC.tanner([[T0, 'Tanner 1']]), tanner0: 'Tanner 1',
    cfg: Object.assign({}, VITD, SUIVI_RAPPROCHE), bio: { crp0: 24, cal0: 940, calFin: 80, vitd0: 11 }, molTdm: 'Infliximab',
    bilan: d => ({ croiss: { statut: 'fait_anormal', date: d, commentaire: 'Cassure staturale : vitesse de croissance 1,8 cm/an sous adalimumab (taille −1,6 DS) ; Tanner 1' } }),
    retro: [{ c: { protocoleId: 'ada', specialite: 'Humira®', dateDebut: '2025-01-07', dateFin: '2025-09-30', cause: 'Perte de réponse secondaire', motif: 'calprotectine 640 µg/g, cassure staturale ; injections au domicile (autre centre)', remarques: 'Dossier transmis par le CHU de Rabat ; posologie pédiatrique < 40 kg', mode: 'detail', poids: '22' },
      doses: i => i === 0 ? [80, '80 mg'] : i === 1 ? [40, '40 mg'] : [20, '20 mg'], poids: [['2025-01-07', 22.4], ['2025-09-30', 22.8]], remarque: (i, n) => i === n - 1 ? 'Dernière injection : douleurs abdominales, calprotectine 640 µg/g' : '' }]
  },
  { /* vedolizumab : report (rupture de stock), séance corrigée, calprotectine en retard */
    k: 'P10', ipp: '2025-00745', prenom: 'Aya', nom: 'SEBTI', sexe: 'F', ddn: '2012-03-05', age: 14, tel: '06 67 84 05 61', medecin: 'traifi',
    patho: 'RCH', paris: { E: 'E4', sev: 'une', score: 55 }, dateDiag: '2025-07-22', proto: 'vdz-iv', specialite: 'Entyvio®', j0: add(L(9), -378), heure: '13:00',
    tt: 'Mésalazine 75 mg/kg/j (4 g/j)', allergies: 'Aucune allergie connue', consang: 'non', comorb: 'Échec des anti-TNF non applicable (choix d’un anti-intégrine en première ligne, RCH)', atcd: { oui: false },
    poids: d => lin(d, [[T0, 40.2], [AUJ, 45.4]]) + bruit('P10p', d) * 0.3, taille: d => lin(d, [[T0, 151.6], [AUJ, 156.9]]), puberte: DEC.tanner([[T0, 'Tanner 3'], ['2026-07-01', 'Tanner 4']]),
    cfg: Object.assign({}, VITD, { calpro: { periode: 91 } }), bio: { crp0: 21, cal0: 1380, calFin: 160 }, retardIds: ['calpro']
  }
];

/* ---------- dossiers « file active » (figurants fictifs) : remplissent le planning ---------- */
const FIG_NOMS = [['Anas', 'AMRANI', 'M'], ['Kenza', 'ZNIBER', 'F'], ['Ayoub', 'FILALI', 'M'], ['Rim', 'BENNIS', 'F'], ['Hamza', 'NACIRI', 'M'], ['Zineb', 'TAHIRI', 'F'], ['Ismail', 'SKALLI', 'M'], ['Ghita', 'BENKIRANE', 'F'], ['Amine', 'OUAZZANI', 'M'], ['Malak', 'HAJJI', 'F'], ['Walid', 'GUESSOUS', 'M'], ['Sara', 'BOUZIDI', 'F'], ['Youssef', 'ZIANI', 'M'], ['Imane', 'RAHALI', 'F'], ['Ilyas', 'BENCHEKROUN', 'M'], ['Douae', 'MANSOURI', 'F'], ['Taha', 'BELKADI', 'M'], ['Chaimae', 'SLAOUI', 'F'], ['Achraf', 'HAMDAOUI', 'M'], ['Yasmine', 'ENNAJI', 'F'], ['Bilal', 'CHERKAOUI', 'M']];
/* séance du figurant dans les deux semaines affichées : [jour relatif au lundi, heure, rang de la séance (0 = S0, 1 = S2, 2 = S6, 3 = S14…)] */
/* intervalle d'entretien : 56 j (standard), 42 j (« intervalle raccourci »), 28 j (« intensifiée 10 mg/kg ») — rythmes variés pour étaler l'activité des mois passés */
const FIG_PLAN = [[0, '09:00', 4, 56], [0, '11:30', 1, 56], [1, '10:00', 4, 42], [1, '12:30', 2, 56], [2, '08:30', 6, 28], [2, '11:00', 3, 56], [3, '08:00', 2, 56], [3, '12:00', 5, 42], [4, '08:30', 4, 42], [4, '10:00', 1, 56], [4, '12:30', 3, 56],
  [7, '08:30', 5, 42], [7, '12:00', 1, 56], [8, '10:30', 3, 56], [8, '12:30', 1, 56], [9, '08:00', 2, 56], [9, '10:00', 7, 28], [10, '08:00', 1, 56], [10, '11:00', 4, 42], [11, '08:30', 1, 56], [11, '11:30', 3, 56]];
const JOURS_SEANCE = (n, I) => n === 0 ? 0 : n === 1 ? 14 : n === 2 ? 42 : 98 + I * (n - 3);
function figurants() {
  return FIG_NOMS.map(([prenom, nom, sexe], i) => {
    const [j, heure, rang, inter] = FIG_PLAN[i]; const k = 'F' + (i + 1); const age = i === 6 ? 16 : 6 + (hash(k + 'age') % 10); /* 6 à 15 ans, un adolescent de 16 ans */
    const ddn = add(AUJ, -Math.round((age + 0.2 + (hash(k + 'mois') % 9) / 12) * 365.25)); const rch = i % 4 === 1; const vdz = rch && i % 8 === 5;
    const cible = add(LUNDI, j); /* 0–4 : semaine en cours, 7–11 : semaine suivante */
    const j0 = add(cible, -JOURS_SEANCE(rang, inter));
    const a0 = age - 1.2; /* âge au début de la simulation */ const p0 = (a0 < 10 ? 8 + a0 * 2.4 : a0 * 3.3 - 3) * (sexe === 'F' ? 0.96 : 1) + (hash(k + 'p') % 4), t0 = Math.min(sexe === 'F' ? 162 : 176, Math.round(78 + a0 * 6 + (hash(k + 't') % 6)));
    return { k, figurant: true, ipp: `2026-0${1100 + i * 17}`, prenom, nom, sexe, ddn, age, tel: `06 ${60 + (hash(k + 'a') % 30)} ${10 + (hash(k + 'b') % 89)} ${10 + (hash(k + 'c') % 89)} ${10 + (hash(k + 'd') % 89)}`, medecin: ['moussaddek', 'traifi', 'bensabahia'][i % 3],
      patho: rch ? 'RCH' : 'MC', paris: rch ? { E: ['E2', 'E3', 'E4'][i % 3], sev: 'jamais', score: 40 } : { A: age - 1 < 10 ? 'A1a' : 'A1b', L: ['L1', 'L2', 'L3'][i % 3], B: 'B1', G: 'G0', sev: 'jamais', score: 32.5 }, dateDiag: add(j0, -60 - (hash(k + 'dg') % 90)),
      proto: vdz ? 'vdz-iv' : 'ifx-iv', variante: inter === 56 ? null : vdz ? 0 : inter === 42 ? 1 : 2, specialite: vdz ? 'Entyvio®' : ['Remsima®', 'Inflectra®', 'Flixabi®'][i % 3], j0, heure, tt: rch ? 'Mésalazine 60 mg/kg/j' : 'Azathioprine 2 mg/kg/j', allergies: 'Aucune allergie connue', consang: 'non', comorb: '—', atcd: { oui: false },
      poids: d => p0 + diff(T0, d) / 365 * 3.2 + bruit(k, d) * 0.2, taille: d => t0 + diff(T0, d) / 365 * 5.5, puberte: d => age >= 13 ? 'Tanner 3' : age >= 11 ? 'Tanner 2' : 'Tanner 1', tanner0: age >= 13 ? 'Tanner 3' : 'Tanner 1',
      cfg: null, bio: { crp0: 18 + (hash(k + 'crp') % 25), cal0: 700 + (hash(k + 'cal') % 900) }, molTdm: vdz ? null : 'Infliximab' };
  });
}
const DOSSIERS = [...VITRINE, ...figurants()];
DOSSIERS.forEach(sp => { sp.cree = add(sp.j0, -7 - (hash(sp.k + 'cree') % 4)); if (!ouvert(sp.cree)) sp.cree = add(sp.cree, dow(sp.cree) === 6 ? -1 : -2); if (sp.cree < T0) throw new Error(`${sp.k} : création avant le début de la simulation (${sp.cree})`); });

/* =====================================================================
   Événements scénarisés (date, heure, auteur)
   ===================================================================== */
const P = k => DOSSIERS.find(x => x.k === k);
const EV = [];
const ev = (k, date, heure, par, type, o) => EV.push(Object.assign({ k, date, heure, par, type }, o || {}));
/* P1 — modèle : rendez-vous, notes */
ev('P1', add(P('P1').j0, 360), '15:00', 'moussaddek', 'rdv', { r: { type: 'Endoscopie', date: add(P('P1').j0, 365), heure: '08:30', avec: 'moussaddek', objet: 'Iléo-coloscopie de contrôle à 1 an (sous anesthésie générale)' } });
ev('P1', L(-10), '11:15', 'ide1', 'note', { txt: 'Yassine très à l’aise pendant les perfusions ; souhaite participer à la préparation de sa voie (éducation thérapeutique).' });
ev('P1', L(-4), '16:00', 'sec', 'rdv', { r: { type: 'Consultation', date: L(14), heure: '14:00', avec: 'moussaddek', objet: 'Consultation de suivi après la séance du ' + L(0).split('-').reverse().join('/') } });
/* P2 — optimisation après le dosage sous la cible */
{ const p = P('P2'); const dOpt = add(p.j0, 98); ev('P2', dOpt, '15:30', 'traifi', 'posologie', { vals: { type: 'mgkg', valeur: '10', intervalle: '56', intervalle_sem: '8', motif: 'taux résiduel 6,2 µg/mL sous la cible (≥ 10, atteinte périnéale), anticorps non détectés — décision du staff' } });
  ev('P2', dOpt, '15:40', 'traifi', 'note', { titre: 'Staff MICI', txt: 'Taux résiduel 6,2 µg/mL sous la cible de l’atteinte périnéale (≥ 10). Optimisation à 10 mg/kg toutes les 8 semaines à partir de la prochaine perfusion ; IRM pelvienne à 6 mois.' });
  ev('P2', L(-6), '10:30', 'traifi', 'note', { txt: 'Fistule non productive, séton retiré en septembre. Poursuite 10 mg/kg toutes les 8 semaines ; IRM pelvienne de contrôle programmée.' });
  ev('P2', L(-6), '10:40', 'traifi', 'rdv', { r: { type: 'Imagerie', date: L(10), heure: '09:30', avec: 'traifi', objet: 'IRM pelvienne de contrôle (fistule périnéale)' } }); }
/* P3 — éducation à l'injection */
ev('P3', add(P('P3').j0, 0), '15:30', 'ide2', 'note', { txt: 'Éducation à l’auto-injection débutée avec la mère (stylo prérempli) ; prochaines injections à l’HDJ jusqu’à autonomie.' });
ev('P3', L(-3), '09:00', 'sec', 'rdv', { r: { type: 'Éducation', date: L(2), heure: '14:30', avec: 'ide2', objet: 'Éducation thérapeutique — auto-injection (2e séance)' } });
/* P4 — perte de réponse puis ustékinumab */
ev('P4', '2026-05-06', '14:00', 'traifi', 'note', { titre: 'Perte de réponse', txt: 'Douleurs abdominales et réveils nocturnes depuis 6 semaines, calprotectine 980 µg/g, CRP 18 mg/L. Taux résiduel d’infliximab dans la cible (6,1 µg/mL), anticorps non détectés : échec de mécanisme. Dossier présenté au staff.' });
ev('P4', '2026-06-15', '11:00', 'traifi', 'changer', { vals: { protocoleId: 'ust', specialite: 'Stelara®', variante: '', date: '2026-06-22', poids: '41.4', debut: 'induction', heure: '10:30', motif: 'Perte de réponse secondaire : calprotectine 980 µg/g, CRP 18 mg/L malgré un taux résiduel d’infliximab dans la cible (6,1 µg/mL, anticorps non détectés) — changement de classe décidé en staff' } });
ev('P4', L(-5), '10:00', 'sec', 'rdv', { r: { type: 'Consultation', date: L(0), heure: '14:00', avec: 'traifi', objet: 'Réévaluation sous ustékinumab (S20)' } });
/* P5 — suspension en cours */
ev('P5', L(-3), '15:30', 'moussaddek', 'note', { txt: 'Appel de la mère : fièvre 39 °C depuis 48 h, toux. Vue aux urgences : pneumopathie basale droite, amoxicilline débutée.' });
ev('P5', L(-3), '16:00', 'moussaddek', 'suspendre', { vals: { motif: 'Pneumopathie fébrile sous amoxicilline — perfusion différée, reprise après avis du médecin référent' } });
ev('P5', L(-3), '16:10', 'sec', 'rdv', { r: { type: 'Consultation', date: L(3), heure: '11:30', avec: 'moussaddek', objet: 'Réévaluation avant reprise de l’infliximab (pneumopathie)' } });
/* P6 — allergie au latex (note épinglée), réaction puis prémédication */
ev('P6', P('P6').j0, '07:45', 'ide1', 'note', { titre: 'Allergie au latex', txt: 'Allergie au latex : gants nitrile et matériel sans latex pour toute pose de voie veineuse.', epingle: true });
ev('P6', L(-4), '12:00', 'ide2', 'note', { txt: 'Prémédication adaptée au poids rappelée à l’équipe : paracétamol 15 mg/kg per os et dexchlorphéniramine 0,1 mg/kg IV, 30 min avant la perfusion.' });
/* P7 — adolescente : séance manquée puis replanifiée ; note épinglée ; retard de bilan */
{ const p = P('P7'); const dM = add(p.j0, 210); /* séance S30 */ ev('P7', dM, '15:30', 'ide1', 'manquee', { cure: dM, vals: { motif: 'Patiente non venue, famille injoignable le matin' } });
  ev('P7', add(dM, 1), '15:00', 'sec', 'note', { titre: 'Contact famille', txt: 'Mère joignable uniquement l’après-midi (après 14 h) : appeler le 06 61 58 26 34 pour toute convocation.', epingle: true });
  ev('P7', add(dM, 1), '15:10', 'sec', 'reporter', { cure: dM, statutCure: 'manquee', vals: { date: add(dM, 3), heure: '13:00', categorie: 'patient', motif: 'séance manquée, replanifiée avec la mère', suite: 'garder' } });
  ev('P7', L(-5), '10:00', 'sec', 'rdv', { r: { type: 'Consultation', date: L(7), heure: '14:30', avec: 'bensabahia', objet: 'Consultation de transition (16 ans) : préparation du passage en service adulte' } }); }
/* P8 — induction, avis pour le QuantiFERON */
ev('P8', add(P('P8').j0, -2), '14:00', 'bensabahia', 'note', { titre: 'Avis pneumo-pédiatrique', txt: 'QuantiFERON indéterminé, radiographie thoracique normale, pas de contage : biothérapie autorisée. QuantiFERON de contrôle à 3 mois.' });
ev('P8', add(P('P8').j0, 0), '13:00', 'ide2', 'note', { txt: 'Première perfusion bien tolérée ; enfant anxieux à la pose de la voie (crème anesthésiante à prévoir).' });
ev('P8', add(P('P8').j0, 1), '09:00', 'sec', 'rdv', { r: { type: 'Consultation', date: L(2), heure: '11:30', avec: 'bensabahia', objet: 'Point après S2 : tolérance, sérologie VZV' } });
/* P9 — IRM annulée à reprogrammer ; croissance */
ev('P9', L(-6), '09:30', 'moussaddek', 'survAnnuler', { survId: 'irm', note: true });
ev('P9', L(-6), '09:40', 'moussaddek', 'note', { txt: 'Entéro-IRM annulée : enfant fébrile, sédation impossible. À reprogrammer après guérison.' });
ev('P9', L(-14), '12:30', 'ide1', 'note', { txt: 'Reprise de la croissance : +2,8 cm depuis avril ; la famille est rassurée.' });
ev('P9', L(-4), '10:00', 'sec', 'rdv', { r: { type: 'Endoscopie', date: L(11), heure: '08:00', avec: 'moussaddek', objet: 'Iléo-coloscopie et FOGD sous anesthésie (réévaluation à 1 an)' } });
/* P10 — rupture de stock, séance corrigée */
{ const p = P('P10'); const dR = add(p.j0, 154 + 56 * 1); /* S30 */ ev('P10', add(dR, -2), '11:00', 'ide2', 'reporter', { cure: dR, vals: { date: add(dR, 7), heure: '13:00', categorie: 'stock', motif: 'rupture du vedolizumab 300 mg à la pharmacie', suite: 'garder' } });
  ev('P10', add(dR, -2), '11:10', 'sec', 'note', { txt: 'Famille prévenue du report (rupture de stock du vedolizumab), nouvelle date confirmée par téléphone.' });
  const dC = add(p.j0, 266); /* séance S38 */ ev('P10', add(dC, 2), '10:00', 'traifi', 'corriger', { cureReelle: dC, vals: { lot: 'ENT26B181' } });
  ev('P10', L(-3), '11:00', 'sec', 'rdv', { r: { type: 'Biologie', date: L(4), heure: '09:00', avec: 'traifi', objet: 'Calprotectine fécale (contrôle en retard)' } }); }
EV.forEach(e => { if (!ouvert(e.date)) throw new Error(`événement ${e.k} ${e.type} un jour fermé : ${e.date}`); if (e.date >= AUJ) throw new Error(`événement ${e.k} ${e.type} non passé : ${e.date}`); });
/* séances à saisir avec une particularité */
const SEANCES = {
  P6: (c, k) => k === 6 ? { tolerance: 'Réaction mineure (gérée, perfusion terminée)', commentaire: 'prurit et flush du visage à 40 min — perfusion arrêtée 15 min, dexchlorphéniramine IV, reprise à débit réduit sans récidive', premedication: 'Aucune' }
    : k > 6 ? { premedication: 'Paracétamol 1 g + dexchlorphéniramine 5 mg IV', premedDefaut: k === 7 } : null,
  P7: (c) => null
};
/* séance à ne pas marquer réalisée le jour prévu (gérée par un événement) */
const sautSeance = (sp, d) => EV.some(e => e.k === sp.k && e.type === 'manquee' && e.cure === d);

module.exports = { DOSSIERS, EV };
if (require.main !== module) return;

/* =====================================================================
   Pilotage de la page
   ===================================================================== */
const OUTILS = () => {
  const R = window.RYZE, S = R.S;
  window.__V = {
    el(ds, extra) { return Object.assign({ dataset: Object.assign({}, ds || {}), value: '', checked: false, closest: () => null }, extra || {}); },
    toasts() { const t = document.getElementById('toast-root'); return t ? t.innerText.replace(/\s+/g, ' ').trim() : ''; },
    viderToasts() { const t = document.getElementById('toast-root'); if (t) t.innerHTML = ''; },
    remplir(f, vals) {
      for (const [k, v] of Object.entries(vals || {})) {
        const els = [...f.querySelectorAll(`[name="${k}"]`)]; if (!els.length) throw new Error('champ absent : ' + k);
        const e0 = els[0];
        if (e0.type === 'radio') { els.forEach(e => { e.checked = e.value === String(v); }); const c = els.find(e => e.checked); if (!c) throw new Error(`choix absent : ${k}=${v}`); c.dispatchEvent(new Event('change', { bubbles: true })); }
        else if (e0.type === 'checkbox') { const arr = Array.isArray(v) ? v.map(String) : null; els.forEach(e => { e.checked = arr ? arr.includes(e.value) : !!v; }); }
        else if (e0.tagName === 'SELECT') { if (![...e0.options].some(o => o.value === String(v))) throw new Error(`option absente : ${k}=${v} (${[...e0.options].map(o => o.value).join(' | ')})`); e0.value = String(v); e0.dispatchEvent(new Event('change', { bubbles: true })); }
        else { e0.value = v == null ? '' : String(v); e0.dispatchEvent(new Event('input', { bubbles: true })); e0.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    },
    /* ouvre une fenêtre par l'action réelle, remplit, valide (événement submit : délégation et droits de l'application) */
    fenetre(action, ds, vals, extra) {
      R.closeModal(); this.viderToasts(); R.actions[action](this.el(ds, extra));
      const f = document.querySelector('#modal-root form'); if (!f) throw new Error(`pas de fenêtre pour ${action} : ${this.toasts()}`);
      this.remplir(f, vals); const g = document.querySelector('#modal-root form') || f;
      const inv = [...g.querySelectorAll(':invalid')].map(e => e.name).filter(Boolean);
      if (inv.length) throw new Error(`${action} : champs invalides ${inv.join(', ')}`);
      g.requestSubmit();
      if (g.isConnected && document.querySelector('#modal-root form') === g) throw new Error(`${action} : non enregistré — ${this.toasts()}`);
      R.closeModal();
    },
    /* formulaire de page (hors fenêtre) : FormData construit comme le navigateur, handler réel */
    soumettre(action, obj) { if (!R.autorise(action)) throw new Error('droits : ' + action); const fd = new FormData(); Object.entries(obj).forEach(([k, v]) => { if (Array.isArray(v)) v.forEach(x => fd.append(k, x)); else if (v !== false && v != null) fd.append(k, v); }); R.actions[action](null, fd); },
    pid: ipp => { const p = S.patients.find(x => x.ipp === ipp); if (!p) throw new Error('dossier introuvable : ' + ipp); return p; },
    uid: nom => { const u = S.users.find(x => x.nom === nom); if (!u) throw new Error('code introuvable : ' + nom); return u.id; },
    connecte(nom) { R.session(this.uid(nom)); },
    calme() { R.closeModal(); if (S.route.page !== 'equipe') { S.route = { page: 'equipe', params: {} }; } }
  };
};

async function principal() {
  fs.mkdirSync(OUT, { recursive: true });
  log(`Vitrine — aujourd’hui ${AUJ}, lundi de référence ${LUNDI}, simulation depuis le ${T0} ; ${DOSSIERS.length} dossiers`);
  const nav = await chromium.launch({ executablePath: CHROMIUM, args: ARGS });
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 }, locale: 'fr-FR', timezoneId: 'UTC', acceptDownloads: true });
  const page = await ctx.newPage();
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message)); page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); }); page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.clock.install({ time: instant(T0, '07:30') });
  let tCourant = 0; /* horloge de la page toujours croissante */
  const heure = async (date, h) => { let t = instant(date, h).getTime(); if (t <= tCourant) t = tCourant + 60000; tCourant = t; await page.clock.setSystemTime(new Date(t)); };
  await page.goto(APP_URL); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload(); await page.waitForSelector('#login-code');
  await page.fill('#login-code', 'MED001'); await page.click('form[data-form="loginCode"] button[type=submit]'); await page.waitForSelector('.shell');
  await page.evaluate(OUTILS);
  const E = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { throw new Error(String(e.message).split('\n')[0]); } };

  /* ---------- base vide, équipe, paramètres ---------- */
  await E(() => { const R = window.RYZE; R.actions.viderDemo(); R.closeModal(); });
  await E(eq => { const R = window.RYZE, S = R.S, V = window.__V;
    eq.forEach(u => { V.fenetre('userAjouter', {}, { titre: u.titre, nom: u.nom, prenom: u.prenom, fonction: u.fonction, role: u.role, medecin: u.medecin }); const x = S.users.find(y => y.nom === u.nom); x.code = u.code; x.prenom = u.prenom; });
    R.touch(); V.connecte('MOUSSADDEK');
    S.users.filter(u => !eq.some(e => e.nom === u.nom)).map(u => u.id).forEach(id => { R.actions.userSupprimerOk(V.el({ id })); });
    R.closeModal(); }, EQUIPE);
  await E(reg => { const R = window.RYZE, V = window.__V; R.go('parametres'); const f = document.querySelector('form[data-form="settingsSave"]'); V.remplir(f, reg); f.requestSubmit(); R.actions.impressionCouleur(V.el({}, { value: '1' })); R.go('equipe'); }, REGLAGES);
  const nomDe = k => EQUIPE.find(u => u.k === k).nom;

  /* ---------- simulation jour par jour ---------- */
  const evts = EV.slice().sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  const ides = ['OUAHBI', 'ZEMMOURI'];
  let nSeances = 0, nCtrl = 0, nEv = 0;
  const rangSeance = {}; /* nombre de séances réalisées par dossier (rang de la séance) */
  for (let d = T0; d < AUJ; d = add(d, 1)) {
    if (!ouvert(d)) continue;
    /* 1. créations de dossiers (assistant) */
    for (const sp of DOSSIERS.filter(x => x.cree === d)) {
      await heure(d, '08:10');
      const o = { d: { nom: sp.nom, prenom: sp.prenom, ddn: sp.ddn, sexe: sp.sexe, ipp: sp.ipp, tel: sp.tel, poids: String(Math.round(sp.poids(d) * 10) / 10), taille: String(Math.round(sp.taille(d) * 10) / 10), pathologie: sp.patho, paris: sp.paris, dateDiag: sp.dateDiag, traitementsAssocies: sp.tt, allergies: sp.allergies, antecedentsBio: sp.antecedentsBio != null ? sp.antecedentsBio : 'Aucune biothérapie antérieure', comorbidites: sp.comorb, consanguinite: sp.consang, atcdFam: sp.atcd },
        medecin: nomDe(sp.medecin), proto: sp.proto, variante: sp.variante == null ? null : sp.variante, specialite: sp.specialite, j0: sp.j0, heure: sp.heure, horizon: Math.max(365, diff(sp.j0, AUJ) + 300), cfg: sp.cfg, bilan: bilanPre(sp, add(d, -3)),
        retro: (sp.retro || []).map(r => ({ c: r.c, doses: [0, 1, 2].map(i => r.doses(i)), poids: r.poids, rem: 'Dernière injection : douleurs abdominales, calprotectine 640 µg/g' })) };
      await E(o => { const R = window.RYZE, S = R.S, V = window.__V; V.connecte(o.medecin); R.closeModal(); R.ui.w = null; if (S.brouillons) delete S.brouillons[S.user];
        R.go('nouveau'); const w = R.ui.w; if (!w) throw new Error('assistant absent');
        Object.assign(w.d, o.d, { paris: Object.assign({}, o.d.paris), medecinId: V.uid(o.medecin) }); R.sevSync(w.d.paris, w.d.pathologie);
        R.actions.wProto(V.el({ id: o.proto })); if (o.variante != null) R.actions.wVariante(V.el({}, { value: String(o.variante) })); w.specialite = o.specialite; w.dateDebut = o.j0; w.heure = o.heure; w.horizon = o.horizon; w.carnetMixte = true;
        if (o.cfg) Object.keys(o.cfg).forEach(k => { w.cfg.items[k] = Object.assign(w.cfg.items[k] || {}, o.cfg[k], { on: true }); });
        o.bilan.forEach(b => { const x = w.bilan.find(y => y.id === b.id); if (x) Object.assign(x, b); else w.bilan.push(b); });
        (o.retro || []).forEach(r => { R.actions.retroOuvrir(V.el({ ctx: 'w' })); const st = R.ui.retro; Object.assign(st.c, r.c); R.actions.retroGenerer(); const n = st.c.seances.length;
          const t0 = R.parse(r.poids[0][0]).getTime(), t1 = R.parse(r.poids[1][0]).getTime();
          st.c.seances.forEach((x, i) => { const [dose, txt] = r.doses[Math.min(i, 2)]; x.dose = dose; x.doseTexte = txt; const t = R.parse(x.date).getTime(); x.poids = String(Math.round((r.poids[0][1] + (r.poids[1][1] - r.poids[0][1]) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))) * 10) / 10); x.remarque = i === n - 1 ? r.rem : ''; });
          R.actions.retroEnregistrer(); if (R.ui.retro) throw new Error('traitement antérieur non enregistré : ' + V.toasts()); });
        R.actions.wCreate(); const p = S.patients.find(x => x.ipp === o.d.ipp); if (!p) throw new Error(`dossier non créé (${o.d.nom}) : ${V.toasts()}`); V.calme(); }, o);
    }
    /* 2. événements du matin (avant 12 h) */
    const lancer = async e => {
      await heure(d, e.heure); nEv++;
      await E(([e, nom]) => { const R = window.RYZE, S = R.S, V = window.__V; V.connecte(nom); const p = V.pid(e.ipp);
        const cure = (date, st) => { const c = p.cures.find(x => x.statut === (st || 'prevue') && x.datePrevue === date); if (!c) throw new Error(`séance du ${date} introuvable (${p.nom})`); return c; };
        switch (e.type) {
          case 'note': V.soumettre('noteAdd', { pid: p.id, titre: e.titre || '', txt: e.txt, epingle: e.epingle ? '1' : false }); break;
          case 'rdv': V.fenetre('rdvAjouter', { pid: p.id, date: e.r.date }, { type: e.r.type, date: e.r.date, heure: e.r.heure, avec: V.uid(e.r.avecNom), objet: e.r.objet }); break;
          case 'posologie': V.fenetre('posologieModifier', { pid: p.id }, e.vals); break;
          case 'changer': V.fenetre('protoChangerAncien', { pid: p.id }, e.vals); break;
          case 'suspendre': V.fenetre('patientSuspendre', { pid: p.id }, e.vals); break;
          case 'manquee': V.fenetre('cureManquee', { pid: p.id, n: cure(e.cure).n }, e.vals); break;
          case 'reporter': V.fenetre('cureReporter', { pid: p.id, n: cure(e.cure, e.statutCure).n }, e.vals); break;
          case 'corriger': { const c = p.cures.find(x => x.statut === 'realisee' && x.dateReelle === e.cureReelle); if (!c) throw new Error('séance à corriger introuvable ' + e.cureReelle); V.fenetre('cureModifier', { pid: p.id, n: c.n }, e.vals); break; }
          case 'survAnnuler': { const i = p.surveillance.findIndex(s => s.id === e.survId && s.statut === 'prevue'); if (i < 0) throw new Error('contrôle à annuler introuvable'); R.actions.survAnnuler(V.el({ params: JSON.stringify({ pid: p.id, i }) })); break; }
          default: throw new Error('événement inconnu ' + e.type);
        }
        V.calme(); }, [Object.assign({}, e, { ipp: P(e.k).ipp, r: e.r ? Object.assign({}, e.r, { avecNom: nomDe(e.r.avec) }) : undefined }), nomDe(e.par)]);
    };
    for (const e of evts.filter(x => x.date === d && x.heure < '12:00')) await lancer(e);
    /* 3. état du jour : séances prévues et contrôles échus */
    const etat = await E(d => window.RYZE.S.patients.map(p => ({ ipp: p.ipp, statut: p.statut,
      cures: p.cures.filter(c => c.statut === 'prevue' && c.datePrevue <= d).map(c => ({ n: c.n, d: c.datePrevue, heure: c.heure || '09:00', voie: c.voie, label: c.label, phase: c.phase, articleId: c.articleId, protocoleId: c.protocoleId, doseTexte: c.doseTexte })),
      surv: p.surveillance.map((s, i) => ({ i, id: s.id, nom: s.nom || '', statut: s.statut, mode: s.mode, echeance: s.echeance })).filter(s => s.statut === 'prevue' && s.mode === 'echeance' && s.echeance && s.echeance <= d) })), d);
    /* 4. contrôles échus : faits le jour même (avant la perfusion) par le médecin référent */
    for (const pe of etat) {
      const sp = DOSSIERS.find(x => x.ipp === pe.ipp); if (pe.statut === 'suspendu') continue;
      for (const s of pe.surv) {
        if ((sp.retardIds || []).includes(s.id) && diff(s.echeance, AUJ) <= 45) continue; /* contrôle laissé en retard */
        if (sp.k === 'P7' && s.id === 'biostd' && diff(s.echeance, AUJ) <= 45 && diff(s.echeance, AUJ) > 20) continue;
        await heure(d, '08:20'); nCtrl++;
        const vals = Object.assign({ date: d }, resultatControle(sp, s, d));
        await E(([ipp, i, vals, nom]) => { const V = window.__V; V.connecte(nom); V.fenetre('survSaisir', { pid: V.pid(ipp).id, i: String(i) }, vals); V.calme(); }, [pe.ipp, s.i, vals, nomDe(sp.medecin)]);
      }
    }
    /* 5. séances du jour : marquées réalisées par les IDE (fenêtre « Marquer réalisée ») */
    const jour = etat.flatMap(pe => pe.cures.filter(c => c.d === d).map(c => ({ pe, c }))).sort((a, b) => a.c.heure.localeCompare(b.c.heure));
    for (const { pe, c } of jour) {
      const sp = DOSSIERS.find(x => x.ipp === pe.ipp); if (sautSeance(sp, d)) continue;
      const k = rangSeance[sp.k] = (rangSeance[sp.k] || 0) + 1;
      const ide = ides[(hash(sp.k + d) % 2)]; const hFin = String(Math.min(17, +c.heure.slice(0, 2) + (c.voie === 'IV' ? 2 : 0))).padStart(2, '0') + c.heure.slice(2);
      await heure(d, hFin); nSeances++;
      const iv = c.voie === 'IV', art = c.articleId || '';
      const v = Object.assign({ dateReelle: d, heure: c.heure, poids: (Math.round(sp.poids(d) * 10) / 10).toFixed(1), lot: lotDe(art, d), premedication: 'Aucune', duree: !iv ? '— (SC / PO)' : sp.proto === 'vdz-iv' ? '30 min' : c.phase === 'Induction' ? '2 h' : '1 h',
        ta: iv ? `${98 + Math.round(6 + bruit(sp.k, d, 'tas') * 8)}/${58 + Math.round(4 + bruit(sp.k, d, 'tad') * 5)}` : '', fc: iv ? String(Math.round(88 - sp.age + bruit(sp.k, d, 'fc') * 8)) : '', temp: iv ? (36.7 + bruit(sp.k, d, 't') * 0.25).toFixed(1) : '', tolerance: 'Bonne', commentaire: '' }, clinique(sp, d));
      if (sp.k === 'P4' && c.protocoleId === 'ust') v.lot = lotDe(c.voie === 'IV' ? 'UST130' : 'UST90', d);
      if (sp.k === 'P3') v.lot = lotDe(c.articleId || 'ADA40', d);
      const ex = SEANCES[sp.k] && SEANCES[sp.k](c, k); if (ex) Object.assign(v, ex);
      if (ex && ex.premedDefaut === false) delete v.premedDefaut;
      await E(([ipp, n, v, nom]) => { const R = window.RYZE, V = window.__V; V.connecte(nom); const p = V.pid(ipp); const premedAvant = p.premedication;
        if (!v.premedDefaut && p.premedication && p.premedication !== 'Aucune' && v.premedication === 'Aucune') v.premedication = p.premedication;
        R.closeModal(); R.actions.cureEnregistrer(V.el({ pid: p.id, n: String(n) })); const f = document.querySelector('#modal-root form'); if (!f) throw new Error('fenêtre séance absente : ' + V.toasts());
        const vals = Object.assign({}, v); if (!f.querySelector('[name="cl_perineal"]')) { delete vals.cl_perineal; delete vals.cl_cutaneNote; } if (!vals.cl_perineal) { vals.cl_perineal = []; } if (!vals.cl_douleur) vals.cl_douleur = false;
        if (!f.querySelector('[name="flaconsUtilises"]')) delete vals.flaconsUtilises;
        V.remplir(f, vals); f.requestSubmit(); if (f.isConnected && document.querySelector('#modal-root form') === f) throw new Error(`séance ${n} de ${p.nom} non enregistrée : ${V.toasts()}`); V.calme(); }, [pe.ipp, c.n, v, ide]);
    }
    /* 6. événements de l'après-midi */
    for (const e of evts.filter(x => x.date === d && x.heure >= '12:00')) await lancer(e);
    if (dow(d) === 5) log(`  ${d} : ${nSeances} séances, ${nCtrl} contrôles, ${nEv} événements`);
  }

  /* ---------- export de la base construite ---------- */
  await heure(AUJ, '07:45');
  const texte = await E(() => { const R = window.RYZE; R.closeModal(); window.RYZE.S.route = { page: 'dashboard', params: {} }; return R.texteBase(); });
  log(`Simulation terminée : ${nSeances} séances, ${nCtrl} contrôles, ${nEv} événements ; erreurs JS : ${erreurs.length}`); erreurs.slice(0, 10).forEach(x => log('  ! ' + x));
  await ctx.close();

  /* ---------- horloge réelle : rechargement, connexion, « Exporter la base » ---------- */
  const ctx2 = await nav.newContext({ viewport: { width: 1360, height: 900 }, locale: 'fr-FR', acceptDownloads: true });
  const pg = await ctx2.newPage(); const err2 = []; pg.on('pageerror', e => err2.push(e.message)); pg.on('console', m => { if (m.type() === 'error') err2.push(m.text()); });
  await pg.goto(APP_URL); await pg.evaluate(t => { localStorage.clear(); localStorage.setItem('ryze-hdj-v1', t); }, texte); await pg.reload(); await pg.waitForSelector('#login-code');
  await pg.fill('#login-code', 'AAA111'); await pg.click('form[data-form="loginCode"] button[type=submit]'); await pg.waitForSelector('.shell');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.evaluate(() => window.RYZE.actions.exporterBase())]);
  const fichier = path.join(OUT, dl.suggestedFilename()); await dl.saveAs(fichier);
  const exporte = fs.readFileSync(fichier, 'utf8'); const s = JSON.parse(exporte);
  /* la vitrine s'ouvre sur le tableau de bord, sans trace de la date d'export */
  s.route = { page: 'dashboard', params: {} };
  fs.writeFileSync(SORTIE, JSON.stringify(s));
  log(`Écrit : ${SORTIE} (${Math.round(fs.statSync(SORTIE).size / 1024)} Ko, version ${s.version}, ${s.patients.length} dossiers) ; erreurs JS au rechargement : ${err2.length}`);
  await ctx2.close(); await nav.close();
  if (VERIFIER) require('./verifier-vitrine.js').verifier(SORTIE).then(code => process.exit(code));
}
principal().catch(e => { console.error('ÉCHEC : ' + (e && e.stack || e)); process.exit(1); });
