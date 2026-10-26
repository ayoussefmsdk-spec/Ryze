/* =====================================================================
   02-dossier : création de dossiers par l'assistant (IV et SC), séances
   générées, séance réalisée / manquée / reportée, séance ajoutée en mg/kg,
   notes, contrôles et dosage (cibles pédiatriques infliximab), suspension
   et reprise, changement de protocole et suppression de cycle, trace des
   corrections faites par « Modifier ».
   Dossiers d'essai fictifs « ESSAI … » créés sur la démonstration.
   ===================================================================== */
'use strict';
const { suite } = require('./lib');
const H = suite('02-dossier');
const { t } = H;

/* assistant « Nouveau dossier » jusqu'à l'enregistrement ; renvoie l'identifiant du dossier créé */
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
/* prochain jour d'ouverture de l'hôpital de jour à partir de aujourd'hui + n jours */
const jourOuvert = (page, n) => page.evaluate(k => { const R = window.RYZE; let d = R.addDays(R.today(), k); for (let i = 0; i < 7 && !R.jourOuvert(d); i++) d = R.addDays(d, 1); return d; }, n);
const etat = (page, pid) => page.evaluate(id => JSON.parse(JSON.stringify(window.RYZE.patient(id))), pid);

H.executer(async () => {
  const { page } = await H.ouvrir();
  await H.demo(page);
  await H.connexion(page, 'MED001');
  const today = await page.evaluate(() => window.RYZE.today());

  /* ---------------- Création IV ---------------- */
  H.section('Assistant : dossier IV (infliximab, 42 kg)');
  const iv = await creerDossier(page, { nom: 'ESSAI', prenom: 'Perfusion', ddn: '2012-05-14', sexe: 'M', poids: 42, taille: 150, proto: 'ifx-iv' });
  let p = iv && await etat(page, iv);
  t('dossier IV créé par l’assistant et ouvert', !!p && p.nom === 'ESSAI' && p.protocoleId === 'ifx-iv' && (await page.evaluate(() => window.RYZE.S.route)).params.id === iv, p && p.id);
  if (!p) throw new Error('dossier IV non créé : suite interrompue');
  const ind = p.cures.filter(c => c.phase === 'Induction'), ent = p.cures.filter(c => c.phase === 'Entretien');
  t('séances générées : induction S0 · S2 · S6 puis entretien, toutes prévues, numérotées dans l’ordre des dates', ind.map(c => c.label).join(' ') === 'S0 S2 S6' && ent.length >= 3 && p.cures.every((c, i) => c.n === i + 1 && c.statut === 'prevue' && (i === 0 || c.datePrevue >= p.cures[i - 1].datePrevue)), p.cures.map(c => c.label + ' ' + c.datePrevue));
  t('doses au poids : 5 mg/kg × 42 kg = 210 mg, 3 flacons de 100 mg', p.cures.every(c => c.dose === 210 && c.flacons === 3 && /5 mg\/kg/.test(c.doseTexte)), p.cures.map(c => c.doseTexte + ' ' + c.flacons));
  t('séances IV : créneau (heure) et fauteuil attribués', p.cures.every(c => c.voie === 'IV' && /^\d{2}:\d{2}$/.test(c.heure || '') && c.fauteuil >= 1 && !c.sansCreneau));
  const tdm0 = p.surveillance.filter(s => s.id === 'tdm');
  t('plan de surveillance généré, dosages infliximab avec la cible pédiatrique ≥ 5 µg/mL', p.surveillance.filter(s => s.mode === 'echeance').length >= 5 && tdm0.length >= 1 && tdm0.every(s => s.cible === 'infliximab ≥ 5 µg/mL'), tdm0.map(s => s.cible));
  t('statut « induction », brouillon de l’assistant effacé, création tracée au journal', p.statut === 'induction' && await page.evaluate(() => !(window.RYZE.S.brouillons || {})[window.RYZE.S.user] && /Dossier créé — ESSAI Perfusion/.test(window.RYZE.S.journal[0].txt)));

  /* ---------------- Création SC ---------------- */
  H.section('Assistant : dossier SC (adalimumab)');
  const sc = await creerDossier(page, { nom: 'ESSAI', prenom: 'Injection', ddn: '2011-09-03', sexe: 'F', poids: 45, taille: 152, proto: 'ada' });
  const q = sc && await etat(page, sc);
  t('dossier SC créé : toutes les séances en sous-cutané avec une dose', !!q && q.cures.length >= 3 && q.cures.every(c => c.voie === 'SC' && c.dose > 0 && c.statut === 'prevue'), q && q.cures.map(c => c.voie + ' ' + c.doseTexte));
  t('dossier SC : aucune séance n’occupe de fauteuil', !!q && q.cures.every(c => !c.fauteuil) && await page.evaluate(id => { const R = window.RYZE, p = R.patient(id); return p.cures.every(c => !R.seances(c.datePrevue).some(x => x.patient === p)); }, sc));

  /* ---------------- Séance réalisée ---------------- */
  H.section('Séance marquée réalisée (dose, poids, lot)');
  await H.aller(page, 'patient', { id: iv });
  await page.click('.page-actions [data-action="cureEnregistrer"]');
  await page.fill('#modal-root [name="poids"]', '43');
  await page.fill('#modal-root [name="lot"]', 'TEST-LOT-1');
  const calc = await page.evaluate(() => ({ dose: document.querySelector('#modal-root [name="dose"]').value, txt: (document.getElementById('calc-dose') || {}).innerText || '' }));
  t('fenêtre de séance : dose recalculée sur le poids du jour (5 mg/kg × 43 kg = 215 mg, 3 flacons)', calc.dose === '215' && /215 mg/.test(calc.txt) && /3 flacon/.test(calc.txt), calc);
  await H.validerModal(page);
  p = await etat(page, iv);
  const s0 = p.cures.find(c => c.lot === 'TEST-LOT-1');
  t('séance S0 réalisée : date du jour, poids 43 kg, dose 215 mg, lot, IDE notée', !!s0 && s0.label === 'S0' && s0.statut === 'realisee' && s0.dateReelle === today && s0.poids === 43 && s0.dose === 215 && /215 mg/.test(s0.doseTexte) && s0.ide === 'u-med1', s0);
  t('poids du dossier mis à jour, dernière séance notée', p.poids === 43 && p.derniereCure === today, [p.poids, p.derniereCure]);

  /* ---------------- Séance manquée puis reportée ---------------- */
  H.section('Séance manquée, reportée, replanifiée');
  const nS2 = p.cures.find(c => c.label === 'S2').n;
  await page.evaluate(([pid, n]) => window.RYZE.actions.cureManquee({ dataset: { pid, n: String(n) } }), [iv, nS2]);
  await page.fill('#modal-root [name="motif"]', 'patient injoignable (test)');
  await H.validerModal(page);
  p = await etat(page, iv);
  let s2 = p.cures.find(c => c.label === 'S2');
  t('séance S2 « patient non venu » : statut manquée, motif et absence tracés', s2.statut === 'manquee' && s2.motif === 'patient injoignable (test)' && (s2.absences || []).length === 1, s2);
  t('séance manquée signalée « à replanifier » dans les alertes', await page.evaluate(id => window.RYZE.alertes().some(a => /Séance manquée à replanifier — ESSAI Perfusion/.test(a.t)), iv));
  await H.aller(page, 'patient', { id: iv, tab: 'plan' });
  const nouvelle = await page.evaluate(d => { const R = window.RYZE; let x = R.addDays(d, 2); for (let i = 0; i < 7 && !R.jourOuvert(x); i++) x = R.addDays(x, 1); return x; }, s2.datePrevue);
  await page.click(`[data-action="cureReporter"][data-n="${nS2}"]`);
  await page.fill('#modal-root [name="date"]', nouvelle);
  await page.selectOption('#modal-root [name="categorie"]', { index: 1 });
  await page.fill('#modal-root [name="motif"]', 'report de test');
  await H.validerModal(page);
  p = await etat(page, iv); s2 = p.cures.find(c => (c.reports || []).length);
  t('séance replanifiée : nouvelle date, de nouveau prévue, report tracé (de → vers, motif)', !!s2 && s2.statut === 'prevue' && s2.datePrevue === nouvelle && s2.reports[0].vers === nouvelle && /^Reportée \(/.test(s2.motif) && /report de test/.test(s2.motif), s2 && { d: s2.datePrevue, m: s2.motif, r: s2.reports });
  await page.click(`[data-action="cureReporter"][data-n="${s2.n}"]`);
  await page.fill('#modal-root [name="date"]', '');
  await page.selectOption('#modal-root [name="categorie"]', { index: 1 });
  await H.validerModal(page);
  p = await etat(page, iv); s2 = p.cures.find(c => (c.reports || []).length);
  t('report sans date : séance « reportée » (à replanifier), deux reports tracés', s2.statut === 'reportee' && s2.reports.length === 2 && s2.reports[1].vers === null, { st: s2.statut, r: s2.reports.length });

  /* ---------------- Séance ajoutée en mg/kg ---------------- */
  H.section('Séance ajoutée à la main en mg/kg');
  const nAvant = p.cures.length, dAjout = await jourOuvert(page, 9);
  await page.click('[data-action="cureAjouter"]');
  await page.selectOption('#modal-root [name="doseMode"]', 'mgkg');
  await page.fill('#modal-root [name="date"]', dAjout);
  await page.fill('#modal-root [name="mgkg"]', '10');
  await page.fill('#modal-root [name="poids"]', '43');
  const doseAjout = await page.inputValue('#modal-root [name="dose"]');
  t('fenêtre d’ajout : 10 mg/kg × 43 kg = 430 mg calculés', doseAjout === '430', doseAjout);
  await page.fill('#modal-root [name="motif"]', 'perfusion supplémentaire (test)');
  await H.validerModal(page);
  p = await etat(page, iv);
  const aj = p.cures.find(c => c.motif === 'perfusion supplémentaire (test)');
  t('séance ajoutée : 10 mg/kg → 430 mg, 5 flacons, prévue à la date choisie avec un fauteuil', p.cures.length === nAvant + 1 && !!aj && aj.mgkg === 10 && aj.dose === 430 && aj.flacons === 5 && /10 mg\/kg/.test(aj.doseTexte) && aj.datePrevue === dAjout && aj.fauteuil >= 1, aj);

  /* ---------------- Notes ---------------- */
  H.section('Notes : ajout, épinglage, modification, suppression');
  await H.aller(page, 'patient', { id: iv, tab: 'notes' });
  await page.fill('form[data-form="noteAdd"] [name="titre"]', 'Décision de staff (test)');
  await page.fill('form[data-form="noteAdd"] [name="txt"]', 'Remarque de test : surveillance clinique rapprochée');
  await page.click('form[data-form="noteAdd"] button[type=submit]');
  p = await etat(page, iv);
  t('note ajoutée avec titre, date, heure et auteur', p.notes[0] && p.notes[0].titre === 'Décision de staff (test)' && p.notes[0].date === today && /^\d{2}:\d{2}$/.test(p.notes[0].heure) && p.notes[0].par === 'u-med1' && !p.notes[0].epingle, p.notes[0]);
  await page.click('[data-action="noteEpingle"][data-i="0"]');
  await H.aller(page, 'patient', { id: iv, tab: 'synthese' });
  const synth = await H.texte(page, 'main');
  p = await etat(page, iv);
  t('note épinglée : visible dans la synthèse du dossier', p.notes[0].epingle === true && p.notes[0].epingleLe === today && synth.includes('surveillance clinique rapprochée'));
  await H.aller(page, 'patient', { id: iv, tab: 'notes' });
  await page.click('[data-action="noteModifier"][data-i="0"]');
  await page.fill('#modal-root [name="txt"]', 'Remarque de test modifiée');
  await H.validerModal(page);
  p = await etat(page, iv);
  t('note modifiée : texte remplacé, « modifiée le » tracé, toujours épinglée', p.notes[0].txt === 'Remarque de test modifiée' && p.notes[0].modifieLe === today && p.notes[0].modifiePar === 'u-med1' && p.notes[0].epingle === true && /modifiée le/.test(await H.texte(page, 'main .timeline')), p.notes[0]);
  const nNotes = p.notes.length;
  await page.click('[data-action="noteSupprimer"][data-i="0"]');
  await page.click('#modal-root [data-action="noteSupprimerOk"]');
  p = await etat(page, iv);
  t('note supprimée (contenu gardé dans le journal)', p.notes.length === nNotes - 1 && !p.notes.some(n => /modifiée/.test(n.txt)) && await page.evaluate(() => /Note supprimée — ESSAI Perfusion/.test(window.RYZE.S.journal[0].txt)));

  /* ---------------- Contrôles et dosage ---------------- */
  H.section('Contrôles : marquer fait, dosage infliximab et cibles pédiatriques');
  await H.aller(page, 'patient', { id: iv, tab: 'plan' });
  const iBio = p.surveillance.findIndex(s => s.id === 'biostd' && s.statut === 'prevue');
  await page.click(`[data-action="survSaisir"][data-i="${iBio}"]`);
  const champs = await page.$$('#modal-root input[name^="val_"]');
  if (champs.length) await champs[0].fill('12,5'); else await page.fill('#modal-root [name="resultat"]', 'normal');
  await page.fill('#modal-root textarea[name="note"]', 'contrôle de test');
  await H.validerModal(page);
  p = await etat(page, iv);
  t('contrôle biologique marqué fait : date, résultat, remarque, auteur', p.surveillance[iBio].statut === 'faite' && p.surveillance[iBio].dateFaite === today && !!p.surveillance[iBio].resultat && p.surveillance[iBio].note === 'contrôle de test' && p.surveillance[iBio].par === 'u-med1', p.surveillance[iBio]);
  const iTdm = p.surveillance.findIndex(s => s.id === 'tdm' && s.statut === 'prevue');
  await page.click(`[data-action="survSaisir"][data-i="${iTdm}"]`);
  await page.fill('#modal-root [name="tdm_taux"]', '4.2');
  await page.selectOption('#modal-root [name="tdm_ac"]', 'neg');
  const lecture = await H.texte(page, '#tdm-interp');
  t('dosage infliximab 4,2 µg/mL : lecture à l’écran « sous la cible », cible ≥ 5 µg/mL', /Sous la cible/.test(lecture) && /≥ 5 µg\/mL/.test(lecture), lecture);
  await H.validerModal(page);
  p = await etat(page, iv);
  const dos = p.surveillance[iTdm];
  t('dosage enregistré : taux, anticorps, constat « sous la cible (≥ 5) »', dos.statut === 'faite' && dos.tdm && dos.tdm.taux === 4.2 && dos.tdm.ac === 'neg' && /4,2 µg\/mL/.test(dos.resultat) && await page.evaluate(([id, i]) => { const R = window.RYZE, p = R.patient(id), s = p.surveillance[i]; return /sous la cible \(≥ 5\)/.test(R.interpTdm(s.tdm, R.ctxTdm(s, p)).constat); }, [iv, iTdm]), dos && dos.resultat);
  /* atteinte périnéale (Paris p) cochée dans « Modifier » : cible ≥ 10 µg/mL */
  await H.aller(page, 'patient', { id: iv });
  await page.click('.page-actions [data-action="patientModifier"]');
  await page.check('#modal-root input[name="paris_p"]');
  await H.validerModal(page);
  const cibles = await page.evaluate(id => { const R = window.RYZE, p = R.patient(id); return { per: !!(p.paris && p.paris.p), prevues: [...new Set(p.surveillance.filter(s => s.id === 'tdm' && s.statut === 'prevue').map(s => R.cibleControle(p, s)))], min: R.cibleTdm(p, 'infliximab').min }; }, iv);
  t('atteinte périnéale (Paris p) : cible infliximab ≥ 10 µg/mL sur les dosages prévus', cibles.per && cibles.min === 10 && cibles.prevues.length === 1 && cibles.prevues[0] === 'infliximab ≥ 10 µg/mL (atteinte périnéale)', cibles);
  /* dossiers infliximab de la démonstration avec un dosage prévu : sans atteinte périnéale (≥ 5) et avec « p » de Paris (≥ 10) */
  const demoCibles = await page.evaluate(() => { const R = window.RYZE, L = R.S.patients.filter(p => !/^ESSAI$/.test(p.nom) && p.protocoleId === 'ifx-iv' && p.surveillance.some(x => x.id === 'tdm' && x.statut === 'prevue'));
    const c = p => { if (!p) return null; const s = p.surveillance.find(x => x.id === 'tdm' && x.statut === 'prevue'); return p.id + ' : ' + R.cibleControle(p, s); };
    return { sans: c(L.find(p => !(p.paris || {}).p && !R.atteintePerineale(p).oui)), avec: c(L.find(p => (p.paris || {}).p)) }; });
  t('démonstration : cible infliximab ≥ 5 sans atteinte périnéale, ≥ 10 avec « p » de Paris', /: infliximab ≥ 5 µg\/mL$/.test(demoCibles.sans || '') && /: infliximab ≥ 10 µg\/mL \(atteinte périnéale\)$/.test(demoCibles.avec || ''), demoCibles);

  /* ---------------- Suspension et reprise ---------------- */
  H.section('Suspension et reprise du traitement');
  const prevAvant = p.cures.filter(c => c.statut === 'prevue').length;
  await page.click('.page-actions [data-action="patientSuspendre"]');
  await page.fill('#modal-root [name="motif"]', 'Infection intercurrente (test)');
  await H.validerModal(page);
  p = await etat(page, iv);
  t('suspension : statut suspendu, séances prévues mises en attente, note et trace structurée', p.statut === 'suspendu' && p.cures.filter(c => c.parSuspension && c.statut === 'reportee').length === prevAvant && !p.cures.some(c => c.statut === 'prevue') && (p.suspensions || []).length === 1 && p.notes[0].txt === 'Traitement suspendu : Infection intercurrente (test)', { statut: p.statut, prevAvant, attente: p.cures.filter(c => c.parSuspension).length });
  await page.click('.page-actions [data-action="patientReprendre"]');
  p = await etat(page, iv);
  const demain = await page.evaluate(() => window.RYZE.addDays(window.RYZE.today(), 1));
  t('reprise : séances replanifiées à partir de demain, suspension close', p.statut !== 'suspendu' && !p.cures.some(c => c.parSuspension) && p.cures.filter(c => c.statut === 'prevue').length === prevAvant && p.cures.filter(c => c.statut === 'prevue').every(c => c.datePrevue >= demain) && p.suspensions[0].repriseLe === today, { statut: p.statut, s: p.suspensions });
  t('reprise : note « Reprise du traitement … » au pluriel accordé, sans « (s) »', /^Reprise du traitement \(Infection intercurrente \(test\)\) — \d+ séances? replanifiées? à partir du \d{2}\/\d{2}\/\d{4}$/.test(p.notes[0].txt) && !/\(s\)/.test(p.notes[0].txt), p.notes[0].txt);

  /* ---------------- Changement de protocole et suppression du cycle ---------------- */
  H.section('Changement de protocole, puis suppression du cycle');
  const avantChg = Object.fromEntries(p.cures.filter(c => ['prevue', 'reportee', 'manquee'].includes(c.statut)).map(c => [c.datePrevue + c.label, c.statut])); /* séances à venir du cycle 1 */
  await H.aller(page, 'patient', { id: iv, tab: 'plan' });
  await page.click('[data-action="protoChanger"]');
  await page.waitForSelector('[data-action="chgValider"]');
  await page.selectOption('select[data-k="cause"]', { index: 1 });
  await page.fill('input[data-k="motif"]', 'perte de réponse (test)');
  await page.click('[data-action="wProto"][data-id="vdz-iv"]');
  await page.click('[data-action="chgValider"]');
  p = await etat(page, iv);
  const h1 = (p.historiqueProtocoles || []).find(h => h.cycle === 1), h2 = (p.historiqueProtocoles || []).find(h => h.cycle === 2);
  t('changement de protocole : cycle 2 vedolizumab ouvert, cycle 1 terminé avec son motif', p.cycleCourant === 2 && p.protocoleId === 'vdz-iv' && !!h1 && h1.statut === 'terminé' && /perte de réponse \(test\)/.test(h1.motifFin || '') && !!h2 && h2.statut === 'en cours', { cyc: p.cycleCourant, h: (p.historiqueProtocoles || []).map(h => [h.cycle, h.protocoleId, h.statut, h.motifFin]) });
  t('changement de protocole : séances du cycle 2 générées, séances à venir du cycle 1 annulées et conservées', p.cures.some(c => c.cycle === 2 && c.protocoleId === 'vdz-iv' && c.statut === 'prevue') && Object.keys(avantChg).length > 0 && Object.keys(avantChg).every(k => { const c = p.cures.find(x => x.datePrevue + x.label === k); return c && c.statut === 'annulee' && /^Changement de protocole/.test(c.motif || ''); }), p.cures.filter(c => (c.cycle || 1) === 1).map(c => c.statut + ' ' + c.motif));
  await H.aller(page, 'patient', { id: iv, tab: 'traitement' });
  await page.click('[data-action="cycleSupprimer"][data-cycle="2"]');
  await page.click('#modal-root [data-action="cycleSupprimerOk"]');
  p = await etat(page, iv);
  t('suppression du cycle 2 : retour au cycle 1 infliximab en cours, séances du cycle 2 retirées', p.cycleCourant === 1 && p.protocoleId === 'ifx-iv' && p.historiqueProtocoles.length === 1 && p.historiqueProtocoles[0].statut === 'en cours' && !p.cures.some(c => c.cycle === 2), { cyc: p.cycleCourant, proto: p.protocoleId });
  t('suppression du cycle 2 : séances annulées par le changement remises dans leur état d’avant (prévues, reportée)', Object.keys(avantChg).every(k => { const c = p.cures.find(x => x.datePrevue + x.label === k); return c && c.statut === avantChg[k]; }) && !p.cures.some(c => /^Changement de protocole/.test(c.motif || '')), p.cures.map(c => c.statut));
  t('suppression du cycle 2 : note automatique au pluriel accordé, sans « (s) »', /^Cycle 2 supprimé — /.test(p.notes[0].txt) && p.notes[0].auto === true && !/\(s\)/.test(p.notes[0].txt), p.notes[0].txt);

  /* ---------------- Modifier une séance réalisée : trace « corrigée le … » ---------------- */
  H.section('Correction d’une séance réalisée (Modifier)');
  const nS0 = p.cures.find(c => c.lot === 'TEST-LOT-1').n;
  await page.evaluate(([pid, n]) => window.RYZE.actions.cureModifier({ dataset: { pid, n: String(n) } }), [iv, nS0]);
  await page.fill('#modal-root [name="lot"]', 'TEST-LOT-2');
  await H.validerModal(page);
  p = await etat(page, iv);
  const corr = p.cures.find(c => c.lot === 'TEST-LOT-2');
  const txtCorr = await page.evaluate(([pid, lot]) => { const R = window.RYZE, c = R.patient(pid).cures.find(x => x.lot === lot); return R.correctionsTexte(c); }, [iv, 'TEST-LOT-2']);
  t('séance corrigée : changement du lot tracé (avant → après, date, auteur)', !!corr && (corr.corrections || []).length === 1 && corr.corrections[0].le === today && corr.corrections[0].par === 'u-med1' && corr.corrections[0].changements.some(x => x.champ === 'lot' && x.avant === 'TEST-LOT-1' && x.apres === 'TEST-LOT-2'), corr && corr.corrections);
  t('trace lisible « Corrigée le jj/mm/aaaa … »', /^Corrigée le \d{2}\/\d{2}\/\d{4}/.test(txtCorr) && /TEST-LOT-1/.test(txtCorr) && /TEST-LOT-2/.test(txtCorr), txtCorr);
  await H.aller(page, 'carnet', { id: iv });
  const carnet = await H.texte(page, '#app .carnet-wrap');
  await H.aller(page, 'impression', { id: iv, quoi: 'seances' });
  const imp = await H.texte(page, '#app .carnet-wrap');
  t('trace « corrigée le … » imprimée dans le carnet A4 et l’historique des séances', /Corrigée le \d{2}\/\d{2}\/\d{4}/.test(carnet) && /corrigée le \d{2}\/\d{2}\/\d{4}/i.test(imp), { carnet: /Corrigée le/.test(carnet), imp: /corrigée le/i.test(imp) });
});
