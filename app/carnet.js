/* =====================================================================
   Ryze — carnet.js : carnet patient bilingue (français / arabe) remis
   UNE SEULE FOIS aux familles (il n'est pas réimprimé). 8 pages A5
   (148 × 210 mm), soit 2 feuilles A4 pliées en deux :
     1 couverture (logo et identité de l'établissement, prochain rendez-vous
       à remplir) et informations ; 2 à 4 mes séances (lignes numérotées :
       dates à venir et doses laissées en blanc, remplies par l'équipe ;
       séances déjà faites pré-remplies) ; 5 mes examens (plan et fréquence,
       lignes vides) ; 6 et 7 urgences et conseils (9 pt au moins) ;
       8 numéros utiles. Carte détachable : recto en page 8, verso en
       page 7, à la même place (même feuillet).
   Contenu : R.LIVRET (livret-data.js). Route : R.pages.carnetPatient ;
   export : R.docExport.
   ===================================================================== */
'use strict';
(function (R) {
  const S = R.S, esc = R.esc;
  const L = () => R.LIVRET || {};
  const NB_PAGES = 8;
  /* ---------- helpers bilingues ---------- */
  const fr = v => typeof v === 'string' ? v : (v && v.fr) || '';
  const ar = v => typeof v === 'string' ? '' : (v && v.ar) || '';
  const ltr = s => `<bdi dir="ltr" class="nw">${esc(s)}</bdi>`;
  const LRI = '\u2066', PDI = '\u2069'; /* isolats LTR dans une phrase arabe (chiffres, heures) */
  /* espaces insécables : chiffres groupés (téléphones, « 24 h/24 », « 38 °C ») jamais coupés en fin de ligne */
  const insec = s => String(s).replace(/(\d) (?=\d)/g, '$1\u00A0').replace(/(\d) (?=°|h\/|kg\b|mg\b)/g, '$1\u00A0');
  /* remplit les {clés} d'un texte déjà échappé : valeur neutre isolée en LTR côté arabe, paire {fr, ar} selon la langue */
  const remplir = (s, vals, lang) => String(s).replace(/\{([a-zA-Z.]+)\}/g, (m, k) => { const v = vals && vals[k]; if (v == null) return m; if (typeof v === 'object') return esc(lang === 'ar' ? v.ar : v.fr); return lang === 'ar' ? ltr(v) : esc(v); });
  /* libellé bilingue sur une ligne : FR / AR */
  const bi = (v, cls, vals) => v ? `<span class="bi${cls ? ' ' + cls : ''}"><span class="fr">${insec(remplir(esc(fr(v)), vals, 'fr'))}</span>${ar(v) ? `<span class="sep">/</span><span class="ar" lang="ar" dir="rtl">${insec(remplir(esc(ar(v)), vals, 'ar'))}</span>` : ''}</span>` : '';
  /* phrase longue : ligne française puis ligne arabe (alignée à droite) */
  const bi2 = (v, cls, vals) => v ? `<div class="bi2${cls ? ' ' + cls : ''}"><div class="fr">${insec(remplir(esc(fr(v)), vals, 'fr'))}</div>${ar(v) ? `<div class="ar" lang="ar" dir="rtl">${insec(remplir(esc(ar(v)), vals, 'ar'))}</div>` : ''}</div>` : '';
  const fill = () => '<span class="fill"></span>';
  /* ligne « libellé : valeur » ; valeur : chaîne (échappée, ou LTR isolée), paire bilingue, ou vide (ligne à compléter) */
  const champ = (label, val, o = {}) => `<div class="f${o.cls ? ' ' + o.cls : ''}"><span class="lab">${bi(label)}</span><span class="val${val ? '' : ' libre'}">${val ? (typeof val === 'object' ? bi(val) : o.html ? val : (o.ltr ? ltr(val) : esc(val))) : ''}</span></div>`;
  const titreBloc = (v, cls) => `<h3 class="bt${cls ? ' ' + cls : ''}">${bi(v)}</h3>`;
  const chk = () => '<span class="chk"></span>';
  const pre = h => `<span class="pre">${h}</span>`;
  const dt = s => s ? R.fmtDate(s) : '';
  const dtPasse = s => s && s <= R.today() ? R.fmtDate(s) : ''; /* date à venir : case laissée en blanc (carnet non réimprimé) */
  /* téléphones vides ou factices (« 05 XX… ») : ligne à remplir à la main (R.telImprimable, documents.js) ; jamais coupés */
  const A_REMPLIR = '<span class="a-remplir">………………</span>';
  const tel = v => R.telImprimable(v) ? ltr(R.telImprimable(v)) : A_REMPLIR;
  const telUrgTxt = v => R.telImprimable(v) ? R.telImprimable(v).replace(/\s*\((?=[^)]*(?:urgence|24))[^)]*\)\s*$/i, '') : ''; /* « 05 … (urgences 24 h/24) » : la parenthèse est déjà dans le libellé */
  const telUrg = v => telUrgTxt(v) ? ltr(telUrgTxt(v)) : A_REMPLIR;
  const suite = v => ({ fr: `${fr(v)} ${fr(L().suite)}`, ar: `${ar(v)} ${ar(L().suite)}` });
  const joindre = (a, b) => ({ fr: `${fr(a)} → ${fr(b)}`, ar: `${ar(a)} ← ${ar(b)}` });
  const vide = v => v == null || String(v).trim() === '' || String(v).trim() === '—';
  const nb = v => R.nbFr(v);
  /* forme plurielle arabe : 1, 2, 3–10, 11 et plus */
  const plur = (T, n) => { const t = n === 1 ? T.un : n === 2 ? T.deux : n <= 10 ? T.peu : T.beaucoup; return t ? { fr: fr(t).replace('{n}', n), ar: ar(t).replace('{n}', LRI + n + PDI) } : null; };

  /* ---------- contexte du dossier ---------- */
  function contexte(p) {
    const pr = R.proto(p.protocoleId) || {}, t = R.today(), e = R.etab();
    let sch = {}; try { sch = R.schemaPatient(p) || {}; } catch (er) { sch = {}; }
    const voies = [...new Set(String(pr.voie || '').split(/\s*(?:puis|,|\/)\s*/).map(v => v.trim()).filter(Boolean))];
    const classe = /TNF/i.test(pr.classe || '') ? 'antiTNF' : /int[ée]grine/i.test(pr.classe || '') ? 'vedolizumab' : /\bIL\b|interleukine|IL-/i.test(pr.classe || '') ? 'antiIL' : /JAK/i.test(pr.classe || '') ? 'JAK' : '';
    const tt = String(p.traitementsAssocies || ''); const associe = [];
    if (/m[ée]thotrexate|mtx/i.test(tt)) associe.push('methotrexate');
    if (/azathioprine|mercaptopurine|6-?MP|thiopurine|purinethol|imurel/i.test(tt)) associe.push('thiopurine');
    if (/m[ée]salazine|5-?ASA|pentasa|fivasa|salofalk|sulfasalazine/i.test(tt)) associe.push('mesalazine');
    const age = R.age(p.ddn), ageN = typeof age === 'number' ? age : null;
    const sexe = p.sexe === 'F' ? 'F' : 'M';
    const PAT = { voie: voies, sexe, classe, associe, maladie: p.pathologie, age: ageN };
    const garde = i => !i.si || Object.entries(i.si).every(([k, v]) => { const want = [].concat(v), have = [].concat(PAT[k] ?? []); return want.some(x => have.includes(x)); });
    /* grossesse : filles à partir de 10 ans seulement (document pédiatrique) ; voies : texte propre à la perfusion ou à l'injection */
    const filtreTexte = i => !(/enceinte|grossesse/i.test(fr(i)) && !(sexe === 'F' && (ageN == null || ageN >= 10))) && !(!voies.includes('SC') && /point d’injection/i.test(fr(i))) && !(!voies.includes('IV') && /pendant la perfusion/i.test(fr(i)));
    const items = arr => (arr || []).filter(garde).filter(filtreTexte);
    const dci = String(pr.dci || '').split(' — ')[0];
    const translit = (L().translit || {})[dci.toLowerCase().split(/\s/)[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
    const dciBi = { fr: dci, ar: translit || '' }; /* nom latin côté FR, translittération côté AR */
    return { p, pr, t, e, sch, horaires: horairesBi(), voies, classe, associe, sexe, ageN, garde, filtreTexte, items, dci, dciBi, susp: p.statut === 'suspendu', maladie: ((L().p1 || {}).maladies || {})[p.pathologie] || { fr: (R.PATHOS[p.pathologie] || {}).label || p.pathologie || '', ar: '' } };
  }
  /* rythme d'entretien actuel : « Toutes les N semaines », « Tous les N jours », « 1 fois par jour » */
  const rythmeBi = c => { const a = c.sch.actuel, T = L().p1.rythmes; if (!a || !T) return null; const po = (a.doseType || ((c.sch.pr || {}).entretien || {}).doseType || (c.sch.pr || {}).doseType) === 'po'; if (po) return /×\s*2|x\s*2|2\s*fois|\b2\/j/i.test(a.texte || '') ? T.po2 : T.po1; const j = +a.intervalleJours || 0; if (!j) return null; return j % 7 === 0 ? plur(T.semaines, j / 7) : plur(T.jours, j); };
  const commentBi = c => { const V = L().p1.voies || {}; const l = c.voies.map(v => V[v]).filter(Boolean); if (!l.length) return c.pr.voie ? { fr: c.pr.voie, ar: '' } : ''; return l.length === 1 ? l[0] : joindre(l[0], l[1]); };
  /* horaires de l'hôpital de jour : « Du lundi au vendredi, de 08:00 à 16:00 » (jours contigus) ou liste des jours */
  const horairesBi = () => { const h = R.hdj() || {}, J = L().p1.jours || {}; const ordre = [1, 2, 3, 4, 5, 6, 0]; const jours = [...new Set(h.jours || [])].sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b)); const noms = jours.map(d => J[d]).filter(Boolean); if (!noms.length) return null;
    const idx = jours.map(d => ordre.indexOf(d)); const contigu = noms.length >= 3 && idx.every((x, i) => i === 0 || x === idx[i - 1] + 1); const T = contigu ? L().p1.horairesDuAu : L().p1.horairesListe; if (!T) return null;
    const liste = lang => lang === 'fr' ? noms.map(x => x.fr).join(', ').replace(/, ([^,]*)$/, ' et $1') : noms.map(x => x.ar).join(' و');
    const f = lang => String(T[lang]).replace('{a}', noms[0][lang]).replace('{b}', noms[noms.length - 1][lang]).replace('{jours}', liste(lang)).replace('{h1}', lang === 'ar' ? LRI + (h.ouverture || '') + PDI : (h.ouverture || '')).replace('{h2}', lang === 'ar' ? LRI + (h.fermeture || '') + PDI : (h.fermeture || ''));
    return { fr: f('fr'), ar: f('ar') }; };
  const dureeBi = c => { const T = L().p1.heures; const m = c.pr.dureeSeanceMin != null ? +c.pr.dureeSeanceMin : 180; if (!T || !(m > 0) || !c.voies.includes('IV')) return null; return plur(T, Math.max(1, Math.round(m / 60))); };
  const nomPatient = p => `${esc(p.prenom || '')} <b>${esc(p.nom || '')}</b>`;
  /* bandeau de page : nom et dossier (une seule fois par page), titre, numéro ; sansNom : page de la carte (le nom est sur la carte) */
  const enTete = (c, n, titre, o) => `<div class="run">${o && o.sansNom ? '' : `<span class="run-id">${nomPatient(c.p)}${c.p.ipp ? ` · ${bi(L().dossierNo)} ${ltr(c.p.ipp)}` : ''}</span>`}<span class="run-t">${bi(titre)}</span><span class="num">${fr(L().page)} ${n}/${NB_PAGES}</span></div>`;
  const etabLignes = e => [e.hopital, [e.service, e.unite].filter(Boolean).join(' · ')].filter(Boolean);
  const bandeauPause = c => c.susp && L().p2.pause ? `<div class="pause">${bi2(L().p2.pause)}</div>` : '';

  /* ---------- page 1 : couverture et informations ---------- */
  function page1(c) {
    const Lv = L(), P1 = Lv.p1, p = c.p, e = c.e; const moi = P1.moi, par = P1.parents, mal = P1.maladie, trt = P1.traitement, equ = P1.equipe, rdv = Lv.p3.rdv;
    const sexeLib = c.sexe === 'F' ? (c.ageN != null && c.ageN < 18 ? P1.sexe.fille : P1.sexe.F) : (c.ageN != null && c.ageN < 18 ? P1.sexe.garcon : P1.sexe.M);
    const ddn = p.ddn && !isNaN(R.parse(p.ddn)) ? `${R.ddnTxt(p)}${R.ageDoc(p) ? ' (' + R.ageDoc(p) + ')' : ''}` : '';
    const pi = R.poidsInitial(p), pd = R.dernierPoids(p); const poidsTxt = pd && pi && pd.poids !== pi ? `${nb(pi)} kg · ${nb(pd.poids)} kg (${dt(pd.date)})` : (pi || pd ? `${nb(pi || pd.poids)} kg` : '');
    const allergies = vide(p.allergies) ? '' : p.allergies; /* « — » = non renseigné (assistant) : ligne laissée à compléter, jamais « Aucune allergie connue » */
    const pm = R.premedicationEnCours ? R.premedicationEnCours(p) : null; const premed = pm ? pm.texte : '';
    const dateDiag = p.dateDiag && !isNaN(R.parse(p.dateDiag)) ? R.fmtDate(p.dateDiag, { month: '2-digit', year: 'numeric' }) : '';
    const medecin = R.userName(p.medecinId) === '—' ? '' : R.userName(p.medecinId);
    const rdvLigne = `<tr><td></td><td></td><td></td><td class="c">${chk()}</td></tr>`;
    /* valeurs longues (allergies, autres médicaments, prémédication, horaires…) : 2 lignes de rendez-vous au lieu de 3, puis présentation resserrée */
    const long = [allergies, vide(p.traitementsAssocies) ? '' : p.traitementsAssocies, c.voies.includes('IV') ? premed : '', vide(p.specialite) ? '' : p.specialite, e.chef, vide(p.groupeSanguin) ? '' : 'x'.repeat(20)].reduce((a, x) => a + String(x || '').length, 0) + Math.max(0, fr(c.horaires).length - 40) + Math.max(0, (p.prenom || '').length + (p.nom || '').length - 28) * 3;
    const nbRdv = long > 70 ? 2 : 3, dense = long > 150;
    return `<section class="page p1${dense ? ' dense' : ''}">
      <header class="couv">${R.logoHTML('lv-logo')}<div class="couv-etab">${e.etablissement ? `<b>${esc(e.etablissement)}</b>` : ''}${etabLignes(e).map(x => `<span>${esc(x)}</span>`).join('')}<span class="couv-hdj">${esc(e.hdj)}</span></div></header>
      <div class="couv-titre"><div class="titre">${bi(Lv.titre)}</div><div class="sous">${bi(Lv.sousTitre)}</div></div>
      <div class="nom-band"><div class="nom">${nomPatient(p)}${p.ipp ? ` <span class="ipp">${bi(Lv.dossierNo)} ${ltr(p.ipp)}</span>` : ''}</div>
        <div class="remis"><span>${bi(Lv.remisLe)} <b>${ltr(R.fmtDate(c.t))}</b></span><span>${bi(Lv.remisPar)} ${fill()}</span><span>${bi(Lv.carnetNo)} ${chk()}1 ${chk()}2 ${chk()}3</span></div></div>
      ${bandeauPause(c)}
      <div class="rdv-couv">${titreBloc(rdv.titreCourt)}<table class="lv-tab rdv"><colgroup><col style="width:26mm"><col style="width:16mm"><col><col style="width:10mm"></colgroup><thead><tr>${['date', 'heure', 'quoi', 'fait'].map(k => `<th>${bi(rdv.cols[k])}</th>`).join('')}</tr></thead><tbody>${rdvLigne.repeat(nbRdv)}</tbody></table></div>
      <div class="cols">
        <div class="col">
          ${titreBloc(moi.titre)}
          ${champ(moi.ddn, ddn, { ltr: true })}${champ(moi.sexe, sexeLib)}${champ(P1.ecole, '')}${champ(moi.poids, poidsTxt, { ltr: true })}${champ(moi.taille, p.taille ? `${nb(p.taille)} cm` : '', { ltr: true })}${vide(p.groupeSanguin) ? '' : champ(moi['groupe-sanguin'], p.groupeSanguin, { ltr: true })}${champ(moi.allergies, allergies)}
          ${titreBloc(par.titre)}
          ${champ(par.nom, '')}${champ(par.lien, '')}${champ(par.tel, R.telImprimable(p.tel), { ltr: true })}${champ(par.autreTel, '')}
          ${titreBloc(equ.titre)}
          ${champ(equ.medecin, medecin)}${e.chef ? champ(equ.chef, e.chef) : ''}${champ(equ['hdj-tel'], R.telImprimable(e.telHDJ), { ltr: true })}${champ(equ['hdj-horaires'], c.horaires)}
        </div>
        <div class="col">
          ${titreBloc(mal.titre)}
          ${champ(mal['maladie-nom'], c.maladie)}${champ(mal['date-diag'], dateDiag, { ltr: true })}
          ${titreBloc(trt.titre)}
          ${champ(trt['tt-nom'], c.dci ? c.dciBi : '')}${vide(p.specialite) ? '' : champ(trt['tt-boite'], p.specialite)}${champ(trt['tt-comment'], commentBi(c))}${champ(trt['tt-rythme'], rythmeBi(c) || '')}${champ(trt['tt-debut'], dtPasse(R.j0(p) || p.dateDebut), { ltr: true })}${c.voies.includes('IV') && premed ? champ(trt['tt-premed'], premed) : ''}${champ(trt['tt-autres'], vide(p.traitementsAssocies) ? '' : p.traitementsAssocies)}
          <div class="apporte"><b>${bi(P1.apporte)}</b> ${bi2(P1.apporteListe)}</div>
        </div>
      </div>
      <footer class="pied"><span class="maq">imprimé le ${R.fmtDate(c.t)} par Ryze</span><span class="num">${fr(Lv.page)} 1/${NB_PAGES}</span></footer>
    </section>`;
  }

  /* ---------- séances : lignes numérotées (rang de la séance dans le traitement en cours) ---------- */
  const PREREMPLIES = 3; /* séances déjà faites recopiées en tête : les 3 dernières du traitement en cours */
  const BLOC_MM = 11.95; /* une séance = 2 lignes (6,2 + 5,7 mm) + filets */
  const CAP_SUITE = 14; /* séances par page de suite (pages 3 et 4) */
  const TOP_P2 = 46; /* haut de la page 2 jusqu'au premier bloc (mm) */
  function lignesSeances(c) {
    const cyc = c.p.cycleCourant || 1;
    const faites = (c.p.cures || []).filter(x => x.statut === 'realisee' && (x.cycle || 1) === cyc).sort((a, b) => String(a.dateReelle || a.datePrevue).localeCompare(String(b.dateReelle || b.datePrevue))); /* cycle en cours seulement : l'en-tête des pages affiche le médicament actuel */
    const debut = Math.max(0, faites.length - PREREMPLIES);
    return { faites: faites.slice(debut).map((x, i) => ({ rang: debut + i + 1, x })), suivant: faites.length + 1 };
  }
  /* dose réellement donnée d'une séance faite : « 325 mg » */
  const doseDonnee = x => { if (x.dose != null && x.dose !== '' && !isNaN(+x.dose) && +x.dose > 0) return `${nb(+x.dose)} mg`; const t = String(x.doseTexte || ''); const m = /→\s*([\d.,]+)\s*mg/.exec(t) || /^\s*([\d.,]+)\s*mg\b/.exec(t); return m ? `${m[1].replace('.', ',')} mg` : ''; };
  /* tolérance d'une séance faite : « Bien tolérée », ou la réaction (nature seulement, sans le détail professionnel) */
  const toleranceHTML = x => { const t = String(x.tolerance || '').trim(); if (!t) return ''; const seg = t.split(/\s+—\s+/).find(s => R.estReaction(s));
    if (seg) { let h = seg.split(/\s+:\s+/)[0].trim(); if (!R.estReaction(h)) h = seg.trim(); h = h.charAt(0).toUpperCase() + h.slice(1); if (h.length > 140) h = h.slice(0, 140).replace(/\s+\S*$/, '') + '…'; return `<span class="pre reac">⚠ ${esc(h)}</span>`; }
    return /^(bonne|bien tol|ras\b)/i.test(t) ? pre(bi(L().p2.bienToleree)) : ''; };
  const trSeance = r => { const x = r.x, f = !!x, cls = f ? 'fait' : 'blanc'; const ide = f && x.ide && R.userName(x.ide) !== '—' ? R.userName(x.ide) : '';
    return `<tr class="sa ${cls}"><td class="n" rowspan="2">${r.rang}</td><td class="c d">${f ? pre(ltr(dt(x.datePrevue || x.dateReelle))) : ''}</td><td class="c d">${f ? pre(ltr(dt(x.dateReelle || x.datePrevue))) : ''}</td><td class="c">${f && +x.poids > 0 ? pre(esc(nb(x.poids))) : ''}</td><td class="c">${f ? pre(esc(doseDonnee(x))) : ''}</td><td class="c">${f && !vide(x.lot) ? `<span class="pre mono">${esc(x.lot)}</span>` : ''}</td><td class="sig" rowspan="2">${ide ? `<span class="pre sig-pre">${esc(ide)}</span>` : ''}</td></tr><tr class="sb ${cls}"><td class="rem" colspan="5">${f ? toleranceHTML(x) : ''}</td></tr>`; };
  function pageSeances(c, n, rows, o) {
    const Lv = L(), P2 = Lv.p2, col = P2.cols; const th = (k, a) => `<th${a || ''}>${bi(col[k])}</th>`;
    const haut = o.premiere ? `${bandeauPause(c)}${o.retro || ''}<div class="aide">${bi2(P2.aideDates, 'aide-d')}<div class="legende">${bi(P2.legende)}</div></div>` : '';
    return `<section class="page p2${o.premiere ? ' premiere' : ''}">${enTete(c, n, P2.enTete)}
      <div class="titre-page"><h2>${bi(o.premiere ? P2.titre : suite(P2.titre))}</h2>${o.premiere ? `<span class="sous">${bi(P2.sousTitre)}</span>` : ''}</div>
      ${haut}
      <table class="lv-tab seances"><colgroup><col style="width:7mm"><col style="width:20mm"><col style="width:20mm"><col style="width:14mm"><col style="width:22mm"><col style="width:23mm"><col></colgroup>
        <thead><tr>${th('n', ' rowspan="2"')}${th('datePrevue')}${th('dateFaite')}${th('poids')}${th('dose')}${th('lot')}${th('visa', ' rowspan="2"')}</tr><tr><th colspan="5" class="th-rem">${bi(col.tolerance)}</th></tr></thead>
        <tbody>${rows.map(trSeance).join('')}</tbody></table>
    </section>`;
  }

  /* ---------- traitements antérieurs (cycles saisis rétrospectivement et cycles précédents dans Ryze) ---------- */
  function blocRetro(c) {
    const T = L().p2.retro, p = c.p; if (!T) return { html: '', h: 0 }; const cyc = p.cycleCourant || 1;
    const hist = (p.historiqueProtocoles || []).filter(h => h && !h.retro).sort((a, b) => (a.cycle || 1) - (b.cycle || 1));
    const avant = hist.filter(h => (h.cycle || 1) < cyc).map(h => { const suiv = hist.find(x => (x.cycle || 1) > (h.cycle || 1)); return { protocoleId: h.protocoleId, specialite: h.specialite, dateDebut: h.dateDebut, dateFin: h.dateFin || (suiv && suiv.dateDebut) || '' }; });
    const L0 = [...R.retroCycles(p), ...avant].filter(h => h.protocoleId || h.dateDebut); if (!L0.length) return { html: '', h: 0 };
    /* carnet remis à la famille : médicament et période seulement (nombre de séances, motif d'arrêt et remarques restent dans le carnet de suivi des soignants) ; spécialité seulement si elle est renseignée */
    const rows = L0.slice(0, 5).map(h => { const pr = R.proto(h.protocoleId) || {}; return `<tr><td><b>${esc(String(pr.dci || h.protocoleId || '').split(' — ')[0])}</b>${vide(h.specialite) ? '' : ` <span class="pre">(${esc(h.specialite)})</span>`}</td><td class="c">${ltr(dt(h.dateDebut))}${h.dateFin ? ` → ${ltr(dtPasse(h.dateFin) || dt(h.dateFin))}` : ''}</td></tr>`; }).join('');
    return { html: `<h3 class="bt retro-t">${bi(T.titre)}</h3><table class="lv-tab retro"><thead><tr><th>${bi(T.medicament)}</th><th>${bi(T.periode)}</th></tr></thead><tbody>${rows}</tbody></table>`, h: 13.5 + Math.min(5, L0.length) * 5.8 };
  }

  /* ---------- examens : plan de surveillance du dossier, fréquence en clair ---------- */
  const EXAMENS_IDS = { biostd: 'biostd', nfs: 'nfs', crp: 'crp', calpro: 'calpro', tdm: 'tdm', actnf: 'actnf', lip: 'lip', colo: 'colo', endo: 'colo', fogd: 'fibro', recto: 'recto', irm: 'irm', echo: 'echo', rxt: 'rxt', igra: 'igra', derm: 'peau', fcu: 'frottis', vacc: 'vacc', bh: 'foie', creat: 'reins' };
  const libelleExamen = x => { const E = L().p3.examens || {}; if (x.id === 'vit' || x.libre) { if (x.id === 'vit' && /vitamine\s*D\b/i.test(x.nom || '')) return E.vit; const T = L().p3.priseDeSangNom; if (x.id === 'vit' && T) return { fr: fr(T).replace('{nom}', x.nom || ''), ar: ar(T).replace('{nom}', LRI + (x.nom || '') + PDI) }; return { fr: x.nom || '', ar: '' }; } const id = EXAMENS_IDS[x.id]; return (id && E[id]) || { fr: x.label || x.id || '', ar: '' }; };
  const frequenceBi = per => { const F = L().p3.frequences || {}; if (per === 'cure') return F.chaqueSeance || null; const d = R.periodeDecompose ? R.periodeDecompose(per) : null; if (!d) return null; if (d.u === 'mois') return d.n % 12 === 0 && F.ans ? plur(F.ans, d.n / 12) : F.mois ? plur(F.mois, d.n) : null; return plur(L().p1.rythmes.semaines, d.n); };
  function planExamens(c) {
    const out = []; let cfg = null; try { cfg = R.cfgDepuisPatient ? R.cfgDepuisPatient(c.p) : null; } catch (er) { cfg = null; }
    if (cfg && R.BILANS) {
      R.BILANS.forEach(g => (g.items || []).forEach(it => { const ci = cfg.items && cfg.items[it.id]; if (!ci || !ci.on || g.periode === 'cure' || it.type === 'clinique') return; if (it.type === 'composite' && Array.isArray(ci.sous) && !ci.sous.length) return; const per = R.periodeItem(cfg, g, it, ci);
        if (it.type === 'libre') { (ci.entries || []).filter(x => x && x.nom && String(x.nom).trim()).forEach(x => out.push({ id: it.id, nom: String(x.nom).trim(), per: +x.periode || per })); return; }
        out.push({ id: it.id, label: it.label, per }); }));
      Object.keys(cfg.libres || {}).forEach(gid => { const g = R.BILANS.find(x => x.id === gid); (cfg.libres[gid] || []).filter(x => x && x.nom && String(x.nom).trim()).forEach(x => out.push({ id: 'libre-' + gid, libre: true, nom: String(x.nom).trim(), per: +x.periode || (g && g.periode !== 'cure' ? +(cfg.groupes && cfg.groupes[gid]) || g.periode : 91) })); });
    } else { const vus = new Set(); (c.p.surveillance || []).filter(s => s.mode === 'echeance' && s.statut === 'prevue').forEach(s => { const k = s.id + '|' + (s.nom || ''); if (vus.has(k)) return; vus.add(k); out.push({ id: s.id, nom: s.nom, label: s.label, per: s.periode || null }); }); }
    return out.map(x => ({ id: x.id, lib: libelleExamen(x), freq: x.per ? frequenceBi(x.per) : null }));
  }
  /* hauteur estimée (mm) d'un texte bilingue empilé : fr sur nf caractères par ligne, ar sur na */
  const hBi = (v, nf, na, lf, la) => Math.ceil((fr(v).length || 1) / nf) * lf + (ar(v) ? Math.ceil(ar(v).length / na) * la : 0);
  function pageExamens(c, n) {
    const Lv = L(), P3 = Lv.p3, col = P3.cols; const plan = planExamens(c); const ids = new Set(plan.map(x => x.id));
    const conseils = (P3.conseils.items || []).slice(0, 3).filter(i => (/taux du médicament/.test(fr(i)) && ids.has('tdm')) || (/calprotectine/.test(fr(i)) && ids.has('calpro')) || (/Coloscopie/.test(fr(i)) && ids.has('colo')));
    const rapportez = (P3.conseils.items || []).find(i => /Rapportez tous/.test(fr(i)));
    /* lignes vides dans la hauteur restante (positions en mm depuis le haut de la page ; bas utile : 205 mm, encadré « Rapportez » : 10 mm) */
    const hPlan = x => 7.2 + Math.max(0, Math.ceil(fr(x.lib).length / 80) - 1) * 2.9 + Math.max(0, Math.ceil(ar(x.lib).length / 80) - 1) * 3.2;
    const hConseil = i => 1.2 + Math.ceil(fr(i).length / 126) * 2.85 + Math.ceil(ar(i).length / 140) * 3.2;
    const haut = 28 + (plan.length ? 12.8 + plan.reduce((a, x) => a + hPlan(x), 0) : 0) + (conseils.length ? 6.5 + conseils.reduce((a, i) => a + hConseil(i), 0) : 0) + 6.5 + 7.4;
    const nbLignes = Math.max(3, Math.min(18, Math.floor((205 - (rapportez ? 10.5 : 1) - haut) / 7.65)));
    const lignePlan = x => `<tr><td class="ex">${bi(x.lib)}</td><td class="fq">${x.freq ? bi(x.freq) : ''}</td></tr>`;
    return `<section class="page p3">${enTete(c, n, P3.titre)}
      <div class="titre-page"><h2>${bi(P3.titre)}</h2></div>${bi2(P3.intro, 'intro')}
      ${plan.length ? `${titreBloc(P3.plan.titre)}<table class="lv-tab plan"><colgroup><col><col style="width:40mm"></colgroup><thead><tr><th>${bi(col.examen)}</th><th>${bi(P3.plan.quand)}</th></tr></thead><tbody>${plan.map(lignePlan).join('')}</tbody></table>` : ''}
      ${conseils.length ? `<div class="conseils">${titreBloc(P3.conseils.titre)}${conseils.map(i => `<div class="li">${bi2(i)}</div>`).join('')}</div>` : ''}
      ${titreBloc(P3.dates)}<table class="lv-tab examens"><colgroup><col><col style="width:22mm"><col style="width:22mm"><col style="width:36mm"></colgroup><thead><tr><th>${bi(col.examen)}</th><th>${bi(col.quand)}</th><th>${bi(col.fait)}</th><th>${bi(col.vu)}</th></tr></thead><tbody>${`<tr class="blanc"><td></td><td></td><td></td><td>${chk()}</td></tr>`.repeat(nbLignes)}</tbody></table>
      ${rapportez ? `<div class="rapportez">${bi2(rapportez)}</div>` : ''}
    </section>`;
  }

  /* ---------- urgences (page 6) : rouge et orange, 9 pt au moins, numéros en gros ---------- */
  const listeItems = (arr, cls) => `<ul class="items${cls ? ' ' + cls : ''}">${arr.map(i => `<li>${bi(i)}</li>`).join('')}</ul>`;
  /* hauteur estimée (mm) d'un élément de liste à 9 pt : colonne française ≈ 40 caractères par ligne, arabe ≈ 44 */
  const hItem = i => 1.3 + Math.max(Math.ceil((fr(i).length || 1) / 47), ar(i) ? Math.ceil(ar(i).length / 44) : 0) * 3.85;
  const URG_BAS = 204.5, URG_FIXE = 65.5, HOR_MM = 5.2, P7_LIBRE = 27, SUITE_FIXE = 12; /* bas utile de la page 6, hauteur fixe (bandeau, titres, numéros, marges), ligne des horaires */
  function listesUrgence(c) {
    const P4 = L().p4;
    const rouge = c.items(P4.rouge.items).slice(0, 6);
    const orange = c.items(P4.orange.items).filter((i, k, a) => !a.some(j => fr(j).length > fr(i).length && fr(j).startsWith(fr(i)))); /* doublon retiré : « Je suis enceinte… » générique quand l'item méthotrexate le reprend */
    /* rouge (titre, 3 numéros, éléments) puis orange (titre, numéro de l'hôpital de jour) ; les éléments orange qui ne tiennent pas passent en tête de la page 7 (même double page) */
    const somme = arr => arr.reduce((a, i) => a + hItem(i), 0); const horaires = !!c.horaires && URG_FIXE + somme(rouge) + somme(orange) <= URG_BAS;
    let h = URG_FIXE - (c.horaires && !horaires ? HOR_MM : 0) + somme(rouge); const p6 = [], p7 = [];
    orange.forEach(i => { const hi = hItem(i); if (!p7.length && h + hi <= URG_BAS) { p6.push(i); h += hi; } else p7.push(i); });
    /* page 7 trop chargée par la suite de la liste orange : la consigne « Pendant la perfusion » passe en page 8 */
    const regleP8 = p7.length > 0 && SUITE_FIXE + somme(p7) > P7_LIBRE;
    return { rouge, orange: p6, orangeSuite: p7, horaires, regleP8 };
  }
  const ligneNum = (lab, val) => `<div class="num-l"><span class="lib">${bi(lab)}</span><span class="tel-g">${val}</span></div>`;
  function pageUrgences(c, n, U) {
    const P4 = L().p4, e = c.e;
    const nums = (P4.numerosUrgence || []).map(x => ligneNum(x, x.tel === '{urgences}' ? telUrg(e.telUrgences) : ltr(x.tel))).join('');
    return `<section class="page p4 urg-page">${enTete(c, n, P4.titre)}
      <div class="alerte rouge"><div class="al-t"><span class="ico oct">!</span>${bi2(P4.rouge.titre)}</div><div class="nums">${nums}</div>${listeItems(U.rouge)}</div>
      <div class="alerte orange"><div class="al-t"><span class="ico tri">!</span>${bi2(P4.orange.titre)}</div><div class="nums">${ligneNum(P4.hdj, tel(e.telHDJ))}<div class="num-sous">${U.horaires ? `<div>${bi(c.horaires)}</div>` : ''}<div>${bi(P4.sinonUrgences)}</div></div></div>${listeItems(U.orange)}</div>
    </section>`;
  }

  /* ---------- carte détachable : même taille et même hauteur sur les deux pages du feuillet ---------- */
  function carteRecto(c) {
    const P4 = L().p4, e = c.e, ci = P4.carte.recto.items || [], it = i => ci[i] || { fr: '', ar: '' };
    return `<div class="carte recto"><div class="ciseaux">✂</div><div class="carte-in"><div class="ct">${bi(P4.carte.recto.titre)}</div>
      <div class="f"><span class="lab">${bi(it(0))}</span><span class="val">${c.dci ? bi(c.dciBi) : fill()}${vide(c.p.specialite) ? '' : ' · ' + esc(c.p.specialite)}</span></div>
      <div class="ct-l grille">${bi(it(1))}</div><div class="ct-l grille">${bi(it(2))}</div><div class="ct-l grille">${bi(it(3))}</div>
      <div class="f ct-tel"><span class="lab">${bi(it(4))}</span><span class="val">${tel(e.telHDJ)}</span></div><div class="f ct-tel"><span class="lab">${bi(it(5))}</span><span class="val">${telUrg(e.telUrgences)}</span></div></div></div>`;
  }
  function carteVerso(c) {
    const Lv = L(), p = c.p, e = c.e, verso = (Lv.p4.carte.verso || {}).items || [], it = i => verso[i] || { fr: '', ar: '' };
    const medecin = R.userName(p.medecinId) === '—' ? '' : R.userName(p.medecinId);
    return `<div class="carte verso"><div class="carte-in"><div class="ct">${bi(Lv.p3.versoCarte)}</div>
      ${champ(it(0), `${p.prenom || ''} ${p.nom || ''}`.trim())}${champ(it(1), p.ipp, { ltr: true })}${champ(it(2), c.maladie)}${champ(it(3), dtPasse(R.j0(p) || p.dateDebut), { ltr: true })}${champ(it(4), medecin)}
      <div class="ct-etab">${esc([e.hopital, e.service].filter(Boolean).join(' · ') || e.etablissement)}</div>
      <div class="ct-note">${bi2(it(5))}</div></div></div>`;
  }

  /* ---------- page 7 : à ne jamais faire, avant chaque séance, verso de la carte ---------- */
  function pageConseils(c, n, U) {
    const Lv = L(), P4 = Lv.p4;
    const jamais = c.items(P4.jamais.items).slice(0, 5);
    const avant = c.items(P4.avant.items); const cases = avant.filter(i => /^☐/.test(fr(i))), regles = avant.filter(i => !/^☐/.test(fr(i)) && !(U.regleP8 && /^Pendant la perfusion/.test(fr(i))));
    return `<section class="page p4 urg-page conseils-page">${enTete(c, n, suite(P4.titre), { sansNom: true })}
      ${U.orangeSuite.length ? `<div class="alerte orange"><div class="al-t"><span class="ico tri">!</span>${bi2(suite(P4.orange.titre))}</div>${listeItems(U.orangeSuite)}</div>` : ''}
      <div class="jamais">${`<h3 class="bt"><span class="ico non"></span>${bi(P4.jamais.titre)}</h3>`}${listeItems(jamais)}</div>
      <div class="avant"><h3 class="bt">${bi(P4.avant.titreCourt)}</h3><ul class="items cases">${cases.map(i => `<li class="case">${chk()}${bi({ fr: fr(i).replace(/^☐\s*/, ''), ar: ar(i) })}</li>`).join('')}</ul>${regles.map(i => `<div class="regle grille">${bi(i)}</div>`).join('')}</div>
      <div class="bas-carte droite">${carteVerso(c)}</div>
    </section>`;
  }

  /* ---------- informations pratiques des séances (page 8, sous les numéros) ---------- */
  function infosPratiques(c, pageAvant) {
    const P2 = L().p2, duree = dureeBi(c), iv = c.voies.includes('IV');
    /* « grossesse ? » seulement pour les filles de 10 ans et plus (ou d'âge inconnu) ; renvoi à la page des questions « avant chaque séance » */
    const sansG = !(c.sexe === 'F' && (c.ageN == null || c.ageN >= 10));
    let avFr = fr(P2.avantDeVenir.texte).replace(/page 4\b/, 'page ' + pageAvant), avAr = ar(P2.avantDeVenir.texte).replace(/4(?=\))/, LRI + pageAvant + PDI);
    if (sansG) { avFr = avFr.replace(/ grossesse \?/, ''); avAr = avAr.replace(/حمل؟ /, ''); }
    const info = (lab, txt) => `<div class="f2"><b>${bi(lab)}</b>${bi2(txt)}</div>`;
    const infos = [iv && duree ? info(P2.dureeSurPlace, duree) : '', iv ? info(P2.retard.label, P2.retard.texte) : '', info(P2.avantDeVenir.label, { fr: avFr, ar: avAr })].join('');
    return `<div class="infos2"><div class="callout-hdj"><b>${bi(P2.report.titre)}</b>${bi2(P2.report.texte)}</div><div class="infos-seance">${infos}</div></div>`;
  }

  /* ---------- page 8 : numéros utiles, informations pratiques, avis, recto de la carte ---------- */
  function pageContacts(c, n, U) {
    const Lv = L(), P4 = Lv.p4, p = c.p, e = c.e, equ = Lv.p1.equipe;
    const medecin = R.userName(p.medecinId) === '—' ? '' : R.userName(p.medecinId);
    const ligne = (lab, val, cls) => `<div class="ct-ligne${cls ? ' ' + cls : ''}"><span class="lab">${bi(lab)}</span><span class="val">${val}</span></div>`;
    const urg = (P4.numerosUrgence || []).map(x => ligne(x, x.tel === '{urgences}' ? telUrg(e.telUrgences) : ltr(x.tel), 'gros')).join('');
    return `<section class="page p4 contacts-page">${enTete(c, n, P4.numeros.titre)}
      <h2 class="titre-contacts">${bi(P4.numeros.titre)}</h2>
      <div class="contacts">${ligne(P4.hdj, tel(e.telHDJ), 'gros')}${c.horaires ? `<div class="ct-hor">${bi(c.horaires)}</div>` : ''}${urg}
        ${ligne(equ.medecin, medecin ? esc(medecin) : fill())}${e.chef ? ligne(equ.chef, esc(e.chef)) : ''}
        ${(P4.numeros.items || []).filter(i => (i.p || 1) <= 1).map(i => ligne(i, fill(), 'libre')).join('')}</div>
      ${infosPratiques(c, 7)}
      ${U.regleP8 ? c.items(P4.avant.items).filter(i => /^Pendant la perfusion/.test(fr(i))).map(i => `<div class="regle grille">${bi(i)}</div>`).join('') : ''}<div class="avis">${bi2(P4.pied.avis)}</div>
      <div class="bas-carte gauche">${carteRecto(c)}<div class="bas-etab">${R.logoHTML('lv-logo-p')}<div>${e.etablissement ? `<b>${esc(e.etablissement)}</b>` : ''}${etabLignes(e).map(x => `<span>${esc(x)}</span>`).join('')}<span>${esc(e.hdj)}</span></div><div class="maq">imprimé le ${R.fmtDate(c.t)} par Ryze</div></div></div>
    </section>`;
  }

  /* ---------- assemblage : 8 pages fixes (2 feuilles A4 pliées), aucune page de remplissage ---------- */
  const NOMS = ['couverture et informations', 'mes séances', 'mes séances', 'mes séances', 'mes examens', 'urgences', 'conseils et verso de la carte', 'numéros utiles et recto de la carte'];
  R.carnetPatientPages = function (p) {
    const c = contexte(p); const retro = blocRetro(c); const sea = lignesSeances(c); const U = listesUrgence(c);
    /* page 2 : bandeau, titre, consigne et en-tête du tableau (≈ 46 mm depuis le haut de la page), bandeau de pause, traitements antérieurs ; pages 3 et 4 : 14 séances */
    const cap1 = Math.max(4, Math.floor((205 - TOP_P2 - (c.susp ? 12 : 0) - retro.h) / BLOC_MM)); const caps = [cap1, CAP_SUITE, CAP_SUITE];
    const tous = sea.faites.slice(); let r = sea.suivant; while (tous.length < caps[0] + caps[1] + caps[2]) tous.push({ rang: r++, x: null });
    const parPage = [tous.slice(0, caps[0]), tous.slice(caps[0], caps[0] + caps[1]), tous.slice(caps[0] + caps[1])];
    return [page1(c), pageSeances(c, 2, parPage[0], { premiere: true, retro: retro.html }), pageSeances(c, 3, parPage[1], {}), pageSeances(c, 4, parPage[2], {}), pageExamens(c, 5), pageUrgences(c, 6, U), pageConseils(c, 7, U), pageContacts(c, 8, U)];
  };
  /* document complet : vue A5 (pages, double pages intérieures) ou feuilles A4 recto-verso (imposition) */
  R.carnetPatientHTML = function (p, o) {
    o = o || {}; const pages = R.carnetPatientPages(p); const N = pages.length; const a4 = !!o.a4;
    let corps;
    if (a4) {
      const feuilles = []; for (let k = 0; k < N / 4; k++) { const r1 = N - 2 * k, r2 = 2 * k + 1, v1 = 2 * k + 2, v2 = N - 2 * k - 1; feuilles.push(`<div class="lab-page">Feuille ${k + 1} — recto (page ${r1} · page ${r2})</div><div class="sheet">${pages[r1 - 1]}${pages[r2 - 1]}</div><div class="lab-page">Feuille ${k + 1} — verso (page ${v1} · page ${v2})</div><div class="sheet">${pages[v1 - 1]}${pages[v2 - 1]}</div>`); }
      corps = `<div class="imposition">${feuilles.join('')}</div>`;
    } else {
      const lib = (i, j) => NOMS[i] === NOMS[j] ? NOMS[i] : `${NOMS[i]} · ${NOMS[j]}`;
      const blocs = [`<div class="lab-page">Page 1 — ${NOMS[0]}</div><div class="solo">${pages[0]}</div>`];
      for (let i = 1; i < N - 1; i += 2) blocs.push(`<div class="lab-page">Pages ${i + 1} et ${i + 2} — ${lib(i, i + 1)}</div><div class="spread">${pages[i]}${pages[i + 1]}</div>`);
      blocs.push(`<div class="lab-page">Page ${N} — ${NOMS[N - 1]}</div><div class="solo">${pages[N - 1]}</div>`);
      corps = `<div class="pages">${blocs.join('')}</div>`;
    }
    return `<div class="carnet-wrap livret${a4 ? ' a4' : ''}" data-pages="${N}"><style>${R.carnetPatientCSS(a4)}</style>${corps}</div>`;
  };

  /* ---------- feuille de style du carnet (préfixe .livret ; @page du format choisi) ---------- */
  R.carnetPatientCSS = a4 => `
.livret{--lv-ink:#182421;--lv-ink2:#4E5E59;--lv-ar:#1F3B57;--lv-acc:#1C6B62;--lv-acc-t:#E2F0ED;--lv-line:#B9C6C2;--lv-soft:#EEF3F1;--lv-rouge:#B3261E;--lv-rouge-t:#FBE9E7;--lv-orange:#C76E00;--lv-orange-t:#FFF1DF;--lv-gris:#5F6E69;color-scheme:light}
.livret *{box-sizing:border-box}
.livret .page{width:148mm;height:210mm;padding:5.5mm 7mm 5mm;background:#fff;color:var(--lv-ink);font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:7.2pt;line-height:1.3;position:relative;overflow:hidden;display:flex;flex-direction:column;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.livret table{color:inherit}
.livret .ar{font-family:'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif;color:var(--lv-ar);font-size:1.12em;unicode-bidi:isolate}
.livret .bi .sep{color:var(--lv-gris);margin:0 .35em;font-weight:400}
.livret .bi2 .fr{display:block}
.livret .bi2 .ar{display:block;text-align:right;margin-top:.15mm}
.livret bdi{unicode-bidi:isolate}
.livret bdi.nw,.livret .a-remplir{white-space:nowrap}
.livret .a-remplir{letter-spacing:.04em;color:var(--lv-ink2);font-weight:400;font-size:9pt}
.livret b,.livret strong{font-weight:600}
.livret .page h2{font-size:11pt;font-weight:600;margin:0;line-height:1.2;text-wrap:initial}
.livret .page h2 .ar{font-size:1.05em}
.livret .bt{font-size:7.6pt;font-weight:600;margin:1.4mm 0 .6mm;padding:0 0 .3mm;border-bottom:.35pt solid var(--lv-acc);color:var(--lv-acc);text-transform:none;display:flex;align-items:center;gap:1mm;text-wrap:initial}
.livret .f{display:flex;flex-wrap:wrap;gap:0 1.5mm;padding:.45mm 0;border-bottom:.25pt dotted var(--lv-line);align-items:baseline;min-height:3.6mm}
.livret .f .lab{flex:0 1 auto;color:var(--lv-ink2)}
.livret .f .val{flex:1 1 18mm;font-weight:500}
.livret .fill{display:inline-block;min-width:14mm;border-bottom:.3pt solid var(--lv-ink2);height:1em;vertical-align:baseline;flex:1}
.livret .chk{display:inline-block;width:3.6mm;height:3.6mm;border:.45pt solid var(--lv-ink);border-radius:.5mm;vertical-align:-0.8mm;margin-right:.6mm;background:#fff}
.livret .pre{color:var(--lv-gris);font-style:italic}
.livret .pre.reac{color:var(--lv-rouge);font-style:normal;font-weight:600}
.livret .mono{font-family:'IBM Plex Mono',monospace;font-style:normal;font-size:.95em}
.livret .num{color:var(--lv-gris);white-space:nowrap}
.livret .pied{margin-top:auto;padding-top:.7mm;border-top:.35pt solid var(--lv-line);display:flex;justify-content:flex-end;gap:3mm;font-size:6.2pt;color:var(--lv-ink2);line-height:1.25}
.livret .maq{color:var(--lv-gris);font-size:6pt}
.livret .run{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;font-size:6.6pt;color:var(--lv-ink2);border-bottom:.35pt solid var(--lv-line);padding-bottom:.5mm;margin-bottom:1.2mm}
.livret .run .run-id{color:var(--lv-ink)}
.livret .run .run-t{flex:1;text-align:center}
/* couverture */
.livret .couv{display:flex;align-items:center;gap:3.5mm;padding-bottom:1.6mm;border-bottom:.5pt solid var(--lv-acc)}
.livret .lv-logo{height:15mm;width:auto;max-width:40mm;object-fit:contain;flex:none}
.livret .couv-etab{display:flex;flex-direction:column;font-size:6.8pt;line-height:1.3;color:var(--lv-ink2)}
.livret .couv-etab b{font-size:7.6pt;color:var(--lv-ink)}
.livret .couv-hdj{color:var(--lv-acc);font-weight:600}
.livret .couv-titre{margin-top:1.8mm}
.livret .couv-titre .titre{font-size:14pt;font-weight:700;line-height:1.15;color:var(--lv-acc)}
.livret .couv-titre .titre .ar{font-size:.95em}
.livret .couv-titre .sous{font-size:7.4pt;margin-top:.4mm;font-weight:500}
.livret .nom-band{margin:1.6mm 0 .4mm;padding:1.2mm 2mm;background:var(--lv-acc-t);border:.4pt solid var(--lv-acc);border-radius:1mm;display:flex;flex-direction:column;gap:.6mm}
.livret .nom-band .nom{font-size:11.5pt;font-weight:500}
.livret .nom-band .nom .ipp{font-size:7.2pt;color:var(--lv-ink2);margin-left:2mm;font-weight:400}
.livret .nom-band .remis{font-size:6.8pt;color:var(--lv-ink2);display:flex;flex-wrap:wrap;gap:.6mm 3mm;align-items:baseline}
.livret .nom-band .remis > span{white-space:nowrap}
.livret .nom-band .remis .fill{min-width:16mm;flex:0 0 auto}
.livret .p1.dense .f{padding:.25mm 0;min-height:3.2mm}.livret .p1.dense .bt{margin:1mm 0 .4mm}.livret .p1.dense .apporte{margin-top:1mm;padding:.8mm 1.4mm}
.livret .pause{margin:1.2mm 0 .4mm;padding:1mm 2mm;border:.8pt solid var(--lv-orange);border-left:2mm solid var(--lv-orange);border-radius:.8mm;background:var(--lv-orange-t);font-weight:600;font-size:8pt;line-height:1.25}
.livret .rdv-couv .bt{margin-top:1.4mm}
.livret .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 4mm;align-items:start}
.livret .cols .col > .bt:first-child{margin-top:1.4mm}
.livret .apporte{margin-top:1.6mm;padding:1.2mm 1.6mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);border-radius:.8mm;font-size:6.8pt;line-height:1.35}
/* tableaux */
.livret .lv-tab{width:100%;border-collapse:collapse;table-layout:fixed}
.livret .lv-tab th{font-size:6.3pt;font-weight:600;text-align:left;padding:.7mm .8mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);vertical-align:bottom;line-height:1.2;text-transform:none;letter-spacing:0;color:var(--lv-ink);white-space:normal}
.livret .lv-tab th .ar{display:block;font-size:1.05em}
.livret .lv-tab th .sep{display:none}
.livret .lv-tab th.th-rem .bi .ar,.livret .lv-tab th.th-rem .bi .fr{display:inline}
.livret .lv-tab th.th-rem .sep{display:inline}
.livret .lv-tab td{border:.3pt solid var(--lv-line);padding:.4mm .8mm;vertical-align:middle;font-size:6.8pt;line-height:1.2;overflow-wrap:break-word}
.livret .lv-tab td.c{text-align:center}
.livret .lv-tab td.d{white-space:nowrap;padding-left:.4mm;padding-right:.4mm}
.livret .rdv td{height:6.4mm}
.livret .seances tr.sa td{height:6.2mm;border-top:.9pt solid var(--lv-ink2)}
.livret .seances tr.sb td{height:5.7mm;border-top:.25pt dotted var(--lv-line)}
.livret .seances td.n{font-weight:600;text-align:center;font-size:7.6pt;border-top:.9pt solid var(--lv-ink2)}
.livret .seances td.sig{border-top:.9pt solid var(--lv-ink2);vertical-align:top}
.livret .seances td.rem{font-size:6.6pt;line-height:1.15;vertical-align:top;padding-top:.5mm}
.livret .seances tr.fait td{background:#FAFBFA}
.livret .sig-pre{font-size:6.2pt}
.livret .retro-t{margin-top:1mm}
.livret .retro td{height:5.4mm;font-size:6.6pt}
.livret .retro th:nth-child(2),.livret .retro td:nth-child(2){width:46mm}
.livret .retro{margin-bottom:.6mm}
/* page 2 : informations pratiques */
.livret .titre-page{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;margin-bottom:1mm}
.livret .titre-page .sous{font-size:6.8pt;color:var(--lv-ink2);text-align:right;max-width:72mm}
.livret .infos2{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin:1.6mm 0 .4mm;align-items:start}
.livret .callout-hdj{padding:1.2mm 1.8mm;background:var(--lv-acc-t);border:.3pt solid var(--lv-acc);border-left:1.2mm solid var(--lv-acc);border-radius:.8mm;font-size:6.8pt;line-height:1.25}
.livret .callout-hdj .tel{margin-top:.6mm}
.livret .callout-hdj .tel b{font-size:8.4pt}
.livret .callout-hdj .hor{font-size:6.4pt;color:var(--lv-ink2)}
.livret .infos-seance .f2{font-size:6.6pt;line-height:1.22;padding:.3mm 0 .5mm;border-bottom:.25pt dotted var(--lv-line)}
.livret .infos-seance .f2 > b{display:block}
.livret .aide{margin:1mm 0 1mm;font-size:6.6pt;display:grid;grid-template-columns:1fr auto;gap:0 3mm;align-items:end}
.livret .legende{color:var(--lv-ink2);font-size:6.4pt;white-space:nowrap}
.livret .legende .bi .ar{display:block;text-align:right}.livret .legende .sep{display:none}
.livret .aide-d{font-size:6.5pt;line-height:1.2}
/* page 5 : examens */
.livret .intro{font-size:6.8pt;color:var(--lv-ink2);line-height:1.22;margin-bottom:.6mm}
.livret .plan td{height:6.4mm;font-size:6.9pt}
.livret .plan td.ex .sep,.livret .plan td.fq .sep{display:none}
.livret .plan td.ex .ar,.livret .plan td.fq .ar{display:block}
.livret .plan td.fq{font-weight:600}
.livret .examens td{height:7.6mm}
.livret .examens td:last-child{text-align:left}
.livret .conseils .li{font-size:6.6pt;padding:.4mm 0;border-bottom:.25pt dotted var(--lv-line);line-height:1.2}
.livret .rapportez{margin-top:auto;padding:1mm 1.6mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);border-radius:.8mm;font-size:6.8pt;line-height:1.22}
/* pages 6 et 7 : urgences et conseils (9 pt au moins) */
.livret .alerte{border:.6pt solid;border-radius:1mm;padding:.8mm 1.8mm .6mm;margin-bottom:1.2mm}
.livret .alerte.rouge{border-color:var(--lv-rouge);background:var(--lv-rouge-t);border-left-width:2mm}
.livret .alerte.orange{border-color:var(--lv-orange);background:var(--lv-orange-t);border-left-width:2mm}
.livret .al-t{font-weight:700;font-size:10pt;display:flex;align-items:center;gap:1.8mm;line-height:1.15}
.livret .al-t .bi2{flex:1}
.livret .al-t .bi2 .ar{font-size:1.04em}
.livret .rouge .al-t{color:var(--lv-rouge)}.livret .orange .al-t{color:var(--lv-orange)}
.livret .ico{display:inline-flex;width:5mm;height:5mm;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:8.5pt;flex:0 0 auto}
.livret .ico.oct{background:var(--lv-rouge);clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)}
.livret .ico.tri{background:var(--lv-orange);clip-path:polygon(50% 0,100% 100%,0 100%);padding-top:1.4mm}
.livret .ico.non{width:3.8mm;height:3.8mm;border:.7pt solid var(--lv-ink);border-radius:50%;position:relative}
.livret .ico.non::after{content:"";position:absolute;left:-.3mm;top:45%;width:4mm;height:.7pt;background:var(--lv-ink);transform:rotate(-45deg)}
.livret .nums{margin:.8mm 0 .7mm;padding:.2mm 1.4mm;background:#fff;border:.6pt solid var(--lv-rouge);border-radius:.8mm}
.livret .orange .nums{border-color:var(--lv-orange)}
.livret .num-l{display:flex;align-items:center;justify-content:space-between;gap:3mm;padding:.35mm 0;border-bottom:.25pt dotted var(--lv-line);font-size:9pt;line-height:1.15}
.livret .num-l:last-child{border-bottom:0}
.livret .num-l .lib{font-weight:600}
.livret .tel-g{font-size:13pt;font-weight:700;line-height:1.1;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--lv-ink);flex:none}
.livret .num-sous{font-size:9pt;padding:.2mm 0 .4mm;color:var(--lv-ink2)}
.livret .items{margin:0;padding:0;list-style:none}
.livret .items li{padding:.45mm 0 .45mm 2.8mm;position:relative;border-bottom:.25pt dotted rgba(0,0,0,.18);font-size:9pt;line-height:1.16;break-inside:avoid}
.livret .items li:last-child{border-bottom:0}
.livret .items li .bi{display:grid;grid-template-columns:1.25fr 1fr;gap:0 3mm}
.livret .items li .bi .sep{display:none}
.livret .items li .bi .ar{text-align:right;font-size:1.06em}
.livret .items li::before{content:"•";position:absolute;left:.5mm;color:var(--lv-ink2)}
.livret .urg-page .bt{font-size:10pt;margin:1.6mm 0 .8mm;border-bottom-width:.5pt}
.livret .jamais .bt{color:var(--lv-ink);border-color:var(--lv-ink)}
.livret .cases li.case{padding-left:6mm;padding-top:.6mm;padding-bottom:.6mm}
.livret .cases li.case::before{content:none}
.livret .cases li.case .chk{position:absolute;left:.3mm;top:1mm;width:4mm;height:4mm}
.livret .regle{font-size:9pt;margin-top:.8mm;padding:.8mm 1.6mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);border-radius:.6mm;line-height:1.2}
.livret .grille .bi,.livret .grille.bi{display:grid;grid-template-columns:1.15fr 1fr;gap:0 3mm}
.livret .grille .bi .sep,.livret .grille.bi .sep{display:none}
.livret .grille .bi .ar,.livret .grille.bi .ar{text-align:right}
/* page 8 : numéros utiles */
.livret .titre-contacts{margin:.6mm 0 1.4mm!important;color:var(--lv-acc)}
.livret .contacts{display:flex;flex-direction:column}
.livret .ct-ligne{display:flex;align-items:baseline;gap:2mm;padding:.9mm 0;border-bottom:.3pt dotted var(--lv-line);font-size:9pt}
.livret .ct-ligne .lab{flex:1 1 auto;color:var(--lv-ink2)}
.livret .ct-ligne .val{flex:0 0 auto;font-weight:600;text-align:right}
.livret .ct-ligne.gros .val{font-size:13pt;font-weight:700}
.livret .ct-ligne.gros .lab{color:var(--lv-ink);font-weight:600}
.livret .ct-ligne.libre .val{flex:0 0 52mm}
.livret .ct-ligne .val .fill{width:100%;min-width:40mm}
.livret .ct-hor{font-size:8pt;color:var(--lv-ink2);text-align:right;margin:-.4mm 0 .4mm}
.livret .avis{margin-top:2mm;padding:1.2mm 1.8mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);border-radius:.8mm;font-size:8pt;line-height:1.25}
/* carte détachable : 85 × 54 mm, posée en bas de page à la même hauteur au recto (page 8, à gauche) et au verso (page 7, à droite) */
.livret .bas-carte{margin-top:auto;height:54mm;flex:none;display:flex;gap:4mm;align-items:stretch}
.livret .bas-carte.droite{justify-content:flex-end}
.livret .carte{width:85mm;height:54mm;flex:none;border:.6pt dashed var(--lv-gris);border-radius:2.5mm;position:relative;padding:2.2mm 2.6mm;background:#fff;font-size:7pt;line-height:1.2;overflow:hidden}
.livret .carte.recto{border-color:var(--lv-acc);background:var(--lv-acc-t)}
.livret .carte .ct{font-weight:700;color:var(--lv-acc);font-size:8.4pt;margin-bottom:.6mm;border-bottom:.4pt solid var(--lv-acc);padding-bottom:.4mm}
.livret .carte.verso .ct{color:var(--lv-ink2);border-color:var(--lv-line);font-size:7.6pt}
.livret .carte .f{padding:.35mm 0;min-height:3.4mm;font-size:7pt}
.livret .carte .ct-l{margin:.3mm 0;font-size:6.9pt;line-height:1.16}
.livret .carte .ct-tel .val{font-size:8.4pt;font-weight:700}
.livret .carte .ct-etab{font-size:6.4pt;color:var(--lv-ink2);margin-top:.6mm}
.livret .carte .ct-note{margin-top:.5mm;color:var(--lv-ink2);font-size:6.4pt;line-height:1.15}
.livret .ciseaux{position:absolute;top:.4mm;right:2mm;color:var(--lv-gris);font-size:8pt;line-height:1}
.livret .bas-etab{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1mm;font-size:6.4pt;line-height:1.3;color:var(--lv-ink2)}
.livret .bas-etab > div{display:flex;flex-direction:column}
.livret .bas-etab b{color:var(--lv-ink);font-size:6.6pt}
.livret .lv-logo-p{height:9mm;width:auto;max-width:30mm;object-fit:contain;align-self:flex-start}
.livret .bas-etab .maq{font-size:6pt}
/* police web absente (poste hors ligne) : la police de remplacement est plus large, corps réduit pour que chaque page tienne (9 pt gardés sur les pages d'urgence) */
.livret.sans-police .page{font-size:6.4pt}
.livret.sans-police .items li,.livret.sans-police .regle,.livret.sans-police .num-l,.livret.sans-police .num-sous,.livret.sans-police .ct-ligne{font-size:8.6pt;line-height:1.1}
.livret.sans-police .lv-tab th{font-size:5.8pt}.livret.sans-police .lv-tab td{font-size:6.2pt}
/* présentation à l'écran et impression */
.livret .pages{padding:18px 8px 40px;display:flex;flex-direction:column;gap:14px;align-items:center}
.livret .spread{display:flex;gap:0;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.livret .spread .page{margin:0}
.livret .spread .page + .page{border-left:.4pt dashed #B9C6C2}
.livret .solo{box-shadow:0 8px 24px rgba(0,0,0,.18)}
.livret .lab-page{font-size:12px;color:var(--muted,#4E5E59);font-family:'IBM Plex Sans',system-ui,sans-serif;align-self:center}
.livret .imposition{display:flex;flex-direction:column;gap:14px;align-items:center;padding:18px 8px 40px;overflow-x:auto;max-width:100%}
.livret .sheet{display:flex;width:297mm;height:210mm;flex:none;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.livret .sheet .page{margin:0}
.livret .sheet .page + .page{border-left:.4pt dashed #B9C6C2}
@media print{
  .livret{background:#fff!important;padding:0!important}
  .livret .lab-page{display:none!important}
  .livret .pages,.livret .imposition{padding:0;gap:0;display:block;overflow:visible}
  .livret .spread,.livret .solo{display:contents;box-shadow:none}
  .livret .page{page-break-after:always;break-after:page;margin:0;box-shadow:none}
  .livret .spread .page + .page{border-left:0}
  .livret .solo:last-child .page,.livret .page:last-child{page-break-after:auto;break-after:auto}
  .livret .sheet{box-shadow:none;page-break-after:always;break-after:page;margin:0}
  .livret .sheet:last-child{page-break-after:auto;break-after:auto}
  .livret .sheet .page{page-break-after:auto;break-after:auto}
  @page{size:${a4 ? '297mm 210mm' : '148mm 210mm'};margin:0;@bottom-center{content:none}}
}`;

  /* ---------- route ---------- */
  R.pages.carnetPatient = {
    render(params) {
      const p = R.patient(params.id); if (!p) return '<div class="empty">Dossier introuvable.</div>';
      if (!R.can('carnet', 'r')) return '<div class="empty">Carnet réservé aux accès autorisés.</div>';
      if (!R.LIVRET) return '<div class="empty">Contenu du carnet patient indisponible (livret-data.js).</div>';
      const a4 = !!R.ui.carnetA4; const doc = R.carnetPatientHTML(p, { a4 }); const N = +(doc.match(/data-pages="(\d+)"/) || [])[1] || 0; setTimeout(R.carnetPatientPolices, 0);
      return `<div class="row between no-print mb16" style="flex-wrap:wrap;gap:8px"><button class="btn" data-go="patient" data-params='${R.params({ id: p.id })}'>${R.icon('back')}Retour au dossier</button>
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="small muted">Carnet patient (français / arabe) · ${N} pages A5 · ${R.pluriel(N / 4, 'feuille A4', 'feuilles A4')}</span><div class="btn-group"><button type="button" class="btn sm${a4 ? '' : ' on'}" data-action="carnetVue" data-v="a5">Vue A5</button><button type="button" class="btn sm${a4 ? ' on' : ''}" data-action="carnetVue" data-v="a4">Vue A4 recto-verso</button></div>${R.boutonsDoc()}</div></div>
        <p class="small muted no-print" style="margin:-8px 0 12px">Carnet remis une seule fois : les dates à venir et les doses sont laissées en blanc, l’équipe les note à chaque séance. ${a4 ? 'Feuilles A4 paysage à imprimer recto-verso (retournement sur le bord court) puis à plier en deux : la carte détachable a son verso au dos, à la même place.' : 'Pages A5 à imprimer recto-verso (retournement sur le bord long) ; la vue A4 donne l’imposition pour deux feuilles pliées en deux.'}</p>${doc}`;
    }
  };
  R.actions.carnetVue = el => { R.ui.carnetA4 = el.dataset.v === 'a4'; R.render(); };
  /* sans la police web (poste sans accès à Internet), la police de remplacement est plus large : corps réduit pour que chaque page tienne */
  R.carnetPatientPolices = () => {
    const chargee = () => { try { return [...document.fonts].some(f => f.family === 'IBM Plex Sans' && f.status === 'loaded'); } catch (e) { return true; } };
    const appliquer = () => { const el = document.querySelector('.carnet-wrap.livret'); if (el) el.classList.toggle('sans-police', !chargee()); };
    appliquer();
    if (document.fonts) { if (!R.ui.carnetPolicesEcoute) { R.ui.carnetPolicesEcoute = true; document.fonts.addEventListener('loadingdone', appliquer); } document.fonts.ready.then(() => setTimeout(appliquer, 50)); }
  };
})(window.RYZE);
