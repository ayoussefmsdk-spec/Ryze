/* =====================================================================
   Ryze — carnet.js : carnet patient bilingue (français / arabe) remis
   aux familles. Pages A5 (148 × 210 mm) construites depuis le dossier :
   page 1 informations, pages de planning (séances puis examens, autant
   que nécessaire), dernière page urgences et conseils. Contenu : R.LIVRET
   (livret-data.js). Route : R.pages.carnetPatient ; export : R.docExport.
   ===================================================================== */
'use strict';
(function (R) {
  const S = R.S, esc = R.esc;
  const L = () => R.LIVRET || {};
  /* ---------- helpers bilingues ---------- */
  const fr = v => typeof v === 'string' ? v : (v && v.fr) || '';
  const ar = v => typeof v === 'string' ? '' : (v && v.ar) || '';
  const ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;
  const LRI = '⁦', PDI = '⁩'; /* isolats LTR dans une phrase arabe (chiffres, heures) */
  /* remplit les {clés} d'un texte déjà échappé : valeur neutre isolée en LTR côté arabe, paire {fr, ar} selon la langue */
  const remplir = (s, vals, lang) => String(s).replace(/\{([a-zA-Z.]+)\}/g, (m, k) => { const v = vals && vals[k]; if (v == null) return m; if (typeof v === 'object') return esc(lang === 'ar' ? v.ar : v.fr); return lang === 'ar' ? ltr(v) : esc(v); });
  /* libellé bilingue sur une ligne : FR / AR */
  const bi = (v, cls, vals) => v ? `<span class="bi${cls ? ' ' + cls : ''}"><span class="fr">${remplir(esc(fr(v)), vals, 'fr')}</span>${ar(v) ? `<span class="sep">/</span><span class="ar" lang="ar" dir="rtl">${remplir(esc(ar(v)), vals, 'ar')}</span>` : ''}</span>` : '';
  /* phrase bilingue sur deux lignes : FR puis AR à droite */
  const bi2 = (v, cls, vals) => v ? `<div class="bi2${cls ? ' ' + cls : ''}"><div class="fr">${remplir(esc(fr(v)), vals, 'fr')}</div>${ar(v) ? `<div class="ar" lang="ar" dir="rtl">${remplir(esc(ar(v)), vals, 'ar')}</div>` : ''}</div>` : '';
  const fill = () => '<span class="fill"></span>';
  /* ligne « libellé : valeur » ; valeur : chaîne (échappée, ou LTR isolée), paire bilingue, ou vide (filet à compléter) */
  const champ = (label, val, o = {}) => `<div class="f${o.cls ? ' ' + o.cls : ''}"><span class="lab">${bi(label)}</span><span class="val${val ? '' : ' libre'}">${val ? (typeof val === 'object' ? bi(val) : o.html ? val : (o.ltr ? ltr(val) : esc(val))) : ''}</span></div>`;
  const titreBloc = (v, cls) => `<h3 class="bt${cls ? ' ' + cls : ''}">${bi(v)}</h3>`;
  const chk = () => '<span class="chk"></span>';
  const tel = v => v ? ltr(v) : '………';
  const telUrgTxt = v => v ? String(v).replace(/\s*\((?=[^)]*(?:urgence|24))[^)]*\)\s*$/i, '') : '………'; /* « 05 … (urgences 24 h/24) » : la parenthèse est déjà dans le texte du bloc */
  const telUrg = v => v ? ltr(telUrgTxt(v)) : '………';
  const suite = v => ({ fr: `${fr(v)} ${fr(L().suite)}`, ar: `${ar(v)} ${ar(L().suite)}` });
  const joindre = (a, b, sep) => ({ fr: `${fr(a)} ${sep || '→'} ${fr(b)}`, ar: `${ar(a)} ${sep === '·' ? '·' : '←'} ${ar(b)}` });
  const vide = v => v == null || String(v).trim() === '' || String(v).trim() === '—';
  const nb = v => String(v == null ? '' : v).replace('.', ',');
  /* forme plurielle arabe : 1, 2, 3–10, 11 et plus */
  const plur = (T, n) => { const t = n === 1 ? T.un : n === 2 ? T.deux : n <= 10 ? T.peu : T.beaucoup; return t ? { fr: fr(t).replace('{n}', n), ar: ar(t).replace('{n}', LRI + n + PDI) } : null; };

  /* ---------- contexte du dossier ---------- */
  function contexte(p) {
    const pr = R.proto(p.protocoleId) || {}, t = R.today(), s = S.settings || {};
    const sch = R.schemaPatient(p);
    const voies = [...new Set(String(pr.voie || '').split(/\s*(?:puis|,|\/)\s*/).map(v => v.trim()).filter(Boolean))];
    const prochaine = R.prochaineCure(p), derniere = R.derniereCure(p);
    const voieCourante = (prochaine && prochaine.voie) || (sch.actuel && sch.actuel.voie) || voies[0] || 'IV';
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
    const poids = (R.dernierPoids(p) || {}).poids || +sch.poids || +p.poids || null;
    const dci = String(pr.dci || '').split(' — ')[0];
    const translit = (L().translit || {})[dci.toLowerCase().split(/\s/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '')];
    const dciBi = { fr: dci, ar: translit || '' }; /* nom latin côté FR, translittération côté AR */
    return { p, pr, t, s, sch, voies, voieCourante, prochaine, derniere, classe, associe, sexe, ageN, garde, filtreTexte, items, poids, dci, dciBi, maladie: (L().p1.maladies || {})[p.pathologie] || { fr: (R.PATHOS[p.pathologie] || {}).label || p.pathologie || '', ar: '' } };
  }
  /* rythme d'entretien actuel : « Toutes les N semaines », « Tous les N jours », « 1 fois par jour » */
  const rythmeBi = c => { const a = c.sch.actuel, T = L().p1.rythmes; if (!a || !T) return null; const po = (a.doseType || (c.sch.pr.entretien || {}).doseType || c.sch.pr.doseType) === 'po'; if (po) return /×\s*2|x\s*2|2\s*fois|\b2\/j/i.test(a.texte || '') ? T.po2 : T.po1; const j = +a.intervalleJours || 0; if (!j) return null; return j % 7 === 0 ? plur(T.semaines, j / 7) : plur(T.jours, j); };
  /* dose d'entretien : celle de la prochaine séance d'entretien planifiée (ce qui sera réellement donné), sinon calculée sur la posologie actuelle et le dernier poids, sinon celle de la prochaine ou dernière séance */
  const doseTxt = c => { const pe = (c.p.cures || []).find(x => x.statut === 'prevue' && x.phase === 'Entretien' && x.doseTexte && !/poids|préciser/i.test(x.doseTexte)); if (pe) return pe.doseTexte; const a = c.sch.actuel; if (a && c.sch.pr && c.sch.pr.entretien) { try { const d = R.doseEtape(Object.assign({}, c.sch.pr, { entretien: a }), a, c.poids || 0, 'entretien'); if (d && d.texte && !/à préciser/.test(d.texte) && (c.poids || d.dose == null)) return d.texte; } catch (e) {} } return (c.prochaine && c.prochaine.doseTexte) || (c.derniere && c.derniere.doseTexte) || ''; };
  const commentBi = c => { const V = L().p1.voies || {}; const l = c.voies.map(v => V[v]).filter(Boolean); if (!l.length) return { fr: c.pr.voie || '', ar: '' }; return l.length === 1 ? l[0] : joindre(l[0], l[1]); };
  /* horaires de l'hôpital de jour : « Du lundi au vendredi, de 08:00 à 16:00 » (jours contigus) ou liste des jours */
  const horairesBi = () => { const h = R.hdj() || {}, J = L().p1.jours || {}; const ordre = [1, 2, 3, 4, 5, 6, 0]; const jours = [...new Set(h.jours || [])].sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b)); const noms = jours.map(d => J[d]).filter(Boolean); if (!noms.length) return null;
    const idx = jours.map(d => ordre.indexOf(d)); const contigu = noms.length >= 3 && idx.every((x, i) => i === 0 || x === idx[i - 1] + 1); const T = contigu ? L().p1.horairesDuAu : L().p1.horairesListe; if (!T) return null;
    const liste = lang => lang === 'fr' ? noms.map(x => x.fr).join(', ').replace(/, ([^,]*)$/, ' et $1') : noms.map(x => x.ar).join(' و');
    const f = lang => String(T[lang]).replace('{a}', noms[0][lang]).replace('{b}', noms[noms.length - 1][lang]).replace('{jours}', liste(lang)).replace('{h1}', lang === 'ar' ? LRI + (h.ouverture || '') + PDI : (h.ouverture || '')).replace('{h2}', lang === 'ar' ? LRI + (h.fermeture || '') + PDI : (h.fermeture || ''));
    return { fr: f('fr'), ar: f('ar') }; };
  const dureeBi = c => { const T = L().p1.heures; const m = c.pr.dureeSeanceMin != null ? +c.pr.dureeSeanceMin : 180; if (!T || !(m > 0) || !c.voies.includes('IV')) return null; return plur(T, Math.max(1, Math.round(m / 60))); };
  const nomPatient = p => `${esc(p.prenom || '')} <b>${esc(p.nom || '')}</b>`;
  const enTete = (c, n, N, droite) => `<div class="run"><span>${nomPatient(c.p)} · ${bi(L().dossierNo)} ${ltr(c.p.ipp || '')} · ${esc(c.dci)} ${esc(c.voieCourante)}</span><span>${droite}</span><span class="num">${fr(L().page)} ${n}/${N}</span></div>`;
  const piedTech = c => `${esc(c.s.etablissement || '')}${c.s.unite ? ' · ' + esc(c.s.unite) : ''} · imprimé le ${R.fmtDate(c.t)} par Ryze`;

  /* ---------- page 1 : informations ---------- */
  function page1(c, n, N) {
    const Lv = L(), P1 = Lv.p1, p = c.p, s = c.s; const moi = P1.moi, par = P1.parents, mal = P1.maladie, trt = P1.traitement, equ = P1.equipe;
    const sexeLib = c.sexe === 'F' ? (c.ageN != null && c.ageN < 18 ? P1.sexe.fille : P1.sexe.F) : (c.ageN != null && c.ageN < 18 ? P1.sexe.garcon : P1.sexe.M);
    const ddn = p.ddn ? `${R.ddnTxt(p)} (${R.ageTxt(p.ddn)})` : '';
    const pi = R.poidsInitial(p), pd = R.dernierPoids(p); const poidsTxt = pd && pi && pd.poids !== pi ? `${nb(pi)} kg · ${nb(pd.poids)} kg (${R.fmtDate(pd.date)})` : (pi || pd ? `${nb(pi || pd.poids)} kg` : '');
    const allergies = vide(p.allergies) ? (p.allergies === '—' ? P1.allergiesAucune : '') : p.allergies;
    const premed = p.premedication || (p.cures.filter(x => x.premedication && x.premedication !== 'Aucune').slice(-1)[0] || {}).premedication || '';
    const dateDiag = p.dateDiag && !isNaN(R.parse(p.dateDiag)) ? R.fmtDate(p.dateDiag, { month: '2-digit', year: 'numeric' }) : '';
    const horaires = horairesBi(); const long = (String(allergies && allergies.fr ? '' : allergies || '').length + String(vide(p.traitementsAssocies) ? '' : p.traitementsAssocies).length + String(c.voies.includes('IV') ? premed : '').length + String(p.specialite || '').length) > 110; /* valeurs longues : l'encadré urgence (repris en dernière page) cède la place */
    return `<section class="page p1">
      <header class="band">
        <div class="band-l"><div class="titre">${bi(Lv.titre)}</div><div class="sous">${bi(Lv.sousTitre)}</div>
          <div class="etab">${esc(s.etablissement || '')}${s.service ? ' · ' + esc(s.service) : ''}<br>${esc(s.unite || '')}</div></div>
        <div class="etiquette"><span>${bi(Lv.etiquette)}</span></div>
      </header>
      <div class="nom-band"><div class="nom">${nomPatient(p)} <span class="ipp">${bi(Lv.dossierNo)} ${ltr(p.ipp || '')}</span></div>
        <div class="remis"><span>${bi(Lv.remisLe)} <b>${ltr(R.fmtDate(c.t))}</b></span><span>${bi(Lv.remisPar)} ${fill()}</span><span>${bi(Lv.carnetNo)} ${chk()}1 ${chk()}2 ${chk()}3</span></div></div>
      <div class="cols">
        <div class="col">
          ${titreBloc(moi.titre)}
          ${champ(moi.nom, p.nom)}${champ(moi.prenom, p.prenom)}${champ(moi.ddn, ddn, { ltr: true })}${champ(moi.sexe, sexeLib)}${champ(moi.dossier, p.ipp, { ltr: true })}${champ(P1.ecole, '')}
          ${champ(moi.poids, poidsTxt, { ltr: true })}${champ(moi.taille, p.taille ? `${nb(p.taille)} cm` : '', { ltr: true })}${champ(moi['groupe-sanguin'], '')}${champ(moi.allergies, allergies)}
          ${titreBloc(par.titre)}
          ${champ(par.nom, '')}${champ(par.lien, '')}${champ(par.tel, p.tel, { ltr: true })}${champ(par.autreTel, '')}
          ${titreBloc(equ.titre)}
          ${champ(equ.medecin, R.userName(p.medecinId) === '—' ? '' : R.userName(p.medecinId))}${s.chef ? champ(equ.chef, s.chef) : ''}${champ(equ['hdj-tel'], s.telHDJ, { ltr: true })}${champ(equ['hdj-horaires'], horaires)}
        </div>
        <div class="col">
          ${titreBloc(mal.titre)}
          ${champ(mal['maladie-nom'], c.maladie)}${champ(mal['date-diag'], dateDiag, { ltr: true })}
          ${titreBloc(trt.titre)}
          ${champ(trt['tt-nom'], c.dciBi)}${champ(trt['tt-boite'], p.specialite || '')}${champ(trt['tt-comment'], commentBi(c))}${champ(trt['tt-rythme'], rythmeBi(c) || '')}${champ(trt['tt-dose'], doseTxt(c), { ltr: true })}${champ(trt['tt-debut'], R.fmtDate(R.j0(p) || p.dateDebut), { ltr: true })}${c.voies.includes('IV') && premed ? champ(trt['tt-premed'], premed) : ''}${champ(trt['tt-autres'], vide(p.traitementsAssocies) ? '' : p.traitementsAssocies)}
          <div class="apporte">${bi(P1.apporte)} ${bi(P1.apporteListe)}</div>
        </div>
      </div>
      ${long ? '' : `<div class="urg">${bi(P1.urgence.titre, 'titre-urg')} ${bi2(P1.urgence.texte)}</div>`}
      <footer class="pied"><span class="lv-bandeau">${bi(P1.piedApporter)}</span><span class="maq">${piedTech(c)}</span><span class="num">${fr(Lv.page)} ${n}/${N}</span></footer>
    </section>`;
  }

  /* ---------- lignes du planning ---------- */
  const SEANCES_PAR_PAGE = 14, EXAMENS_PAR_PAGE = 8;
  function lignesSeances(c) {
    const cures = (c.p.cures || []).filter(x => x.statut !== 'annulee');
    const faites = cures.filter(x => x.statut === 'realisee').sort((a, b) => String(a.dateReelle || a.datePrevue).localeCompare(String(b.dateReelle || b.datePrevue))).slice(-3);
    const prevues = cures.filter(x => x.statut === 'prevue').sort((a, b) => String(a.datePrevue).localeCompare(String(b.datePrevue)));
    return [...faites, ...prevues];
  }
  const EXAMENS_IDS = { biostd: 'biostd', nfs: 'nfs', crp: 'crp', calpro: 'calpro', tdm: 'tdm', actnf: 'actnf', lip: 'lip', colo: 'colo', endo: 'colo', fogd: 'fibro', recto: 'recto', irm: 'irm', echo: 'echo', rxt: 'rxt', igra: 'igra', derm: 'peau', fcu: 'frottis', vacc: 'vacc', bh: 'foie', creat: 'reins' };
  const libelleExamen = x => { const E = L().p3.examens || {}; let id = EXAMENS_IDS[x.id]; if (x.id === 'vit' && /vitamine\s*D\b/i.test((x.nom || '') + ' ' + (x.label || ''))) id = 'vit'; return (id && E[id]) || { fr: x.label || x.id || '', ar: '' }; };
  function lignesExamens(c) {
    return (c.p.surveillance || []).filter(x => x.mode === 'echeance' && x.statut === 'prevue' && x.echeance && x.echeance >= c.t).sort((a, b) => a.echeance.localeCompare(b.echeance));
  }
  const chunk = (arr, taille) => { const out = []; for (let i = 0; i < arr.length; i += taille) out.push(arr.slice(i, i + taille)); return out; };
  /* hauteur estimée d'une ligne d'examen (mm) : libellé FR sur ~38 caractères par ligne, AR sur ~42, 7,4 mm au minimum */
  const hauteurExamen = x => { const l = libelleExamen(x); const nf = Math.ceil(fr(l).length / 38) || 1, na = Math.ceil(ar(l).length / 42); return Math.max(7.4, 1.4 + nf * 2.6 + na * 2.9); };
  const EXAMENS_HAUTEUR = 66; /* 8 lignes de 7,4 mm + marge */
  const chunkExamens = rows => { const out = []; let cur = [], h = 0; rows.forEach(x => { const hx = hauteurExamen(x); if (cur.length && (cur.length >= EXAMENS_PAR_PAGE || h + hx > EXAMENS_HAUTEUR)) { out.push(cur); cur = []; h = 0; } cur.push(x); h += hx; }); if (cur.length || !out.length) out.push(cur); return out; };
  const completerExamens = rows => { const liste = rows.slice(); let h = rows.reduce((a, x) => a + hauteurExamen(x), 0); while (liste.length < EXAMENS_PAR_PAGE && h + 7.4 <= EXAMENS_HAUTEUR + 0.1) { liste.push(null); h += 7.4; } return liste; };

  /* ---------- traitements antérieurs (en tête de la première page de séances) ---------- */
  function blocRetro(c) {
    const T = L().p2.retro; const L0 = R.retroCycles(c.p); if (!L0.length || !T) return { html: '', lignes: 0 };
    /* carnet remis à la famille : médicament et période seulement (nombre de séances, motif d'arrêt et remarques restent dans le carnet professionnel) */
    const rows = L0.slice(0, 6).map(h => { const pr = R.proto(h.protocoleId) || {}; return `<tr><td><b>${esc(String(pr.dci || h.protocoleId || '').split(' — ')[0])}</b>${h.specialite ? ` <span class="pre">(${esc(h.specialite)})</span>` : ''}</td><td class="c">${ltr(R.fmtDate(h.dateDebut))}${h.dateFin ? ` → ${ltr(R.fmtDate(h.dateFin))}` : ''}</td></tr>`; }).join('');
    return { html: `<h3 class="bt retro-t">${bi(T.titre)}</h3><table class="lv-tab retro"><thead><tr><th>${bi(T.medicament)}</th><th>${bi(T.periode)}</th></tr></thead><tbody>${rows}</tbody></table>`, lignes: Math.min(6, L0.length) + 2 };
  }

  /* ---------- pages de séances ---------- */
  function pageSeances(c, rows, n, N, o) {
    const Lv = L(), P2 = Lv.p2, col = P2.cols, th = k => `<th>${bi(col[k])}</th>`; const mixte = c.voies.length > 1;
    const tr = x => x ? `<tr class="${x.statut === 'realisee' ? 'fait' : 'prevu'}"><td class="c">${esc(x.n)}<br><small>${esc(x.label || '')}</small></td><td class="c d">${ltr(R.fmtDate(x.datePrevue))}${x.voie === 'IV' && x.heure ? `<br><small>${ltr(x.heure)}</small>` : mixte && x.voie ? `<br><small>${esc(x.voie)}</small>` : ''}</td><td class="d">${x.statut === 'realisee' ? `<span class="pre">${ltr(R.fmtDate(x.dateReelle || x.datePrevue))}</span>` : ''}</td><td class="c">${x.statut === 'realisee' ? `<span class="pre">${esc(x.dose ? x.dose + ' mg' : x.doseTexte || '')}</span>` : `<span class="prevu-dose">${esc(x.doseTexte || '')}</span>`}</td><td>${x.statut === 'realisee' && x.poids ? `<span class="pre">${esc(nb(x.poids))} kg</span>` : ''}</td><td>${x.statut === 'realisee' ? `<span class="pre mono">${esc(x.lot || '')}</span>` : ''}</td><td class="c">${x.statut === 'realisee' ? '<span class="coche">✓</span>' : chk()}</td><td>${x.statut === 'realisee' && /^bonne tolérance/i.test(x.tolerance || '') ? '<span class="pre">Bonne tolérance</span>' : ''}</td><td class="sig">${x.statut === 'realisee' && x.ide ? `<span class="pre sig-pre">${esc(R.userName(x.ide))}</span>` : ''}</td></tr>` : `<tr class="blanc"><td class="c"></td><td></td><td></td><td></td><td></td><td></td><td class="c">${chk()}</td><td></td><td class="sig"></td></tr>`;
    const liste = rows.slice(); while (liste.length < o.capacite) liste.push(null);
    const duree = dureeBi(c); const sc = c.voies.includes('SC'), iv = c.voies.includes('IV');
    /* trois rappels au plus : IV = temps sur place, retard ; SC = oubli, stylos au frais ; IV puis SC = temps sur place, oubli ; puis « Avant de venir » */
    const avant = champ(P2.avantDeVenir.label, { fr: fr(P2.avantDeVenir.texte).replace(/page 4\b/, 'page ' + N), ar: ar(P2.avantDeVenir.texte).replace(/4(?=\))/, LRI + N + PDI) });
    const infos = (iv && sc ? [champ(P2.injections.oubli.titre, P2.injections.oubli.texte)] : iv ? [duree ? champ(P2.dureeSurPlace, duree) : '', champ(P2.retard.label, P2.retard.texte)] : sc ? [champ(P2.injections.oubli.titre, P2.injections.oubli.texte), `<div class="f"><span class="val">${bi(P2.injections.frigo)}</span></div>`] : []).concat(avant).join('');
    return `<section class="page p2">${enTete(c, n, N, bi(P2.enTete))}
      <div class="titre-page"><h2>${bi(o.premiere ? P2.titre : suite(P2.titre))}</h2><span class="sous">${bi(P2.sousTitre)}</span></div>
      ${o.retro || ''}
      <div class="aide"><b>${bi(P2.aideCocher)}</b> <div class="legende">${bi(P2.legende)}</div></div>
      <table class="lv-tab seances"><thead><tr>${th('n')}${th('datePrevue')}${th('dateFaite')}${th('dose')}${th('poids')}${th('lot')}${th('fait')}${th('tolerance')}${th('visa')}</tr></thead><tbody>${liste.map(tr).join('')}</tbody></table>
      <div class="sous-tab">
        <div class="callout-hdj"><b>${bi(P2.report.titre)}</b> ${bi2(P2.report.texte)}<div class="tel">${bi(P2.report.tel)} : <b>${tel(c.s.telHDJ)}</b>${horairesBi() ? ' · ' + bi(horairesBi()) : ''}</div></div>
        <div class="infos-seance">${infos}</div>
      </div>
      <footer class="pied"><span>${bi(P2.aideDates)}</span><span class="num">${fr(Lv.page)} ${n}/${N}</span></footer>
    </section>`;
  }

  /* ---------- pages d'examens ---------- */
  function pageExamens(c, rows, n, N, o) {
    const Lv = L(), P3 = Lv.p3, col = P3.cols, th = k => `<th>${bi(col[k])}</th>`; const p = c.p;
    const tr = x => x ? `<tr class="prevu"><td class="ex">${bi(libelleExamen(x))}</td><td class="c d">${ltr(R.fmtDate(x.echeance))}</td><td></td><td class="c">${chk()}</td><td class="c">${chk()}</td><td class="sig"></td></tr>` : `<tr class="blanc"><td class="ex"></td><td></td><td></td><td class="c">${chk()}</td><td class="c">${chk()}</td><td class="sig"></td></tr>`;
    const liste = completerExamens(rows);
    let bas;
    if (o.derniere) {
      const pc = c.prochaine; const quoi = pc ? (pc.voie === 'IV' ? P3.rdv.quoi.perfusionHDJ : pc.voie === 'SC' ? L().p1.voies.SC : L().p1.voies.PO) : null;
      const rdvRows = [pc ? { date: R.fmtDate(pc.datePrevue), heure: pc.voie === 'IV' ? pc.heure || '' : '', quoi, lieu: pc.voie === 'IV' ? c.s.unite || '' : '' } : null, null, null];
      const trr = r => `<tr>${r ? `<td class="c">${ltr(r.date)}</td><td class="c">${ltr(r.heure)}</td><td>${bi(r.quoi)}</td><td>${esc(r.lieu)}</td><td class="c">${chk()}</td>` : `<td></td><td></td><td></td><td></td><td class="c">${chk()}</td>`}</tr>`;
      const verso = (Lv.p4.carte.verso || {}).items || []; const it = i => verso[i] || { fr: '', ar: '' };
      bas = `<h3 class="bt mt">${bi(P3.rdv.titre)}</h3>
      <table class="lv-tab rdv"><thead><tr>${['date', 'heure', 'quoi', 'lieu', 'fait'].map(k => `<th>${bi(P3.rdv.cols[k])}</th>`).join('')}</tr></thead><tbody>${rdvRows.map(trr).join('')}</tbody></table>
      <div class="bas3">
        <div class="conseils"><h3 class="bt">${bi(P3.conseils.titre)}</h3>${P3.conseils.items.filter(i => (i.p || 1) <= 2 && !/Rapportez tous/.test(fr(i))).map(i => `<div class="li">${bi2(i)}</div>`).join('')}</div>
        <div class="carte verso"><div class="carte-in"><div class="ct">${bi(P3.versoCarte)}</div>
          ${champ(it(0), `${p.prenom || ''} ${p.nom || ''}`)}${champ(it(1), p.ipp, { ltr: true })}${champ(it(2), c.maladie)}${champ(it(3), R.fmtDate(R.j0(p) || p.dateDebut), { ltr: true })}${champ(it(4), R.userName(p.medecinId) === '—' ? '' : R.userName(p.medecinId))}
          <div class="ct-note">${bi2(it(5))}</div></div></div>
      </div>`;
    } else bas = blocQuestions();
    return `<section class="page p3">${enTete(c, n, N, bi(Lv.p2.enTete))}
      <div class="titre-page"><h2>${bi(o.premiere ? P3.titre : suite(P3.titre))}</h2><span class="sous">${bi(P3.intro)}</span></div>
      <table class="lv-tab examens"><thead><tr>${th('examen')}${th('quand')}${th('fait')}${th('coche')}${th('resultatVu')}${th('visa')}</tr></thead><tbody>${liste.map(tr).join('')}</tbody></table>
      ${bas}
      <footer class="pied"><span>${bi(P3.conseils.items[3])}</span><span class="num">${fr(Lv.page)} ${n}/${N}</span></footer>
    </section>`;
  }
  const blocQuestions = () => `<div class="questions"><h3 class="bt mt">${bi(L().p3.questions.titre)}</h3><div class="q-sous">${bi(L().p3.questions.texte)}</div><div class="lignes"></div></div>`;
  function pageNotes(c, n, N) { return `<section class="page p3 notes">${enTete(c, n, N, bi(L().p2.enTete))}${blocQuestions()}<footer class="pied"><span>${bi(L().p3.conseils.items[3])}</span><span class="num">${fr(L().page)} ${n}/${N}</span></footer></section>`; }

  /* ---------- dernière page : urgences et conseils ---------- */
  function pageUrgences(c, n, N) {
    const Lv = L(), P4 = Lv.p4, p = c.p, s = c.s;
    const items = (arr, cls) => `<ul class="items${cls ? ' ' + cls : ''}">${arr.map(i => `<li>${bi(i)}</li>`).join('')}</ul>`;
    const rouge = c.items(P4.rouge.items).slice(0, 6);
    const orange = c.items(P4.orange.items).filter(i => (i.p || 1) <= 1 || /Zona/.test(fr(i)));
    const jamais = c.items(P4.jamais.items).slice(0, 5);
    const avant = c.items(P4.avant.items); const cases = avant.filter(i => /^☐/.test(fr(i))), regles = avant.filter(i => !/^☐/.test(fr(i)) && !/^Pendant la perfusion/i.test(fr(i)));
    const ci = P4.carte.recto.items || [], ciVal = i => ci[i] || { fr: '', ar: '' };
    const marque = p.specialite ? esc(p.specialite) : `${bi(P4.marque)} <span class="fill" style="display:inline-block;width:16mm;flex:none"></span>`;
    const numeros = `<div class="nums grille">${bi(P4.rouge.sousTitre, '', { 'settings.telUrgences': telUrgTxt(s.telUrgences) })}</div>`;
    const horaires = horairesBi();
    return `<section class="page p4">
      <div class="run"><span>${bi(P4.titre)}</span><span>${nomPatient(p)} · ${ltr(p.ipp || '')}</span><span class="num">${fr(Lv.page)} ${n}/${N}</span></div>
      <div class="alerte rouge"><div class="al-t"><span class="ico oct">!</span>${bi(P4.rouge.titre)}</div>${numeros}${items(rouge)}</div>
      <div class="alerte orange"><div class="al-t"><span class="ico tri">!</span>${bi(P4.orange.titre)}</div><div class="nums"><span>${bi(P4.hdj)} <b>${tel(s.telHDJ)}</b>${horaires ? ' · ' + bi(horaires) : ''} · ${bi(P4.sinonUrgences)}</span></div>${items(orange)}</div>
      <div class="jamais"><h3 class="bt"><span class="ico non"></span>${bi(P4.jamais.titre)}</h3>${items(jamais)}</div>
      <div class="avant"><h3 class="bt">${bi(P4.avant.titreCourt)}</h3><ul class="items cases">${cases.map(i => `<li class="case">${chk()}${bi({ fr: fr(i).replace(/^☐\s*/, ''), ar: ar(i) })}</li>`).join('')}</ul>${regles.slice(0, 1).map(i => `<div class="regle grille">${bi(i)}</div>`).join('')}</div>
      <div class="bas4">
        <div class="carte recto"><div class="ciseaux">✂</div><div class="carte-in"><div class="ct">${bi(P4.carte.recto.titre)}</div>
          <div class="f"><span class="lab">${bi(ciVal(0))}</span><span class="val">${bi(c.dciBi)} · ${marque}</span></div>
          <div class="ct-l grille">${bi(ciVal(1))}</div><div class="ct-l grille">${bi(ciVal(2))}</div><div class="ct-l grille">${bi(ciVal(3))}</div>
          <div class="f"><span class="lab">${bi(ciVal(4))}</span><span class="val">${tel(s.telHDJ)}</span></div><div class="f"><span class="lab">${bi(ciVal(5))}</span><span class="val">${telUrg(s.telUrgences)}</span></div></div></div>
        <div class="droite">
          <h3 class="bt">${bi(P4.numeros.titre)}</h3>${(P4.numeros.items || []).map(i => champ(i, '')).join('')}${champ(P4.notes, '')}
        </div>
      </div>
      <footer class="pied p4-pied"><span class="grille">${bi(P4.pied.avis)}</span><span class="maq">imprimé le ${R.fmtDate(c.t)} par Ryze · ${fr(Lv.page)} ${n}/${N}</span></footer>
    </section>`;
  }

  /* ---------- assemblage : pages dans l'ordre, nombre arrondi au multiple de 4 (feuilles A4 pliées) ---------- */
  R.carnetPatientPages = function (p) {
    const c = contexte(p); const retro = blocRetro(c);
    const seances = lignesSeances(c); const capacite1 = Math.max(4, SEANCES_PAR_PAGE - retro.lignes);
    const chunksS = seances.length <= capacite1 ? [seances] : [seances.slice(0, capacite1), ...chunk(seances.slice(capacite1), SEANCES_PAR_PAGE)];
    const chunksE = chunkExamens(lignesExamens(c));
    let total = 1 + chunksS.length + chunksE.length + 1; const pad = (4 - total % 4) % 4; let notes = 0;
    if (pad >= 1) chunksS.push([]); if (pad >= 2) chunksE.push([]); if (pad >= 3) notes = 1; total += pad;
    const pages = [(n, N) => page1(c, n, N)];
    chunksS.forEach((rows, i) => pages.push((n, N) => pageSeances(c, rows, n, N, { premiere: i === 0, retro: i === 0 ? retro.html : '', capacite: i === 0 ? capacite1 : SEANCES_PAR_PAGE })));
    if (notes) pages.push((n, N) => pageNotes(c, n, N));
    chunksE.forEach((rows, i) => pages.push((n, N) => pageExamens(c, rows, n, N, { premiere: i === 0, derniere: i === chunksE.length - 1 })));
    pages.push((n, N) => pageUrgences(c, n, N));
    const N = pages.length; return pages.map((f, i) => f(i + 1, N));
  };
  /* document complet : vue A5 (pages, double pages intérieures) ou feuilles A4 recto-verso (imposition) */
  R.carnetPatientHTML = function (p, o) {
    o = o || {}; const pages = R.carnetPatientPages(p); const N = pages.length; const a4 = !!o.a4;
    let corps;
    if (a4) {
      const feuilles = []; for (let k = 0; k < N / 4; k++) { const r1 = N - 2 * k, r2 = 2 * k + 1, v1 = 2 * k + 2, v2 = N - 2 * k - 1; feuilles.push(`<div class="lab-page">Feuille ${k + 1} — recto (page ${r1} · page ${r2})</div><div class="sheet">${pages[r1 - 1]}${pages[r2 - 1]}</div><div class="lab-page">Feuille ${k + 1} — verso (page ${v1} · page ${v2})</div><div class="sheet">${pages[v1 - 1]}${pages[v2 - 1]}</div>`); }
      corps = `<div class="imposition">${feuilles.join('')}</div>`;
    } else {
      const blocs = [`<div class="lab-page">Page 1 — informations</div><div class="solo">${pages[0]}</div>`];
      for (let i = 1; i < N - 1; i += 2) blocs.push(`<div class="lab-page">Pages ${i + 1} et ${i + 2} — planning de suivi</div><div class="spread">${pages[i]}${pages[i + 1]}</div>`);
      blocs.push(`<div class="lab-page">Page ${N} — urgences et conseils</div><div class="solo">${pages[N - 1]}</div>`);
      corps = `<div class="pages">${blocs.join('')}</div>`;
    }
    return `<div class="carnet-wrap livret${a4 ? ' a4' : ''}" data-pages="${N}"><style>${R.carnetPatientCSS(a4)}</style>${corps}</div>`;
  };

  /* ---------- feuille de style du carnet (préfixe .livret ; @page du format choisi) ---------- */
  R.carnetPatientCSS = a4 => `
.livret{--lv-ink:#182421;--lv-ink2:#4E5E59;--lv-ar:#1F3B57;--lv-acc:#1C6B62;--lv-acc-t:#E2F0ED;--lv-line:#B9C6C2;--lv-soft:#EEF3F1;--lv-rouge:#B3261E;--lv-rouge-t:#FBE9E7;--lv-orange:#C76E00;--lv-orange-t:#FFF1DF;--lv-gris:#7E8C88;color-scheme:light}
.livret *{box-sizing:border-box}
.livret .page{width:148mm;height:210mm;padding:5.5mm 7mm 5mm;background:#fff;color:var(--lv-ink);font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:7.2pt;line-height:1.3;position:relative;overflow:hidden;display:flex;flex-direction:column;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.livret table{color:inherit}
.livret.sans-police .page{font-size:6.3pt}.livret.sans-police .p1 .urg{display:none}.livret.sans-police .p4 .items li{font-size:5.5pt;line-height:1.08}.livret.sans-police .p4 .nums,.livret.sans-police .p4 .regle{font-size:5.7pt}.livret.sans-police .p4 .alerte{padding-top:.3mm;padding-bottom:.2mm} /* police web absente (poste hors ligne) : corps réduit et encadré urgence de la page 1 (repris en dernière page) retiré, la police de remplacement est plus large */
.livret .ar{font-family:'IBM Plex Sans Arabic','IBM Plex Sans',sans-serif;color:var(--lv-ar);font-size:1.12em;unicode-bidi:isolate}
.livret .bi .sep{color:var(--lv-gris);margin:0 .35em;font-weight:400}
.livret .bi2 .ar{display:block;text-align:right;margin-top:.15mm}
.livret .bi2 .fr{display:block}
.livret bdi{unicode-bidi:isolate}
.livret b,.livret strong{font-weight:600}
.livret .page h2{font-size:11pt;font-weight:600;margin:0;line-height:1.2;text-wrap:initial}
.livret .page h2 .ar{font-size:1.05em}
.livret .bt{font-size:7.4pt;font-weight:600;margin:1.3mm 0 .6mm;padding:0 0 .3mm;border-bottom:.35pt solid var(--lv-acc);color:var(--lv-acc);text-transform:none;display:flex;align-items:center;gap:1mm;text-wrap:initial}
.livret .bt.mt{margin-top:2mm}
.livret .p4{padding-top:4.5mm;padding-bottom:4.4mm}
.livret .p4 .bt{margin:.6mm 0 .25mm}
.livret .f{display:flex;flex-wrap:wrap;gap:0 1.5mm;padding:.4mm 0;border-bottom:.25pt dotted var(--lv-line);align-items:baseline;min-height:3.4mm}
.livret .f .lab{flex:0 1 auto;color:var(--lv-ink2)}
.livret .f .val{flex:1 1 18mm;font-weight:500}
.livret .f .val.libre{border-bottom:0}
.livret .fill{display:inline-block;min-width:14mm;border-bottom:.3pt solid var(--lv-ink2);height:1em;vertical-align:baseline;flex:1}
.livret .f .val .fill{width:100%}
.livret .chk{display:inline-block;width:3.6mm;height:3.6mm;border:.45pt solid var(--lv-ink);border-radius:.5mm;vertical-align:-0.8mm;margin-right:.6mm;background:#fff}
.livret .coche{font-weight:700;color:var(--lv-acc);font-size:9pt}
.livret .pre{color:var(--lv-gris);font-style:italic}
.livret .mono{font-family:'IBM Plex Mono',monospace;font-style:normal;font-size:.95em}
.livret .num{color:var(--lv-gris)}
.livret .pied{margin-top:auto;padding-top:.7mm;border-top:.35pt solid var(--lv-line);display:flex;justify-content:space-between;gap:3mm;align-items:flex-end;font-size:6.2pt;color:var(--lv-ink2);line-height:1.25}
.livret .pied .maq{color:var(--lv-gris);font-size:5.8pt;text-align:right;max-width:70mm}
.livret .p4-pied{font-size:5.9pt;line-height:1.2}
.livret .p4-pied .grille{flex:1 1 auto}
.livret .p4-pied .maq{flex:0 0 42mm}
.livret .run{display:flex;justify-content:space-between;gap:3mm;font-size:6.4pt;color:var(--lv-ink2);border-bottom:.35pt solid var(--lv-line);padding-bottom:.5mm;margin-bottom:1.1mm}
.livret .band{display:flex;gap:3mm;align-items:stretch}
.livret .band .titre{font-size:13pt;font-weight:700;line-height:1.15;color:var(--lv-acc)}
.livret .band .titre .ar{font-size:.95em}
.livret .band .sous{font-size:7.2pt;margin-top:.4mm;font-weight:500}
.livret .band .etab{font-size:6.6pt;color:var(--lv-ink2);margin-top:1mm;line-height:1.35}
.livret .etiquette{flex:0 0 46mm;height:22mm;border:.4pt dashed var(--lv-gris);border-radius:1mm;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--lv-gris);font-size:6.4pt;padding:2mm}
.livret .nom-band{margin:1.6mm 0 1mm;padding:1.2mm 2mm;background:var(--lv-acc-t);border-radius:1mm;display:flex;flex-direction:column;gap:.6mm}
.livret .nom-band .nom{font-size:11pt;font-weight:500}
.livret .nom-band .nom .ipp{font-size:7pt;color:var(--lv-ink2);margin-left:2mm;font-weight:400}
.livret .nom-band .remis{font-size:6.6pt;color:var(--lv-ink2);display:flex;gap:4mm;align-items:baseline;white-space:nowrap}
.livret .nom-band .remis .fill{min-width:20mm;flex:0 0 auto;display:inline-block}
.livret .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 4mm;align-items:start}
.livret .p1 .bt:first-child{margin-top:0}
.livret .apporte{margin-top:1.6mm;padding:1.2mm 1.6mm;background:var(--lv-soft);border-radius:.8mm;font-size:6.6pt;line-height:1.35}
.livret .urg{margin-top:1.4mm;padding:1mm 2mm;border:.5pt solid var(--lv-rouge);border-left:1.6mm solid var(--lv-rouge);border-radius:.8mm;background:var(--lv-rouge-t);font-size:6.8pt}
.livret .urg .titre-urg{font-weight:700;color:var(--lv-rouge)}
.livret .pied .lv-bandeau{font-weight:600;color:var(--lv-acc);font-size:7.4pt}
.livret .titre-page{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;margin-bottom:1mm}
.livret .titre-page .sous{font-size:6.6pt;color:var(--lv-ink2);text-align:right;max-width:75mm}
.livret .aide{display:flex;justify-content:space-between;gap:3mm;font-size:6.6pt;margin:.6mm 0 1.2mm;align-items:baseline}
.livret .legende{color:var(--lv-ink2)}
.livret .lv-tab{width:100%;border-collapse:collapse;table-layout:fixed}
.livret .lv-tab th{font-size:6.2pt;font-weight:600;text-align:left;padding:.8mm .8mm;background:var(--lv-soft);border:.3pt solid var(--lv-line);vertical-align:bottom;line-height:1.2;text-transform:none;letter-spacing:0;color:var(--lv-ink);white-space:normal}
.livret .lv-tab th .ar{display:block;font-size:1.05em}
.livret .lv-tab th .sep{display:none}
.livret .lv-tab td{border:.3pt solid var(--lv-line);padding:.5mm .8mm;height:8.2mm;vertical-align:middle;font-size:6.8pt;line-height:1.2;overflow-wrap:break-word}
.livret .lv-tab td.c{text-align:center}
.livret .lv-tab td small{color:var(--lv-gris);font-size:5.8pt}
.livret .lv-tab tr.fait td{background:#FAFBFA}
.livret .lv-tab tr.prevu td .prevu-dose{color:var(--lv-ink2)}
.livret .lv-tab td.sig{width:25mm}
.livret .sig-pre{font-size:6.2pt}
.livret .seances th:nth-child(1),.livret .seances td:nth-child(1){width:8mm}
.livret .seances th:nth-child(2),.livret .seances td:nth-child(2){width:16mm}
.livret .seances th:nth-child(3),.livret .seances td:nth-child(3){width:16mm}
.livret .seances th:nth-child(4),.livret .seances td:nth-child(4){width:15mm}
.livret .seances th:nth-child(5),.livret .seances td:nth-child(5){width:11mm}
.livret .seances th:nth-child(6),.livret .seances td:nth-child(6){width:15mm}
.livret .seances th:nth-child(7),.livret .seances td:nth-child(7){width:7mm;text-align:center}
.livret .seances th:nth-child(9),.livret .seances td:nth-child(9){width:22mm}
.livret .lv-tab td.d{white-space:nowrap;padding-left:.4mm;padding-right:.4mm}
.livret .seances td{height:7.4mm}
.livret .retro-t{margin-top:0}
.livret .retro td{height:5.6mm;font-size:6.5pt}
.livret .retro th:nth-child(2),.livret .retro td:nth-child(2){width:44mm}
.livret .retro{margin-bottom:1.5mm}
.livret .examens th:nth-child(1),.livret .examens td:nth-child(1){width:46mm}
.livret .examens th:nth-child(2),.livret .examens td:nth-child(2){width:16mm}
.livret .examens th:nth-child(3),.livret .examens td:nth-child(3){width:15mm}
.livret .examens th:nth-child(4),.livret .examens td:nth-child(4){width:8mm;text-align:center}
.livret .examens th:nth-child(5),.livret .examens td:nth-child(5){width:20mm;text-align:center}
.livret .examens td{height:7.4mm}
.livret .examens td.ex .bi .sep{display:none}
.livret .examens td.ex .ar{display:block;font-size:1.02em}
.livret .rdv td{height:5.6mm}
.livret .rdv th:nth-child(1),.livret .rdv td:nth-child(1){width:18mm}
.livret .rdv th:nth-child(2),.livret .rdv td:nth-child(2){width:12mm}
.livret .rdv th:nth-child(5),.livret .rdv td:nth-child(5){width:10mm;text-align:center}
.livret .sous-tab{display:grid;grid-template-columns:1.15fr 1fr;gap:3mm;margin-top:2mm;align-items:start}
.livret .callout-hdj{padding:1.4mm 2mm;background:var(--lv-acc-t);border-left:1.2mm solid var(--lv-acc);border-radius:.8mm;font-size:6.8pt}
.livret .callout-hdj .tel{margin-top:.8mm}
.livret .infos-seance .f{font-size:6.4pt;display:block;line-height:1.25}
.livret .infos-seance .f .lab,.livret .infos-seance .f .val{display:inline}
.livret .infos-seance .f .lab::after{content:' '}
.livret .bas3{display:grid;grid-template-columns:1fr 85mm;gap:3mm;margin-top:2mm;align-items:end}
.livret .conseils .li{font-size:6.5pt;padding:.4mm 0;border-bottom:.25pt dotted var(--lv-line)}
.livret .conseils .bt{margin-top:0}
.livret .questions{display:flex;flex-direction:column;flex:1 1 auto;min-height:30mm;margin-bottom:2mm}
.livret .questions .q-sous{font-size:6.4pt;color:var(--lv-ink2);margin-bottom:1mm}
.livret .questions .lignes{flex:1 1 auto;background:repeating-linear-gradient(to bottom,transparent 0,transparent 5.7mm,var(--lv-line) 5.7mm,var(--lv-line) calc(5.7mm + .3pt))}
.livret .notes .questions .bt{margin-top:1mm}
.livret .carte{width:85mm;height:42mm;border:.5pt dashed var(--lv-gris);border-radius:2mm;position:relative;padding:2mm 2.4mm;background:#fff;font-size:6.3pt}
.livret .carte.recto{border-color:var(--lv-acc);border-style:dashed;background:var(--lv-acc-t)}
.livret .carte .ct{font-weight:700;color:var(--lv-acc);font-size:7.2pt;margin-bottom:.5mm;border-bottom:.35pt solid var(--lv-acc);padding-bottom:.3mm}
.livret .carte.verso .ct{color:var(--lv-ink2);border-color:var(--lv-line);font-size:6.8pt}
.livret .carte .f{padding:.3mm 0;min-height:3.2mm;font-size:6.3pt}
.livret .carte .ct-l{margin:.2mm 0;font-size:6.1pt;line-height:1.18}
.livret .grille .bi,.livret .grille.bi{display:grid;grid-template-columns:1.15fr 1fr;gap:0 3mm}
.livret .grille .bi .sep,.livret .grille.bi .sep{display:none}
.livret .grille .bi .ar,.livret .grille.bi .ar{text-align:right}
.livret .carte .ct-note{margin-top:.8mm;color:var(--lv-ink2);font-size:5.9pt}
.livret .ciseaux{position:absolute;top:-2.2mm;left:4mm;background:#fff;padding:0 .6mm;color:var(--lv-gris);font-size:8pt;line-height:1}
.livret .alerte{border:.5pt solid;border-radius:1mm;padding:.5mm 1.5mm .4mm;margin-bottom:.8mm}
.livret .alerte.rouge{border-color:var(--lv-rouge);background:var(--lv-rouge-t);border-left-width:1.8mm}
.livret .alerte.orange{border-color:var(--lv-orange);background:var(--lv-orange-t);border-left-width:1.8mm}
.livret .al-t{font-weight:700;font-size:7.2pt;display:flex;align-items:center;gap:1.5mm;line-height:1.15}
.livret .rouge .al-t{color:var(--lv-rouge)}.livret .orange .al-t{color:var(--lv-orange)}
.livret .al-t .ar{font-size:1.02em}
.livret .ico{display:inline-flex;width:4.2mm;height:4.2mm;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:7pt;flex:0 0 auto}
.livret .ico.oct{background:var(--lv-rouge);clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)}
.livret .ico.tri{background:var(--lv-orange);clip-path:polygon(50% 0,100% 100%,0 100%);padding-top:1.2mm}
.livret .ico.non{width:3.4mm;height:3.4mm;border:.6pt solid var(--lv-ink);border-radius:50%;position:relative}
.livret .ico.non::after{content:"";position:absolute;left:-.3mm;top:45%;width:3.6mm;height:.6pt;background:var(--lv-ink);transform:rotate(-45deg)}
.livret .nums{display:flex;flex-wrap:wrap;gap:.3mm 4mm;margin:.4mm 0 .3mm;font-size:6.5pt;line-height:1.2}
.livret .nums b{font-size:9pt;font-weight:700;font-variant-numeric:tabular-nums}
.livret .items{margin:0;padding:0;list-style:none;columns:1}
.livret .items li{padding:.1mm 0 .1mm 2.2mm;position:relative;border-bottom:.25pt dotted rgba(0,0,0,.12);font-size:6.2pt;line-height:1.15;break-inside:avoid}
.livret .items li .bi{display:grid;grid-template-columns:1.18fr 1fr;gap:0 3mm}
.livret .items li .bi .sep{display:none}
.livret .items li .bi .ar{text-align:right}
.livret .items li::before{content:"•";position:absolute;left:.4mm;color:var(--lv-ink2)}
.livret .avant .bt{margin-top:1.6mm}
.livret .cases li.case{padding-left:5.2mm;padding-top:.05mm;padding-bottom:.05mm}
.livret .cases li.case::before{content:none}
.livret .cases li.case .chk{position:absolute;left:.4mm;top:.5mm}
.livret .regle{font-size:6.3pt;margin-top:.4mm;padding:.4mm 1.4mm;background:var(--lv-soft);border-radius:.6mm;line-height:1.2}
.livret .bas4{display:grid;grid-template-columns:85mm 1fr;gap:4mm;margin-top:1mm;align-items:end}
.livret .droite .bt:first-child{margin-top:0}
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
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="small muted">Carnet patient (français / arabe) · ${N} pages A5 · ${N / 4} feuille(s) A4</span><div class="btn-group"><button type="button" class="btn sm${a4 ? '' : ' on'}" data-action="carnetVue" data-v="a5">Vue A5</button><button type="button" class="btn sm${a4 ? ' on' : ''}" data-action="carnetVue" data-v="a4">Vue A4 recto-verso</button></div>${R.boutonsDoc()}</div></div>
        <p class="small muted no-print" style="margin:-8px 0 12px">${a4 ? 'Feuilles A4 paysage à imprimer recto-verso (retournement sur le bord court) puis à plier en deux : la carte détachable de la dernière page a son verso au dos.' : 'Pages A5 à imprimer recto-verso (retournement sur le bord long) ; la vue A4 donne l’imposition pour une feuille pliée en deux.'}</p>${doc}`;
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
