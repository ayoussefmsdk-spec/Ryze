/* =====================================================================
   HDJ — video/longue.js : version longue du film de démonstration
   (≈ 4 min 30, docs/VIDEO-SCENARIO.md § 2), base vitrine fictive,
   code AAA111, horloge figée au lundi 9/11/2026 10:00.
     export NODE_PATH=$(npm root -g)
     node video/longue.js --ips 24              # rendu d'essai
     node video/longue.js                       # rendu final 60 i/s
     node video/longue.js --segment documents   # ne refait qu'un chapitre
     node video/controle.js <sortie>/HDJ-demo-longue.mp4
   Sortie : <scratchpad>/video/longue/ (ou --sortie dossier)
   ===================================================================== */
'use strict';
const path = require('path');
const studio = require('./studio');
const S = require('./scenes');

const SORTIE_DEFAUT = '/tmp/claude-0/-home-user-Ryze/d683416b-3238-53e6-a9a0-b6d3024a5424/scratchpad/video/longue';
const DUREE = 275.04; /* durée réelle mesurée (barre de progression) */

/* durées du scénario par segment (docs/VIDEO-SCENARIO.md), contrôlées par controle.js (± 10 %) */
const PREVU = { ouverture: 8, connexion: 10, 'tableau-de-bord': 24, 'dossier-patient': 58, 'nouveau-dossier': 25, planning: 30, documents: 55, rapport: 25, securite: 20, fin: 15 };

(async () => {
  const a = studio.arguments();
  const st = await studio.ouvrir({ base: a.base || path.join(__dirname, '..', 'demo', 'vitrine.json'), code: S.CODE, horloge: S.HORLOGE, ips: a.ips || 60, sortie: a.sortie || SORTIE_DEFAUT, dureeTotale: DUREE, seulement: a.seulement, pastille: { right: 16, top: 72 }, prevu: PREVU });
  const debut = Date.now();
  let ok = false;
  try {
    await S.preparer(st);
    await st.segment('ouverture');        await S.ouverture(st);
    await st.segment('connexion');        await S.connexion(st);
    await st.segment('tableau-de-bord');  await S.tableauDeBord(st);
    await st.segment('dossier-patient');  await S.dossierPatient(st);
    await st.segment('nouveau-dossier');  await S.nouveauDossier(st);
    await st.segment('planning');         await S.planning(st);
    await st.segment('documents');        await S.documents(st);
    await st.segment('rapport');          await S.rapport(st);
    await st.segment('securite');         await S.securite(st);
    await st.segment('fin');              await S.fin(st);
    const r = await st.assembler('HDJ-demo-longue.mp4');
    const b = st.bilanRendu();
    console.log(`Film : ${r.film} (${r.duree.toFixed(2)} s, annoncé ${DUREE} s)`);
    console.log(`Minutage : ${r.minutage}`);
    console.log(`Rendu : ${b.images} images en ${((Date.now() - debut) / 1000).toFixed(1)} s (${b.imagesParSeconde} i/s)`);
    if (Math.abs(r.duree - DUREE) > 0.02 * DUREE) console.log(`  attention : durée réelle ${r.duree.toFixed(2)} s ≠ ${DUREE} s : mettre DUREE à jour (barre de progression)`);
    ok = true;
  } catch (e) {
    console.error('Échec du film :', e && e.stack || e);
    try { await st.page.screenshot({ path: path.join(st.sortie, 'echec.png') }); console.error('Capture de l’écran au moment de l’échec : ' + path.join(st.sortie, 'echec.png')); } catch (x) { /* page fermée */ }
  } finally {
    await st.fermer();
    process.exit(ok ? 0 : 1);
  }
})();
