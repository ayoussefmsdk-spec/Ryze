/* =====================================================================
   Ryze — carnet.js : carnet patient bilingue (français / arabe) remis
   UNE SEULE FOIS aux familles (il n'est pas réimprimé, il doit durer des
   années). 8 pages A5 FIXES (148 × 210 mm), soit 2 feuilles A4 pliées en
   deux — structure imposée par le médecin (décision D1) :
     1 couverture et informations (logo et identité de l'établissement,
       titre seul, identité, « Moi », parents, maladie, traitement sans
       dose, médecin en charge, « J'apporte ») ; 2 et 3 « Mes séances » : planning pur de
       20 lignes numérotées par page (1 à 40), séances déjà faites
       pré-remplies, aucune date ni dose à venir ; 4 et 5 « Mes examens » :
       plan de surveillance avec sa fréquence en tête de la page 4, puis
       planning pur (examens déjà faits pré-remplis) ; 6 « Mes rendez-vous
       à venir » : 20 lignes vides ; 7 « Avant chaque séance » : consignes
       pédiatriques (cases à cocher, « à ne jamais faire », séance manquée)
       et verso de la carte ; 8 « En cas d'urgence » : signes rouges et
       orange, numéros en gros, médecin, recto de la carte, pied de page.
     Aucun horaire, aucune équipe (le médecin en charge seulement), aucun
     texte sous les plannings ; « informez l'hôpital de jour » partout.
     Lignes de planning à 8,5 pt au moins ; page 8 entièrement à 9 pt au
     moins (bandeau, pied et recto de la carte compris ; la consigne
     « pas de vaccin vivant » de la carte est au verso, page 7).
     Pages 4 et 5 : R.carnetPatientAjuster ajoute les lignes vides qui
     tiennent encore (l'estimation des hauteurs est prudente).
     Carte détachable : recto en page 8, verso en page 7, à la même place
     (même feuillet).
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
  const LRI = '⁦', PDI = '⁩'; /* isolats LTR dans une phrase arabe (chiffres, heures) */
  /* espaces insécables : chiffres groupés (téléphones, « 24 h/24 », « 38 °C ») jamais coupés en fin de ligne */
  const insec = s => String(s).replace(/(\d) (?=\d)/g, '$1 ').replace(/(\d) (?=°|h\/|kg\b|mg\b)/g, '$1 ');
  /* remplit les {clés} d'un texte déjà échappé : valeur neutre isolée en LTR côté arabe, paire {fr, ar} selon la langue */
  const remplir = (s, vals, lang) => String(s).replace(/\{([a-zA-Z.]+)\}/g, (m, k) => { const v = vals && vals[k]; if (v == null) return m; if (typeof v === 'object') return esc(lang === 'ar' ? v.ar : v.fr); return lang === 'ar' ? ltr(v) : esc(v); });
  /* libellé bilingue sur une ligne : FR / AR */
  const bi = (v, cls, vals) => v ? `<span class="bi${cls ? ' ' + cls : ''}"><span class="fr">${insec(remplir(esc(fr(v)), vals, 'fr'))}</span>${ar(v) ? `<span class="sep">/</span><span class="ar" lang="ar" dir="rtl">${insec(remplir(esc(ar(v)), vals, 'ar'))}</span>` : ''}</span>` : '';
  /* phrase longue : ligne française puis ligne arabe (alignée à droite) */
  const bi2 = (v, cls, vals) => v ? `<div class="bi2${cls ? ' ' + cls : ''}"><div class="fr">${insec(remplir(esc(fr(v)), vals, 'fr'))}</div>${ar(v) ? `<div class="ar" lang="ar" dir="rtl">${insec(remplir(esc(ar(v)), vals, 'ar'))}</div>` : ''}</div>` : '';
  const fill = () => '<span class="fill"></span>';
  /* ligne « libellé : valeur » ; valeur : chaîne (échappée, ou LTR isolée), paire bilingue, ou vide (ligne à compléter) */
  const champ = (label, val, o = {}) => `<div class="f${o.cls ? ' ' + o.cls : ''}${typeof val === 'string' && val.length > 42 ? ' long' : ''}"><span class="lab">${bi(label)}</span><span class="val${val ? '' : ' libre'}">${val ? (typeof val === 'object' ? bi(val) : o.html ? val : (o.ltr ? ltr(val) : esc(val))) : ''}</span></div>`;
  const titreBloc = (v, cls) => `<h3 class="bt${cls ? ' ' + cls : ''}">${bi(v)}</h3>`;
  const chk = on => `<span class="chk${on ? ' coche' : ''}">${on ? '✓' : ''}</span>`; /* case à cocher ; cochée pour ce qui est déjà fait */
  const pre = h => `<span class="pre">${h}</span>`;
  const dt = s => s ? R.fmtDate(s) : '';
  const dtPasse = s => s && s <= R.today() ? R.fmtDate(s) : ''; /* date à venir : case laissée en blanc (carnet non réimprimé) */
  /* « Paracétamol 1 g + dexchlorphéniramine 5 mg IV » → « Paracétamol + dexchlorphéniramine IV » (doses retirées : pas de dose fixe dans le carnet) */
  const sansDose = t => String(t || '').replace(/\s*\d+(?:[.,]\d+)?\s*(?:mg\s*\/\s*kg|mg|g|µg|mcg|ml|UI)(?![A-Za-zÀ-ÿ0-9])/gi, '').replace(/\s{2,}/g, ' ').replace(/\s+([+,;])/g, ' $1').trim();
  /* téléphones vides ou factices (« 05 XX… ») : ligne à remplir à la main (R.telImprimable, documents.js) ; jamais coupés */
  const A_REMPLIR = '<span class="a-remplir">………………</span>';
  const tel = v => R.telImprimable(v) ? ltr(R.telImprimable(v)) : A_REMPLIR;
  const telUrgTxt = v => R.telImprimable(v) ? R.telImprimable(v).replace(/\s*\((?=[^)]*(?:urgence|24))[^)]*\)\s*$/i, '') : ''; /* « 05 … (urgences 24 h/24) » : la parenthèse est déjà dans le libellé */
  const telUrg = v => telUrgTxt(v) ? ltr(telUrgTxt(v)) : A_REMPLIR;
  /* carte (colonne de 39 mm) : le numéro reste insécable, une précision (« (poste 4412) ») peut passer à la ligne */
  const telCarte = t => { if (!t) return A_REMPLIR; const i = String(t).search(/\s[^\d\s+.\-]/); return i < 0 ? ltr(t) : `${ltr(t.slice(0, i))} ${ltr(t.slice(i + 1))}`; };
  const suite = v => ({ fr: `${fr(v)} ${fr(L().suite)}`, ar: `${ar(v)} ${ar(L().suite)}` });
  const joindre = (a, b) => ({ fr: `${fr(a)} → ${fr(b)}`, ar: `${ar(a)} ← ${ar(b)}` });
  const vide = v => v == null || String(v).trim() === '' || String(v).trim() === '—';
  const nb = v => R.nbFr(v);
  /* forme plurielle arabe : 1, 2, 3–10, 11 et plus */
  const plur = (T, n) => { const t = n === 1 ? T.un : n === 2 ? T.deux : n <= 10 ? T.peu : T.beaucoup; return t ? { fr: fr(t).replace('{n}', n), ar: ar(t).replace('{n}', LRI + n + PDI) } : null; };
  /* libellé court pour une ligne de planning : la parenthèse finale d'un libellé long est retirée (« Prise de sang : taux du médicament (juste avant…) ») */
  const court = v => fr(v).length > 34 ? { fr: fr(v).replace(/\s*\([^()]*\)\s*$/, ''), ar: ar(v).replace(/\s*\([^()]*\)\s*$/, '') } : v;
  const medecinDe = p => { const m = R.userName(p.medecinId); return !m || m === '—' ? '' : m; };
  /* dernier poids mesuré en séance à la date d'impression (R.dernierPoids, sans séance datée dans le futur : aucune date future pré-imprimée) */
  const poidsPasse = (p, t) => { const d = R.dernierPoids(p); if (!d || d.date <= t) return d; const c = (p.cures || []).filter(x => x.statut === 'realisee' && +x.poids > 0 && x.dateReelle && x.dateReelle <= t).sort((a, b) => b.dateReelle.localeCompare(a.dateReelle))[0]; return c ? { poids: +c.poids, date: c.dateReelle } : null; };

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
    /* carnet pédiatrique lu par les parents : aucune question d'adulte (grossesse) ; voies : texte propre à la perfusion ou à l'injection */
    const filtreTexte = i => !/enceinte|grossesse/i.test(fr(i)) && !(!voies.includes('SC') && /point d’injection/i.test(fr(i))) && !(!voies.includes('IV') && /pendant la perfusion/i.test(fr(i)));
    const items = arr => (arr || []).filter(garde).filter(filtreTexte);
    const dci = String(pr.dci || '').split(' — ')[0];
    const translit = (L().translit || {})[dci.toLowerCase().split(/\s/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '')];
    const dciBi = { fr: dci, ar: translit || '' }; /* nom latin côté FR, translittération côté AR */
    return { p, pr, t, e, sch, voies, classe, associe, sexe, ageN, items, dci, dciBi, medecin: medecinDe(p), maladie: ((L().p1 || {}).maladies || {})[p.pathologie] || { fr: (R.PATHOS[p.pathologie] || {}).label || p.pathologie || '', ar: '' } };
  }
  /* rythme d'entretien actuel : « Toutes les N semaines », « Tous les N jours », « 1 fois par jour » */
  const rythmeBi = c => { const a = c.sch.actuel, T = L().p1.rythmes; if (!a || !T) return null; const po = (a.doseType || ((c.sch.pr || {}).entretien || {}).doseType || (c.sch.pr || {}).doseType) === 'po'; if (po) return /×\s*2|x\s*2|2\s*fois|\b2\/j/i.test(a.texte || '') ? T.po2 : T.po1; const j = +a.intervalleJours || 0; if (!j) return null; return j % 7 === 0 ? plur(T.semaines, j / 7) : plur(T.jours, j); };
  const commentBi = c => { const V = L().p1.voies || {}; const l = c.voies.map(v => V[v]).filter(Boolean); if (!l.length) return c.pr.voie ? { fr: c.pr.voie, ar: '' } : ''; return l.length === 1 ? l[0] : joindre(l[0], l[1]); };
  const nomPatient = p => `${esc(p.prenom || '')} <b>${esc(p.nom || '')}</b>`;
  /* bandeau de page : nom et dossier (une seule fois par page), titre, numéro ; sansNom : page de la carte (le nom est sur la carte) ; sansNum : le numéro est dans le pied */
  const enTete = (c, n, titre, o) => `<div class="run">${o && o.sansNom ? '' : `<span class="run-id">${nomPatient(c.p)}${c.p.ipp ? ` · ${bi(L().dossierNo)} ${ltr(c.p.ipp)}` : ''}</span>`}<span class="run-t">${bi(titre)}</span>${o && o.sansNum ? '' : `<span class="num">${fr(L().page)} ${n}/${NB_PAGES}</span>`}</div>`;
  const etabLignes = e => [[e.service, e.unite].filter(Boolean).join(' · ')].filter(Boolean);
  const pied = (c, n) => `<span class="maq">imprimé le ${R.fmtDate(c.t)} <span class="nw">par Ryze</span></span><span class="pied-sep"> · </span><span class="num">${fr(L().page)} ${n}/${NB_PAGES}</span>`; /* page 8 : texte continu « imprimé le … par Ryze · Page 8/8 » renvoyé à la ligne à côté de la carte */
  const titrePage = v => `<div class="titre-page"><h2>${bi(v)}</h2></div>`;
  /* ligne « Mon médecin : Dr … » (le médecin en charge, rien d'autre) */
  const ligneMedecin = (c, cls) => `<div class="medecin-l${cls ? ' ' + cls : ''}"><span class="lab">${bi(L().p1.equipe.medecin)}</span><span class="val">${c.medecin ? esc(c.medecin) : fill()}</span></div>`;

  /* ---------- page 1 : couverture et informations ---------- */
  function page1(c) {
    const Lv = L(), P1 = Lv.p1, p = c.p, e = c.e; const moi = P1.moi, par = P1.parents, mal = P1.maladie, trt = P1.traitement;
    const sexeLib = !p.sexe ? '' : c.sexe === 'F' ? (c.ageN != null && c.ageN < 18 ? P1.sexe.fille : P1.sexe.F) : (c.ageN != null && c.ageN < 18 ? P1.sexe.garcon : P1.sexe.M);
    const ddn = p.ddn && !isNaN(R.parse(p.ddn)) ? `${R.ddnTxt(p)}${R.ageDoc(p) ? ' (' + R.ageDoc(p) + ')' : ''}` : '';
    const pi = R.poidsInitial(p), pd = poidsPasse(p, c.t); const poidsTxt = pd && pi && pd.poids !== pi ? `${nb(pi)} kg · ${nb(pd.poids)} kg (${dt(pd.date)})` : (pi || pd ? `${nb(pi || pd.poids)} kg` : '');
    const allergies = vide(p.allergies) ? '' : p.allergies; /* « — » = non renseigné (assistant) : ligne laissée à compléter, jamais « Aucune allergie connue » */
    const pm = R.premedicationEnCours ? R.premedicationEnCours(p) : null; const premed = c.voies.includes('IV') && pm ? sansDose(pm.texte) : ''; /* noms des médicaments, jamais leur dose (elle suit le poids de l'enfant) */
    const dateDiag = p.dateDiag && !isNaN(R.parse(p.dateDiag)) && String(p.dateDiag) <= c.t ? R.fmtDate(p.dateDiag, { month: '2-digit', year: 'numeric' }) : '';
    /* valeurs longues (allergies, prémédication, nom, « Comment » d'un protocole IV puis SC, DCI longue) : présentation resserrée dès l'estimation ; R.carnetPatientAjuster vérifie ensuite à l'affichage */
    const long = [allergies, premed].reduce((a, x) => a + String(x || '').length, 0) + Math.max(0, (p.prenom || '').length + (p.nom || '').length - 28) * 3 + Math.max(0, fr(commentBi(c)).length + ar(commentBi(c)).length - 60) + Math.max(0, String(c.dci || '').length - 14) * 2;
    return `<section class="page p1${long > 150 ? ' dense' : ''}">
      <header class="couv">${R.logoHTML('lv-logo')}<div class="couv-etab">${e.etablissement ? `<span>${esc(e.etablissement)}</span>` : ''}${e.hopital ? `<b class="hop">${esc(e.hopital)}</b>` : ''}${etabLignes(e).map(x => `<span>${esc(x)}</span>`).join('')}<span class="couv-hdj">${esc(e.hdj)}</span></div></header>
      <div class="couv-titre"><div class="titre">${bi(Lv.titre)}</div></div>
      <div class="nom-band"><div class="nom">${p.vierge ? `<span class="vierge-l">${bi(par.nom)} ${fill()}</span> <span class="ipp vierge-ipp">${bi({ fr: 'N° de dossier', ar: ar(Lv.dossierNo) })} ${fill()}</span>` : `${nomPatient(p)}${p.ipp ? ` <span class="ipp">${bi(Lv.dossierNo)} ${ltr(p.ipp)}</span>` : ''}`}</div>
        <div class="remis"><span>${bi(Lv.remisLe)} ${p.vierge ? fill() : `<b>${ltr(R.fmtDate(c.t))}</b>`}</span><span>${bi(Lv.remisPar)} ${fill()}</span><span>${bi(Lv.carnetNo)} ${chk()}1 ${chk()}2 ${chk()}3</span></div></div>
      <div class="cols">
        <div class="col">
          ${titreBloc(moi.titre)}
          ${champ(moi.ddn, ddn, { ltr: true })}${champ(moi.sexe, sexeLib)}${champ(P1.ecole, '')}${champ(moi.poids, poidsTxt, { ltr: true })}${champ(moi.taille, p.taille ? `${nb(p.taille)} cm` : '', { ltr: true })}${champ(moi.allergies, allergies)}
          ${titreBloc(par.titre)}
          ${champ(par.nom, '')}${champ(par.lien, '')}${champ(par.tel, R.telImprimable(p.tel), { ltr: true })}${champ(par.autreTel, '')}
        </div>
        <div class="col">
          ${titreBloc(mal.titre)}
          ${champ(mal['maladie-nom'], c.maladie)}${champ(mal['date-diag'], dateDiag, { ltr: true })}
          ${titreBloc(trt.titre)}
          ${champ(trt['tt-nom'], c.dci ? c.dciBi : '')}${champ(trt['tt-comment'], commentBi(c))}${champ(trt['tt-rythme'], rythmeBi(c) || '')}${champ(trt['tt-debut'], dtPasse(R.j0(p) || p.dateDebut), { ltr: true })}${premed ? champ(trt['tt-premed'], premed) : ''}${champ(trt['tt-autres'], '')}
        </div>
      </div>
      ${ligneMedecin(c, 'f')}
      <div class="apporte"><b>${bi(P1.apporte)}</b> ${bi2(P1.apporteListe)}</div>
      <footer class="pied">${pied(c, 1)}</footer>
    </section>`;
  }

  /* ---------- hauteurs (mm) servant à remplir les pages : bas utile 199,5 mm (page 210 − marges 5,5 + 5) ---------- */
  const MM = { bas: 199.5, run: 5.4, h2: 6.6, th: 8.4, h3: 5.8, seance: 8.4, examen: 9.5, rdv: 8.7, exSup: 3.6, thEx: 12.6, planTh: 6.2, planLigne: 5.3, planSup: 3.3 };
  const SEANCES_PAGE = 20, RDV_LIGNES = 20, EXAMENS_SUITE = 17, EXAMENS_MIN = 4, BLANCS_MIN = 10, PLAN_MAX = 22;

  /* ---------- séances : 20 lignes numérotées par page (rang de la séance dans le traitement en cours) ---------- */
  function lignesSeances(c) {
    const cyc = c.p.cycleCourant || 1, cap = 2 * SEANCES_PAGE;
    const faites = (c.p.cures || []).filter(x => x.statut === 'realisee' && (x.cycle || 1) === cyc && String(x.dateReelle || x.datePrevue || '') <= c.t).sort((a, b) => String(a.dateReelle || a.datePrevue).localeCompare(String(b.dateReelle || b.datePrevue))); /* cycle en cours seulement */
    const debut = Math.max(0, faites.length - (cap - BLANCS_MIN)); /* dossier ancien : les plus récentes gardées, 10 lignes vides au moins */
    const rows = faites.slice(debut).map((x, i) => ({ rang: debut + i + 1, x })); let r = faites.length + 1;
    while (rows.length < cap) rows.push({ rang: r++, x: null });
    return rows;
  }
  /* dose réellement donnée d'une séance faite : « 325 mg » */
  const doseDonnee = x => { if (x.dose != null && x.dose !== '' && !isNaN(+x.dose) && +x.dose > 0) return `${nb(+x.dose)} mg`; const t = String(x.doseTexte || ''); const m = /→\s*([\d.,]+)\s*mg/.exec(t) || /^\s*([\d.,]+)\s*mg\b/.exec(t); return m ? `${m[1].replace('.', ',')} mg` : ''; };
  /* tolérance d'une séance faite : « Bien tolérée », ou la réaction (nature seulement, sans le détail professionnel) */
  const toleranceHTML = x => { const t = String(x.tolerance || '').trim(); if (!t) return ''; const seg = R.estReaction(t) ? t.split(/\s+—\s+/).find(s => R.estReaction(s)) || t : null; /* même règle que les autres documents : « Bonne — … » choisi dans la fenêtre n'est pas une réaction */
    if (seg) { let h = seg.split(/\s+:\s+/)[0].trim(); if (!R.estReaction(h)) h = seg.trim(); h = h.replace(/\s*\([^()]*\)\s*$/, ''); h = h.charAt(0).toUpperCase() + h.slice(1); if (h.length > 60) h = h.slice(0, 60).replace(/\s+\S*$/, '') + '…'; return `<span class="pre reac">⚠ ${esc(h)}</span>`; }
    return /^(bonne|bien tol|ras\b)/i.test(t) ? pre(bi(L().p2.bienToleree)) : ''; };
  const trSeance = r => { const x = r.x, f = !!x;
    return `<tr class="${f ? 'fait' : 'blanc'}"><td class="n">${r.rang}</td><td class="c d">${f ? pre(ltr(dtPasse(x.datePrevue || x.dateReelle))) : ''}</td><td class="c d">${f ? pre(ltr(dt(x.dateReelle || x.datePrevue))) : ''}</td><td class="c">${f ? pre(esc(doseDonnee(x))) : ''}</td><td class="c">${f && +x.poids > 0 ? pre(esc(nb(x.poids))) : ''}</td><td class="c lot">${f && !vide(x.lot) ? `<span class="pre mono">${esc(x.lot)}</span>` : ''}</td><td class="c ck">${chk(f)}</td><td class="rem">${f ? toleranceHTML(x) : ''}</td><td class="sig"></td></tr>`; };
  function pageSeances(c, n, rows, premiere) {
    const Lv = L(), P2 = Lv.p2, col = P2.cols; const th = k => `<th>${bi(col[k])}</th>`;
    return `<section class="page p2">${enTete(c, n, P2.enTete)}
      ${titrePage(premiere ? P2.titre : suite(P2.titre))}
      <table class="lv-tab planning seances"><colgroup><col style="width:6.5mm"><col style="width:18mm"><col style="width:18mm"><col style="width:14mm"><col style="width:11mm"><col style="width:18.5mm"><col style="width:7mm"><col><col style="width:15mm"></colgroup>
        <thead><tr>${th('n')}${th('datePrevue')}${th('dateFaite')}${th('dose')}${th('poids')}${th('lot')}${th('fait')}${th('remarques')}${th('signature')}</tr></thead>
        <tbody>${rows.map(trSeance).join('')}</tbody></table>
    </section>`;
  }

  /* ---------- examens : plan de surveillance du dossier (fréquence en clair) et planning ---------- */
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
    return out.slice(0, PLAN_MAX).map(x => ({ id: x.id, lib: libelleExamen(x), freq: x.per ? frequenceBi(x.per) : null }));
  }
  /* examens déjà faits (échéances réalisées, hors examen clinique de séance), du plus ancien au plus récent */
  const examensFaits = c => (c.p.surveillance || []).filter(s => s && s.statut === 'faite' && s.dateFaite && String(s.dateFaite) <= c.t && s.mode !== 'cure' && s.id !== 'clin' && s.type !== 'clinique').sort((a, b) => String(a.dateFaite).localeCompare(String(b.dateFaite)));
  const libFait = s => court(libelleExamen({ id: s.id, nom: s.nom, label: s.label, libre: !EXAMENS_IDS[s.id] && s.id !== 'vit' && !!s.nom }));
  const trExamen = s => s ? `<tr class="fait"><td class="ex">${bi(libFait(s))}</td><td class="c d">${s.echeance ? pre(ltr(dtPasse(s.echeance))) : ''}</td><td class="c d">${pre(ltr(dt(s.dateFaite)))}</td><td class="c ck">${chk()}</td><td class="sig"></td></tr>` /* « résultat vu par le médecin » : case de validation cochée à la main, comme la signature (aucune donnée du dossier ne l'atteste) */
    : `<tr class="blanc"><td class="ex"></td><td class="c d"></td><td class="c d"></td><td class="c ck">${chk()}</td><td class="sig"></td></tr>`;
  const tableExamens = rows => { const col = L().p3.cols, th = k => `<th>${bi(col[k])}</th>`; return `<table class="lv-tab planning examens"><colgroup><col><col style="width:18mm"><col style="width:18mm"><col style="width:21mm"><col style="width:19mm"></colgroup><thead><tr>${th('examen')}${th('quand')}${th('fait')}${th('resultatVu')}${th('signature')}</tr></thead><tbody>${rows.join('')}</tbody></table>`; };
  function pagesExamens(c) {
    const Lv = L(), P3 = Lv.p3, plan = planExamens(c);
    /* page 4 : plan (une ligne par examen, FR et AR sur la même ligne) puis autant de lignes de planning que la hauteur le permet ; page 5 : planning seul (17 lignes au plus) */
    const hPlan = x => MM.planLigne + Math.max(0, Math.ceil((fr(x.lib).length + ar(x.lib).length + 3) / 64) - 1) * MM.planSup;
    const hautPlan = plan.length ? MM.h3 + MM.planTh + plan.reduce((a, x) => a + hPlan(x), 0) : 0;
    const dispo4 = MM.bas - MM.run - MM.h2 - hautPlan - MM.h3 - MM.thEx - 1, dispo5 = Math.min(EXAMENS_SUITE * MM.examen, MM.bas - MM.run - MM.h2 - MM.thEx - 1); /* en-tête du planning des examens sur 4 lignes (« Résultat vu par le médecin ») */
    /* ligne pré-remplie : le libellé court peut prendre 2 lignes en français (≈ 38 caractères par ligne) ou en arabe (≈ 40) */
    const hFait = s => { const l = libFait(s); return MM.examen + Math.max(0, Math.max(Math.ceil(fr(l).length / 38), Math.ceil((ar(l).length || 1) / 40)) - 1) * MM.exSup; };
    /* répartition des examens faits (page 4 puis page 5), lignes vides dans la hauteur restante ; dossier ancien : les plus anciens sont retirés jusqu'à garder 10 lignes vides au moins */
    const repartir = faits => { const p4f = [], p5f = []; let h4 = 0, h5 = 0; faits.forEach(s => { const h = hFait(s); if (!p5f.length && h4 + h <= dispo4) { p4f.push(s); h4 += h; } else { p5f.push(s); h5 += h; } });
      return { p4f, p5f, n4: Math.max(p4f.length ? 0 : EXAMENS_MIN, Math.floor((dispo4 - h4) / MM.examen)), n5: Math.max(0, Math.min(EXAMENS_SUITE - p5f.length, Math.floor((dispo5 - h5) / MM.examen))) }; };
    let faits = examensFaits(c), rep = repartir(faits); while (faits.length && rep.n4 + rep.n5 < BLANCS_MIN) { faits = faits.slice(1); rep = repartir(faits); }
    const rows4 = [...rep.p4f.map(trExamen), ...Array(rep.n4).fill(trExamen(null))], rows5 = [...rep.p5f.map(trExamen), ...Array(rep.n5).fill(trExamen(null))];
    const lignePlan = x => `<tr><td class="ex">${bi(x.lib)}</td><td class="fq">${x.freq ? bi(x.freq) : ''}</td></tr>`;
    const p4 = `<section class="page p3">${enTete(c, 4, P3.titreCourt)}
      ${titrePage(P3.titreCourt)}
      ${plan.length ? `${titreBloc(P3.plan.titre)}<table class="lv-tab plan"><colgroup><col><col style="width:38mm"></colgroup><thead><tr><th>${bi(P3.cols.examen)}</th><th>${bi(P3.plan.quand)}</th></tr></thead><tbody>${plan.map(lignePlan).join('')}</tbody></table>` : ''}
      ${titreBloc(P3.dates)}${tableExamens(rows4)}
    </section>`;
    const p5 = `<section class="page p3 suite">${enTete(c, 5, P3.titreCourt)}
      ${titrePage(suite(P3.titreCourt))}
      ${tableExamens(rows5)}
    </section>`;
    return [p4, p5];
  }

  /* ---------- page 6 : mes rendez-vous à venir (20 lignes vides) ---------- */
  function pageRdv(c, n) {
    const T = L().p3.rdv, col = T.cols, th = k => `<th>${bi(col[k])}</th>`;
    const ligne = `<tr class="blanc"><td class="c d"></td><td class="c"></td><td></td><td></td><td class="c ck">${chk()}</td></tr>`;
    return `<section class="page p6">${enTete(c, n, L().p2.enTete)}
      ${titrePage(T.planning)}
      <table class="lv-tab planning rdv"><colgroup><col style="width:24mm"><col style="width:16mm"><col><col style="width:34mm"><col style="width:10mm"></colgroup><thead><tr>${th('date')}${th('heure')}${th('quoi')}${th('lieu')}${th('fait')}</tr></thead><tbody>${ligne.repeat(RDV_LIGNES)}</tbody></table>
    </section>`;
  }

  /* ---------- carte détachable : même taille et même hauteur sur les deux pages du feuillet ----------
     recto (page 8, règle des 9 pt de la page urgences) : traitement, défenses diminuées, fièvre ou urgence, téléphones ;
     la consigne « Pas de vaccin vivant. Pas d'anti-inflammatoires sans avis. » passe au verso (page 7, déjà dans « À ne jamais faire ») pour que le recto tienne à 9 pt */
  function carteRecto(c) {
    const P4 = L().p4, e = c.e, ci = P4.carte.recto.items || [], it = i => ci[i] || { fr: '', ar: '' };
    return `<div class="carte recto"><div class="ciseaux">✂</div><div class="carte-in"><div class="ct">${bi(P4.carte.recto.titre)}</div>
      ${c.dci ? `<div class="f ct-trt"><span class="val">${bi(c.dciBi)}${vide(c.p.specialite) ? '' : `<span class="ct-spec"> · ${esc(c.p.specialite)}</span>`}</span></div>` /* le titre dit déjà « biothérapie » : la molécule seule, en gras, sans libellé */ : `<div class="f"><span class="lab">${bi(it(0))}</span><span class="val">${fill()}</span></div>`}
      <div class="ct-l grille ct-def">${bi(it(1))}</div><div class="ct-l grille">${bi(it(2))}</div>
      <div class="ct-tels"><div class="ct-tel"><span class="lab">${bi(it(4))}</span><span class="val">${telCarte(R.telImprimable(e.telHDJ))}</span></div><div class="ct-tel"><span class="lab">${bi(it(5))}</span><span class="val">${telCarte(telUrgTxt(e.telUrgences))}</span></div></div></div></div>`;
  }
  function carteVerso(c) {
    const Lv = L(), p = c.p, e = c.e, verso = (Lv.p4.carte.verso || {}).items || [], it = i => verso[i] || { fr: '', ar: '' }, vaccin = ((Lv.p4.carte.recto || {}).items || [])[3];
    return `<div class="carte verso"><div class="carte-in"><div class="ct">${bi(Lv.p3.versoCarte)}</div>
      ${champ(it(0), `${p.prenom || ''} ${p.nom || ''}`.trim())}${champ(it(1), p.ipp, { ltr: true })}${champ(it(2), c.maladie)}${champ(it(3), dtPasse(R.j0(p) || p.dateDebut), { ltr: true })}${champ(it(4), c.medecin)}
      ${vaccin ? `<div class="ct-l grille">${bi(vaccin)}</div>` : ''}<div class="ct-etab">${esc([e.hopital, e.service].filter(Boolean).join(' · ') || e.etablissement)}</div>
      <div class="ct-note">${bi2(it(5))}</div></div></div>`;
  }

  /* ---------- page 7 : avant chaque séance (pédiatrie), à ne jamais faire, séance manquée, verso de la carte ---------- */
  const listeItems = (arr, cls) => `<ul class="items${cls ? ' ' + cls : ''}">${arr.map(i => `<li data-p="${i.p || 1}">${bi(i)}</li>`).join('')}</ul>`;
  function pageConsignes(c, n) {
    const P4 = L().p4, A = P4.avant;
    const avant = c.items(A.items); const cases = avant.filter(i => /^☐/.test(fr(i))), consigne = avant.find(i => /^Une case cochée/.test(fr(i)));
    const jamais = c.items(P4.jamais.items).filter(i => (i.p || 1) <= 1);
    return `<section class="page p4 conseils-page">${enTete(c, n, A.titrePage, { sansNom: true })}
      ${titrePage(A.titrePage)}
      <div class="avant"><h3 class="bt">${bi(A.titreCourt)}</h3><ul class="items cases">${cases.map(i => `<li class="case">${chk()}${bi({ fr: fr(i).replace(/^☐\s*/, ''), ar: ar(i) })}</li>`).join('')}</ul>${consigne ? `<div class="regle grille">${bi(consigne)}</div>` : ''}</div>
      <div class="jamais"><h3 class="bt"><span class="ico non"></span>${bi(P4.jamais.titre)}</h3>${listeItems(jamais)}</div>
      ${A.manquee ? `<div class="regle grille manquee">${bi(A.manquee)}</div>` : ''}
      <div class="bas-carte droite">${carteVerso(c)}</div>
    </section>`;
  }

  /* ---------- page 8 : en cas d'urgence (rouge, orange, numéros en gros, médecin, recto de la carte, pied) ---------- */
  /* hauteur estimée (mm) d'un élément de liste à 9 pt : colonne française ≈ 47 caractères par ligne, arabe ≈ 44, 3,85 mm par ligne */
  const hItem = i => 1.3 + Math.max(Math.ceil((fr(i).length || 1) / 47), ar(i) ? Math.ceil(ar(i).length / 44) : 0) * 3.85;
  const URG_FIXE = 111; /* bandeau (9 pt), titres et numéros des deux encadrés, ligne du médecin, carte (54 mm), marges */
  function listesUrgence(c) {
    const P4 = L().p4; const budget = MM.bas - URG_FIXE;
    const rouge = c.items(P4.rouge.items).sort((a, b) => (a.p || 1) - (b.p || 1)), orange = c.items(P4.orange.items).sort((a, b) => (a.p || 1) - (b.p || 1));
    /* garantis : 4 signes rouges, 3 orange et les éléments conditionnels de priorité 1 qui s'appliquent au dossier (point d'injection en SC, yeux jaunes sous azathioprine ou méthotrexate) ;
       puis les suivants, par priorité, tant qu'ils tiennent (R.carnetPatientAjuster retire encore à l'affichage si besoin) */
    const R8 = rouge.slice(0, 4), O8 = orange.filter((i, k) => k < 3 || (i.si && (i.p || 1) <= 1)); let h = [...R8, ...O8].reduce((a, i) => a + hItem(i), 0);
    const reste = [...rouge.filter(i => !R8.includes(i)).map(i => ['r', i]), ...orange.filter(i => !O8.includes(i)).map(i => ['o', i])].sort((a, b) => (a[1].p || 1) - (b[1].p || 1));
    reste.forEach(([k, i]) => { const hi = hItem(i); if (h + hi <= budget) { (k === 'r' ? R8 : O8).push(i); h += hi; } });
    return { rouge: rouge.filter(i => R8.includes(i)), orange: orange.filter(i => O8.includes(i)) };
  }
  const ligneNum = (lab, val) => `<div class="num-l"><span class="lib">${bi(lab)}</span><span class="tel-g">${val}</span></div>`;
  function pageUrgences(c, n) {
    const Lv = L(), P4 = Lv.p4, e = c.e, U = listesUrgence(c);
    const nat = (P4.numerosUrgence || []).filter(x => x.tel !== '{urgences}'); /* SAMU 141, Protection civile 15 : une ligne compacte */
    return `<section class="page p4 urg-page">${enTete(c, n, Lv.p1.urgence.titre, { sansNum: true })}
      <div class="alerte rouge"><div class="al-t"><span class="ico oct">!</span>${bi2(P4.rouge.titre)}</div><div class="nums">${ligneNum(P4.numerosUrgence[0], telUrg(e.telUrgences))}${nat.length ? `<div class="num-sous">${nat.map(x => `<span class="nw">${bi(x)} <b>${esc(x.tel)}</b></span>`).join(' · ')}</div>` : ''}</div>${listeItems(U.rouge)}</div>
      <div class="alerte orange"><div class="al-t"><span class="ico tri">!</span>${bi2(P4.orange.titre)}</div><div class="nums">${ligneNum(P4.hdj, tel(e.telHDJ))}</div>${listeItems(U.orange)}</div>
      ${ligneMedecin(c)}
      <div class="bas-carte gauche">${carteRecto(c)}<div class="bas-droite"><div class="pied-urg">${pied(c, n)}</div></div></div>
    </section>`;
  }

  /* ---------- assemblage : 8 pages fixes (2 feuilles A4 pliées), aucune page de remplissage ---------- */
  const NOMS = ['couverture et informations', 'mes séances', 'mes séances', 'mes examens', 'mes examens', 'mes rendez-vous à venir', 'avant chaque séance et verso de la carte', 'en cas d’urgence et recto de la carte'];
  R.carnetPatientPages = function (p) {
    const c = contexte(p); const sea = lignesSeances(c); const ex = pagesExamens(c);
    return [page1(c), pageSeances(c, 2, sea.slice(0, SEANCES_PAGE), true), pageSeances(c, 3, sea.slice(SEANCES_PAGE), false), ex[0], ex[1], pageRdv(c, 6), pageConsignes(c, 7), pageUrgences(c, 8)];
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

  /* ---------- feuille de style du carnet (préfixe .livret ; @page du format choisi) ----------
     couleurs (décision D2) : palette unique des documents (variables --imp-* d'index.html, couloir @couleur ; valeurs de repli ici) — une couleur discrète par
     rubrique pour se repérer vite (séances et rendez-vous : accent bleu du CHU ; examens : vert-bleu ; urgences : rouge sobre en page 8), bandeaux de titre de
     page teintés, lignes de planning alternées très claires, carte détachable à bordure d'accent ; le reste en noir (arabe compris).
     Noir et blanc (html.imp-nb) : variables neutres, fonds retirés, symboles (octogone, triangle, sens interdit) gardés en noir */
  R.carnetPatientCSS = a4 => `
.livret{--lv-ink:#182421;--lv-ink2:#4E5E59;--lv-ar:var(--lv-ink);--lv-acc:var(--imp-acc-e,#0A6FA0);--lv-acc-m:var(--imp-acc,#0098D0);--lv-acc-t:var(--imp-acc-t,#E6F4FA);--lv-line:#B9C6C2;--lv-soft:#F2F5F7;--lv-alt:var(--imp-alt,#F6F9FB);--lv-rouge:var(--imp-al,#B3261E);--lv-rouge-t:var(--imp-al-t,#FBE9E7);--lv-orange:var(--imp-af-e,#8F5508);--lv-orange-m:var(--imp-af,#B27B0C);--lv-orange-t:var(--imp-af-t,#FBEFD9);--lv-ex:var(--imp-ex,#057558);--lv-ex-t:var(--imp-ex-t,#E4F2EE);--lv-gris:#5F6E69;color-scheme:light}
html.imp-nb .livret{--lv-soft:transparent}
/* rubrique de la page : séances, rendez-vous, couverture, consignes = accent ; examens (pages 4 et 5) = vert-bleu ; urgences (page 8) = rouge */
.livret .page{--lv-rub:var(--lv-acc);--lv-rub-m:var(--lv-acc-m);--lv-rub-t:var(--lv-acc-t)}
.livret .page.p3{--lv-rub:var(--lv-ex);--lv-rub-m:var(--lv-ex);--lv-rub-t:var(--lv-ex-t)}
.livret .page.urg-page{--lv-rub:var(--lv-rouge);--lv-rub-m:var(--lv-rouge);--lv-rub-t:var(--lv-rouge-t)}
.livret *{box-sizing:border-box}
.livret .page{width:148mm;height:210mm;padding:5.5mm 7mm 5mm;background:#fff;color:var(--lv-ink);font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:7.6pt;line-height:1.3;position:relative;overflow:hidden;display:flex;flex-direction:column;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.livret table{color:inherit}
.livret .ar{font-family:'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif;color:var(--lv-ar);font-size:1.12em;unicode-bidi:isolate}
.livret .bi .sep{color:var(--lv-gris);margin:0 .35em;font-weight:400}
.livret .bi2 .fr{display:block}
.livret .bi2 .ar{display:block;text-align:right;margin-top:.15mm}
.livret bdi{unicode-bidi:isolate}
.livret bdi.nw,.livret .nw,.livret .a-remplir{white-space:nowrap}
.livret .a-remplir{letter-spacing:.04em;color:var(--lv-ink2);font-weight:400;font-size:9pt}
.livret b,.livret strong{font-weight:600}
.livret .page h2{font-size:11.5pt;font-weight:600;margin:0;line-height:1.2;text-wrap:initial;color:var(--lv-rub)}
.livret .page h2 .ar{font-size:1.05em}
.livret .titre-page{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;margin:0 0 1mm;padding:.4mm 1.6mm;background:var(--lv-rub-t);border-left:1mm solid var(--lv-rub-m);border-radius:.6mm} /* bandeau de titre teinté : même hauteur qu'avant (marges reprises dans le remplissage) */
.livret .bt{font-size:8.8pt;font-weight:600;margin:2mm 0 .7mm;padding:0 0 .3mm;border-bottom:.35pt solid var(--lv-rub-m);color:var(--lv-rub);text-transform:none;display:flex;align-items:center;gap:1mm;text-wrap:initial}
.livret .f{display:flex;flex-wrap:wrap;gap:0 1.5mm;padding:.8mm 0;border-bottom:.25pt dotted var(--lv-line);align-items:baseline;min-height:5.2mm;font-size:8pt}
.livret .f .lab{flex:0 1 auto;color:var(--lv-ink2)}
.livret .f .val{flex:1 1 18mm;font-weight:500}
.livret .f.long .val{flex-basis:100%} /* valeur longue (allergies, prémédication) : sous le libellé, sur toute la largeur */
.livret .fill{display:inline-block;min-width:14mm;border-bottom:.3pt solid var(--lv-ink2);height:1em;vertical-align:baseline;flex:1}
.livret .chk{display:inline-flex;align-items:center;justify-content:center;width:3.8mm;height:3.8mm;border:.45pt solid var(--lv-ink);border-radius:.5mm;vertical-align:-0.9mm;margin-right:.6mm;background:#fff;font-size:8.5pt;line-height:1;color:var(--lv-ink);font-style:normal}
.livret .chk.coche{font-weight:700}
.livret .pre{color:var(--lv-gris);font-style:italic}
.livret .pre.reac{color:var(--lv-rouge);font-style:normal;font-weight:600}
.livret .mono{font-family:'IBM Plex Mono',monospace;font-style:normal;font-size:.95em}
.livret .num{color:var(--lv-acc);white-space:nowrap}
.livret .pied{margin-top:auto;padding-top:.7mm;border-top:.35pt solid var(--lv-line);display:flex;justify-content:flex-end;gap:3mm;font-size:6.6pt;color:var(--lv-ink2);line-height:1.25}
.livret .maq{color:var(--lv-gris);font-size:6.4pt}
.livret .run{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;font-size:6.8pt;color:var(--lv-ink2);border-bottom:.35pt solid var(--lv-rub-m);padding-bottom:.5mm;margin-bottom:1.2mm}
.livret .run .run-t{color:var(--lv-rub)}
.livret .run .run-id{color:var(--lv-ink);white-space:nowrap;flex:none}
.livret .run .run-t{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} /* bandeau sur une ligne : le titre s'efface devant un nom long */
.livret .medecin-l{display:flex;align-items:baseline;gap:2mm;font-size:9pt;padding:1mm 0;border-bottom:.3pt dotted var(--lv-line)}
.livret .medecin-l .lab{color:var(--lv-ink2)}
.livret .medecin-l .val{font-weight:600;flex:1}
.livret .medecin-l.f{font-size:8.6pt;padding:1mm 0;margin-top:2.2mm;border-bottom:.3pt solid var(--lv-line)}
/* couverture */
.livret .couv{display:flex;align-items:center;gap:3.5mm;padding-bottom:1.6mm;border-bottom:.5pt solid var(--lv-acc-m)}
.livret .lv-logo{height:16mm;width:auto;max-width:42mm;object-fit:contain;flex:none}
.livret .couv-etab{display:flex;flex-direction:column;font-size:7pt;line-height:1.3;color:var(--lv-ink2)}
.livret .couv-etab b.hop{font-size:8.4pt;color:var(--lv-ink);font-weight:700}
.livret .couv-hdj{color:var(--lv-acc);font-weight:600}
.livret .couv-titre{margin-top:2mm}
.livret .couv-titre .titre{font-size:16pt;font-weight:700;line-height:1.15;color:var(--lv-acc)}
.livret .couv-titre .titre .ar{font-size:.95em}
.livret .nom-band{margin:2mm 0 .6mm;padding:1.4mm 2mm;background:var(--lv-acc-t);border:.4pt solid var(--lv-acc-m);border-radius:1mm;display:flex;flex-direction:column;gap:.7mm}
.livret .nom-band .nom{font-size:13pt;font-weight:500}
.livret .nom-band .vierge-l,.livret .nom-band .nom .ipp.vierge-ipp{display:inline-flex;align-items:baseline;gap:1.5mm;font-size:9pt;font-weight:400}.livret .nom-band .vierge-l .fill{min-width:52mm}.livret .nom-band .nom .ipp.vierge-ipp .fill{min-width:24mm}
.livret .nom-band .nom .ipp{font-size:7.4pt;color:var(--lv-ink2);margin-left:2mm;font-weight:400}
.livret .nom-band .remis{font-size:7.2pt;color:var(--lv-ink2);display:flex;flex-wrap:wrap;gap:.6mm 3mm;align-items:baseline}
.livret .nom-band .remis > span{white-space:nowrap}
.livret .nom-band .remis .fill{min-width:16mm;flex:0 0 auto}
.livret .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 4mm;align-items:start}
.livret .cols .col > .bt:first-child{margin-top:1.4mm}
.livret .apporte{margin-top:2.2mm;padding:1.4mm 2mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);border-radius:.8mm;font-size:7.8pt;line-height:1.35}
.livret .apporte .bi2{display:inline}.livret .apporte .bi2 .fr{display:inline}.livret .apporte .bi2 .ar{margin-top:.3mm}
.livret .p1.dense .f{padding:.4mm 0;min-height:4mm;font-size:7.3pt}.livret .p1.dense .bt{margin:1.1mm 0 .5mm;font-size:8pt}.livret .p1.dense .apporte{margin-top:1mm;padding:.8mm 1.4mm;font-size:7pt}.livret .p1.dense .couv-titre{margin-top:1mm}.livret .p1.dense .nom-band{margin:1.2mm 0 .4mm}.livret .p1.dense .medecin-l.f{font-size:7.6pt;margin-top:1.2mm}
/* tableaux */
.livret .lv-tab{width:100%;border-collapse:collapse;table-layout:fixed}
.livret .lv-tab th{font-size:6.8pt;font-weight:600;text-align:left;padding:.6mm .7mm;background:var(--lv-rub-t);border:.3pt solid var(--lv-line);vertical-align:bottom;line-height:1.15;text-transform:none;letter-spacing:0;color:var(--lv-ink);white-space:normal}
.livret .lv-tab th .ar{display:block;font-size:1.05em}
.livret .lv-tab th .sep{display:none}
.livret .lv-tab td{border:.3pt solid var(--lv-line);padding:.4mm .8mm;vertical-align:middle;font-size:7.6pt;line-height:1.2;overflow-wrap:break-word}
.livret .lv-tab td.c{text-align:center}
.livret .lv-tab td.d{white-space:nowrap;padding-left:.3mm;padding-right:.3mm}
/* plannings (pages 2 à 6) : lignes à remplir à la main, 8,5 pt au moins */
.livret .planning td{font-size:8.5pt;line-height:1.15;padding:.5mm .7mm}
.livret .planning td .ar{font-size:1.08em}
.livret .planning td.ck{padding:0 .3mm;text-align:center}
.livret .planning td.ck .chk{margin:0;vertical-align:middle}
.livret .planning tbody tr:nth-child(even) td{background:var(--lv-alt)} /* lignes alternées très claires */
.livret .seances td{height:8.4mm}
.livret .seances td.n,.livret .planning.seances tbody tr td.n{font-weight:600;text-align:center;font-size:8.5pt;background:var(--lv-rub-t)}
.livret .seances td.rem{line-height:1.12;vertical-align:middle}
.livret .seances td.rem .bi .ar{display:block;font-size:1.06em}
.livret .seances td.rem .bi .sep{display:none}
.livret .seances td.lot .mono{font-size:1em;overflow-wrap:anywhere;font-style:normal}
.livret .examens td{height:9.5mm}
.livret .examens td.ex .bi .ar{display:block;font-size:1.06em}
.livret .examens td.ex .bi .sep{display:none}
.livret .examens td.ex{line-height:1.12}
.livret .rdv td{height:8.7mm}
.livret .plan td{height:5.3mm;font-size:7.6pt;line-height:1.15;padding:.3mm .8mm}
.livret .plan td.fq{font-weight:600}
.livret .plan th{padding:.4mm .8mm;font-size:6.6pt}
.livret .plan th .ar{display:inline;margin-left:1mm}.livret .plan th .sep{display:inline}
.livret .p3 .bt{margin-top:1.2mm}
/* pages 7 et 8 : consignes et urgences (9 pt au moins) */
.livret .alerte{border:.6pt solid;border-radius:1mm;padding:.8mm 1.8mm .6mm;margin-bottom:1.4mm}
.livret .alerte.rouge{border-color:var(--lv-rouge);background:var(--lv-rouge-t);border-left-width:2mm}
.livret .alerte.orange{border-color:var(--lv-orange-m);background:var(--lv-orange-t);border-left-width:2mm}
.livret .al-t{font-weight:700;font-size:10pt;display:flex;align-items:center;gap:1.8mm;line-height:1.15}
.livret .al-t .bi2{flex:1}
.livret .al-t .bi2 .ar{font-size:1.04em}
.livret .rouge .al-t{color:var(--lv-rouge)}.livret .orange .al-t{color:var(--lv-orange)}
.livret .ico{display:inline-flex;width:5mm;height:5mm;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:9pt;flex:0 0 auto}
.livret .ico.oct{background:var(--lv-rouge);clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)}
.livret .ico.tri{background:var(--lv-orange-m);clip-path:polygon(50% 0,100% 100%,0 100%);padding-top:1.4mm}
.livret .ico.non{width:3.8mm;height:3.8mm;border:.7pt solid var(--lv-ink);border-radius:50%;position:relative}
.livret .ico.non::after{content:"";position:absolute;left:-.3mm;top:45%;width:4mm;height:.7pt;background:var(--lv-ink);transform:rotate(-45deg)}
.livret .nums{margin:.8mm 0 .7mm;padding:.2mm 1.4mm;background:#fff;border:.6pt solid var(--lv-rouge);border-radius:.8mm}
.livret .orange .nums{border-color:var(--lv-orange-m)}
.livret .num-l{display:flex;align-items:center;justify-content:space-between;gap:3mm;padding:.35mm 0;font-size:9pt;line-height:1.15}
.livret .num-l .lib{font-weight:600}
.livret .tel-g{font-size:13pt;font-weight:700;line-height:1.1;white-space:nowrap;font-variant-numeric:tabular-nums;color:var(--lv-ink);flex:none}
.livret .num-sous{font-size:9pt;padding:.2mm 0 .5mm;color:var(--lv-ink2);border-top:.25pt dotted var(--lv-line)}
.livret .num-sous b{color:var(--lv-ink);font-weight:700}
.livret .items{margin:0;padding:0;list-style:none}
.livret .items li{padding:.5mm 0 .5mm 2.8mm;position:relative;border-bottom:.25pt dotted rgba(0,0,0,.18);font-size:9pt;line-height:1.16;break-inside:avoid}
.livret .items li:last-child{border-bottom:0}
.livret .items li .bi{display:grid;grid-template-columns:1.25fr 1fr;gap:0 3mm}
.livret .items li .bi .sep{display:none}
.livret .items li .bi .ar{text-align:right;font-size:1.06em}
.livret .items li::before{content:"•";position:absolute;left:.5mm;color:var(--lv-ink2)}
.livret .conseils-page .bt{font-size:10.5pt;margin:1.8mm 0 .8mm;border-bottom-width:.5pt}
.livret .conseils-page .items li{padding-top:.8mm;padding-bottom:.8mm;font-size:9.3pt}
.livret .jamais .bt{color:var(--lv-ink);border-color:var(--lv-ink)}
.livret .cases li.case{padding-left:6.5mm;padding-top:1mm;padding-bottom:1mm}
.livret .cases li.case::before{content:none}
.livret .cases li.case .chk{position:absolute;left:.3mm;top:1.1mm;width:4.2mm;height:4.2mm}
.livret .regle{font-size:9.5pt;margin-top:1mm;padding:1mm 1.8mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);border-radius:.6mm;line-height:1.2;font-weight:500}
.livret .regle.manquee{margin-top:2.2mm;border-color:var(--lv-acc-m);background:var(--lv-acc-t)}
.livret .grille .bi,.livret .grille.bi{display:grid;grid-template-columns:1.15fr 1fr;gap:0 3mm}
.livret .grille .bi .sep,.livret .grille.bi .sep{display:none}
.livret .grille .bi .ar,.livret .grille.bi .ar{text-align:right}
.livret .urg-page .medecin-l{margin-top:.4mm}
/* page 8 : tout le texte de la page à 9 pt au moins, bandeau, pied et recto de la carte détachable compris ; un nom très long renvoie le titre à la ligne */
.livret .urg-page .run{font-size:9pt;flex-wrap:wrap;row-gap:.2mm}
.livret .urg-page .run .run-t{flex:1 1 auto;min-width:auto;white-space:normal;overflow:visible;text-overflow:clip}
/* carte détachable : 85 × 54 mm, posée en bas de page à la même hauteur au recto (page 8, à gauche) et au verso (page 7, à droite) */
.livret .bas-carte{margin-top:auto;height:54mm;flex:none;display:flex;gap:4mm;align-items:stretch}
.livret .bas-carte.droite{justify-content:flex-end}
.livret .carte{width:85mm;height:54mm;flex:none;border:.6pt dashed var(--lv-acc-m);border-radius:2.5mm;position:relative;padding:2.2mm 2.6mm;background:#fff;font-size:7pt;line-height:1.2;overflow:hidden}
.livret .carte.recto{border-color:var(--lv-acc-m);background:var(--lv-acc-t)}
.livret .carte .ct{font-weight:700;color:var(--lv-acc);font-size:8.4pt;margin-bottom:.6mm;border-bottom:.4pt solid var(--lv-acc-m);padding-bottom:.4mm}
.livret .carte.verso .ct{color:var(--lv-ink2);border-color:var(--lv-line);font-size:7.6pt}
.livret .carte.verso .f{padding:.25mm 0;min-height:3.1mm}.livret .carte.verso .ct-l{margin:.5mm 0 0}
.livret .carte .f{padding:.35mm 0;min-height:3.4mm;font-size:7pt}
.livret .carte .ct-l{margin:.3mm 0;font-size:6.9pt;line-height:1.16}
.livret .carte .ct-tel .val{font-size:8.4pt;font-weight:700}
.livret .carte .ct-etab{font-size:6.4pt;color:var(--lv-ink2);margin-top:.6mm}
.livret .carte .ct-note{margin-top:.5mm;color:var(--lv-ink2);font-size:6.4pt;line-height:1.15}
.livret .ciseaux{position:absolute;top:.4mm;right:2mm;color:var(--lv-gris);font-size:9pt;line-height:1}
/* recto de la carte (page 8) : 9 pt au moins, téléphones à 10 pt ; le verso (page 7) garde le corps de carte */
.livret .carte.recto{font-size:9pt;line-height:1.14;padding:2mm 2.6mm}
.livret .carte.recto .ct{font-size:9.5pt;margin-bottom:.5mm;padding-right:4mm}
.livret .carte.recto .f{font-size:9pt;padding:.3mm 0;min-height:0}.livret .carte.recto .ct-trt .val{font-weight:700}
.livret .carte.recto .ct-l{font-size:9pt;line-height:1.13;margin:.4mm 0}
/* téléphones côte à côte (hôpital de jour | urgences) : libellé FR / AR puis le numéro à 10 pt */
.livret .carte.recto .ct-tels{display:grid;grid-template-columns:1fr 1fr;gap:0 2.5mm;margin-top:.6mm;padding-top:.6mm;border-top:.25pt dotted var(--lv-line)}
.livret .carte.recto .ct-tel{display:flex;flex-direction:column;min-width:0}
.livret .carte.recto .ct-tel .lab{color:var(--lv-ink2)}.livret .carte.recto .ct-tel .lab .sep{display:none}.livret .carte.recto .ct-tel .lab .ar{display:block;line-height:1.1}
.livret .carte.recto .ct-tel .val{font-size:10pt;font-weight:700;line-height:1.15}
.livret .bas-droite{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-end}
.livret .pied .pied-sep{display:none}
.livret .pied-urg{display:block;text-align:right;font-size:9pt;line-height:1.25;color:var(--lv-ink2);border-top:.35pt solid var(--lv-line);padding-top:.7mm}
.livret .pied-urg .maq{font-size:9pt}
/* police web absente (poste hors ligne) : la police de remplacement est plus large, corps réduit hors plannings (8,5 pt gardés sur les lignes à remplir, 9 pt en pages 7 et 8) */
.livret.sans-police .page{font-size:7pt}
.livret.sans-police .f{font-size:7.4pt}.livret.sans-police .p1.dense .f{font-size:6.8pt}
.livret.sans-police .lv-tab th{font-size:6.2pt}
.livret.sans-police .items li,.livret.sans-police .regle{font-size:9pt;line-height:1.12}
/* présentation à l'écran et impression */
.livret .pages{padding:18px 8px 40px;display:flex;flex-direction:column;gap:14px;align-items:center}
.livret .spread{display:flex;gap:0;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.livret .spread .page{margin:0}
.livret .spread .page + .page{border-left:.4pt dashed #B9C6C2}
.livret .solo{box-shadow:0 8px 24px rgba(0,0,0,.18)}
.livret .lab-page{font-size:12px;color:var(--muted,#4E5E59);font-family:'IBM Plex Sans',system-ui,sans-serif;align-self:center}
.livret .imposition{display:flex;flex-direction:column;gap:14px;align-items:center;padding:18px 8px 40px;overflow-x:auto;max-width:100%}
.livret .sheet{display:flex;justify-content:center;width:297mm;height:210mm;flex:none;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18)} /* pages centrées : pli au milieu de la feuille, carte superposée au recto et au verso */
.livret .sheet .page{margin:0}
.livret .sheet .page + .page{border-left:.4pt dashed #B9C6C2}
/* noir et blanc : symboles d'alerte gardés en noir (fond de l'icône imprimé malgré l'économie d'encre) */
html.imp-nb .livret .ico{-webkit-print-color-adjust:exact;print-color-adjust:exact}
html.imp-nb .livret .page .ico.oct,html.imp-nb .livret .page .ico.tri{background:var(--lv-ink)!important}
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
  /* carnet vierge : dossier temporaire jamais enregistré (aucune donnée de patient), nom, n° de dossier, sexe et date de remise à remplir à la main */
  R.patientVierge = () => ({ id: 'vierge', vierge: true, nom: '', prenom: '', ddn: '', sexe: '', ipp: '', pathologie: '', protocoleId: '', medecinId: '', statut: 'actif', allergies: '', cures: [], curesRetro: [], surveillance: [], bilan: [], notes: [], historiqueProtocoles: [] });
  R.pages.carnetPatient = {
    render(params) {
      const vierge = params.id === 'vierge', p = vierge ? R.patientVierge() : R.patient(params.id); if (!p) return '<div class="empty">Dossier introuvable.</div>';
      if (!R.can('carnet', 'r')) return '<div class="empty">Carnet réservé aux accès autorisés.</div>';
      if (!R.LIVRET) return '<div class="empty">Contenu du carnet patient indisponible (livret-data.js).</div>';
      const a4 = !!R.ui.carnetA4; const doc = R.carnetPatientHTML(p, { a4 }); const N = +(doc.match(/data-pages="(\d+)"/) || [])[1] || 0; setTimeout(R.carnetPatientPolices, 0);
      return `<div class="row between no-print mb16" style="flex-wrap:wrap;gap:8px">${vierge ? `<button class="btn" data-go="patients">${R.icon('back')}Retour aux patients</button>` : `<button class="btn" data-go="patient" data-params='${R.params({ id: p.id })}'>${R.icon('back')}Retour au dossier</button>`}
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="small muted">${vierge ? 'Carnet patient vierge' : 'Carnet patient'} (français / arabe) · ${N} pages A5 · ${R.pluriel(N / 4, 'feuille A4', 'feuilles A4')}</span><div class="btn-group"><button type="button" class="btn sm${a4 ? '' : ' on'}" data-action="carnetVue" data-v="a5">Vue A5</button><button type="button" class="btn sm${a4 ? ' on' : ''}" data-action="carnetVue" data-v="a4">Vue A4 recto-verso</button></div>${R.boutonsDoc()}</div></div>
        <p class="small muted no-print" style="margin:-8px 0 12px">${vierge ? 'Carnet vierge : nom, dates, doses et informations sont à remplir à la main ; rien n’est enregistré dans HDJ.' : 'Carnet remis une seule fois : les séances et les examens déjà faits sont pré-remplis, les dates à venir et les doses sont laissées en blanc, l’équipe les note à chaque séance.'} ${a4 ? 'Feuilles A4 paysage à imprimer recto-verso (retournement sur le bord court) puis à plier en deux : la carte détachable a son verso au dos, à la même place.' : 'Pages A5 à imprimer recto-verso (retournement sur le bord long) ; la vue A4 donne l’imposition pour deux feuilles pliées en deux.'}</p>${doc}`;
    }
  };
  R.actions.carnetVue = el => { R.ui.carnetA4 = el.dataset.v === 'a4'; R.render(); };
  /* page qui déborde encore une fois rendue (valeurs très longues, police de remplacement) : page 1 — présentation resserrée, puis sans l'encadré « J'apporte » ;
     plannings (pages 2 à 6) — une ligne vide de moins, puis la ligne pré-remplie la plus ancienne ; page 4 — lignes du plan au-delà de 12 ; pages 7 et 8 — éléments de
     priorité 2, puis le dernier élément orange, puis le dernier rouge. Pages 4 et 5 : lignes vides ajoutées dans la place restante. Rien n'est jamais rogné ; le
     document téléchargé (R.docExport) copie ce rendu */
  R.carnetPatientAjuster = racine => {
    const wrap = racine || document.querySelector('.carnet-wrap.livret'); if (!wrap) return; const deborde = el => el.scrollHeight - el.clientHeight > 1;
    const dernier = (el, sel) => { const l = el.querySelectorAll(sel); return l.length ? l[l.length - 1] : null; };
    wrap.querySelectorAll('.page.p1').forEach(el => { for (let k = 0; k < 4 && deborde(el); k++) { if (!el.classList.contains('dense')) { el.classList.add('dense'); continue; } const ap = el.querySelector('.apporte'); if (ap) { ap.remove(); continue; } break; } });
    wrap.querySelectorAll('.page.p2, .page.p3, .page.p6').forEach(el => { for (let k = 0; k < 40 && deborde(el); k++) { const b = dernier(el, '.planning tbody tr.blanc'); if (b) { b.remove(); continue; } const pl = el.querySelectorAll('.plan tbody tr'); if (pl.length > 12) { pl[pl.length - 1].remove(); continue; } const f = el.querySelector('.planning tbody tr.fait'); if (f) { f.remove(); continue; } break; } });
    /* pages 4 et 5 : l'estimation des hauteurs est prudente — lignes vides d'examens ajoutées tant qu'elles tiennent entièrement dans la page (17 lignes au plus par page) */
    wrap.querySelectorAll('.page.p3').forEach(el => { const tb = el.querySelector('table.examens tbody'); if (!tb) return;
      for (let k = 0; k < EXAMENS_SUITE && tb.rows.length < EXAMENS_SUITE && !deborde(el); k++) { tb.insertAdjacentHTML('beforeend', trExamen(null)); if (deborde(el)) { tb.lastElementChild.remove(); break; } } });
    /* recto de la carte (9 pt) : valeurs très longues ou police de remplacement → la spécialité, puis « diminue mes défenses » (déjà dit par le titre), sont retirées plutôt que rognées */
    wrap.querySelectorAll('.carte.recto').forEach(el => { ['.ct-spec', '.ct-def'].forEach(sel => { const x = el.querySelector(sel); if (x && deborde(el)) x.remove(); }); });
    wrap.querySelectorAll('.page.p4').forEach(el => { for (let k = 0; k < 20 && deborde(el); k++) { const p2 = dernier(el, '.items li[data-p="2"]'); if (p2) { p2.remove(); continue; } const o = dernier(el, '.alerte.orange .items li'); if (o) { o.remove(); continue; } const r = dernier(el, '.alerte.rouge .items li'); if (r) { r.remove(); continue; } const j = dernier(el, '.jamais .items li'); if (j) { j.remove(); continue; } break; } });
  };
  /* sans la police web (poste sans accès à Internet), la police de remplacement est plus large : corps réduit pour que chaque page tienne */
  R.carnetPatientPolices = () => {
    const chargee = () => { try { return [...document.fonts].some(f => f.family === 'IBM Plex Sans' && f.status === 'loaded'); } catch (e) { return true; } };
    /* l'ajustement (retrait de lignes) n'a lieu qu'une fois les polices chargées : avec la police de remplacement, plus large, une page peut déborder puis retrouver sa place */
    const appliquer = final => { const el = document.querySelector('.carnet-wrap.livret'); if (el) { el.classList.toggle('sans-police', !chargee()); if (final) R.carnetPatientAjuster(el); } };
    appliquer(!document.fonts);
    if (document.fonts) { if (!R.ui.carnetPolicesEcoute) { R.ui.carnetPolicesEcoute = true; document.fonts.addEventListener('loadingdone', () => appliquer(true)); } document.fonts.ready.then(() => setTimeout(() => appliquer(true), 50)); }
  };
})(window.RYZE);
