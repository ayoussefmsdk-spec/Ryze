/* =====================================================================
   Ryze — Suivi biothérapique HDJ
   data.js : référentiels cliniques, catalogues, générateurs et jeu de
   démonstration. Les données patients sont FICTIVES (démonstration).
   ===================================================================== */
'use strict';
window.RYZE = window.RYZE || {};
(function (R) {

  /* ---------- Utilitaires date ---------- */
  const pad = n => String(n).padStart(2, '0');
  R.iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  R.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  R.addDays = (s, n) => { const d = R.parse(s); d.setDate(d.getDate() + n); return R.iso(d); };
  R.diffDays = (a, b) => Math.round((R.parse(b) - R.parse(a)) / 86400000);
  R.today = () => R.iso(new Date());
  R.lundi = (s) => { const d = R.parse(s); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return R.iso(d); };
  /* Semaine de référence de l'HDJ : semaine en cours du lundi au vendredi ; le week-end, la semaine à venir */
  R.semaineRef = () => { const t = R.today(); const wd = R.parse(t).getDay(); return (wd === 0 || wd === 6) ? R.addDays(R.lundi(t), 7) : R.lundi(t); };
  R.fmtDate = (s, opts) => s ? R.parse(s).toLocaleDateString('fr-FR', opts || { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  R.fmtDateLong = s => s ? R.parse(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  R.fmtMois = s => R.parse(s).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  R.age = ddn => { const d = R.parse(ddn), t = new Date(); let a = t.getFullYear() - d.getFullYear(); const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--; return a; };
  R.libelleJour = j => j === 0 ? 'S0' : (j % 7 === 0 ? `S${j / 7}` : `J${j}`);
  /* Décale une date tombant un week-end au lundi suivant (l'HDJ fonctionne du lundi au vendredi) */
  R.jourOuvre = d => { const wd = R.parse(d).getDay(); return wd === 6 ? R.addDays(d, 2) : wd === 0 ? R.addDays(d, 1) : d; };

  /* ---------- Accès : deux niveaux ---------- */
  R.ROLES = {
    complet: { label: 'Accès complet', court: 'COMPLET', desc: 'Dossiers et prescriptions, protocoles, stock, planning, équipe et codes d’accès.' },
    hdj:     { label: 'Accès hôpital de jour', court: 'HDJ', desc: 'Marquer les cures réalisées, gérer le planning et les rendez-vous, ajouter du stock, imprimer le carnet. Pas de modification des protocoles, des dossiers ni de l’équipe.' }
  };
  R.MODULES = [
    { id: 'dashboard',  label: 'Tableau de bord' },
    { id: 'patients',   label: 'Patients (consultation)' },
    { id: 'dossier',    label: 'Dossier & prescription' },
    { id: 'cures',      label: 'Cures (marquer réalisée, reporter)' },
    { id: 'planning',   label: 'Planning HDJ' },
    { id: 'protocoles', label: 'Protocoles' },
    { id: 'stock',      label: 'Stock & pharmacie' },
    { id: 'equipe',     label: 'Équipe & codes d’accès' },
    { id: 'carnet',     label: 'Carnet de suivi' }
  ];
  /* rw = lecture/écriture, r = lecture, - = aucun accès */
  R.PERMS = {
    complet: { dashboard: 'rw', patients: 'rw', dossier: 'rw', cures: 'rw', planning: 'rw', protocoles: 'rw', stock: 'rw', equipe: 'rw', carnet: 'rw' },
    hdj:     { dashboard: 'r',  patients: 'r',  dossier: 'r',  cures: 'rw', planning: 'rw', protocoles: 'r',  stock: 'rw', equipe: '-',  carnet: 'r'  }
  };

  /* ---------- Pathologies ---------- */
  R.PATHOS = {
    MC:  { label: 'Maladie de Crohn', court: 'MC' },
    RCH: { label: 'Rectocolite hémorragique', court: 'RCH' },
    MICI_I: { label: 'Colite inclassée', court: 'MICI-I' }
  };

  /* ---------- Catalogue des molécules / articles de stock ---------- */
  R.ARTICLES = [
    { id: 'IFX100', dci: 'Infliximab',   libelle: 'Infliximab 100 mg — poudre pour sol. à diluer (flacon)', unite: 100, uniteLib: 'mg', voie: 'IV', conservation: '2–8 °C, à l’abri de la lumière', stabilite: 'RCP actuel : stabilité physico-chimique du reconstitué/dilué 28 j à 2–8 °C + 24 h à 25 °C ; microbiologiquement, débuter la perfusion dans les 3 h. Filtre en ligne ≤ 1,2 µm. Flacon : ≤ 30 °C pendant 6 mois max (une seule fois).', serie: 1 },
    { id: 'VDZ300', dci: 'Vedolizumab',  libelle: 'Vedolizumab 300 mg — poudre pour sol. à diluer (flacon)', unite: 300, uniteLib: 'mg', voie: 'IV', conservation: '2–8 °C', stabilite: 'Reconstitué : 8 h à 2–8 °C. Dilué dans 250 mL NaCl 0,9 % : 12 h à 20–25 °C ou 24 h à 2–8 °C.', serie: 2 },
    { id: 'UST130', dci: 'Ustekinumab',  libelle: 'Ustekinumab 130 mg/26 mL — sol. à diluer IV (flacon)', unite: 130, uniteLib: 'mg', voie: 'IV', conservation: '2–8 °C', stabilite: 'Dilué qsp 250 mL NaCl 0,9 % uniquement : 8 h à 15–25 °C, perfusion terminée dans les 8 h ; perfusion ≥ 1 h, filtre 0,2 µm.', serie: 3 },
    { id: 'UST90',  dci: 'Ustekinumab',  libelle: 'Ustekinumab 90 mg/1 mL — seringue préremplie SC', unite: 90, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C (30 j max à T° ambiante ≤ 30 °C)', stabilite: 'Sortir 30 min avant injection.', serie: 3 },
    { id: 'RZB600', dci: 'Risankizumab', libelle: 'Risankizumab 600 mg/10 mL — sol. à diluer IV (flacon)', unite: 600, uniteLib: 'mg', voie: 'IV', conservation: '2–8 °C', stabilite: 'Dilué dans NaCl 0,9 % ou G5 % (1,2–6 mg/mL) : 20 h à 2–8 °C ou 8 h ≤ 25 °C ; perfusion ≥ 1 h (MC) / ≥ 2 h (RCH).', serie: 4 },
    { id: 'RZB360', dci: 'Risankizumab', libelle: 'Risankizumab 360 mg/2,4 mL — cartouche SC (injecteur)', unite: 360, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C', stabilite: 'Hors frigo ≤ 25 °C : 24 h max. Existe aussi en cartouche 180 mg/1,2 mL (RCH).', serie: 4 },
    { id: 'MIR300', dci: 'Mirikizumab',  libelle: 'Mirikizumab 300 mg/15 mL — sol. à diluer IV (flacon)', unite: 300, uniteLib: 'mg', voie: 'IV', conservation: '2–8 °C', stabilite: 'Dilué dans 100–250 mL NaCl 0,9 % ou G5 % ; perfusion ≥ 30 min (RCH) / ≥ 90 min (MC). Stabilité après dilution : se référer au RCP en vigueur.', serie: 5 },
    { id: 'MIR100', dci: 'Mirikizumab',  libelle: 'Mirikizumab 100 mg/1 mL — stylo prérempli SC', unite: 100, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C (≤ 30 °C 2 semaines max)', stabilite: 'Existe aussi en stylo 200 mg/2 mL.', serie: 5 },
    { id: 'GUS200', dci: 'Guselkumab',   libelle: 'Guselkumab 200 mg/20 mL — sol. à diluer IV (flacon)', unite: 200, uniteLib: 'mg', voie: 'IV', conservation: '2–8 °C', stabilite: 'Dilué dans 250 mL NaCl 0,9 % (0,8 mg/mL) : 10 h ≤ 25 °C ; perfusion ≥ 1 h.', serie: 6 },
    { id: 'GUS100', dci: 'Guselkumab',   libelle: 'Guselkumab 100 mg/1 mL — stylo prérempli SC', unite: 100, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C', stabilite: '', serie: 6 },
    { id: 'ADA40',  dci: 'Adalimumab',   libelle: 'Adalimumab 40 mg/0,4 mL — stylo prérempli SC', unite: 40, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C (14 j max à T° ambiante ≤ 25 °C)', stabilite: '', serie: 7 },
    { id: 'GOL50',  dci: 'Golimumab',    libelle: 'Golimumab 50 mg/0,5 mL — stylo prérempli SC', unite: 50, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C', stabilite: '', serie: 8 },
    { id: 'IFX120', dci: 'Infliximab',   libelle: 'Infliximab 120 mg/1 mL — stylo prérempli SC (CT-P13 SC)', unite: 120, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C (≤ 25 °C 28 j max)', stabilite: '', serie: 1 },
    { id: 'VDZ108', dci: 'Vedolizumab',  libelle: 'Vedolizumab 108 mg/0,68 mL — stylo prérempli SC', unite: 108, uniteLib: 'mg', voie: 'SC', conservation: '2–8 °C (≤ 25 °C 7 j max)', stabilite: '', serie: 2 },
    { id: 'NACL250', dci: 'Consommable', libelle: 'NaCl 0,9 % 250 mL — poche', unite: 1, uniteLib: 'u', voie: '—', conservation: 'T° ambiante', stabilite: '', serie: 0 },
    { id: 'SETF12', dci: 'Consommable',  libelle: 'Set de perfusion avec filtre en ligne 1,2 µm', unite: 1, uniteLib: 'u', voie: '—', conservation: 'T° ambiante', stabilite: '', serie: 0 },
    { id: 'HCORT100', dci: 'Prémédication', libelle: 'Hydrocortisone 100 mg — poudre inj.', unite: 100, uniteLib: 'mg', voie: 'IV', conservation: 'T° ambiante', stabilite: '', serie: 0 },
    { id: 'DEXCHLO5', dci: 'Prémédication', libelle: 'Dexchlorphéniramine 5 mg/mL — amp. inj.', unite: 5, uniteLib: 'mg', voie: 'IV', conservation: 'T° ambiante', stabilite: '', serie: 0 }
  ];
  R.article = id => R.ARTICLES.find(a => a.id === id);

  /* ---------- Catalogue du bilan pré-thérapeutique ---------- */
  R.BILAN_PRE = [
    { id: 'igra',  cat: 'Dépistage infectieux', label: 'IGRA (Quantiféron®) ou IDR à la tuberculine' },
    { id: 'rxt',   cat: 'Dépistage infectieux', label: 'Radiographie thoracique' },
    { id: 'vhb',   cat: 'Dépistage infectieux', label: 'Sérologie VHB (Ag HBs, Ac anti-HBc, Ac anti-HBs)' },
    { id: 'vhc',   cat: 'Dépistage infectieux', label: 'Sérologie VHC' },
    { id: 'vih',   cat: 'Dépistage infectieux', label: 'Sérologie VIH (avec accord du patient)' },
    { id: 'vzv',   cat: 'Dépistage infectieux', label: 'Sérologie VZV (si pas d’antécédent certain de varicelle)' },
    { id: 'ebv',   cat: 'Dépistage infectieux', label: 'Sérologie EBV (si thiopurine associée)' },
    { id: 'sero2', cat: 'Dépistage infectieux', label: 'Sérologies complémentaires ECCO : VHA, CMV, rougeole (statut immunitaire)' },
    { id: 'foyer', cat: 'Dépistage infectieux', label: 'Recherche de foyer infectieux (dentaire, ORL, urinaire, cutané)' },
    { id: 'nfs',   cat: 'Biologie', label: 'NFS-plaquettes' },
    { id: 'crp',   cat: 'Biologie', label: 'CRP' },
    { id: 'bh',    cat: 'Biologie', label: 'Bilan hépatique (ASAT, ALAT, GGT, PAL, bilirubine)' },
    { id: 'iono',  cat: 'Biologie', label: 'Ionogramme, créatinine' },
    { id: 'alb',   cat: 'Biologie', label: 'Albumine' },
    { id: 'lip',   cat: 'Biologie', label: 'Bilan lipidique (inhibiteurs de JAK, modulateurs S1P)' },
    { id: 'hcg',   cat: 'Clinique', label: 'β-hCG (femme en âge de procréer)' },
    { id: 'derm',  cat: 'Clinique', label: 'Examen dermatologique (lésions suspectes, antécédent de cancer cutané)' },
    { id: 'ecg',   cat: 'Clinique', label: 'ECG (inhibiteurs de JAK, modulateurs S1P)' },
    { id: 'oph',   cat: 'Clinique', label: 'Examen ophtalmologique — œdème maculaire (ozanimod, étrasimod)' },
    { id: 'vacc',  cat: 'Vaccinal', label: 'Statut vaccinal : dTP-coq, grippe annuelle, pneumocoque (VPC20), VHB, HPV, zona recombinant (Shingrix® 2 doses) — vaccins vivants ≥ 3–4 sem. avant' },
    { id: 'fcu',   cat: 'Vaccinal', label: 'Frottis cervico-utérin à jour' },
    { id: 'calpro0', cat: 'Référence', label: 'Calprotectine fécale de référence' },
    { id: 'endo0',   cat: 'Référence', label: 'Endoscopie de référence avec score (SES-CD / Mayo endoscopique)' },
    { id: 'clostr',  cat: 'Référence', label: 'Recherche de C. difficile / coproculture (si poussée)' }
  ];
  R.BILAN_STATUTS = { fait_normal: 'Fait — normal', fait_anormal: 'Fait — anormal', attente: 'En attente', na: 'Non applicable' };

  /* ---------- Catalogue des éléments de surveillance ---------- */
  /* mode : 'cure' = à chaque cure ; 'echeances' = dates fixes (jours après J0) ; 'periodique' = tous les N jours */
  R.SURVEILLANCE = [
    { id: 'clin',   cat: 'Clinique', label: 'Consultation de suivi (HBI / Mayo partiel, poids, tolérance)', mode: 'periodique', tousLes: 91 },
    { id: 'nfs',    cat: 'Biologie', label: 'NFS-plaquettes', mode: 'cure' },
    { id: 'crp',    cat: 'Biologie', label: 'CRP', mode: 'cure' },
    { id: 'bh',     cat: 'Biologie', label: 'Bilan hépatique (ASAT, ALAT, GGT, PAL)', mode: 'cure' },
    { id: 'creat',  cat: 'Biologie', label: 'Créatinine, ionogramme', mode: 'periodique', tousLes: 91 },
    { id: 'calpro', cat: 'Biologie', label: 'Calprotectine fécale', mode: 'echeances', jours: [98, 182, 365], cible: '< 150–250 µg/g' },
    { id: 'tdm',    cat: 'Pharmacologie', label: 'Dosage pharmacologique — taux résiduel + anticorps anti-médicament', mode: 'echeances', jours: [98], cible: 'Infliximab résiduel ≥ 5 µg/mL (AGA 2017) / 3–7 µg/mL selon consensus ; adalimumab 8–12 µg/mL' },
    { id: 'endo',   cat: 'Morphologie', label: 'Iléo-coloscopie de contrôle (cicatrisation muqueuse)', mode: 'echeances', jours: [182, 365] },
    { id: 'irm',    cat: 'Morphologie', label: 'Entéro-IRM (cicatrisation transmurale)', mode: 'echeances', jours: [365] },
    { id: 'echo',   cat: 'Morphologie', label: 'Échographie intestinale', mode: 'echeances', jours: [91, 182] },
    { id: 'igra',   cat: 'Sécurité', label: 'IGRA de contrôle (exposition / zone d’endémie)', mode: 'echeances', jours: [365] },
    { id: 'derm',   cat: 'Sécurité', label: 'Examen dermatologique annuel', mode: 'echeances', jours: [365] },
    { id: 'fcu',    cat: 'Sécurité', label: 'Frottis cervico-utérin', mode: 'echeances', jours: [365] },
    { id: 'vacc',   cat: 'Sécurité', label: 'Mise à jour vaccinale (grippe annuelle, pneumocoque)', mode: 'echeances', jours: [365] },
    { id: 'lip',    cat: 'Sécurité', label: 'Bilan lipidique (inhibiteurs de JAK)', mode: 'echeances', jours: [56, 182, 365] }
  ];
  R.surv = id => R.SURVEILLANCE.find(s => s.id === id);

  /* ---------- Protocoles thérapeutiques ----------
     doseType : 'mgkg' (mg/kg), 'mg' (dose fixe), 'palier' (paliers de poids), 'po' (voie orale, texte)
     phases   : induction = étapes datées ; entretien = intervalle régulier
  ---------------------------------------------------- */
  R.PROTOCOLES_DEFAUT = [
    {
      id: 'ifx-iv', dureeSeanceMin: 180, dci: 'Infliximab', specialites: 'Remicade®, Remsima®, Inflectra®, Flixabi®, Zessly®', classe: 'Anti-TNFα',
      voie: 'IV', indications: ['MC', 'RCH'], articleId: 'IFX100', doseType: 'mgkg', doseRef: 5,
      induction: [{ label: 'S0', jour: 0, dose: 5, voie: 'IV' }, { label: 'S2', jour: 14, dose: 5, voie: 'IV' }, { label: 'S6', jour: 42, dose: 5, voie: 'IV' }],
      entretien: { debutJour: 98, intervalleJours: 56, dose: 5, voie: 'IV', label: 'toutes les 8 semaines' },
      dureePerfusion: '2 h (réduction à 1 h possible à partir de la 4e perfusion si bien toléré)',
      preparation: 'Reconstitution 10 mL EPPI par flacon, dilution dans 250 mL NaCl 0,9 %, filtre en ligne ≤ 1,2 µm',
      premedication: 'Non systématique. Si antécédent de réaction : paracétamol 1 g PO + dexchlorphéniramine 5 mg IV ± hydrocortisone 100–200 mg IV, 30 min avant.',
      surveillancePerf: 'Constantes (TA, FC, T°) avant, toutes les 30 min pendant, puis observation 1–2 h après (RCP). Adrénaline, antihistaminique, corticoïde disponibles.',
      optimisation: 'Perte de réponse : 10 mg/kg (RCP MC) et/ou intervalle 4–6 semaines (pratique GETAID), guidés par le taux résiduel (≥ 5 µg/mL AGA ; 3–7 µg/mL consensus) et les anticorps anti-infliximab.',
      surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'tdm', 'endo', 'derm', 'vacc'],
      remarque: 'Immunosuppresseur associé (thiopurine) discuté pour limiter l’immunisation (SONIC / UC-SUCCESS).'
    },
    {
      id: 'ifx-sc', dureeSeanceMin: 180, dci: 'Infliximab SC (CT-P13 SC)', specialites: 'Remsima® SC 120 mg', classe: 'Anti-TNFα',
      voie: 'IV puis SC', indications: ['MC', 'RCH'], articleId: 'IFX100', articleEntretienId: 'IFX120', doseType: 'mgkg', doseRef: 5,
      induction: [{ label: 'S0', jour: 0, dose: 5, voie: 'IV' }, { label: 'S2', jour: 14, dose: 5, voie: 'IV' }],
      entretien: { debutJour: 42, intervalleJours: 14, dose: 120, doseType: 'mg', voie: 'SC', label: '120 mg SC toutes les 2 semaines dès S6' },
      dureePerfusion: '2 h (induction IV)', preparation: 'Idem infliximab IV pour l’induction',
      premedication: 'Non systématique.', surveillancePerf: 'Idem infliximab IV.',
      optimisation: 'Relais depuis l’entretien IV : 120 mg SC 8 semaines après la dernière perfusion. Non-réponse à S14 (2 IV + 5 SC) : arrêt.',
      surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'tdm', 'endo', 'derm', 'vacc'], remarque: ''
    },
    {
      id: 'vdz-iv', dureeSeanceMin: 150, dci: 'Vedolizumab', specialites: 'Entyvio®', classe: 'Anti-intégrine α4β7',
      voie: 'IV', indications: ['MC', 'RCH'], articleId: 'VDZ300', doseType: 'mg', doseRef: 300,
      induction: [{ label: 'S0', jour: 0, dose: 300, voie: 'IV' }, { label: 'S2', jour: 14, dose: 300, voie: 'IV' }, { label: 'S6', jour: 42, dose: 300, voie: 'IV' }],
      entretien: { debutJour: 98, intervalleJours: 56, dose: 300, voie: 'IV', label: 'toutes les 8 semaines' },
      dureePerfusion: '30 min ; surveillance ≈ 2 h après les 2 premières perfusions puis ≈ 1 h',
      preparation: 'Reconstitution 4,8 mL EPPI, dilution dans 250 mL NaCl 0,9 %',
      premedication: 'Aucune.', surveillancePerf: 'Constantes avant / après ; signes d’hypersensibilité.',
      optimisation: 'Baisse de réponse : intervalle 4 semaines. MC : perfusion supplémentaire à S10 possible, arrêt si absence de bénéfice à S14 ; RCH : réévaluer à S10.',
      surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'vacc'], remarque: 'Action sélective intestinale : profil infectieux favorable.'
    },
    {
      id: 'vdz-sc', dureeSeanceMin: 150, dci: 'Vedolizumab SC', specialites: 'Entyvio® 108 mg SC', classe: 'Anti-intégrine α4β7',
      voie: 'IV puis SC', indications: ['MC', 'RCH'], articleId: 'VDZ300', doseType: 'mg', doseRef: 300,
      induction: [{ label: 'S0', jour: 0, dose: 300, voie: 'IV' }, { label: 'S2', jour: 14, dose: 300, voie: 'IV' }],
      entretien: { debutJour: 42, intervalleJours: 14, dose: 108, doseType: 'mg', voie: 'SC', label: '108 mg SC toutes les 2 semaines dès S6' },
      dureePerfusion: '30 min (induction IV)', preparation: 'Idem vedolizumab IV', premedication: 'Aucune.', surveillancePerf: '—',
      optimisation: '—', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'vacc'], remarque: ''
    },
    {
      id: 'ust', dureeSeanceMin: 120, dci: 'Ustekinumab', specialites: 'Stelara®, Wezlana®, Uzpruvo®, Pyzchiva®', classe: 'Anti-IL-12/23 (p40)',
      voie: 'IV puis SC', indications: ['MC', 'RCH'], articleId: 'UST130', articleEntretienId: 'UST90', doseType: 'palier',
      paliers: [{ max: 55, dose: 260, flacons: 2 }, { max: 85, dose: 390, flacons: 3 }, { max: Infinity, dose: 520, flacons: 4 }],
      induction: [{ label: 'S0', jour: 0, dose: null, voie: 'IV' }],
      entretien: { debutJour: 56, intervalleJours: 84, dose: 90, doseType: 'mg', voie: 'SC', label: '90 mg SC à S8 puis toutes les 12 semaines' },
      dureePerfusion: '≥ 1 h', preparation: 'Dilution dans 250 mL NaCl 0,9 % (retirer un volume équivalent), filtre 0,2 µm',
      premedication: 'Aucune.', surveillancePerf: 'Constantes avant / après.',
      optimisation: 'Réponse insuffisante : intervalle 8 semaines. Induction IV : ≈ 6 mg/kg (≤ 55 kg : 260 mg ; 56–85 kg : 390 mg ; > 85 kg : 520 mg).',
      surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'derm', 'vacc'], remarque: ''
    },
    {
      id: 'rzb-mc', dureeSeanceMin: 120, dci: 'Risankizumab — Crohn', specialites: 'Skyrizi®', classe: 'Anti-IL-23 (p19)',
      voie: 'IV puis SC', indications: ['MC'], articleId: 'RZB600', articleEntretienId: 'RZB360', doseType: 'mg', doseRef: 600,
      induction: [{ label: 'S0', jour: 0, dose: 600, voie: 'IV' }, { label: 'S4', jour: 28, dose: 600, voie: 'IV' }, { label: 'S8', jour: 56, dose: 600, voie: 'IV' }],
      entretien: { debutJour: 84, intervalleJours: 56, dose: 360, doseType: 'mg', voie: 'SC', label: '360 mg SC à S12 puis toutes les 8 semaines' },
      dureePerfusion: '≥ 1 h', preparation: 'Dilution dans 100–250 mL NaCl 0,9 %', premedication: 'Aucune.', surveillancePerf: 'Constantes avant / après.',
      optimisation: '—', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'vacc'], remarque: 'Bilan hépatique recommandé pendant l’induction.'
    },
    {
      id: 'rzb-rch', dureeSeanceMin: 180, dci: 'Risankizumab — RCH', specialites: 'Skyrizi®', classe: 'Anti-IL-23 (p19)',
      voie: 'IV puis SC', indications: ['RCH'], articleId: 'RZB600', articleEntretienId: 'RZB360', doseType: 'mg', doseRef: 1200,
      induction: [{ label: 'S0', jour: 0, dose: 1200, voie: 'IV' }, { label: 'S4', jour: 28, dose: 1200, voie: 'IV' }, { label: 'S8', jour: 56, dose: 1200, voie: 'IV' }],
      entretien: { debutJour: 84, intervalleJours: 56, dose: 360, doseType: 'mg', voie: 'SC', label: '180 ou 360 mg SC à S12 puis toutes les 8 semaines' },
      dureePerfusion: '≥ 2 h', preparation: 'Dilution dans 250 mL NaCl 0,9 %', premedication: 'Aucune.', surveillancePerf: 'Constantes avant / après.',
      optimisation: '—', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'vacc'], remarque: ''
    },
    {
      id: 'mir-rch', dureeSeanceMin: 90, dci: 'Mirikizumab — RCH', specialites: 'Omvoh®', classe: 'Anti-IL-23 (p19)',
      voie: 'IV puis SC', indications: ['RCH'], articleId: 'MIR300', articleEntretienId: 'MIR100', doseType: 'mg', doseRef: 300,
      induction: [{ label: 'S0', jour: 0, dose: 300, voie: 'IV' }, { label: 'S4', jour: 28, dose: 300, voie: 'IV' }, { label: 'S8', jour: 56, dose: 300, voie: 'IV' }],
      entretien: { debutJour: 84, intervalleJours: 28, dose: 200, doseType: 'mg', voie: 'SC', label: '200 mg SC (2 × 100 mg) toutes les 4 semaines dès S12' },
      dureePerfusion: '≥ 30 min', preparation: 'Dilution dans 50–250 mL NaCl 0,9 %', premedication: 'Aucune.', surveillancePerf: 'Constantes avant / après.',
      optimisation: 'Perte de réponse : 300 mg IV à S12, S16, S20 puis reprise SC.', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'vacc'], remarque: 'Maladie de Crohn : 900 mg IV (3 flacons) S0/S4/S8 (≥ 90 min) puis 300 mg SC (100 + 200 mg) toutes les 4 semaines.'
    },
    {
      id: 'gus-rch', dureeSeanceMin: 120, dci: 'Guselkumab — RCH', specialites: 'Tremfya®', classe: 'Anti-IL-23 (p19)',
      voie: 'IV puis SC', indications: ['RCH', 'MC'], articleId: 'GUS200', articleEntretienId: 'GUS100', doseType: 'mg', doseRef: 200,
      induction: [{ label: 'S0', jour: 0, dose: 200, voie: 'IV' }, { label: 'S4', jour: 28, dose: 200, voie: 'IV' }, { label: 'S8', jour: 56, dose: 200, voie: 'IV' }],
      entretien: { debutJour: 112, intervalleJours: 56, dose: 100, doseType: 'mg', voie: 'SC', label: '100 mg SC toutes les 8 semaines dès S16 (ou 200 mg toutes les 4 semaines dès S12)' },
      dureePerfusion: '≥ 1 h', preparation: 'Dilution dans 250 mL NaCl 0,9 %', premedication: 'Aucune.', surveillancePerf: 'Constantes avant / après.',
      optimisation: 'Alternative d’induction SC : 400 mg (2 × 200 mg) S0/S4/S8. Bénéfice insuffisant : 200 mg SC toutes les 4 semaines dès S12.', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'vacc'], remarque: ''
    },
    {
      id: 'ada', dureeSeanceMin: 30, dci: 'Adalimumab', specialites: 'Humira®, Amgevita®, Hyrimoz®, Idacio®, Yuflyma®…', classe: 'Anti-TNFα',
      voie: 'SC', indications: ['MC', 'RCH'], articleId: 'ADA40', doseType: 'mg', doseRef: 40,
      induction: [{ label: 'S0', jour: 0, dose: 160, voie: 'SC' }, { label: 'S2', jour: 14, dose: 80, voie: 'SC' }],
      entretien: { debutJour: 28, intervalleJours: 14, dose: 40, voie: 'SC', label: '40 mg SC toutes les 2 semaines dès S4' },
      dureePerfusion: '— (auto-injection, dispensation rétrocession)', preparation: '—',
      premedication: 'Aucune.', surveillancePerf: 'Éducation à l’auto-injection, rotation des sites.',
      optimisation: 'Réponse insuffisante : 40 mg/semaine ou 80 mg toutes les 2 semaines (taux résiduel cible 8–12 µg/mL).',
      surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'tdm', 'endo', 'derm', 'vacc'], remarque: 'MC : induction 80 mg S0 / 40 mg S2 possible (RCP) ; 160/80 mg = réponse plus rapide, plus d’effets indésirables.'
    },
    {
      id: 'gol-rch', dureeSeanceMin: 30, dci: 'Golimumab — RCH', specialites: 'Simponi®', classe: 'Anti-TNFα',
      voie: 'SC', indications: ['RCH'], articleId: 'GOL50', doseType: 'mg', doseRef: 50,
      induction: [{ label: 'S0', jour: 0, dose: 200, voie: 'SC' }, { label: 'S2', jour: 14, dose: 100, voie: 'SC' }],
      entretien: { debutJour: 42, intervalleJours: 28, dose: 50, voie: 'SC', label: '50 mg (< 80 kg) ou 100 mg (≥ 80 kg) SC toutes les 4 semaines dès S6' },
      dureePerfusion: '—', preparation: '—', premedication: 'Aucune.', surveillancePerf: 'Éducation à l’auto-injection.',
      optimisation: 'Dose d’entretien selon le poids (100 mg si ≥ 80 kg).', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'derm', 'vacc'], remarque: ''
    },
    {
      id: 'upa', dureeSeanceMin: 0, dci: 'Upadacitinib', specialites: 'Rinvoq®', classe: 'Inhibiteur de JAK1', voie: 'PO', indications: ['MC', 'RCH'], articleId: null, doseType: 'po',
      induction: [{ label: 'Induction', jour: 0, dose: null, voie: 'PO', texte: '45 mg/j pendant 8 sem. (RCH) ou 12 sem. (MC)' }],
      entretien: { debutJour: 56, intervalleJours: 28, dose: null, voie: 'PO', label: '15 mg/j (30 mg/j si maladie sévère / réfractaire) — renouvellement mensuel', texte: '15 ou 30 mg/j' },
      dureePerfusion: '—', preparation: '—', premedication: '—', surveillancePerf: 'Bilan lipidique S8–S12, NFS, bilan hépatique, CPK ; zona (vaccin recombinant recommandé).',
      optimisation: 'Âge ≥ 65 ans : 15 mg/j maximum. Facteurs de risque CV / thromboembolique, tabagisme : dose minimale efficace. Ne pas instaurer si lymphocytes < 500/mm³, PNN < 1 000/mm³, Hb < 8 g/dL.',
      surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'lip', 'derm', 'vacc'], remarque: 'Contraception efficace obligatoire.'
    },
    {
      id: 'tofa', dureeSeanceMin: 0, dci: 'Tofacitinib — RCH', specialites: 'Xeljanz®', classe: 'Inhibiteur de JAK (pan-JAK)', voie: 'PO', indications: ['RCH'], articleId: null, doseType: 'po',
      induction: [{ label: 'Induction', jour: 0, dose: null, voie: 'PO', texte: '10 mg × 2/j pendant 8 sem. (prolongeable à 16 sem.)' }],
      entretien: { debutJour: 56, intervalleJours: 28, dose: null, voie: 'PO', label: '5 mg × 2/j (10 mg × 2/j si nécessaire, durée minimale)', texte: '5 mg × 2/j' },
      dureePerfusion: '—', preparation: '—', premedication: '—', surveillancePerf: 'NFS, bilan hépatique, lipides à 8 sem. ; risque thromboembolique et zona (vaccin recombinant).',
      optimisation: 'Arrêt si absence de bénéfice à 16 semaines. Ne pas instaurer si lymphocytes < 750/mm³, PNN < 1 000/mm³, Hb < 9 g/dL.', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'lip', 'derm', 'vacc'], remarque: ''
    }
  ];

  /* ---------- Calcul de dose et génération du calendrier ---------- */
  R.doseEtape = function (proto, etape, poids, phase) {
    const dt = etape.doseType || (phase === 'entretien' ? (proto.entretien.doseType || proto.doseType) : proto.doseType);
    if (dt === 'po') return { dose: null, texte: etape.texte || proto.entretien.texte || '', flacons: 0 };
    if (dt === 'palier') {
      const p = (proto.paliers || []).find(x => poids <= x.max) || proto.paliers[proto.paliers.length - 1];
      return { dose: p.dose, flacons: p.flacons, texte: `${p.dose} mg (${p.flacons} flacons)` };
    }
    const art = R.article(phase === 'entretien' && proto.articleEntretienId ? proto.articleEntretienId : proto.articleId);
    let dose = dt === 'mgkg' ? Math.round(etape.dose * poids) : etape.dose;
    const flacons = art ? Math.ceil(dose / art.unite) : 0;
    return { dose, flacons, texte: dt === 'mgkg' ? `${etape.dose} mg/kg → ${dose} mg` : `${dose} mg` };
  };

  R.genererCures = function (proto, dateDebut, poids, horizonJours) {
    horizonJours = horizonJours || 365;
    const cures = []; let n = 1;
    proto.induction.forEach(et => {
      const d = R.doseEtape(proto, et, poids, 'induction');
      cures.push({ n: n++, cycle: 1, protocoleId: proto.id, phase: 'Induction', label: et.label, jour: et.jour, datePrevue: R.jourOuvre(R.addDays(dateDebut, et.jour)), voie: et.voie, dose: d.dose, doseTexte: d.texte, flacons: d.flacons, articleId: proto.articleId, statut: 'prevue' });
    });
    const e = proto.entretien;
    if (e) {
      for (let j = e.debutJour; j <= horizonJours; j += e.intervalleJours) {
        const d = R.doseEtape(proto, { dose: e.dose, doseType: e.doseType, texte: e.texte }, poids, 'entretien');
        cures.push({ n: n++, cycle: 1, protocoleId: proto.id, phase: 'Entretien', label: R.libelleJour(j), jour: j, datePrevue: R.jourOuvre(R.addDays(dateDebut, j)), voie: e.voie, dose: d.dose, doseTexte: d.texte, flacons: d.flacons, articleId: proto.articleEntretienId || proto.articleId, statut: 'prevue' });
      }
    }
    return cures;
  };

  R.genererSurveillance = function (ids, dateDebut, horizonJours) {
    horizonJours = horizonJours || 365; const out = [];
    ids.forEach(id => {
      const s = R.surv(id); if (!s) return;
      if (s.mode === 'cure') out.push({ id: s.id, label: s.label, cat: s.cat, mode: 'cure', echeance: null, statut: 'cure' });
      else if (s.mode === 'periodique') { for (let j = s.tousLes; j <= horizonJours; j += s.tousLes) out.push({ id: s.id, label: s.label, cat: s.cat, mode: 'echeance', jour: j, echeance: R.addDays(dateDebut, j), statut: 'prevue' }); }
      else s.jours.forEach(j => out.push({ id: s.id, label: s.label, cat: s.cat, mode: 'echeance', jour: j, echeance: R.addDays(dateDebut, j), statut: 'prevue', cible: s.cible }));
    });
    return out.sort((a, b) => (a.jour || 0) - (b.jour || 0));
  };

  /* ---------- Changement de protocole (nouveau cycle) ---------- */
  R.j0 = (p, cycle) => { const h = (p.historiqueProtocoles || []).find(x => x.cycle === (cycle || p.cycleCourant || 1)); return h ? h.dateDebut : p.dateDebut; };
  R.changerProtocole = function (p, o) {
    /* o : { protocoleId, dateDebut, poids, motif, par, debut: 'induction'|'entretien', horizonJours } */
    const proto = R.proto ? R.proto(o.protocoleId) : R.PROTOCOLES_DEFAUT.find(x => x.id === o.protocoleId);
    p.historiqueProtocoles = p.historiqueProtocoles || [{ cycle: 1, protocoleId: p.protocoleId, dateDebut: p.dateDebut, poids: p.poids, statut: 'en cours', modifications: [] }];
    const ancien = p.historiqueProtocoles[p.historiqueProtocoles.length - 1];
    const cyc = ancien.cycle;
    const curesAnc = p.cures.filter(c => (c.cycle || 1) === cyc);
    const planifiees = curesAnc.filter(c => c.statut === 'prevue' || c.statut === 'reportee');
    ancien.planifieJusqua = curesAnc.length ? curesAnc[curesAnc.length - 1].label : '—';
    const derniereFaite = [...curesAnc].reverse().find(c => c.statut === 'realisee');
    ancien.arreteA = R.libelleJour(Math.max(0, Math.round(R.diffDays(ancien.dateDebut, o.dateDebut) / 7) * 7));
    ancien.derniereCure = derniereFaite ? derniereFaite.label + ' le ' + R.fmtDate(derniereFaite.dateReelle || derniereFaite.datePrevue) : 'aucune';
    ancien.dateFin = o.dateDebut; ancien.motifFin = o.motif; ancien.statut = 'terminé'; ancien.parFin = o.par;
    planifiees.forEach(c => { c.statut = 'annulee'; c.motif = 'Changement de protocole : ' + o.motif; });
    const tmp = Object.assign({}, proto);
    if (o.debut === 'entretien' && proto.entretien) { tmp.induction = []; tmp.entretien = Object.assign({}, proto.entretien, { debutJour: 0 }); }
    const nouvelles = R.genererCures(tmp, o.dateDebut, o.poids || p.poids, o.horizonJours || 365).map(c => Object.assign(c, { cycle: cyc + 1, protocoleId: proto.id }));
    p.cures.push(...nouvelles);
    p.cures.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue)); p.cures.forEach((c, i) => c.n = i + 1);
    /* surveillance : les contrôles prévus restent, on ajoute ceux propres au nouveau protocole s'ils n'existent pas déjà */
    const ajouts = R.genererSurveillance(proto.surveillanceDefaut.filter(id => !(id === 'fcu' && p.sexe === 'M')), o.dateDebut, o.horizonJours || 365)
      .filter(s => s.mode === 'echeance' && !p.surveillance.some(x => x.id === s.id && x.statut !== 'faite' && x.echeance && Math.abs(R.diffDays(x.echeance, s.echeance)) < 21))
      .map(s => Object.assign(s, { cycle: cyc + 1 }));
    p.surveillance.push(...ajouts);
    p.protocoleId = proto.id; p.cycleCourant = cyc + 1; p.poids = o.poids || p.poids;
    p.statut = tmp.induction.length ? 'induction' : 'entretien'; p.motifSuspension = '';
    p.historiqueProtocoles.push({ cycle: cyc + 1, protocoleId: proto.id, dateDebut: o.dateDebut, poids: o.poids || p.poids, statut: 'en cours', motif: o.motif, par: o.par, debut: o.debut || 'induction', modifications: [], planifieJusqua: nouvelles.length ? nouvelles[nouvelles.length - 1].label : '—' });
    p.notes = p.notes || []; p.notes.unshift({ date: o.dateDebut <= R.today() ? o.dateDebut : R.today(), par: o.par, txt: `Changement de protocole (cycle ${cyc + 1}) : ${proto.dci} à partir du ${R.fmtDate(o.dateDebut)} — ${o.motif}` });
    return nouvelles;
  };

  /* ---------- Jeu de démonstration ---------- */
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  R.seed = function () {
    const today = R.today(), lundi = R.semaineRef(), rand = rng(20260913);
    const pick = arr => arr[Math.floor(rand() * arr.length)];

    const users = [
      { id: 'u-chef', nom: 'BENJELLOUN', prenom: 'Nawal', titre: 'Pr', fonction: 'Chef de service — Gastro-entérologie', role: 'complet', medecin: true, code: 'CHEF01', actif: true, derniere: R.addDays(today, -1) },
      { id: 'u-med1', nom: 'ALAMI', prenom: 'Youssef', titre: 'Dr', fonction: 'Gastro-entérologue', role: 'complet', medecin: true, code: 'MED001', actif: true, derniere: today },
      { id: 'u-med2', nom: 'ECH-CHERKI', prenom: 'Salma', titre: 'Dr', fonction: 'Gastro-entérologue', role: 'complet', medecin: true, code: 'MED002', actif: true, derniere: R.addDays(today, -2) },
      { id: 'u-pha1', nom: 'BENNANI', prenom: 'Hind', titre: 'Dr', fonction: 'Pharmacien hospitalier — PUI', role: 'complet', medecin: false, code: 'PUI001', actif: true, derniere: today },
      { id: 'u-int',  nom: 'INTERNE', prenom: 'Pharmacie', titre: '', fonction: 'Interne en pharmacie', role: 'complet', medecin: false, code: 'PUI002', actif: true, derniere: today },
      { id: 'u-ide1', nom: 'OUAZZANI', prenom: 'Fatima-Zahra', titre: '', fonction: 'IDE — Hôpital de jour', role: 'hdj', medecin: false, code: 'HDJ001', actif: true, derniere: today },
      { id: 'u-ide2', nom: 'EL FASSI', prenom: 'Rachid', titre: '', fonction: 'IDE — Hôpital de jour', role: 'hdj', medecin: false, code: 'HDJ002', actif: true, derniere: R.addDays(today, -1) },
      { id: 'u-sec',  nom: 'MRABET', prenom: 'Khadija', titre: '', fonction: 'Réception — Hôpital de jour', role: 'hdj', medecin: false, code: 'HDJ003', actif: true, derniere: today }
    ];
    const ides = users.filter(u => /IDE/.test(u.fonction));

    const stock = [
      { articleId: 'IFX100', seuil: 20, cmm: 46, delaiLivraison: 10, lots: [{ lot: 'RMS25K031', peremption: '2027-03-31', qte: 22 }, { lot: 'RMS25F118', peremption: R.addDays(today, 64), qte: 12 }] },
      { articleId: 'VDZ300', seuil: 8, cmm: 11, delaiLivraison: 10, lots: [{ lot: 'ENT25A402', peremption: '2027-06-30', qte: 9 }] },
      { articleId: 'UST130', seuil: 6, cmm: 5, delaiLivraison: 15, lots: [{ lot: 'STL25C077', peremption: '2027-01-31', qte: 4 }] },
      { articleId: 'UST90',  seuil: 6, cmm: 7, delaiLivraison: 15, lots: [{ lot: 'STL25D210', peremption: '2027-05-31', qte: 12 }] },
      { articleId: 'RZB600', seuil: 3, cmm: 3, delaiLivraison: 15, lots: [{ lot: 'SKZ25B019', peremption: '2027-02-28', qte: 2 }] },
      { articleId: 'RZB360', seuil: 3, cmm: 2, delaiLivraison: 15, lots: [{ lot: 'SKZ25B044', peremption: '2027-04-30', qte: 5 }] },
      { articleId: 'MIR300', seuil: 3, cmm: 2, delaiLivraison: 21, lots: [] },
      { articleId: 'MIR100', seuil: 4, cmm: 2, delaiLivraison: 21, lots: [{ lot: 'OMV25A008', peremption: '2027-01-31', qte: 4 }] },
      { articleId: 'GUS200', seuil: 2, cmm: 1, delaiLivraison: 21, lots: [{ lot: 'TRM25A301', peremption: '2027-08-31', qte: 3 }] },
      { articleId: 'ADA40',  seuil: 16, cmm: 24, delaiLivraison: 7, lots: [{ lot: 'AMG25H660', peremption: '2027-09-30', qte: 30 }] },
      { articleId: 'GOL50',  seuil: 2, cmm: 1, delaiLivraison: 10, lots: [{ lot: 'SIM25A101', peremption: '2027-05-31', qte: 3 }] },
      { articleId: 'IFX120', seuil: 4, cmm: 4, delaiLivraison: 10, lots: [{ lot: 'RSC25E014', peremption: '2027-02-28', qte: 6 }] },
      { articleId: 'NACL250', seuil: 60, cmm: 80, delaiLivraison: 5, lots: [{ lot: 'NCL2609', peremption: '2028-06-30', qte: 118 }] },
      { articleId: 'SETF12', seuil: 40, cmm: 50, delaiLivraison: 7, lots: [{ lot: 'SF26-114', peremption: '2029-01-31', qte: 76 }] },
      { articleId: 'HCORT100', seuil: 6, cmm: 3, delaiLivraison: 5, lots: [{ lot: 'HC2604', peremption: '2027-11-30', qte: 10 }] },
      { articleId: 'DEXCHLO5', seuil: 10, cmm: 4, delaiLivraison: 5, lots: [{ lot: 'DX2603', peremption: '2027-10-31', qte: 14 }] }
    ];
    const lotsHistoriques = { IFX100: ['RMS24H902', 'RMS25A117', 'RMS25C554', 'RMS25F118', 'RMS25K031'], VDZ300: ['ENT24K301', 'ENT25A402'], UST130: ['STL24J410', 'STL25C077'], UST90: ['STL25D210'], RZB600: ['SKZ25B019'], RZB360: ['SKZ25B044'], MIR300: ['OMV24L212'], MIR100: ['OMV25A008'], ADA40: ['AMG25C118', 'AMG25H660'], GOL50: ['SIM25A101'], IFX120: ['RSC25E014'] };

    /* ancre : la cure d'indice `idx` tombe à `jourSemaine` jours du lundi de la semaine courante */
    const specs = [
      { ipp: '2024-01187', nom: 'BENALI', prenom: 'Karim', ddn: '1988-03-12', sexe: 'M', poids: 74, taille: 176, patho: 'MC', montreal: 'A2 L3 B1', diag: '2019-06', medecin: 'u-med1', proto: 'ifx-iv', ancre: { idx: 7, js: 1 }, heure: '08:30', fauteuil: 1, tt: 'Azathioprine 150 mg/j', allergies: '—' },
      { ipp: '2025-00412', nom: 'EL IDRISSI', prenom: 'Salma', ddn: '1995-11-02', sexe: 'F', poids: 58, taille: 164, patho: 'RCH', montreal: 'E3 S2', diag: '2023-02', medecin: 'u-med2', proto: 'vdz-iv', ancre: { idx: 5, js: 2 }, heure: '09:00', fauteuil: 2, tt: 'Mésalazine 4 g/j', allergies: '—' },
      { ipp: '2026-02231', nom: 'TAZI', prenom: 'Omar', ddn: '1979-07-25', sexe: 'M', poids: 92, taille: 181, patho: 'MC', montreal: 'A2 L1 B2', diag: '2016-10', medecin: 'u-chef', proto: 'ust', ancre: { idx: 0, js: 0 }, heure: '08:30', fauteuil: 3, tt: '—', allergies: 'Pénicilline (urticaire)', prev: 'Infliximab 2016–2024 (perte de réponse, ADA+)' },
      { ipp: '2026-01905', nom: 'MOUSSAOUI', prenom: 'Nadia', ddn: '2001-01-18', sexe: 'F', poids: 51, taille: 160, patho: 'MC', montreal: 'A2 L2 B1p', diag: '2024-09', medecin: 'u-med1', proto: 'rzb-mc', ancre: { idx: 1, js: 3 }, heure: '10:00', fauteuil: 1, tt: '—', allergies: '—' },
      { ipp: '2026-02410', nom: 'BOUAZZA', prenom: 'Yassine', ddn: '1990-05-30', sexe: 'M', poids: 80, taille: 178, patho: 'MC', montreal: 'A2 L3 B1', diag: '2026-05', medecin: 'u-med2', proto: 'ifx-iv', ancre: { idx: 1, js: 4 }, heure: '08:30', fauteuil: 2, tt: 'Azathioprine 150 mg/j', allergies: '—' },
      { ipp: '2019-07744', nom: 'CHRAIBI', prenom: 'Leila', ddn: '1972-09-08', sexe: 'F', poids: 66, taille: 162, patho: 'RCH', montreal: 'E2', diag: '2015-03', medecin: 'u-chef', proto: 'ifx-iv', ancre: { idx: 9, js: 1 }, heure: '10:30', fauteuil: 3, tt: 'Mésalazine 3 g/j', allergies: '—', reaction: 2, premed: true },
      { ipp: '2025-03310', nom: 'AMRANI', prenom: 'Hamza', ddn: '1985-12-14', sexe: 'M', poids: 70, taille: 174, patho: 'RCH', montreal: 'E3', diag: '2021-08', medecin: 'u-med1', proto: 'vdz-iv', ancre: { idx: 4, js: 0 }, heure: '11:00', fauteuil: 1, tt: '—', allergies: '—', retard: 'calpro' },
      { ipp: '2025-01098', nom: 'SEBTI', prenom: 'Imane', ddn: '1998-04-03', sexe: 'F', poids: 55, taille: 161, patho: 'MC', montreal: 'A2 L3 B3p', diag: '2022-11', medecin: 'u-med2', proto: 'ifx-iv', ancre: { idx: 4, js: 2 }, heure: '13:30', fauteuil: 1, tt: 'Méthotrexate 15 mg/sem SC', allergies: '—', optimisation: 10 },
      { ipp: '2026-01560', nom: 'LAHLOU', prenom: 'Mehdi', ddn: '1968-02-21', sexe: 'M', poids: 88, taille: 175, patho: 'RCH', montreal: 'E3', diag: '2018-06', medecin: 'u-chef', proto: 'mir-rch', ancre: { idx: 2, js: 8 }, heure: '09:30', fauteuil: 2, tt: '—', allergies: '—', prev: 'Infliximab 2019–2021 (réaction à la perfusion)', bascule: { de: 'vdz-iv', joursAvant: 238, motif: 'Perte de réponse secondaire : calprotectine 820 µg/g, Mayo endoscopique 3 malgré intervalle 4 semaines' } },
      { ipp: '2025-02207', nom: 'RAMI', prenom: 'Sofia', ddn: '1993-08-11', sexe: 'F', poids: 62, taille: 168, patho: 'MC', montreal: 'A2 L1 B1', diag: '2020-01', medecin: 'u-med1', proto: 'ust', ancre: { idx: 3, js: 4 }, heure: '14:00', fauteuil: 4, tt: '—', allergies: '—' },
      { ipp: '2025-00871', nom: 'KETTANI', prenom: 'Adam', ddn: '1983-10-05', sexe: 'M', poids: 77, taille: 179, patho: 'MC', montreal: 'A2 L1 B1', diag: '2024-12', medecin: 'u-med2', proto: 'ada', ancre: { idx: 12, js: 3 }, heure: '', fauteuil: 0, tt: '—', allergies: '—' },
      { ipp: '2020-04419', nom: 'FASSI', prenom: 'Rania', ddn: '1976-06-17', sexe: 'F', poids: 69, taille: 165, patho: 'RCH', montreal: 'E2', diag: '2017-09', medecin: 'u-med1', proto: 'ifx-iv', ancre: { idx: 6, js: 3 }, heure: '10:00', fauteuil: 2, tt: 'Mésalazine 4 g/j', allergies: '—', suspendu: 'Infection ORL en cours (antibiothérapie) — cure reportée après guérison' },
      { ipp: '2026-02088', nom: 'ZIANI', prenom: 'Nabil', ddn: '1989-03-27', sexe: 'M', poids: 84, taille: 180, patho: 'RCH', montreal: 'E3', diag: '2025-04', medecin: 'u-med2', proto: 'ust', ancre: { idx: 1, js: 14 }, heure: '', fauteuil: 0, tt: 'Mésalazine 4 g/j', allergies: '—' },
      { ipp: '2026-02515', nom: 'BERRADA', prenom: 'Yousra', ddn: '2003-12-09', sexe: 'F', poids: 49, taille: 158, patho: 'MC', montreal: 'A1 L3 B1', diag: '2026-06', medecin: 'u-chef', proto: 'vdz-iv', ancre: { idx: 2, js: 3 }, heure: '09:00', fauteuil: 2, tt: '—', allergies: '—' }
    ];

    const patients = specs.map((s, i) => {
      const proto = R.PROTOCOLES_DEFAUT.find(p => p.id === s.proto);
      const probe = R.genererCures(proto, '2000-01-01', s.poids, 800);
      const jourAncre = probe[s.ancre.idx].jour;
      const debut = R.addDays(lundi, s.ancre.js - jourAncre);
      let cures = R.genererCures(proto, debut, s.poids, jourAncre + 400);
      let historique = [{ cycle: 1, protocoleId: proto.id, dateDebut: debut, poids: s.poids, statut: 'en cours', modifications: [], planifieJusqua: cures[cures.length - 1].label }];
      let dateDebutDossier = debut, cycleCourant = 1;
      if (s.bascule) {
        const ancienProto = R.PROTOCOLES_DEFAUT.find(x => x.id === s.bascule.de); const debutAncien = R.addDays(debut, -s.bascule.joursAvant);
        cures = R.genererCures(ancienProto, debutAncien, s.poids, s.bascule.joursAvant + 300);
        cures.forEach(c => { if (c.datePrevue < debut) c.statut = 'realisee'; });
        const tmpP = { cures, surveillance: [], sexe: s.sexe, poids: s.poids, protocoleId: ancienProto.id, dateDebut: debutAncien, notes: [] };
        R.changerProtocole(tmpP, { protocoleId: proto.id, dateDebut: debut, poids: s.poids, motif: s.bascule.motif, par: s.medecin, debut: 'induction', horizonJours: jourAncre + 400 });
        cures = tmpP.cures; historique = tmpP.historiqueProtocoles; dateDebutDossier = debutAncien; cycleCourant = 2;
        cures.filter(c => c.cycle === 2).forEach(c => { c.heure = s.heure; c.fauteuil = s.fauteuil; });
      }
      if (s.optimisation) cures.forEach(c => { if (c.phase === 'Entretien' && c.n >= 4) { c.dose = Math.round(s.optimisation * s.poids); c.flacons = Math.ceil(c.dose / 100); c.doseTexte = `${s.optimisation} mg/kg → ${c.dose} mg (optimisation)`; } });
      cures.forEach((c, k) => {
        if (c.voie === 'IV') { c.heure = s.heure || '09:00'; c.fauteuil = s.fauteuil || 1; }
        if (c.datePrevue < today && (c.statut === 'prevue' || (c.statut === 'realisee' && !c.dateReelle))) {
          c.statut = 'realisee'; c.dateReelle = c.datePrevue; c.poids = Math.round((s.poids + (rand() - 0.5) * 3) * 10) / 10;
          c.lot = pick(lotsHistoriques[c.articleId] || ['—']); c.ide = c.voie === 'IV' ? pick(ides).id : null;
          c.duree = c.voie === 'IV' ? (proto.id === 'vdz-iv' ? '30 min' : (k >= 3 && proto.id === 'ifx-iv' ? '1 h' : '2 h')) : '—';
          c.tolerance = 'Bonne'; c.premedication = s.premed && k > s.reaction ? 'Paracétamol 1 g + dexchlorphéniramine 5 mg IV' : 'Aucune';
          c.validationPharma = { par: 'u-pha1', date: R.addDays(c.datePrevue, -1) };
          c.constantes = c.voie === 'IV' ? { ta: `${118 + Math.floor(rand() * 16)}/${70 + Math.floor(rand() * 12)}`, fc: 64 + Math.floor(rand() * 20), temp: (36.4 + rand() * 0.6).toFixed(1) } : null;
          if (c.cycle === 1 && s.bascule && k === cures.filter(x => x.cycle === 1).length - 1) c.tolerance = 'Bonne — mais perte de réponse clinique (Mayo partiel 6)';
          if (s.reaction === k) c.tolerance = 'Réaction à la perfusion (prurit, flush, à 40 min) — arrêt 15 min, dexchlorphéniramine 5 mg IV, reprise à débit réduit. Prémédication systématique ensuite.';
        }
        if (s.suspendu && c.datePrevue >= today && c.statut === 'prevue' && !cures.some(x => x.statut === 'reportee')) { c.statut = 'reportee'; c.motif = s.suspendu; }
        if (c.statut === 'prevue' && c.datePrevue <= R.addDays(lundi, 6) && c.voie === 'IV' && i % 3 !== 2) c.validationPharma = { par: 'u-pha1', date: R.addDays(today, -1) };
      });
      const survIds = proto.surveillanceDefaut.filter(id => !(id === 'fcu' && s.sexe === 'M'));
      const surveillance = R.genererSurveillance(survIds, dateDebutDossier, jourAncre + 400 + (s.bascule ? s.bascule.joursAvant : 0)).map(x => {
        if (x.echeance && x.echeance < today) {
          const enRetard = s.retard === x.id && R.diffDays(x.echeance, today) < 60;
          if (!enRetard) { x.statut = 'faite'; x.dateFaite = R.addDays(x.echeance, Math.floor(rand() * 5)); x.resultat = resultatDemo(x.id, rand); }
        }
        return x;
      });
      const bilan = R.BILAN_PRE.map(b => {
        let statut = 'fait_normal';
        if (b.id === 'hcg' && s.sexe === 'M') statut = 'na'; if (b.id === 'fcu' && s.sexe === 'M') statut = 'na';
        if (['lip', 'ecg', 'oph'].includes(b.id)) statut = 'na'; if (b.id === 'ebv' && !/Azathioprine/.test(s.tt)) statut = 'na';
        if (b.id === 'clostr') statut = 'na'; if (b.id === 'vzv' && rand() > 0.5) statut = 'na';
        if (i === 12 && b.id === 'rxt') statut = 'attente';
        return { id: b.id, statut, date: statut.startsWith('fait') ? R.addDays(debut, -Math.floor(10 + rand() * 20)) : '', commentaire: (b.id === 'vacc' && statut === 'fait_normal') ? 'Grippe + pneumocoque (VPC20) faits ; VHB immunisé' : (b.id === 'endo0' ? (s.patho === 'MC' ? 'SES-CD 14' : 'Mayo endoscopique 2') : '') };
      });
      const derniere = cures.filter(c => c.statut === 'realisee').slice(-1)[0];
      return {
        id: 'p' + (i + 1), ipp: s.ipp, nom: s.nom, prenom: s.prenom, ddn: s.ddn, sexe: s.sexe, poids: s.poids, taille: s.taille, tel: `06 ${String(10 + Math.floor(rand() * 89))} ${String(10 + Math.floor(rand() * 89))} ${String(10 + Math.floor(rand() * 89))} ${String(10 + Math.floor(rand() * 89))}`,
        pathologie: s.patho, montreal: s.montreal, dateDiag: s.diag + '-01', medecinId: s.medecin, protocoleId: s.proto, dateDebut: dateDebutDossier, cycleCourant, historiqueProtocoles: historique, carnetMixte: i % 2 === 0,
        traitementsAssocies: s.tt, allergies: s.allergies, antecedentsBio: s.prev || 'Aucune biothérapie antérieure',
        statut: s.suspendu ? 'suspendu' : (cures.some(c => c.phase === 'Induction' && c.statut === 'prevue') ? 'induction' : 'entretien'),
        motifSuspension: s.suspendu || '', cures, surveillance, bilan, notes: s.bascule ? [{ date: debut, par: s.medecin, txt: `Changement de protocole (cycle 2) : ${proto.dci} à partir du ${R.fmtDate(debut)} — ${s.bascule.motif}` }] : [], creeLe: R.addDays(dateDebutDossier, -21), creePar: s.medecin, derniereCure: derniere ? derniere.dateReelle : null
      };
    });

    /* Mouvements de stock : sorties liées aux cures réalisées sur 60 jours + entrées */
    const mouvements = [];
    patients.forEach(p => p.cures.filter(c => c.statut === 'realisee' && c.flacons > 0 && R.diffDays(c.dateReelle, today) <= 60).forEach(c => {
      mouvements.push({ date: c.dateReelle, type: 'sortie', articleId: c.articleId, qte: c.flacons, lot: c.lot, motif: `Cure n°${c.n} — ${p.nom} ${p.prenom}`, par: c.ide || 'u-pha1' });
    }));
    mouvements.push({ date: R.addDays(today, -32), type: 'entree', articleId: 'IFX100', qte: 30, lot: 'RMS25K031', motif: 'Réception commande PUI n°2026-0781', par: 'u-pha1' });
    mouvements.push({ date: R.addDays(today, -18), type: 'entree', articleId: 'VDZ300', qte: 12, lot: 'ENT25A402', motif: 'Réception commande PUI n°2026-0802', par: 'u-pha1' });
    mouvements.push({ date: R.addDays(today, -9), type: 'entree', articleId: 'UST90', qte: 8, lot: 'STL25D210', motif: 'Réception commande PUI n°2026-0819', par: 'u-int' });
    mouvements.push({ date: R.addDays(today, -4), type: 'entree', articleId: 'ADA40', qte: 20, lot: 'AMG25H660', motif: 'Réception commande PUI n°2026-0833', par: 'u-pha1' });
    mouvements.push({ date: R.addDays(today, -2), type: 'ajustement', articleId: 'RZB600', qte: -1, lot: 'SKZ25B019', motif: 'Flacon cassé à la préparation — déclaré', par: 'u-int' });
    mouvements.sort((a, b) => b.date.localeCompare(a.date));

    const rdv = [
      { date: R.addDays(lundi, 1), heure: '14:30', patientId: 'p7', type: 'Consultation', objet: 'Consultation de suivi — calprotectine en retard', avec: 'u-med1' },
      { date: R.addDays(lundi, 2), heure: '15:00', patientId: 'p3', type: 'Éducation', objet: 'Éducation thérapeutique — nouvelle biothérapie', avec: 'u-ide1' },
      { date: R.addDays(lundi, 4), heure: '11:30', patientId: 'p12', type: 'Consultation', objet: 'Réévaluation avant reprise (infection ORL)', avec: 'u-med1' },
      { date: R.addDays(lundi, 8), heure: '08:00', patientId: 'p1', type: 'Endoscopie', objet: 'Iléo-coloscopie de contrôle (M12)', avec: 'u-chef' }
    ];

    return {
      version: 3, user: null, route: { page: 'dashboard', params: {} },
      settings: { hdj: { jours: [1, 2, 3, 4, 5], ouverture: '08:00', fermeture: '16:00', fauteuils: 6, maxParJour: 12, pas: 30 }, etablissement: 'Centre Hospitalier Universitaire', service: 'Service de Gastro-entérologie et Hépatologie', unite: 'Hôpital de jour — Biothérapies', telHDJ: '05 XX XX XX XX (poste 4412)', telUrgences: '05 XX XX XX XX (urgences 24 h/24)', chef: 'Pr Nawal BENJELLOUN', fauteuils: 6, joursPeremptionAlerte: 90, stockSecuriteJours: 15, horizonPrevisionJours: 28 },
      users, protocoles: JSON.parse(JSON.stringify(R.PROTOCOLES_DEFAUT)), stock, mouvements, patients, rdv, journal: []
    };
  };

  /* Base vide : référentiels, comptes et articles conservés ; aucun patient, aucun lot */
  R.seedVide = function () {
    const s = R.seed();
    s.patients = []; s.rdv = []; s.mouvements = []; s.journal = [];
    s.stock.forEach(it => { it.lots = []; it.cmm = 0; });
    s.dirty = true; s.vide = true;
    return s;
  };

  function resultatDemo(id, rand) {
    switch (id) {
      case 'calpro': return `${60 + Math.floor(rand() * 120)} µg/g`;
      case 'tdm': return `Résiduel ${(3 + rand() * 5).toFixed(1)} µg/mL — ADA négatifs`;
      case 'endo': return rand() > 0.4 ? 'Cicatrisation muqueuse (SES-CD 2)' : 'Amélioration endoscopique partielle';
      case 'irm': return 'Pas d’activité transmurale';
      case 'echo': return 'Épaisseur pariétale 2,5 mm — normale';
      case 'clin': return `HBI ${1 + Math.floor(rand() * 4)} — rémission clinique`;
      case 'creat': return 'Créatinine 78 µmol/L';
      case 'lip': return 'LDL 1,2 g/L';
      case 'igra': return 'Négatif';
      case 'derm': return 'RAS';
      case 'fcu': return 'Normal';
      case 'vacc': return 'Grippe faite';
      default: return 'Normal';
    }
  }
})(window.RYZE);
