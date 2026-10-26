/* =====================================================================
   03-documents : documents imprimés et exportés, sur 4 dossiers de la
   démonstration (IV, SC, 2 cycles, suspendu) — carnet A4, historique des
   séances, relevé des bilans, compte rendu, carnet patient FR/AR (8 pages
   A5), carnet patient vierge, rapport d'activité (nominatif et anonymisé),
   feuille de planning (jour, semaine), fichier .html autonome, impression
   couleur / noir et blanc, textes interdits.
   Patients : jeu de démonstration fictif uniquement.
   ===================================================================== */
'use strict';
const fs = require('fs');
const { suite, interditsDans, datesDans } = require('./lib');
const H = suite('03-documents');
const { t } = H;

const NOTE_EPINGLEE = 'Note épinglée de test 03-documents';
/* conduite à tenir proposée par l'application après un dosage : à l'écran seulement, jamais sur un document */
const CONDUITES = [/Discuter une optimisation/i, /désescalade peut se discuter/i, /échec probable du mécanisme/i, /discuter un changement de (classe|molécule)/i, /Doser les anticorps pour conclure/i, /interprétation au cas par cas/i, /poursuivre le schéma prévu/i];

H.executer(async () => {
  const { page } = await H.ouvrir();
  await H.demo(page);
  await H.connexion(page, 'MED001');
  const docs = []; /* { nom, texte } : tous les documents rendus, pour les textes interdits */
  const garder = (nom, texte) => { docs.push({ nom, texte }); return texte; };
  const racine = sel => H.texte(page, sel || '#app .carnet-wrap');

  /* ---------------- Choix des 4 dossiers (par leurs caractéristiques, pas leur nom) ---------------- */
  H.section('Dossiers de démonstration utilisés');
  const choix = await page.evaluate(() => {
    const R = window.RYZE, L = R.S.patients, cyc = p => (p.historiqueProtocoles || []).filter(h => !h.retro).length;
    const iv = L.find(p => p.statut !== 'suspendu' && cyc(p) === 1 && p.cures.length && p.cures.every(c => c.voie === 'IV') && p.surveillance.some(s => s.id === 'tdm' && s.statut === 'faite'));
    const sc = L.find(p => p.statut !== 'suspendu' && p.cures.length && p.cures.every(c => c.voie === 'SC'));
    const deux = L.find(p => cyc(p) >= 2);
    const susp = L.find(p => p.statut === 'suspendu');
    return [['IV', iv], ['SC', sc], ['2 cycles', deux], ['suspendu', susp]].map(([type, p]) => p ? { type, id: p.id, nom: p.nom, prenom: p.prenom, ipp: p.ipp } : { type, id: null });
  });
  t('4 dossiers trouvés dans la démonstration : IV, SC, 2 cycles, suspendu', choix.every(c => c.id) && new Set(choix.map(c => c.id)).size === 4, choix.map(c => c.type + ' ' + c.id));
  const D = choix.filter(c => c.id);
  /* note épinglée sur chaque dossier : imprimée dans le carnet A4, jamais dans le carnet patient */
  await page.evaluate(([ids, txt]) => { const R = window.RYZE; ids.forEach(id => R.patient(id).notes.unshift({ date: R.today(), heure: '09:15', par: R.S.user, titre: 'À surveiller', txt, epingle: true, epingleLe: R.today(), epinglePar: R.S.user })); R.touch(); }, [D.map(d => d.id), NOTE_EPINGLEE]);
  const contexte = await page.evaluate(ids => { const R = window.RYZE; return { today: R.today(), etab: R.etab(), conduites: ids.flatMap(id => { const p = R.patient(id); return p.surveillance.filter(s => s.id === 'tdm' && s.statut === 'faite' && R.tdmDe(s, p)).map(s => R.interpTdm(R.tdmDe(s, p), R.ctxTdm(s, p)).texte).filter(Boolean); }), noms: R.S.patients.map(p => ({ nom: p.nom, prenom: p.prenom, ipp: p.ipp })) }; }, D.map(d => d.id));
  const today = contexte.today;
  t('des dosages faits existent (lecture automatique à exclure des documents)', contexte.conduites.length > 0, contexte.conduites.length);

  /* ---------------- Carnet de suivi A4 ---------------- */
  H.section('Carnet de suivi A4');
  const ko = { entete: [], identite: [], blocs: [], tdm: [], taille: [], notes: [] }; const pagesCarnet = {};
  for (const d of D) {
    await H.aller(page, 'carnet', { id: d.id });
    const txt = garder(`carnet ${d.id}`, await racine());
    const dom = await page.evaluate(() => { const w = document.querySelector('#app .carnet-wrap'); return { logo: !!(w && w.querySelector('img.doc-logo')), courbes: [...document.querySelectorAll('#app .doc-courbe .dc-t b')].map(b => b.textContent.trim()), styleId: [...document.querySelectorAll('#app style.doc-identite-pages')].map(s => s.textContent).join(' ') }; });
    const pdf = await H.pdf(page, `carnet-${d.id}`); pagesCarnet[d.id] = pdf.pages;
    if (pdf.textes) garder(`carnet ${d.id} (PDF)`, pdf.textes.join('\n'));
    if (!(txt.includes(contexte.etab.etablissement) && /Carnet de suivi biothérapique/.test(txt) && dom.logo && pdf.pages >= 2 && pdf.formats.every(f => f === '595x842'))) ko.entete.push(d.id);
    const ident = pdf.textes ? pdf.textes.every(x => x.includes(d.nom) && x.includes(d.prenom)) : dom.styleId.includes(d.nom) && dom.styleId.includes(d.prenom);
    if (!ident) ko.identite.push(`${d.id}${pdf.textes ? ' : pages ' + pdf.textes.map((x, i) => x.includes(d.nom) ? '' : i + 1).filter(Boolean).join(',') : ''}`);
    if (!(/statut et sécurité/i.test(txt) && /à faire/i.test(txt))) ko.blocs.push(d.id);
    const conduite = [...contexte.conduites.filter(c => txt.includes(c)), ...CONDUITES.filter(re => re.test(txt)).map(String)]; if (conduite.length) ko.tdm.push(`${d.id} : ${conduite[0]}`);
    if (!dom.courbes.includes('Taille')) ko.taille.push(`${d.id} : ${dom.courbes.join(', ')}`);
    if (!txt.includes(NOTE_EPINGLEE)) ko.notes.push(d.id);
    if (d.type === '2 cycles') { const h = await page.evaluate(id => window.RYZE.patient(id).historiqueProtocoles.filter(x => !x.retro).map(x => (window.RYZE.proto(x.protocoleId) || {}).dci || ''), d.id); t('carnet A4 (2 cycles) : historique avec les deux protocoles', /Historique du traitement/i.test(txt) && h.every(dci => txt.includes(dci.split(' ')[0])), h); }
    if (d.type === 'suspendu') t('carnet A4 (suspendu) : suspension et motif visibles', /suspendu/i.test(txt) && txt.includes(await page.evaluate(id => window.RYZE.patient(id).motifSuspension, d.id)));
  }
  t('carnet A4 : en-tête de l’établissement avec logo, format A4 (4 dossiers)', !ko.entete.length, ko.entete);
  t('carnet A4 : identité du patient sur chaque page imprimée (4 dossiers)', !ko.identite.length, ko.identite);
  t('carnet A4 : blocs « Statut et sécurité » et « À faire » (4 dossiers)', !ko.blocs.length, ko.blocs);
  t('carnet A4 : aucune conduite à tenir automatique après un dosage (4 dossiers)', !ko.tdm.length, ko.tdm);
  t('carnet A4 : courbes d’évolution avec la taille (4 dossiers)', !ko.taille.length, ko.taille);
  t('carnet A4 : notes épinglées imprimées (4 dossiers)', !ko.notes.length, ko.notes);

  /* ---------------- Historique des séances et relevé des bilans ---------------- */
  H.section('Historique des séances, relevé des bilans');
  const koS = [], koB = [];
  for (const d of D) {
    await H.aller(page, 'impression', { id: d.id, quoi: 'seances' });
    const ts = garder(`séances ${d.id}`, await racine());
    const thS = await page.evaluate(() => [...document.querySelectorAll('#app .carnet-wrap th')].map(x => x.textContent.trim()));
    const pS = await H.pdf(page, `seances-${d.id}`);
    if (!(/Historique des séances/.test(ts) && ts.includes(d.nom) && thS.some(x => /^Poids/.test(x)) && pS.pages >= 1)) koS.push(`${d.id} : ${thS.join('|')}`);
    await H.aller(page, 'impression', { id: d.id, quoi: 'bilans' });
    const tb = garder(`bilans ${d.id}`, await racine());
    const thB = await page.evaluate(() => [...document.querySelectorAll('#app .carnet-wrap th')].map(x => x.textContent.trim()));
    const pB = await H.pdf(page, `bilans-${d.id}`);
    if (!(/Relevé des bilans et contrôles/.test(tb) && thB.includes('Poids (kg)') && thB.includes('Taille (cm)') && thB.includes('IMC') && /à retenir/i.test(tb) && pB.pages >= 1)) koB.push(`${d.id} : ${thB.join('|')}`);
    if (pS.textes) garder(`séances ${d.id} (PDF)`, pS.textes.join('\n'));
    if (pB.textes) garder(`bilans ${d.id} (PDF)`, pB.textes.join('\n'));
  }
  t('historique des séances : titre, identité, colonne Poids (4 dossiers)', !koS.length, koS);
  t('relevé des bilans : colonnes Poids (kg) / Taille (cm) / IMC et « À retenir » (4 dossiers)', !koB.length, koB);

  /* ---------------- Compte rendu ---------------- */
  H.section('Compte rendu de suivi');
  const koCR = [];
  for (const d of D) {
    await H.aller(page, 'compteRendu', { id: d.id });
    const tc = garder(`compte rendu ${d.id}`, await racine());
    const pc = await H.pdf(page, `compte-rendu-${d.id}`);
    if (pc.textes) garder(`compte rendu ${d.id} (PDF)`, pc.textes.join('\n'));
    const conduite = [...contexte.conduites.filter(c => tc.includes(c)), ...CONDUITES.filter(re => re.test(tc)).map(String)];
    if (!(/Compte rendu de suivi/.test(tc) && tc.includes(d.nom) && /résumé/i.test(tc) && /conclusion/i.test(tc) && pc.pages >= 1 && !conduite.length)) koCR.push(`${d.id}${conduite.length ? ' : ' + conduite[0] : ''}`);
  }
  t('compte rendu : titre, identité, résumé, conclusion, sans conduite automatique (4 dossiers)', !koCR.length, koCR);

  /* ---------------- Carnet patient FR/AR ---------------- */
  H.section('Carnet patient FR/AR (8 pages A5)');
  const koP = { format: [], dates: [], doses: [], informez: [], p8: [], notes: [] };
  for (const d of D) {
    await H.aller(page, 'carnetPatient', { id: d.id });
    const tp = garder(`carnet patient ${d.id}`, await racine('#app .livret'));
    const pp = await H.pdf(page, `carnet-patient-${d.id}`);
    if (pp.textes) garder(`carnet patient ${d.id} (PDF)`, pp.textes.join('\n'));
    const n = await page.evaluate(() => +(document.querySelector('#app .livret') || {}).dataset.pages);
    if (!(pp.pages === 8 && n === 8 && pp.formats.length === 8 && pp.formats.every(f => f === '420x595'))) koP.format.push(`${d.id} : ${pp.pages} pages ${[...new Set(pp.formats)].join(',')}`);
    const futures = [...new Set(datesDans(tp).filter(x => x > today))]; if (futures.length) koP.dates.push(`${d.id} : ${futures.slice(0, 3).join(', ')}`);
    /* tableau « Mes séances » : une ligne sans date de réalisation n'a ni dose ni date prévue à venir */
    const doses = await page.evaluate(() => { const out = [], R = window.RYZE; let lues = 0; document.querySelectorAll('#app .livret table').forEach(tb => { const th = [...tb.querySelectorAll('th')].map(x => x.textContent); const iF = th.findIndex(x => /Faite le/.test(x)), iD = th.findIndex(x => /Dose donnée/.test(x)), iP = th.findIndex(x => /Date prévue/.test(x)); if (iF < 0 || iD < 0) return; tb.querySelectorAll('tr').forEach(tr => { const td = tr.querySelectorAll('td'); if (td.length <= Math.max(iF, iD)) return; lues++; const prevue = (td[iP] && td[iP].textContent.trim()) || ''; if (!td[iF].textContent.trim() && (td[iD].textContent.trim() || (prevue && prevue.split('/').reverse().join('-') > R.today()))) out.push(tr.textContent.trim().replace(/\s+/g, ' ').slice(0, 60)); }); }); return { out, lues }; });
    if (doses.out.length || doses.lues < 20) koP.doses.push(`${d.id} : ${doses.lues} lignes lues${doses.out.length ? ', « ' + doses.out[0] + ' »' : ''}`);
    if (!/informez l[’']hôpital de jour/i.test(tp)) koP.informez.push(d.id);
    await page.emulateMedia({ media: 'print' });
    const p8 = await page.evaluate(() => { const pg = document.querySelectorAll('#app .livret .page')[7]; if (!pg) return { min: 0 }; let min = 99, ex = ''; const w = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT); let x; while ((x = w.nextNode())) { if (!x.textContent.trim()) continue; const el = x.parentElement, cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const pt = parseFloat(cs.fontSize) * 0.75; if (pt < min) { min = pt; ex = x.textContent.trim().slice(0, 40); } } return { min: Math.round(min * 100) / 100, ex, urg: pg.classList.contains('urg-page') }; });
    await page.emulateMedia({ media: 'screen' });
    if (!(p8.min >= 8.99 && p8.urg)) koP.p8.push(`${d.id} : ${p8.min} pt (« ${p8.ex} »)`);
    if (tp.includes(NOTE_EPINGLEE)) koP.notes.push(d.id);
  }
  t('carnet patient : exactement 8 pages au format A5 (4 dossiers)', !koP.format.length, koP.format);
  t('carnet patient : aucune date à venir imprimée (4 dossiers)', !koP.dates.length, koP.dates);
  t('carnet patient : aucune dose pour une séance non faite (4 dossiers)', !koP.doses.length, koP.doses);
  t('carnet patient : consigne « informez l’hôpital de jour » (4 dossiers)', !koP.informez.length, koP.informez);
  t('carnet patient : page 8 (urgences) en 9 pt au moins (4 dossiers)', !koP.p8.length, koP.p8);
  t('carnet patient : aucune note médicale (note épinglée absente)', !koP.notes.length, koP.notes);

  /* ---------------- Carnet patient vierge ---------------- */
  H.section('Carnet patient vierge');
  const avantV = await page.evaluate(() => ({ raw: localStorage.getItem('ryze-hdj-v1'), pats: JSON.stringify(window.RYZE.S.patients) }));
  await H.aller(page, 'patients');
  await page.click('[data-go="carnetPatient"]');
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const tv = garder('carnet patient vierge', await racine('#app .livret'));
  const pv = await H.pdf(page, 'carnet-patient-vierge');
  if (pv.textes) garder('carnet patient vierge (PDF)', pv.textes.join('\n'));
  const lignes = await page.evaluate(() => { let vides = 0; document.querySelectorAll('#app .livret table').forEach(tb => { if (!/Dose donnée/.test(tb.textContent)) return; tb.querySelectorAll('tbody tr').forEach(tr => { const td = [...tr.querySelectorAll('td')]; if (td.length > 3 && td.slice(1).every(x => !x.textContent.trim())) vides++; }); }); return vides; });
  const nomsTrouves = contexte.noms.filter(n => tv.includes(n.nom) || tv.includes(n.ipp)).map(n => n.nom);
  t('carnet vierge : 8 pages A5', pv.pages === 8 && pv.formats.every(f => f === '420x595'), [pv.pages, pv.formats[0]]);
  t('carnet vierge : lignes de séances à remplir, aucun patient ni date de séance', lignes >= 20 && !nomsTrouves.length && datesDans(tv).every(x => x === today), { lignes, nomsTrouves, dates: datesDans(tv) });
  const apresV = await page.evaluate(() => ({ raw: localStorage.getItem('ryze-hdj-v1'), pats: JSON.stringify(window.RYZE.S.patients), vierge: !!window.RYZE.patient('vierge') }));
  t('carnet vierge : rien n’est enregistré dans la base', apresV.raw === avantV.raw && apresV.pats === avantV.pats && !apresV.vierge);

  /* ---------------- Rapport d'activité ---------------- */
  H.section('Rapport d’activité (nominatif et anonymisé)');
  await H.aller(page, 'activite');
  await page.evaluate(() => { window.RYZE.ui.rapport.anonyme = false; window.RYZE.ui.rapport.annexes = true; window.RYZE.render(); });
  const tr = garder('rapport nominatif', await racine('#app .rapport'));
  const pr = await H.pdf(page, 'rapport-nominatif');
  if (pr.textes) garder('rapport nominatif (PDF)', pr.textes.join('\n'));
  const nomsR = contexte.noms.filter(n => tr.includes(`${n.nom} ${n.prenom}`)).map(n => n.nom);
  t('rapport nominatif : patients nommés dans les annexes, PDF produit', nomsR.length > 0 && /Séances réalisées/.test(tr) && pr.pages >= 1, { nomsR, pages: pr.pages });
  await page.check('#app [data-change="rapportAnonyme"]');
  const ta = garder('rapport anonymisé', await racine('#app .rapport'));
  const pa = await H.pdf(page, 'rapport-anonyme');
  if (pa.textes) garder('rapport anonymisé (PDF)', pa.textes.join('\n'));
  const fuite = contexte.noms.filter(n => ta.includes(n.nom) || (n.ipp && ta.includes(n.ipp)) || (pa.textes && pa.textes.join(' ').includes(n.nom))).map(n => n.nom);
  const nomFichier = await page.evaluate(() => (window.RYZE.docExport() || {}).nom || '');
  t('rapport anonymisé : ni nom ni IPP, patients « Patient A… », fichier nommé « anonyme »', await page.isVisible('#app .rapport.anonyme') && !fuite.length && /Patient A\b/.test(ta) && /anonyme/i.test(nomFichier) && pa.pages >= 1, { fuite, nomFichier });
  await page.uncheck('#app [data-change="rapportAnonyme"]');

  /* ---------------- Feuille de planning ---------------- */
  H.section('Feuille de planning (jour, semaine)');
  const jourSeances = await page.evaluate(() => { const R = window.RYZE; for (let i = 0; i < 60; i++) { const d = R.addDays(R.today(), i); if (R.jourOuvert(d) && R.seances(d).length) return { d, noms: R.seances(d).map(x => x.patient.nom) }; } return null; });
  await H.aller(page, 'feuillePlanning', { vue: 'jour', date: jourSeances && jourSeances.d });
  const tj = garder('planning jour', await racine('#app .carnet-wrap.fp'));
  const pj = await H.pdf(page, 'planning-jour');
  if (pj.textes) garder('planning jour (PDF)', pj.textes.join('\n'));
  t('feuille du jour : titre, patients attendus, A4 portrait', !!jourSeances && /Planning du jour/.test(tj) && jourSeances.noms.every(n => tj.includes(n)) && pj.pages >= 1 && pj.formats.every(f => f === '595x842'), { j: jourSeances, f: pj.formats[0] });
  await H.aller(page, 'feuillePlanning', { vue: 'semaine', date: jourSeances && jourSeances.d });
  const tw = garder('planning semaine', await racine('#app .carnet-wrap.fp'));
  const pw = await H.pdf(page, 'planning-semaine');
  if (pw.textes) garder('planning semaine (PDF)', pw.textes.join('\n'));
  t('feuille de la semaine : titre, patients, A4 paysage', /Planning de la semaine/.test(tw) && !!jourSeances && jourSeances.noms.every(n => tw.includes(n)) && pw.pages >= 1 && pw.formats.every(f => f === '842x595'), pw.formats[0]);

  /* ---------------- Fichier .html autonome ---------------- */
  H.section('Fichier .html exporté (autonome)');
  const dIV = D[0];
  await H.aller(page, 'carnet', { id: dIV.id });
  const ex = await H.telecharger(page, '#app [data-action="telechargerDoc"]');
  t('export : fichier Ryze_Carnet_NOM_Prénom_AAAA-MM-JJ.html', new RegExp(`^Ryze_Carnet_${dIV.nom.replace(/[^A-Za-z0-9]+/g, '-')}_[A-Za-z-]+_\\d{4}-\\d{2}-\\d{2}\\.html$`).test(ex.nom), ex.nom);
  const html = ex.contenu;
  t('export : polices embarquées (data:font/woff2), logo intégré, aucune ressource Internet ni script', /@font-face/.test(html) && /url\(data:font\/woff2;base64,/.test(html) && html.includes(contexte.etab.logo.slice(0, 120)) && !/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/data:[^)"']+/g, '')) && !/<script/i.test(html), { googleapis: /googleapis/.test(html), script: /<script/i.test(html) });
  const X = await H.ouvrir({ horsLigne: true });
  await X.page.goto('file://' + ex.fichier);
  await X.page.evaluate(() => document.fonts.ready.then(() => true));
  const ouvert = await X.page.evaluate(n => ({ police: document.fonts.check('12px "IBM Plex Sans"') && [...document.fonts].some(f => f.family.replace(/"/g, '') === 'IBM Plex Sans' && f.status === 'loaded'), nom: document.body.innerText.includes(n), logo: !!document.querySelector('img.doc-logo') && document.querySelector('img.doc-logo').complete && document.querySelector('img.doc-logo').naturalWidth > 0 }), dIV.nom);
  const px = await H.pdf(X.page, `export-carnet-${dIV.id}`);
  t('export ouvert hors ligne : polices et logo chargés sans réseau, même nombre de pages que dans l’application', ouvert.police && ouvert.nom && ouvert.logo && X.reseau.length === 0 && px.pages === pagesCarnet[dIV.id], { ouvert, reseau: X.reseau, pages: [px.pages, pagesCarnet[dIV.id]] });
  await X.context.close();

  /* ---------------- Couleur / noir et blanc ---------------- */
  H.section('Impression couleur et noir et blanc');
  const pagesCouleur = {};
  for (const [route, par, cle] of [['carnet', { id: dIV.id }, 'carnet'], ['carnetPatient', { id: dIV.id }, 'carnet patient'], ['impression', { id: dIV.id, quoi: 'bilans' }, 'bilans']]) { await H.aller(page, route, par); pagesCouleur[cle] = (await H.pdf(page, `couleur-${cle.replace(' ', '-')}`)).pages; }
  await H.aller(page, 'parametres');
  await page.check('#carte-impression input[data-change="impressionCouleur"][value="0"]');
  const nb = await page.evaluate(() => ({ classe: document.documentElement.classList.contains('imp-nb') && !document.documentElement.classList.contains('imp-couleur'), reglage: window.RYZE.S.settings.impressionCouleur }));
  const pagesNB = {};
  for (const [route, par, cle] of [['carnet', { id: dIV.id }, 'carnet'], ['carnetPatient', { id: dIV.id }, 'carnet patient'], ['impression', { id: dIV.id, quoi: 'bilans' }, 'bilans']]) { await H.aller(page, route, par); pagesNB[cle] = (await H.pdf(page, `nb-${cle.replace(' ', '-')}`)).pages; }
  const exNB = await page.evaluate(() => { const d = window.RYZE.docExport(); return d ? /class="imp-nb"/.test(d.html) && /Impression : noir et blanc/.test(d.html) : false; });
  t('noir et blanc : réglage enregistré, classe imp-nb appliquée, export marqué « noir et blanc »', nb.classe && nb.reglage === false && exNB, nb);
  t('couleur et noir et blanc : même nombre de pages (carnet, carnet patient, bilans)', JSON.stringify(pagesCouleur) === JSON.stringify(pagesNB), { couleur: pagesCouleur, nb: pagesNB });
  await H.aller(page, 'parametres');
  await page.check('#carte-impression input[data-change="impressionCouleur"][value="1"]');

  /* ---------------- Textes interdits ---------------- */
  H.section('Textes interdits sur les documents');
  const fautes = docs.flatMap(x => interditsDans(x.texte).map(f => `${x.nom} : ${f}`));
  t(`aucun « (s) », « 05 XX », « undefined », « NaN » sur les ${docs.length} documents (écran et PDF)`, docs.length >= 30 && !fautes.length, fautes.slice(0, 6));
  fs.writeFileSync(`${H.out}/03-documents-textes.txt`, docs.map(x => `===== ${x.nom}\n${x.texte}`).join('\n\n'));
});
