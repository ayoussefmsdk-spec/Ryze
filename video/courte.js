/* =====================================================================
   HDJ — video/courte.js : version courte du film de démonstration
   (≈ 90 s, 8 plans, docs/VIDEO-SCENARIO.md § 3) ; mêmes scènes que la
   version longue (video/scenes.js), variante « courte ».
     export NODE_PATH=$(npm root -g)
     node video/courte.js --ips 24              # rendu d'essai
     node video/courte.js                       # rendu final 60 i/s
     node video/courte.js --segment dossier     # ne refait qu'un plan
     node video/controle.js <sortie>/HDJ-demo-courte.mp4
   Sortie : <scratchpad>/video/courte/ (ou --sortie dossier)
   ===================================================================== */
'use strict';
const path = require('path');
const studio = require('./studio');
const S = require('./scenes');

const SORTIE_DEFAUT = '/tmp/claude-0/-home-user-Ryze/d683416b-3238-53e6-a9a0-b6d3024a5424/scratchpad/video/courte';
const DUREE = 90.63; /* durée réelle mesurée (barre de progression) */
const C = { variante: 'courte' };

/* durées du scénario par segment (docs/VIDEO-SCENARIO.md), contrôlées par controle.js (± 10 %) */
const PREVU = { ouverture: 5, 'tableau-de-bord': 10, dossier: 27, planning: 15, carnet: 12, rapport: 10, securite: 5, fin: 6 };

(async () => {
  const a = studio.arguments();
  const st = await studio.ouvrir({ base: a.base || path.join(__dirname, '..', 'demo', 'vitrine.json'), code: S.CODE, horloge: S.HORLOGE, ips: a.ips || 60, sortie: a.sortie || SORTIE_DEFAUT, dureeTotale: DUREE, seulement: a.seulement, pastille: { right: 16, top: 72 }, prevu: PREVU });
  const debut = Date.now();
  let ok = false;
  try {
    await S.preparer(st, { connecter: true });   /* connexion en coulisse : le film s'ouvre sur le tableau de bord */
    await st.segment('ouverture');        await S.ouverture(st, C);
    await st.segment('tableau-de-bord');  await S.tableauDeBord(st, C);
    await st.segment('dossier');          await S.dossierPatient(st, C);
    await st.segment('planning');         await S.planning(st, C);
    await st.segment('carnet');           st.chapitre(4, 'Carnet patient'); await st.effacerSousTitre(); await st.fonduEnchaine(0.4, async () => st.allerA('carnetPatient', { id: await S.idDe(st, 'Yassine BENNANI') })); await S.carnetPatient(st, C);
    await st.segment('rapport');          await S.rapport(st, C);
    await st.segment('securite');         await S.securite(st, C);
    await st.segment('fin');              await S.fin(st, C);
    const r = await st.assembler('HDJ-demo-courte.mp4');
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
