/* =====================================================================
   HDJ — video/essai.js : essai du studio (~25 s) qui exerce toute l'API :
   carton d'ouverture, chapitres + sous-titres, connexion (saisie en rampe),
   tableau de bord (zoom 1,6× puis dézoom), Patients (recherche en rampe),
   ouverture d'un dossier, défilement, carton de fin.
   Base de démonstration intégrée (patients fictifs), code MED001.
     export NODE_PATH=$(npm root -g)
     node video/essai.js --ips 24          # rendu rapide
     node video/essai.js                   # rendu final 60 i/s
     node video/essai.js --segment dossier # ne refait qu'un segment
   Sortie : <scratchpad>/video/essai/HDJ-essai.mp4 + minutage.json
   ===================================================================== */
'use strict';
const path = require('path');
const studio = require('./studio');

const SORTIE_DEFAUT = '/tmp/claude-0/-home-user-Ryze/d683416b-3238-53e6-a9a0-b6d3024a5424/scratchpad/video/essai';

(async () => {
  const a = studio.arguments();
  const st = await studio.ouvrir({ base: a.base || null, code: 'MED001', ips: a.ips || 60, sortie: a.sortie || SORTIE_DEFAUT, dureeTotale: 26.2, seulement: a.seulement });
  const debut = Date.now();
  let ok = false;
  try {
    /* 0 · Ouverture */
    await st.segment('ouverture');
    st.cacherCurseur();
    await st.carton({
      titre: 'HDJ', sousTitre: 'Gestion des biothérapies · Hôpital de jour',
      lignes: ['Unité de Gastro-entérologie, Hépatologie et Nutrition Pédiatrique · Hôpital d’Enfants Abderrahim El Harouchi · CHU Ibn Rochd, Casablanca'],
      duree: 2.0, sortie: 0.4
    });
    st.montrerCurseur();

    /* 1 · Connexion */
    await st.segment('connexion');
    st.chapitre(1, 'Connexion');
    await st.sousTitre('Un code personnel par soignant', 'deux niveaux d’accès : médecins et équipe de l’HDJ');
    await st.connexion();                                   /* vers + clic + taper en rampe + « Entrer » */

    /* 2 · Tableau de bord : zoom 1,6× sur « Ma journée » */
    await st.segment('tableau-de-bord');
    await st.cartonChapitre(2, 'Tableau de bord');           /* fondu au vert 0,4 s + carton 1,4 s, pastille ensuite */
    await st.sousTitre('Tout ce qui se passe aujourd’hui', 'séances du jour, patients attendus, fauteuils');
    await st.vers('section.card:has(h2:has-text("Ma journée"))', 0.6);
    await st.zoom('section.card:has(h2:has-text("Ma journée")) .jour-row', 1.6, 1.0);
    await st.attendre(1.0);
    await st.dezoom(0.8);
    await st.survoler('section.card:has(h2:has-text("À traiter")) .alert-row', 0.4);
    await st.effacerSousTitre();

    /* 3 · Patients : recherche, dossier, défilement */
    await st.segment('dossier');
    st.chapitre(3, 'Dossier patient');
    await st.naviguer('.nav [data-go="patients"]');
    await st.sousTitre('La file active', 'recherche, pathologie, biothérapie, prochaine séance');
    await st.choisir('select[name="patho"]', 'MC');
    await st.taper('#f-q', 'Tazi Omar', { rampe: true });
    await st.attendre(0.3);
    await st.naviguer('tbody tr.row-link');
    await st.sousTitre('Le dossier patient', 'identité, protocole par cycles, doses calculées au poids');
    await st.attendre(0.6);
    await st.defiler(700, { duree: 1.2 });
    await st.attendre(0.4);
    /* fondu enchaîné vers l'onglet Planification (navigation en coulisse) */
    await st.fonduEnchaine(0.4, async () => { const id = await st.evaluer(() => window.RYZE.S.route.params.id); await st.allerA('patient', { id, tab: 'plan' }); });
    await st.attendre(0.5);

    /* 9 · Fin */
    await st.segment('fin');
    await st.cartonFin({
      mots: ['Sûr', 'Organisé', 'Documenté', 'Autonome'],
      auteurs: 'Youssef Moussaddek · Ahmed Traifi',
      encadrant: 'Encadrement : Pr Bensabahia',
      service: 'Unité de Gastro-entérologie, Hépatologie et Nutrition Pédiatrique — Service de Pédiatrie 3 — Hôpital d’Enfants Abderrahim El Harouchi — CHU Ibn Rochd, Casablanca',
      note: 'Démonstration réalisée avec des patients fictifs',
      dureeMots: 2.1, dureeCredits: 2.3
    });
    const r = await st.assembler('HDJ-essai.mp4');

    /* contrôle des calques : après navigation et sur les documents imprimables, rien ne les retire */
    const avant = await st.verifierCalques();
    await st.coulisse(async () => {
      const pid = await st.evaluer(() => window.RYZE.S.patients[0].id);
      await st.allerA('carnet', { id: pid }); const c1 = await st.verifierCalques();
      await st.allerA('impression', { id: pid, quoi: 'planification' }); const c2 = await st.verifierCalques();
      await st.allerA('patients'); const c3 = await st.verifierCalques();
      console.log(`Calques : film ${avant.present ? 'présents' : 'ABSENTS'} ; carnet ${c1.present ? 'présents' : 'ABSENTS'} ; impression ${c2.present ? 'présents' : 'ABSENTS'} ; liste ${c3.present ? 'présents' : 'ABSENTS'} ; injections dans le document : ${c3.injections} ; ré-injections pendant le film : ${st.reinjections || 0}`);
    });
    const b = st.bilanRendu();
    console.log(`Film : ${r.film} (${r.duree.toFixed(2)} s, annoncé ${st.o.dureeTotale} s)`);
    console.log(`Minutage : ${r.minutage}`);
    console.log(`Rendu : ${b.images} images en ${((Date.now() - debut) / 1000).toFixed(1)} s → ${b.imagesParSeconde} images/s (capture ${b.msParCapture} ms/image) ; un film de 4 min 30 à ${st.ips} i/s ≈ ${((270 * st.ips) / b.imagesParSeconde / 60).toFixed(1)} min`);
    if (Math.abs(r.duree - st.o.dureeTotale) > 0.05 * st.o.dureeTotale) console.log(`  attention : durée réelle ${r.duree.toFixed(2)} s ≠ durée annoncée ${st.o.dureeTotale} s (barre de progression)`);
    ok = true;
  } catch (e) {
    console.error('Échec de l’essai :', e && e.stack || e);
  } finally {
    await st.fermer();
    process.exit(ok ? 0 : 1);
  }
})();
