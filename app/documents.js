/* =====================================================================
   Ryze — documents.js : fondations communes aux documents imprimés
   (carnet A4, impressions, compte rendu, rapport, carnet patient,
   planning). Chargé après core.js, avant pages.js.
   Contenu : textes (pluriel, virgule décimale, téléphones), identité du
   patient, en-tête commun R.enteteDoc, identité sur chaque page
   imprimée R.identitePages, séances annulées automatiquement,
   événements du traitement, réactions et prémédication, blocs
   « Statut et sécurité » et « À faire ». CSS : index.html (.doc-entete,
   .doc-secu, .doc-afaire…).
   Contrat des corrections (rempli ailleurs, lu ici) :
   c.corrections = [{ le: 'AAAA-MM-JJ', heure, par: userId, changements: [{ champ, avant, apres }] }]
   ===================================================================== */
'use strict';
(function (R) {
  const S = R.S, esc = R.esc;
  const vide = v => v == null || String(v).trim() === '' || String(v).trim() === '—';
  const dciDe = id => String((R.proto(id) || {}).dci || id || '').split(' — ')[0];

  /* ---------- Textes ---------- */
  /* nombre à la française : 64.9 → « 64,9 » ; dec = nombre maximal de décimales (défaut 2) ; '' si vide ; texte non numérique rendu tel quel */
  R.nbFr = (x, dec) => { if (x == null || x === '') return ''; const v = typeof x === 'number' ? x : Number(String(x).trim().replace(',', '.')); if (!isFinite(v)) return String(x); const r = dec == null ? Math.round(v * 100) / 100 : +v.toFixed(dec); return String(r).replace('.', ','); };
  /* virgule décimale dans un texte saisi (« Hb 12.8 g/dL » → « Hb 12,8 g/dL ») : même règle que l'impression des bilans, pour le carnet A4 et le compte rendu */
  R.virguleTexte = t => String(t == null ? '' : t).replace(/(\d)\.(\d)/g, '$1,$2');
  /* « 1 séance », « 3 séances » (singulier sous 2) ; plur facultatif (défaut sing + s) ; motSeul : le mot sans le nombre */
  R.pluriel = (n, sing, plur, motSeul) => { const mot = Math.abs(+n || 0) >= 2 ? (plur || sing + 's') : sing; return motSeul ? mot : `${R.nbFr(+n || 0)} ${mot}`; };
  /* téléphone imprimable : '' si vide ou numéro factice (« 05 XX XX… ») — le document imprime alors une ligne à remplir (R.telHTML) */
  R.telImprimable = v => { const t = v == null ? '' : String(v).trim(); return !t || t === '—' || /x{2}/i.test(t) ? '' : t; };
  R.telHTML = v => { const t = R.telImprimable(v); return t ? `<span class="doc-tel">${esc(t)}</span>` : '<span class="doc-a-remplir">………………</span>'; };
  /* téléphones de l'établissement manquants ou factices : ['hôpital de jour', 'urgences'] */
  R.telsManquants = () => { const e = R.etab(); return [[e.telHDJ, 'hôpital de jour'], [e.telUrgences, 'urgences']].filter(x => !R.telImprimable(x[0])).map(x => x[1]); };
  /* chaîne CSS entre guillemets (content: …), sans retour à la ligne ni balise possible */
  const cssTexte = s => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\3C ').replace(/>/g, '\\3E ').replace(/[\r\n\t]+/g, ' ') + '"';

  /* ---------- Identité du patient ---------- */
  const ageMois = ddn => { if (!ddn || isNaN(R.parse(ddn))) return null; const d = R.parse(ddn), t = R.parse(R.today()); let m = (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth(); if (t.getDate() < d.getDate()) m--; return m >= 0 ? m : null; };
  /* âge imprimé : « 15 ans », « 18 mois » avant 2 ans, '' si inconnu */
  R.ageDoc = p => { const m = ageMois(p && p.ddn); if (m == null) return ''; return m < 24 ? `${m} mois` : `${Math.floor(m / 12)} ans`; };
  /* « Fille · 15 ans », « Garçon · 9 ans », « Femme · 22 ans » (18 ans et plus) ; âge inconnu : « Sexe féminin » */
  R.sexeAge = p => { if (!p) return ''; const m = ageMois(p.ddn), f = p.sexe === 'F', h = p.sexe === 'M'; const lib = !f && !h ? '' : m == null ? (f ? 'Sexe féminin' : 'Sexe masculin') : m < 216 ? (f ? 'Fille' : 'Garçon') : (f ? 'Femme' : 'Homme'); return [lib, R.ageDoc(p)].filter(Boolean).join(' · '); };
  /* « née le 12/03/2011 » / « né le … » ; date estimée : « date de naissance inconnue (âge estimé) » ; '' sans date */
  R.neLe = p => !p || !p.ddn || isNaN(R.parse(p.ddn)) ? '' : p.ddnEstimee ? 'date de naissance inconnue (âge estimé)' : `${p.sexe === 'F' ? 'née' : p.sexe === 'M' ? 'né' : 'né(e)'} le ${R.fmtDate(p.ddn)}`;
  /* ligne d'identification : « NOM Prénom · IPP … · née le … » */
  R.identiteTexte = p => !p ? '' : [R.nomComplet(p), p.ipp ? 'IPP ' + p.ipp : '', R.neLe(p)].filter(Boolean).join(' · ');

  /* ---------- En-tête commun des documents ----------
     o : { titre, sousTitre, patient, sansPatient, compact, date } — textes bruts (échappés ici) ; date : AAAA-MM-JJ (défaut aujourd'hui) */
  R.enteteDoc = o => {
    o = o || {}; const e = R.etab(), p = o.sansPatient ? null : o.patient || null, d = o.date || R.today(); const u = S.user ? R.userName(S.user) : '';
    const edite = `Édité le ${R.fmtDate(d)}${u && u !== '—' ? ' par ' + esc(u) : ''}`;
    if (o.compact) return `<header class="doc-entete compact">${R.logoHTML('doc-logo')}<div class="doc-etab"><b>${esc(e.etablissement)}</b>${[e.hopital, e.service].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div><div class="doc-entete-d"><div class="doc-entete-titre">${esc(o.titre || '')}</div>${p ? `<div class="doc-entete-pat"><b>${esc(R.nomComplet(p))}</b><span>${esc([p.ipp ? 'IPP ' + p.ipp : '', R.neLe(p)].filter(Boolean).join(' · '))}</span></div>` : ''}</div></header>`;
    const lignes = [e.hopital, [e.service, e.unite].filter(Boolean).join(' · ')].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('') + (e.hdj ? `<span class="doc-etab-hdj">${esc(e.hdj)}</span>` : '');
    const pat = p ? `<div class="doc-entete-pat"><span class="doc-entete-nom"><b>${esc(R.nomComplet(p))}</b>${p.ipp ? ` <span class="doc-entete-ipp">IPP ${esc(p.ipp)}</span>` : ''}</span>${[R.sexeAge(p), R.neLe(p)].filter(Boolean).length ? `<span>${esc([R.sexeAge(p), R.neLe(p)].filter(Boolean).join(' · '))}</span>` : ''}</div>` : '';
    return `<header class="doc-entete${e.logo ? ' avec-logo' : ''}"><div class="doc-entete-g">${R.logoHTML('doc-logo')}<div class="doc-etab"><b>${esc(e.etablissement)}</b>${lignes}</div></div><div class="doc-entete-d"><div class="doc-entete-titre">${esc(o.titre || '')}</div>${o.sousTitre ? `<div class="doc-entete-sous">${esc(o.sousTitre)}</div>` : ''}${pat}<div class="doc-entete-ed">${edite}</div></div></header>`;
  };
  /* identité sur chaque feuille imprimée (sauf la première, qui porte l'en-tête) : boîte de marge @top-right de @page — à placer DANS le document (copié par R.docExport) */
  R.identitePages = p => !p ? '' : `<style class="doc-identite-pages">@media print{@page{@top-right{content:${cssTexte(R.identiteTexte(p))};font:8pt 'IBM Plex Sans',system-ui,sans-serif;color:#4E5E59;padding-right:14mm;vertical-align:bottom;padding-bottom:2.5mm;white-space:nowrap}}@page:first{@top-right{content:none}}}</style>`;

  /* ---------- Séances annulées ou reportées automatiquement ----------
     changement de protocole (statutAvantChg, motif « Changement de protocole : … »), action « Suspendre » (parSuspension, motif « Suspendu : … »), arrêt du traitement (motif « Arrêt du traitement ») : une ligne d'événement (R.evenementsTraitement) les remplace dans les documents */
  R.annulationAuto = c => !!c && (c.statut === 'annulee' || c.statut === 'reportee') && (c.statutAvantChg != null || /^Changement de protocole/.test(c.motif || '') || !!c.parSuspension || /^Suspendu : /.test(c.motif || '') || (c.statut === 'annulee' && /^Arrêt du traitement/.test(c.motif || '')));
  /* séance annulée automatiquement (arrêt, changement de protocole) APRÈS une trace saisie par l'équipe : absence (« Patient non venu »), ou report sans nouvelle date — son état d'avant : 'manquee' | 'reportee', sinon null.
     Les documents gardent sa ligne (« Non venu le … », « Reportée … ») et ne la comptent pas parmi les séances annulées de l'événement */
  R.traceAvantAnnulation = c => { if (!c || c.statut !== 'annulee' || !R.annulationAuto(c) || c.parSuspension) return null;
    if ((c.absences || []).some(a => a && a.date) || c.statutAvantChg === 'manquee') return 'manquee';
    const r = (c.reports || []).filter(Boolean).slice(-1)[0]; if (c.statutAvantChg === 'reportee' || (c.statutAvantChg == null && r && r.vers == null)) return 'reportee'; return null; };

  /* clôt les suspensions encore ouvertes (relais, arrêt, suppression du cycle) : finLe, fin = raison — pas de « reprise » imprimée ; le rapport ne les compte plus après cette date */
  R.fermerSuspensions = (p, date, raison) => { (p && p.suspensions || []).forEach(x => { if (x && !x.repriseLe && !x.finLe) Object.assign(x, { finLe: date || R.today(), fin: raison || 'autre' }); }); };
  /* suspension en cours : { le, motif, nbSeances } ou null — date : enregistrement de l'action « Suspendre », sinon note « Traitement suspendu : … », sinon date du report de la séance concernée */
  R.suspensionEnCours = p => {
    if (!p || p.statut !== 'suspendu') return null; const nb = (p.cures || []).filter(c => c.parSuspension && c.statut === 'reportee').length;
    const rec = (p.suspensions || []).filter(x => x && !x.repriseLe && !x.finLe).slice(-1)[0]; /* finLe : suspension close par un relais, un arrêt ou la suppression du cycle (sans « reprise ») */ if (rec) return { le: rec.le || null, motif: p.motifSuspension || rec.motif || '', nbSeances: nb };
    const note = (p.notes || []).find(n => /^Traitement suspendu : /.test(n.txt || '')); let le = note ? note.date : null;
    if (!le) le = (p.cures || []).filter(c => c.statut === 'reportee' && (c.parSuspension || (p.motifSuspension && c.motif === p.motifSuspension))).flatMap(c => (c.reports || []).map(r => r.date)).filter(Boolean).sort()[0] || null;
    return { le, motif: p.motifSuspension || '', nbSeances: nb };
  };

  /* ---------- Événements du traitement ----------
     [{ date, type: 'debut'|'changement'|'suspension'|'reprise'|'arret', texte, motif, nbSeances, de?, vers?, cycle? }] dans l'ordre chronologique (date null en dernier) */
  const ORDRE_EV = { debut: 0, arret: 1, changement: 2, suspension: 3, reprise: 4 };
  const frVersIso = s => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  R.evenementsTraitement = p => {
    if (!p) return []; const ev = [], cures = p.cures || [], hist = (p.historiqueProtocoles || []).filter(h => h && !h.retro).sort((a, b) => (a.cycle || 1) - (b.cycle || 1));
    const ajouter = x => { if (ev.some(y => y.type === x.type && y.date === x.date)) return; ev.push(x); };
    const voieDe = id => String((R.proto(id) || {}).voie || '');
    if (!hist.length && (p.protocoleId || p.dateDebut)) ajouter({ date: p.dateDebut || null, type: 'debut', texte: `Début du traitement par ${dciDe(p.protocoleId)}`, motif: '', nbSeances: 0, cycle: 1 });
    hist.forEach((h, i) => {
      if (i === 0) { ajouter({ date: h.dateDebut || p.dateDebut || null, type: 'debut', texte: `Début du traitement par ${dciDe(h.protocoleId)}`, motif: '', nbSeances: 0, cycle: h.cycle || 1 }); return; }
      const prev = hist[i - 1], n = cures.filter(c => (c.cycle || 1) === (prev.cycle || 1) && c.statut === 'annulee' && (c.statutAvantChg != null || /^Changement de protocole/.test(c.motif || '')) && !R.traceAvantAnnulation(c)).length;
      let de = dciDe(prev.protocoleId), vers = dciDe(h.protocoleId); if (de === vers && voieDe(prev.protocoleId) !== voieDe(h.protocoleId)) { de += ' ' + voieDe(prev.protocoleId); vers += ' ' + voieDe(h.protocoleId); }
      const motif = h.motif || prev.motifFin || '';
      ajouter({ date: h.dateDebut || null, type: 'changement', de, vers, motif, nbSeances: n, cycle: h.cycle, texte: `Relais ${de} → ${vers}${motif ? ' : ' + motif : ''}${n ? ' — ' + R.pluriel(n, 'séance annulée', 'séances annulées') : ''}` });
    });
    const txtSusp = (motif, n) => `Traitement suspendu${motif ? ' : ' + motif : ''}${n ? ' — ' + R.pluriel(n, 'séance mise en attente', 'séances mises en attente') : ''}`;
    const txtReprise = n => `Reprise du traitement${n ? ' — ' + R.pluriel(n, 'séance replanifiée', 'séances replanifiées') : ''}`;
    /* enregistrements structurés (action « Suspendre » / « Reprendre »), puis notes générées par les mêmes actions (données plus anciennes) */
    (p.suspensions || []).forEach(x => { if (!x) return; ajouter({ date: x.le || null, type: 'suspension', motif: x.motif || '', nbSeances: +x.nbSeances || 0, texte: txtSusp(x.motif, +x.nbSeances || 0) }); if (x.repriseLe) ajouter({ date: x.repriseLe, type: 'reprise', motif: '', nbSeances: +x.nbReplanifiees || 0, texte: txtReprise(+x.nbReplanifiees || 0) }); });
    const arretsNotes = [];
    (p.notes || []).forEach(n => { const t = String(n.txt || ''); let m;
      if ((m = /^Traitement suspendu : ([\s\S]*)$/.exec(t))) ajouter({ date: n.date || null, type: 'suspension', motif: m[1].trim(), nbSeances: 0, texte: txtSusp(m[1].trim(), 0) });
      else if (/^Reprise du traitement/.test(t)) { const k = +((/ — (\d+) séance/.exec(t) || [])[1]) || 0; ajouter({ date: n.date || null, type: 'reprise', motif: '', nbSeances: k, texte: txtReprise(k) }); }
      else if ((m = /^Traitement arrêté le (\d{2}\/\d{2}\/\d{4}) : ([\s\S]*)$/.exec(t))) arretsNotes.push({ date: frVersIso(m[1]) || n.date || null, motif: m[2].trim() });
      else if (/^Dossier rouvert/.test(t)) ajouter({ date: n.date || null, type: 'reprise', motif: '', nbSeances: 0, texte: 'Dossier rouvert : reprise du suivi' }); });
    const nArret = cures.filter(c => c.statut === 'annulee' && /^Arrêt du traitement/.test(c.motif || '') && !R.traceAvantAnnulation(c)).length;
    if (p.statut === 'termine' && !arretsNotes.some(a => a.date === (p.dateFin || null))) arretsNotes.push({ date: p.dateFin || null, motif: p.motifFin || '' });
    arretsNotes.sort((a, b) => String(a.date || '9').localeCompare(String(b.date || '9'))).forEach((a, i, L) => { const n = i === L.length - 1 ? nArret : 0; ajouter({ date: a.date, type: 'arret', motif: a.motif, nbSeances: n, texte: `Traitement arrêté${a.motif && a.motif !== '—' ? ' : ' + a.motif : ''}${n ? ' — ' + R.pluriel(n, 'séance annulée', 'séances annulées') : ''}` }); });
    ev.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || ORDRE_EV[a.type] - ORDRE_EV[b.type]);
    /* suspension en cours sans trace (base ancienne, démonstration) : ajoutée d'après le dossier ; nombre de séances en attente complété */
    if (p.statut === 'suspendu') { const cur = R.suspensionEnCours(p); const der = ev.filter(x => x.type === 'suspension' || x.type === 'reprise' || x.type === 'changement').slice(-1)[0];
      if (!der || der.type !== 'suspension') { ev.push({ date: cur.le, type: 'suspension', motif: cur.motif, nbSeances: cur.nbSeances, texte: txtSusp(cur.motif, cur.nbSeances) }); ev.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')) || ORDRE_EV[a.type] - ORDRE_EV[b.type]); }
      else if (!der.nbSeances && cur.nbSeances) { der.nbSeances = cur.nbSeances; der.texte = txtSusp(der.motif, cur.nbSeances); } }
    return ev;
  };

  /* ---------- Réactions antérieures et prémédication ---------- */
  const RX = /r[ée]action|anaphyla/i, RX_NEG = /(?:\b(?:pas de|aucune?|sans(?:\s+aucune?)?|absence de|ni)\s+|\bpas d['’]\s*)(?:de\s+)?(?:r[ée]action|anaphyla\w*)/gi;
  /* texte qui signale une réaction (casse ignorée ; « pas de réaction », « pas d’anaphylaxie », « aucune réaction », « sans (aucune) réaction », « absence de réaction », « ni réaction » exclus) ;
     tolérance « Bonne » choisie dans la fenêtre de la séance (« Bonne » ou « Bonne — note ») : pas une réaction, sauf si la note reprend « Réaction mineure » ou « Réaction sévère » */
  R.estReaction = t => { if (!t) return false; const s = String(t); if (/^\s*Bonne\s*(—|$)/i.test(s) && !/r[ée]action\s+(mineure|s[ée]v[èe]re)/i.test(s)) return false; return RX.test(s) && RX.test(s.replace(RX_NEG, '')); };
  /* champ Allergies qui dit qu'il n'y en a pas (« Aucune », « Néant », « RAS », « Pas d’allergie connue »…) : texte entier, pour ne pas masquer « aucune médicamenteuse, arachide » */
  R.allergieAbsente = v => /^\s*(aucune?(\s+allergie)?(\s+(connue|médicamenteuse connue|alimentaire ou médicamenteuse))?|n[ée]ant|r\.?a\.?s\.?|pas\s+d['’ ]\s*allergies?(\s+connues?)?|sans(\s+allergies?)?(\s+connues?)?|allergies?\s*:\s*(aucune?|n[ée]ant))\s*\.?\s*$/i.test(String(v == null ? '' : v));
  /* toutes les réactions connues, toutes périodes : [{ date, seance, dci, texte, retro }] (séances du dossier, séances et cycles saisis rétrospectivement, antécédents libres), date croissante (sans date en tête) */
  R.reactionsAnterieures = p => {
    if (!p) return []; const out = [];
    (p.cures || []).filter(c => c.statut === 'realisee' && R.estReaction(c.tolerance)).forEach(c => out.push({ date: c.dateReelle || c.datePrevue || null, seance: c.label || '', dci: dciDe(c.protocoleId || p.protocoleId), texte: String(c.tolerance), retro: false }));
    (p.curesRetro || []).filter(c => c.statut !== 'manquee' && R.estReaction(c.remarque)).forEach(c => out.push({ date: c.date || null, seance: c.label || 'séance antérieure', dci: dciDe(c.protocoleId), texte: String(c.remarque), retro: true }));
    R.retroCycles(p).forEach(h => { const t = [h.motifFin, h.remarques].filter(R.estReaction).join(' — '); if (t) out.push({ date: h.dateFin || h.dateDebut || null, seance: 'traitement antérieur', dci: dciDe(h.protocoleId), texte: t, retro: true }); });
    const atcd = String(p.antecedentsBio || '').trim(); if (R.estReaction(atcd)) out.push({ date: null, seance: 'antécédent', dci: '', texte: atcd, retro: true });
    return out.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  };
  /* prémédication en cours : { texte, depuis, source: 'dossier'|'seances' } ou null — celle du dossier, sinon celle de la dernière séance réalisée (une réaction suivie d'une prémédication n'est jamais perdue) */
  R.premedicationEnCours = p => {
    if (!p) return null; const ok = v => !vide(v) && !/^aucune$/i.test(String(v).trim());
    const faites = (p.cures || []).filter(c => c.statut === 'realisee' && c.dateReelle).sort((a, b) => a.dateReelle.localeCompare(b.dateReelle));
    const derPm = (faites.filter(c => ok(c.premedication)).slice(-1)[0] || {}).premedication;
    const texte = ok(p.premedication) ? String(p.premedication).trim() : ok(derPm) ? String(derPm).trim() : ''; if (!texte) return null;
    let depuis = null; for (let i = faites.length - 1; i >= 0; i--) { if (String(faites[i].premedication || '').trim() === texte) depuis = faites[i].dateReelle; else if (depuis) break; }
    return { texte, depuis, source: ok(p.premedication) ? 'dossier' : 'seances' };
  };

  /* ---------- Statut du traitement ----------
     { code: 'arrete'|'suspendu'|'avant'|'en-cours', texte, alerte } */
  R.statutTraitement = p => {
    if (!p) return { code: '', texte: '', alerte: false }; const dci = dciDe(p.protocoleId), spec = vide(p.specialite) ? '' : ` (${p.specialite})`, t = R.today();
    if (p.statut === 'termine') return { code: 'arrete', texte: `ARRÊTÉ${p.dateFin ? ' le ' + R.fmtDate(p.dateFin) : ''}${!vide(p.motifFin) ? ' — ' + p.motifFin : ''}`, alerte: true };
    if (p.statut === 'suspendu') { const s = R.suspensionEnCours(p); return { code: 'suspendu', texte: `SUSPENDU${s.le ? ' depuis le ' + R.fmtDate(s.le) : ''}${s.motif ? ' — ' + s.motif : ''} (${dci})`, alerte: true }; }
    const cyc = p.cycleCourant || 1, duCycle = (p.cures || []).filter(c => (c.cycle || 1) === cyc);
    const faites = duCycle.filter(c => c.statut === 'realisee' && c.dateReelle).sort((a, b) => a.dateReelle.localeCompare(b.dateReelle));
    if (!faites.length) { const pro = duCycle.filter(c => c.statut === 'prevue' && c.datePrevue).sort((a, b) => a.datePrevue.localeCompare(b.datePrevue))[0]; const avant = cyc > 1 ? (p.historiqueProtocoles || []).filter(h => !h.retro && (h.cycle || 1) < cyc).sort((a, b) => (a.cycle || 1) - (b.cycle || 1)).slice(-1)[0] : null; const relais = cyc > 1 ? ` (relais${avant ? ' de ' + dciDe(avant.protocoleId) : ''})` : '';
      return { code: 'avant', texte: pro ? `${dci}${spec}${relais} — début prévu le ${R.fmtDate(pro.datePrevue)}${pro.datePrevue < t ? ' (séance à saisir)' : ''}` : `${dci}${spec}${relais} — aucune séance programmée`, alerte: false }; }
    return { code: 'en-cours', texte: `En cours — ${dci}${spec}, ${p.statut === 'induction' ? 'induction' : 'entretien'}, depuis le ${R.fmtDate(faites[0].dateReelle)}`, alerte: false };
  };

  /* ---------- Bloc « Statut et sécurité » (indépendant de la période imprimée) ----------
     opts : { titre (défaut « Statut et sécurité » ; false = sans titre) } */
  R.blocStatutSecurite = (p, opts) => {
    if (!p) return ''; const o = opts || {}, st = R.statutTraitement(p), reac = R.reactionsAnterieures(p), pm = R.premedicationEnCours(p);
    const ligne = (k, v, cls) => `<div class="doc-secu-r${cls ? ' ' + cls : ''}"><span class="doc-secu-k">${cls === 'alerte' ? '⚠ ' : ''}${k}</span><span class="doc-secu-v">${v}</span></div>`;
    const allergies = vide(p.allergies) ? '<i>non renseignées</i>' : R.allergieAbsente(p.allergies) ? 'aucune connue' : `<b>${esc(p.allergies)}</b>`;
    const reacHTML = reac.length ? `<ul class="doc-secu-reac">${reac.map(r => `<li><b>${r.date ? R.fmtDate(r.date) : 'Date inconnue'}${r.seance ? ' — ' + esc(r.seance) : ''}</b>${r.dci ? ` (${esc(r.dci)})` : ''} : ${esc(r.texte)}</li>`).join('')}</ul>` : 'aucune signalée';
    const pmHTML = pm ? `<b>${esc(pm.texte)}</b>${pm.depuis ? ` depuis le ${R.fmtDate(pm.depuis)}` : ''}` : 'aucune';
    return `<div class="doc-secu${st.alerte || reac.length ? ' alerte' : ''}">${o.titre === false ? '' : `<div class="doc-secu-t">${esc(o.titre || 'Statut et sécurité')}</div>`}${ligne('Traitement', st.alerte ? `<span class="doc-fort">${esc(st.texte)}</span>` : esc(st.texte), st.alerte ? 'alerte' : '')}${ligne('Allergies', allergies)}${ligne(R.pluriel(reac.length, 'Réaction antérieure', 'Réactions antérieures', true), reacHTML, reac.length ? 'alerte' : '')}${ligne('Prémédication', pmHTML)}</div>`;
  };

  /* ---------- Dose de la prochaine séance ---------- */
  /* dose en mg/kg d'une séance (champ mgkg, texte « 5 mg/kg → … », ou schéma du dossier quand la dose attend le poids) ; null pour une dose fixe */
  R.mgkgDe = (p, c) => {
    if (!c) return null; if (+c.mgkg > 0) return +c.mgkg; const m = /(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*kg/i.exec(c.doseTexte || ''); if (m) return +m[1].replace(',', '.');
    if (/poids/i.test(c.doseTexte || '') && R.schemaPatient) { try { const sch = R.schemaPatient(p), pr = sch.pr || {}, ind = c.phase === 'Induction'; const et = ind ? (sch.induction || []).find(x => +x.jour === +c.jour) || (sch.induction || []).find(x => x.label === c.label) : sch.actuel; const dt = et && (et.doseType || (ind ? pr.doseType : ((pr.entretien || {}).doseType || pr.doseType))); if (et && dt === 'mgkg' && +et.dose > 0) return +et.dose; } catch (e) {} }
    return null;
  };
  /* dernier poids connu : séance réalisée, sinon poids à l'inclusion — { poids, date, initial } ou null */
  R.poidsReference = p => { const d = R.dernierPoids(p); if (d) return { poids: d.poids, date: d.date, initial: false }; const i = R.poidsInitial(p); if (!(i > 0)) return null; const h = (p.historiqueProtocoles || []).find(x => !x.retro) || {}; return { poids: i, date: p.creeLe || h.dateDebut || p.dateDebut || null, initial: true }; };
  /* dose à imprimer pour une séance à venir : { texte, mgkg, dose, poids, datePoids, auPoids } — mg/kg recalculés sur le dernier poids (avec sa date), ou « 5 mg/kg — à calculer sur le poids du jour » */
  /* étape du schéma d'une séance quand sa dose suit des paliers de poids (induction : étape du jour ; entretien : schéma actuel, posologie modifiée comprise), sinon null */
  const etapePalier = (p, c, pr) => { if (!pr || !(pr.paliers || []).length) return null; const ind = c.phase === 'Induction'; let et = null;
    try { if ((c.cycle || 1) === (p.cycleCourant || 1) && R.schemaPatient) { const s = R.schemaPatient(p); et = ind ? (s.induction || []).find(x => +x.jour === +c.jour) || (s.induction || []).find(x => x.label === c.label) : s.actuel; } } catch (e) { et = null; }
    if (!et) et = ind ? (pr.induction || []).find(x => +x.jour === +c.jour) || (pr.induction || []).find(x => x.label === c.label) : pr.entretien; if (!et) return null;
    const dt = et.doseType || (ind ? pr.doseType : ((pr.entretien || {}).doseType || pr.doseType)); return dt === 'palier' ? et : null; };
  /* dose de la séance corrigée à la main (« Modifier ») : choix du médecin, jamais recalculé */
  const doseCorrigee = c => (c.corrections || []).some(x => x && (x.changements || []).some(ch => ch && (ch.champ === 'dose' || ch.champ === 'doseTexte')));
  R.doseProchaine = (p, c) => {
    if (!c) return { texte: '', auPoids: false }; const mk = R.mgkgDe(p, c), pw = R.poidsReference(p), pr = R.protoDeCure(p, c) || {};
    if (mk) { if (pw) { const dose = Math.round(mk * pw.poids); return { texte: `${R.nbFr(mk)} mg/kg → ${dose} mg (${pw.initial ? 'poids à l’inclusion' : 'dernier poids'} : ${R.nbFr(pw.poids)} kg${pw.date ? ' le ' + R.fmtDate(pw.date) : ''})`, mgkg: mk, dose, poids: pw.poids, datePoids: pw.date, auPoids: true }; } return { texte: `${R.nbFr(mk)} mg/kg — à calculer sur le poids du jour`, mgkg: mk, dose: null, poids: null, datePoids: null, auPoids: true }; }
    if (/poids/i.test(c.doseTexte || '')) return { texte: 'dose selon le poids du jour', mgkg: null, dose: null, auPoids: true };
    /* paliers de poids (ustekinumab IV, golimumab…) : palier recalculé sur le dernier poids, la dose planifiée est rappelée si le palier a changé (prevu) */
    const et = etapePalier(p, c, pr);
    if (et && pw && !doseCorrigee(c) && R.doseEtape) { let d = null; try { d = R.doseEtape(pr, et, pw.poids, c.phase === 'Induction' ? 'induction' : 'entretien'); } catch (e) { d = null; }
      if (d && +d.dose > 0) { const prevu = c.dose != null && c.dose !== '' && !isNaN(+c.dose) && +c.dose !== +d.dose ? +c.dose : null; return { texte: prevu != null ? `${R.nbFr(d.dose)} mg (palier du ${pw.initial ? 'poids à l’inclusion' : 'dernier poids'} : ${R.nbFr(pw.poids)} kg${pw.date ? ' le ' + R.fmtDate(pw.date) : ''})` : `${R.nbFr(d.dose)} mg`, mgkg: null, dose: +d.dose, poids: pw.poids, datePoids: pw.date, auPoids: true, palier: true, articleId: d.articleId || null, prevu }; } }
    const fixe = c.dose != null && c.dose !== '' && !isNaN(+c.dose) ? `${R.nbFr(c.dose)} mg` : String(c.doseTexte || '').replace(/\s*\((optimisation|modifi[ée]e?)[^)]*\)/gi, '').trim();
    return { texte: fixe, mgkg: null, dose: c.dose != null ? +c.dose : null, auPoids: !!et };
  };
  /* écart entre la dose donnée et la prescription d'une séance réalisée : « prescrit 370 mg », « prescrit 5 mg/kg », '' sans écart.
     prescription en mg/kg : comparaison en mg/kg (mg/kg saisis, sinon dose ÷ poids du jour, 5 % d'arrondi) — jamais les mg planifiés sur un ancien poids ; dose fixe : comparaison des mg */
  const mgkgTexte = t => { const m = /(\d+(?:[.,]\d+)?)\s*mg\s*\/\s*kg/i.exec(t || ''); return m ? +m[1].replace(',', '.') : null; };
  R.ecartDose = (p, c) => {
    if (!c || c.statut !== 'realisee') return ''; const num = v => v != null && v !== '' && !isNaN(+v); if (!num(c.dosePrescrite) || !num(c.dose)) return '';
    const mkP = c.doseTextePrescrite !== undefined ? mgkgTexte(c.doseTextePrescrite) || (+c.mgkg > 0 ? +c.mgkg : null) : (+c.mgkg > 0 ? +c.mgkg : null);
    if (mkP) { const mkD = mgkgTexte(c.doseTexte), lib = `prescrit ${R.nbFr(mkP)} mg/kg`;
      if (mkD) return Math.abs(mkD - mkP) > 0.005 ? lib : ''; /* mg/kg saisis dans la fenêtre : les mg en découlent */
      if (+c.poids > 0) { const attendu = mkP * +c.poids; return Math.abs(+c.dose - attendu) > Math.max(1, attendu * 0.05) ? lib : ''; }
      return ''; }
    return +c.dosePrescrite !== +c.dose ? `prescrit ${R.nbFr(c.dosePrescrite)} mg` : '';
  };

  /* ---------- Bloc « À faire » ----------
     opts : { jours: 90 (horizon), pour: 'soignant' (cases ☐, saisies internes) | 'courrier' (sans cases ni saisies internes), max: 8 (lignes à venir, puis « + N autres »), titre }
     rendu : '' si aucune action */
  R.blocAFaire = (p, opts) => {
    if (!p) return ''; const o = Object.assign({ jours: 90, pour: 'soignant', max: 8 }, opts || {}), courrier = o.pour === 'courrier', t = R.today(), fin = R.addDays(t, Math.max(0, +o.jours || 0));
    const susp = p.statut === 'suspendu', arrete = p.statut === 'termine', cures = p.cures || [], surv = p.surveillance || [];
    const retards = [], suite = [], avenir = [], autres = [];
    if (!arrete) {
      surv.filter(s => s.statut === 'prevue' && s.mode === 'echeance' && s.echeance && s.echeance < t).forEach(s => retards.push({ date: s.echeance, html: `<b>EN RETARD</b> depuis le ${R.fmtDate(s.echeance)} — ${esc(s.label || '')}` }));
      if (!courrier) cures.filter(c => c.statut === 'prevue' && c.datePrevue && c.datePrevue < t).forEach(c => retards.push({ date: c.datePrevue, html: `Séance du ${R.fmtDate(c.datePrevue)} (${esc(c.label || '')}) <b>à saisir</b> : réalisée ou patient non venu` }));
      cures.filter(c => (c.statut === 'manquee' || c.statut === 'reportee') && !R.annulationAuto(c) && !(susp && p.motifSuspension && c.motif === p.motifSuspension)).forEach(c => { const ab = (c.absences || []).slice(-1)[0]; retards.push({ date: c.statut === 'manquee' ? (ab && ab.date) || c.dateManquee || c.datePrevue : c.datePrevue, html: `Séance ${esc(c.label || '')} ${c.statut === 'manquee' ? `manquée le ${R.fmtDate((ab && ab.date) || c.dateManquee || c.datePrevue)}` : `reportée${c.motif ? ' (' + esc(c.motif) + ')' : ''}`} — <b>à reprogrammer</b>` }); });
      const memeCtrl = (a, b) => a.id === b.id && (a.nom || '') === (b.nom || '');
      surv.filter(s => s.statut === 'annulee' && !s.annuleAuto && s.annuleLe && R.diffDays(s.annuleLe, t) <= 365 && !surv.some(x => x !== s && memeCtrl(x, s) && ((x.statut === 'prevue' && x.echeance && x.echeance >= (s.echeance || s.annuleLe)) || (x.statut === 'faite' && (x.dateFaite || '') >= s.annuleLe)))).forEach(s => retards.push({ date: s.echeance || s.annuleLe, html: `${esc(s.label || '')} annulé le ${R.fmtDate(s.annuleLe)}${s.note ? ' (' + esc(s.note) + ')' : ''} — <b>à reprogrammer</b>` }));
    }
    retards.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let pro = null;
    if (susp) { const s = R.suspensionEnCours(p); suite.push({ date: null, html: `Traitement suspendu${s.le ? ' depuis le ' + R.fmtDate(s.le) : ''} : <b>reprise à ${courrier ? 'rediscuter' : 'décider'}</b>` }); }
    else if (!arrete) {
      pro = cures.filter(c => c.statut === 'prevue' && c.datePrevue && c.datePrevue >= t).sort((a, b) => (a.datePrevue + (a.heure || '')).localeCompare(b.datePrevue + (b.heure || '')))[0] || null;
      if (pro) { const d = R.doseProchaine(p, pro), voie = pro.voie === 'IV' ? 'perfusion' : pro.voie === 'SC' ? 'injection sous-cutanée' : pro.voie || ''; const premiere = !cures.some(c => (c.cycle || 1) === (pro.cycle || 1) && c.statut === 'realisee');
        suite.push({ date: pro.datePrevue, html: `<b>${premiere ? 'Première séance' : 'Prochaine séance'}</b>${pro.heure && pro.voie === 'IV' ? ' à ' + esc(pro.heure) : ''} — ${esc([pro.label, pro.phase ? pro.phase.toLowerCase() : '', voie].filter((x, i, a) => x && a.findIndex(y => String(y).toLowerCase() === String(x).toLowerCase()) === i).join(', '))}${d.texte ? ' : ' + esc(d.texte) : ''}` });
        if (!courrier && d.auPoids) { const pw = R.poidsReference(p); if (!pw || !pw.date || R.diffDays(pw.date, pro.datePrevue) > 92 || pw.initial && !R.dernierPoids(p) && R.diffDays(pw.date, pro.datePrevue) > 31) autres.push({ date: pro.datePrevue, html: `<b>Poids à mesurer</b> avant la séance du ${R.fmtDate(pro.datePrevue)} ${pw ? `(${pw.initial ? 'poids à l’inclusion' : 'dernier poids'} : ${R.nbFr(pw.poids)} kg${pw.date ? ' le ' + R.fmtDate(pw.date) : ''})` : '(aucun poids enregistré)'}` }); } }
      else if (!courrier) suite.push({ date: null, html: '<b>Aucune séance programmée</b> : planification à prolonger' });
    }
    if (!arrete) {
      surv.filter(s => s.statut === 'prevue' && s.mode === 'echeance' && s.echeance && s.echeance >= t && s.echeance <= fin).forEach(s => { const av = R.seanceAvantTdm(p, s); avenir.push({ date: s.echeance, html: `${esc(s.label || '')}${av ? ` — <b>à prélever AVANT la séance ${esc(av)}</b> du ${R.fmtDate(s.echeance)}` : ''}` }); });
      (S.rdv || []).filter(r => r.patientId === p.id && r.date >= t && r.date <= fin).forEach(r => avenir.push({ date: r.date, html: `${esc(r.type || 'Rendez-vous')}${r.heure ? ' à ' + esc(r.heure) : ''}${r.objet ? ' — ' + esc(r.objet) : ''}` }));
    }
    avenir.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const att = (p.bilan || []).filter(b => b && b.statut === 'attente'); if (att.length && !arrete) { const noms = att.map(b => R.defBilan(b.id, p.bilan).label.split(' (')[0].split(' :')[0] + (b.date ? ' (' + R.bilanDemandeTxt(b) + ')' : '')); autres.push({ date: null, html: `<b>Bilan pré-biothérapie en attente</b> : ${esc(noms.slice(0, 6).join(', '))}${noms.length > 6 ? ` et ${R.pluriel(noms.length - 6, 'autre examen', 'autres examens')}` : ''}` }); }
    const max = Math.max(1, +o.max || 8), reste = avenir.length - max;
    const lignes = [...retards.map(x => Object.assign({ retard: true, sansDate: true }, x)), ...suite, ...avenir.slice(0, max), ...(reste > 0 ? [{ date: null, html: `<i>+ ${R.pluriel(reste, 'autre échéance', 'autres échéances')} d’ici le ${R.fmtDate(fin)}</i>`, info: true }] : []), ...autres];
    if (!lignes.length) return '';
    const titre = o.titre || (courrier ? 'À prévoir' : 'À faire');
    return `<div class="doc-afaire${courrier ? ' courrier' : ''}"><div class="doc-afaire-t">${esc(titre)}<span class="doc-afaire-h">${retards.length ? R.pluriel(retards.length, 'retard', 'retards') + ' · ' : ''}horizon ${R.pluriel(+o.jours || 0, 'jour')}</span></div><ul class="doc-afaire-l">${lignes.map(l => `<li class="${l.retard ? 'retard' : ''}${l.info ? ' info' : ''}">${courrier || l.info ? '<span class="doc-case"></span>' : '<span class="doc-case" aria-hidden="true">☐</span>'}<span class="doc-afaire-d">${l.date && !l.sansDate ? R.fmtDate(l.date) : ''}</span><span class="doc-afaire-x">${l.html}</span></li>`).join('')}</ul></div>`;
  };

  /* ---------- Trace des corrections d'une séance (contrat c.corrections) ----------
     « Corrigée le 05/10/2026 par Dr Y. ALAMI : dose 300 → 150 ; lot A12 → B34 » — '' sans correction ; opts.derniere : seulement la dernière */
  const CHAMPS = { dose: 'dose', doseTexte: 'dose', lot: 'lot', tolerance: 'tolérance', statut: 'statut', poids: 'poids', dateReelle: 'date', datePrevue: 'date prévue', heure: 'heure', voie: 'voie', flacons: 'flacons', flaconsUtilises: 'flacons utilisés', premedication: 'prémédication', ide: 'administré par', motif: 'motif', label: 'séance', phase: 'phase' };
  const STATUTS = { realisee: 'réalisée', prevue: 'prévue', reportee: 'reportée', manquee: 'manquée', annulee: 'annulée' };
  const valCorr = (champ, v) => vide(v) ? '∅' : champ === 'statut' ? STATUTS[v] || String(v) : champ === 'ide' ? R.userName(v) : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? R.fmtDate(v) : typeof v === 'number' ? R.nbFr(v) : String(v);
  R.correctionsTexte = (c, opts) => { const L = (c && Array.isArray(c.corrections) ? c.corrections : []).filter(x => x && x.le); if (!L.length) return ''; const sel = opts && opts.derniere ? L.slice(-1) : L;
    return sel.map(x => `Corrigée le ${R.fmtDate(x.le)}${x.par ? ' par ' + R.userName(x.par) : ''}${(x.changements || []).length ? ' : ' + x.changements.map(ch => `${CHAMPS[ch.champ] || ch.champ} ${valCorr(ch.champ, ch.avant)} → ${valCorr(ch.champ, ch.apres)}`).join(' ; ') : ''}`).join(' · '); };
  /* ---------- Lecture d'un dosage (taux résiduel) sur un document ----------
     Décision D3 : le constat seulement (taux, cible du dossier, anticorps), précédé de la remarque du médecin (conduite à tenir) en gras si elle existe.
     La conduite proposée par l'application (R.interpTdm(...).texte) reste à l'écran : jamais imprimée ni exportée.
     R.lectureTdm(p, s) → { constat: 'Taux résiduel 5,2 µg/mL — sous la cible (≥ 7,5) — anticorps non détectés', note, niveau, cible, cibleMotif, hors, induction, taux, molecule } ; constat '' si le dosage n'est pas chiffré */
  R.lectureTdm = (p, s) => { if (!s) return { constat: '', note: '', niveau: '', cible: '', cibleMotif: '', hors: false, induction: false, taux: null, molecule: '' };
    const td = R.tdmDe(s, p) || {}, i = R.interpTdm(td, { p: p || null, s }), note = String(s.note || '').trim();
    return { constat: i.constat || '', note, niveau: i.niveau || '', cible: i.cible || '', cibleMotif: i.cibleMotif || '', hors: i.niveau === 'bas' || i.niveau === 'haut', induction: !!i.induction, taux: td.taux != null && !isNaN(td.taux) ? td.taux : null, molecule: td.molecule || '' }; };
  /* HTML : <div class="doc-tdm-note"><b>Remarque du médecin : …</b></div><div class="doc-tdm-constat">constat</div> — o.inline : « <b>Remarque du médecin : …</b> — constat » sur une ligne ; '' si ni note ni constat */
  R.lectureTdmDoc = (p, s, o) => { o = o || {}; const l = R.lectureTdm(p, s); const note = l.note ? `<b>Remarque du médecin : ${esc(l.note)}</b>` : '', constat = l.constat ? esc(l.constat) : '';
    if (!note && !constat) return ''; if (o.inline) return [note, constat].filter(Boolean).join(' — ');
    return `${note ? `<div class="doc-tdm-note">${note}</div>` : ''}${constat ? `<div class="doc-tdm-constat">${constat}</div>` : ''}`; };

  /* ---------- Bilan pré-biothérapie : « À retenir » (décision D7) ----------
     anomalies (examens faits anormaux, hors état de référence R.estEtatReference) et examens en attente, en tête de la liste complète.
     R.bilanPreRetenir(p) → { anomalies: [{ id, label, commentaire, date }], attente: [{ id, label, date, demande }], faits, total } ; label = libellé court */
  const courtBilan = l => String(l || '').split(' (')[0].split(' :')[0];
  R.bilanPreRetenir = p => { const bilan = (p && p.bilan) || []; const app = R.bilanDefs(bilan).map(d => ({ d, b: bilan.find(x => x.id === d.id) })).filter(x => x.b && x.b.statut !== 'na');
    return { anomalies: app.filter(x => x.b.statut === 'fait_anormal' && !R.estEtatReference(x.d.id)).map(x => ({ id: x.d.id, label: courtBilan(x.d.label), commentaire: String(x.b.commentaire || '').trim(), date: x.b.date || '' })),
      attente: app.filter(x => R.bilanEnCours(x.b)).map(x => ({ id: x.d.id, label: courtBilan(x.d.label), date: x.b.date || '', demande: x.b.date ? R.bilanDemandeTxt(x.b) : '' })),
      faits: app.filter(x => R.bilanFait(x.b)).length, total: app.length }; };
  /* liste complète en deux colonnes (compte rendu) : Examen | Résultat | Date ×2 ; anomalies en gras, état de référence « fait », en attente en italique ; puis « Résultats et commentaires » (o.commentaires:false pour l'omettre) ; '' sans bilan retenu */
  R.bilanPreCompactDoc = (p, o) => { o = o || {}; const bilan = (p && p.bilan) || []; const rows = R.bilanDefs(bilan).map(d => ({ d, b: bilan.find(x => x.id === d.id) })).filter(x => x.b && x.b.statut !== 'na'); if (!rows.length) return '';
    const an = x => x.b.statut === 'fait_anormal' && !R.estEtatReference(x.d.id);
    const TD = ' style="height:auto;padding:2px 5px"'; /* lignes serrées (la CSS du document est dans index.html) */
    const cell = x => !x ? `<td${TD}></td><td${TD}></td><td class="m"${TD}></td>` : `<td${TD}>${an(x) ? '<b>' : ''}${esc(courtBilan(x.d.label))}${an(x) ? '</b>' : ''}</td><td${TD}>${x.b.statut === 'attente' ? `<i>${x.b.date ? esc(R.bilanDemandeTxt(x.b)) : 'en attente'}</i>` : an(x) ? '<b>anormal</b>' : x.b.statut === 'fait_anormal' ? 'fait' : 'normal'}</td><td class="m"${TD}>${x.b.date ? R.fmtDate(x.b.date) : ''}</td>`;
    let h = ''; for (let i = 0; i < rows.length; i += 2) h += `<tr>${cell(rows[i])}${cell(rows[i + 1])}</tr>`;
    const com = rows.filter(x => String(x.b.commentaire || '').trim() || an(x));
    return `<table class="doc-table doc-bilan-compact" style="font-size:8.5pt"><thead><tr><th style="padding:3px 5px">Examen</th><th style="padding:3px 5px">Résultat</th><th style="padding:3px 5px">Date</th><th style="padding:3px 5px">Examen</th><th style="padding:3px 5px">Résultat</th><th style="padding:3px 5px">Date</th></tr></thead><tbody>${h}</tbody></table>${com.length && o.commentaires !== false ? `<p class="doc-bilan-com" style="font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:9pt;line-height:1.35;margin:4px 0 0"><b>Résultats et commentaires :</b> ${com.map(x => `${an(x) ? '<b>' : ''}${esc(courtBilan(x.d.label))}${an(x) ? ' (anormal)</b>' : ''}${String(x.b.commentaire || '').trim() ? ' : ' + esc(String(x.b.commentaire).trim()) : ''}`).join(' · ')}</p>` : ''}`; };
  /* bloc imprimé div.doc-retenir (avant la liste complète) : « À retenir — ⚠ Anomalies : … · ☐ En attente : … » ; bilan complet sans anomalie : une ligne ; '' sans bilan retenu */
  R.bilanPreRetenirDoc = p => { const r = R.bilanPreRetenir(p); if (!r.total) return '';
    const an = r.anomalies.map(x => `<b>${esc(x.label)}</b>${x.commentaire ? ' : ' + esc(x.commentaire) : ''}${x.date ? ` (${R.fmtDate(x.date)})` : ''}`), att = r.attente.map(x => `${esc(x.label)}${x.demande ? ` (${esc(x.demande)})` : ''}`);
    const ligne = (k, v) => `<div class="doc-retenir-r" style="display:grid;grid-template-columns:30mm minmax(0,1fr);gap:6px;padding:1px 0"><span class="doc-retenir-k" style="font-weight:700">${k}</span><span class="doc-retenir-v">${v}</span></div>`;
    const corps = !an.length && !att.length ? `<div class="doc-retenir-ok">Bilan complet (${r.faits}/${r.total}), aucune anomalie signalée.</div>` : `${ligne(an.length ? `⚠ ${an.length > 1 ? 'Anomalies' : 'Anomalie'} (${an.length})` : 'Anomalies', an.length ? an.join(' · ') : 'aucune')}${att.length ? ligne(`☐ En attente (${att.length})`, att.join(' · ')) : ''}`;
    return `<div class="doc-box doc-retenir" style="font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:9pt;line-height:1.35;padding:5px 9px;margin:4px 0 6px;break-inside:avoid"><div class="doc-retenir-t" style="font-size:8pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px">À retenir <span style="font-weight:400;letter-spacing:0;text-transform:none">· ${r.faits}/${r.total} ${R.pluriel(r.total, 'examen réalisé', 'examens réalisés', true)}</span></div>${corps}</div>`; };
})(window.RYZE);
