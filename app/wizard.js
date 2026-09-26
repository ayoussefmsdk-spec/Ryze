/* =====================================================================
   Ryze — wizard.js : assistant « Nouveau dossier » (5 étapes)
   et carnet de suivi biothérapique imprimable
   ===================================================================== */
'use strict';
(function (R) {
  const S = R.S, esc = R.esc;
  const opt = (arr, val, lab, sel) => arr.map(x => `<option value="${esc(val(x))}"${val(x) === sel ? ' selected' : ''}>${esc(lab(x))}</option>`).join('');
  const medecins = () => S.users.filter(u => u.medecin && u.actif);

  function nouveauW() {
    const u = R.user();
    return { step: 1, d: { nom: '', prenom: '', ddn: '', sexe: 'F', ipp: '', tel: '', poids: '', taille: '', pathologie: 'MC', paris: {}, dateDiag: '', medecinId: u && u.medecin ? u.id : (medecins()[0] || {}).id, traitementsAssocies: '', allergies: '', antecedentsBio: '', comorbidites: '' },
      bilan: R.BILAN_PRE.map(b => ({ id: b.id, statut: 'attente', date: '', commentaire: '' })), protocoleId: null, cfg: null, dateDebut: R.addDays(R.today(), 7), heure: '09:00', fauteuil: 1, horizon: 365, carnetMixte: true, induction: [], entretien: null, sansInduction: false, premed: '', surv: {}, survCustom: [] };
  }
  const monBrouillon = () => (S.brouillons || {})[S.user] || null;
  const W = () => { if (!R.ui.w) { const b = monBrouillon(); R.ui.w = (b && b.d) ? Object.assign(nouveauW(), b, { d: Object.assign(nouveauW().d, b.d) }) : nouveauW(); } return R.ui.w; };
  let brouillonTimer = null; R.brouillon = () => { if (!S.user || !R.ui.w) return; S.brouillons = S.brouillons || {}; S.brouillons[S.user] = R.ui.w; clearTimeout(brouillonTimer); brouillonTimer = setTimeout(R.save, 800); };
  /* induction réellement planifiée (vide si « pas d'induction ») et poids saisi (null si absent : jamais de poids implicite à l'affichage) */
  const inductionW = w => w.sansInduction ? [] : (w.induction || []);
  const poidsW = w => +w.d.poids > 0 ? +w.d.poids : null;
  const protoTemp = () => Object.assign({}, R.proto(W().protocoleId), { induction: inductionW(W()), entretien: W().entretien });
  const reprise = w => w.reprise === undefined ? w.dateDebut < R.today() : !!w.reprise;
  /* mode de dose d'une phase : 'mgkg' calculée, 'mg' dose totale, 'palier' selon le poids, 'po' texte ; par défaut celui du protocole */
  const dtDefaut = (pr, ph) => ph === 'entretien' ? ((pr.entretien || {}).doseType || pr.doseType) : pr.doseType;
  const dtEtape = (pr, e, ph) => (e && e.doseType) || dtDefaut(pr, ph);
  const modePhase = (w, pr, ph) => dtEtape(pr, ph === 'entretien' ? w.entretien : (w.induction || [])[0], ph);
  const nb = v => String(v).replace('.', ',');
  const dernierJour = ind => ind.length ? Math.max(...ind.map(e => +e.jour || 0)) : null;
  const calcCures = () => { const w = W(); if (!w.protocoleId) return []; const pt = protoTemp(), poids = poidsW(w); let cures = R.genererCures(pt, w.dateDebut, poids || 70, w.horizon);
    if (!poids) cures.forEach((c, i) => { const dt = c.phase === 'Induction' ? dtEtape(pt, pt.induction[i], 'induction') : dtEtape(pt, pt.entretien, 'entretien'); if (dt === 'mgkg' || dt === 'palier') Object.assign(c, { dose: null, flacons: 0, doseTexte: 'poids à renseigner' }); });
    if (reprise(w)) { const t = R.today(); cures = cures.filter(c => c.datePrevue >= t); cures.forEach((c, i) => c.n = i + 1); } return R.reserverCures(cures, w.heure); };
  /* conversion d'une dose quand le médecin change de mode (mg/kg ↔ mg ↔ paliers), au poids saisi ; vers mg/kg : la précision la plus courte qui redonne exactement les mêmes mg (donc les mêmes flacons) */
  const versMgkg = (mg, poids) => { for (const k of [10, 100, 1000]) { const v = Math.round(mg / poids * k) / k; if (Math.round(v * poids) === Math.round(mg)) return v; } return mg / poids; };
  function convertir(pr, ph, dose, de, vers, poids) {
    if (de === vers) return dose; if (vers === 'palier' || vers === 'po') return null;
    const mg = de === 'mgkg' ? (dose != null && poids ? Math.round(dose * poids) : null) : de === 'palier' ? (poids ? R.doseEtape(pr, { doseType: 'palier' }, poids, ph).dose : null) : dose;
    return vers === 'mg' ? mg : (mg != null && poids ? versMgkg(mg, poids) : null);
  }
  /* calcul affiché : « 5 mg/kg × 68 kg = 340 mg · 4 fl. » */
  function calculHTML(pt, e, ph, poids, apres) {
    const dt = dtEtape(pt, e, ph); if (dt === 'po') return esc(e.texte || (ph === 'entretien' ? pt.entretien.texte : '') || '');
    const alerte = t => `<span style="color:var(--warn-ink)">${t}</span>`; const ivSeul = dt === 'mgkg' && e.voie !== 'IV' ? `<br><span style="color:var(--crit-ink)">mg/kg réservé aux perfusions IV</span>` : '';
    if ((dt === 'mgkg' || dt === 'palier') && !poids) return alerte('poids à renseigner') + ivSeul; if (dt !== 'palier' && !(+e.dose > 0)) return alerte('dose à saisir') + ivSeul;
    const d = R.doseEtape(pt, e, poids, ph), fl = d.flacons ? ` · <b>${d.flacons} fl.</b>` : '';
    return (dt === 'mgkg' ? `${nb(e.dose)} mg/kg × ${nb(poids)} kg = <b>${d.dose} mg</b>${fl}` : dt === 'palier' ? `${nb(poids)} kg → ${esc(d.texte)}` : `${d.dose} mg${fl}`) + (apres || '') + ivSeul;
  }
  const libDose = dt => dt === 'mgkg' ? 'Dose (mg/kg)' : dt === 'palier' ? 'Dose (paliers)' : dt === 'po' ? 'Posologie' : 'Dose totale (mg)';
  /* mg/kg proposé seulement si la phase comporte une perfusion IV (ou s'il est déjà choisi, pour pouvoir en sortir) ; pas de choix s'il ne reste qu'un mode */
  const modes = (w, pr, ph) => { const d = dtDefaut(pr, ph), iv = (ph === 'entretien' ? [w.entretien] : w.induction || []).some(e => e && e.voie === 'IV') || modePhase(w, pr, ph) === 'mgkg';
    const l = d === 'po' ? [] : (iv ? [['mgkg', 'Calculée (mg/kg × poids)']] : []).concat([['mg', 'Dose totale (mg)']], d === 'palier' && pr.paliers ? [['palier', 'Selon le poids (paliers)']] : []); return l.length > 1 ? l : []; };
  const choixMode = (w, pr, ph) => { const m = modePhase(w, pr, ph), l = modes(w, pr, ph); return l.length ? `<div class="row" style="gap:6px"><span class="xs muted">Dose</span><div class="btn-group" style="flex-wrap:wrap;max-width:100%" role="radiogroup" aria-label="Mode de dose — ${ph}">${l.map(x => `<button type="button" class="btn sm${m === x[0] ? ' on' : ''}" role="radio" aria-checked="${m === x[0]}" data-action="wMode" data-phase="${ph}" data-v="${x[0]}">${x[1]}</button>`).join('')}</div></div>` : ''; };
  /* séance d'induction suivante : même écart que les deux dernières (14 j s'il n'y en a qu'une), même dose, voie et mode */
  function suite(w) {
    const ind = w.induction, der = ind[ind.length - 1];
    if (!der) { const e0 = (R.proto(w.protocoleId).induction || [])[0] || { dose: null, voie: 'IV' }; return Object.assign({}, e0, { label: R.libelleJour(0), jour: 0 }); }
    const ecart = ind.length > 1 ? der.jour - ind[ind.length - 2].jour : 14, jour = der.jour + (ecart > 0 ? ecart : 14);
    return Object.assign({ label: R.libelleJour(jour), jour, dose: der.dose, voie: der.voie }, der.doseType ? { doseType: der.doseType } : {}, der.texte ? { texte: der.texte } : {});
  }
  /* début de l'entretien recalé sur « dernière induction + intervalle » s'il n'est plus après l'induction ou s'il suivait déjà ce calcul */
  function recaler(w, avant) {
    if (w.sansInduction || !w.entretien) return; const der = dernierJour(w.induction); if (der == null) return;
    const inter = +w.entretien.intervalleJours || 0, deb = +w.entretien.debutJour;
    if (!(deb > der) || (avant != null && deb === avant + inter)) w.entretien.debutJour = der + inter;
  }
  const field = (label, k, type, extra, root) => { const w = W(); const v = root ? w[k] : w.d[k]; return `<div class="field${extra && extra.span ? ' span' + extra.span : ''}"><label>${label}</label><input type="${type || 'text'}" id="w-${k}" value="${esc(v ?? '')}" data-input="wBind" data-k="${k}" ${root ? 'data-root="1"' : ''} ${extra && extra.attrs ? extra.attrs : ''}>${extra && extra.hint ? `<span class="hint">${extra.hint}</span>` : ''}</div>`; };

  /* ---------- Étapes ---------- */
  function section(w, i, titre, resume, body, dernier) {
    const open = (w.sec ?? 0) === i;
    return `<div class="acc${open ? ' open' : ''}"><button type="button" class="acc-head" data-action="wSection" data-i="${i}"><span class="step-n" style="border-color:${open ? 'var(--accent)' : 'var(--line-strong)'};color:${open ? 'var(--accent-ink)' : 'var(--muted)'}">${i + 1}</span><h2>${titre}</h2><span class="sum">${open ? 'ouvert' : esc(resume)}</span>${R.icon(open ? 'chevD' : 'chevR', 'ico')}</button>${open ? `<div class="acc-body"><div class="mt16">${body}</div>${dernier ? '' : `<div class="row mt16" style="justify-content:flex-end"><button type="button" class="btn primary" data-action="wSection" data-i="${i + 1}">Section suivante ${R.icon('chevR')}</button></div>`}</div>` : ''}</div>`;
  }
  function step1(w) {
    const d = w.d; d.paris = d.paris || {}; if (d.montreal && !Object.keys(d.paris).length) { d.paris = R.parisDepuisTexte(d.montreal, d.pathologie, d.ddn, d.dateDiag, true); delete d.montreal; }
    { const autoA = R.parisAuto(d.ddn, d.dateDiag); if (d.pathologie !== 'RCH' && !d.paris.A && autoA) d.paris.A = autoA; } /* proposition d'âge au diagnostic mémorisée dans le brouillon */
    const app = w.bilan.filter(b => b.statut !== 'na'), fait = app.filter(b => b.statut.startsWith('fait')).length;
    const idBody = `<div class="form-grid">${field('Nom', 'nom', 'text', { attrs: 'required style="text-transform:uppercase"' })}${field('Prénom', 'prenom', 'text', { attrs: 'required' })}${field('N° de dossier (IPP)', 'ipp', 'text', { attrs: 'placeholder="laisser vide : numéro automatique"', hint: 'identifiant du patient dans le système de l’hôpital ; sinon numéro généré par Ryze' })}
      ${field('Date de naissance', 'ddn', 'date', { attrs: 'required' })}<div class="field"><label>Sexe</label><select data-change="wBindR" data-k="sexe"><option value="F"${d.sexe === 'F' ? ' selected' : ''}>Femme</option><option value="M"${d.sexe === 'M' ? ' selected' : ''}>Homme</option></select></div>${field('Téléphone', 'tel', 'tel')}
      ${field('Poids (kg)', 'poids', 'number', { attrs: 'step="0.1" required' })}${field('Taille (cm)', 'taille', 'number')}<div class="field"><label>Médecin référent</label><select data-change="wBind" data-k="medecinId">${opt(medecins(), u => u.id, u => R.userName(u.id), d.medecinId)}</select></div></div>`;
    const malBody = `<div class="form-grid"><div class="field"><label>Pathologie</label><select data-change="wBindR" data-k="pathologie">${opt(Object.keys(R.PATHOS), k => k, k => R.PATHOS[k].label, d.pathologie)}</select></div>${field('Date du diagnostic', 'dateDiag', 'date')}</div><div class="caps mt16 mb8">Classification de Paris <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">— ${R.parisCode(d.paris, d.pathologie) || 'non renseignée'}</span></div>${R.formParis(d.paris, d.pathologie, 'w', R.parisAuto(d.ddn, d.dateDiag))}`;
    const atcdBody = `<div class="form-grid">${field('Traitements associés', 'traitementsAssocies', 'text', { attrs: 'placeholder="ex. azathioprine 150 mg/j, mésalazine 4 g/j"' })}${field('Allergies', 'allergies', 'text', { attrs: 'placeholder="ex. pénicilline (urticaire)"' })}${field('Biothérapies antérieures', 'antecedentsBio', 'text', { attrs: 'placeholder="ex. infliximab 2019–2024, perte de réponse (ADA+)"' })}${field('Comorbidités / facteurs de risque', 'comorbidites', 'text', { span: 3, attrs: 'placeholder="ex. tabagisme actif, antécédent de zona, insuffisance cardiaque"' })}</div>`;
    return section(w, 0, 'Identité', d.nom ? `${d.nom.toUpperCase()} ${d.prenom} · ${d.ipp || 'n° automatique'} · ${d.poids || '?'} kg` : 'à compléter', idBody)
      + section(w, 1, 'Maladie', `${R.PATHOS[d.pathologie]?.label}${R.parisCode(d.paris, d.pathologie) ? ' · ' + R.parisCode(d.paris, d.pathologie) : ''}`, malBody)
      + section(w, 2, 'Antécédents et traitements', [d.traitementsAssocies, d.allergies, d.antecedentsBio].filter(Boolean).join(' · ') || 'rien renseigné', atcdBody)
      + section(w, 3, 'Bilan pré-thérapeutique (optionnel)', `${fait}/${app.length} faits`, step2(w), true);
  }
  function step2(w) {
    const app = w.bilan.filter(b => b.statut !== 'na'), fait = app.filter(b => b.statut.startsWith('fait')).length; const cats = [...new Set(R.BILAN_PRE.map(b => b.cat))];
    return `<div class="row between mb8"><span class="small muted">Check-list GETAID 2021 / ECCO 2025 — modifiable ensuite dans le dossier</span><div class="row"><div class="meter" style="width:140px"><i class="${fait === app.length ? 'good' : 'warn'}" style="width:${app.length ? (fait / app.length * 100).toFixed(0) : 0}%"></i></div><span class="num small">${fait}/${app.length}</span><button type="button" class="btn sm" data-action="wBilanTout">Tout marquer « fait — normal »</button></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Catégorie</th><th>Examen</th><th>Statut</th><th>Date</th><th>Résultat / commentaire</th></tr></thead><tbody>${cats.map(cat => R.BILAN_PRE.filter(b => b.cat === cat).map(b => { const r = w.bilan.find(x => x.id === b.id); return `<tr class="${r.statut === 'na' ? 'done' : ''}"><td class="small muted">${esc(cat)}</td><td>${esc(b.label)}</td><td><select class="inline-input w150" data-change="wBilan" data-bid="${b.id}" data-k="statut">${opt(Object.keys(R.BILAN_STATUTS), k => k, k => R.BILAN_STATUTS[k], r.statut)}</select></td><td><input type="date" class="inline-input w150" value="${esc(r.date)}" data-change="wBilan" data-bid="${b.id}" data-k="date"></td><td><input type="text" class="inline-input" style="width:100%!important" value="${esc(r.commentaire)}" data-input="wBilan" data-bid="${b.id}" data-k="commentaire" placeholder="résultat"></td></tr>`; }).join('')).join('')}</tbody></table></div>
      <p class="small muted mt8">Le dépistage de la tuberculose (IGRA + radiographie) et de l’hépatite B conditionne la première séance : une infection tuberculeuse latente se traite ≥ 3 semaines avant le début. Les vaccins vivants sont contre-indiqués sous traitement : à administrer ≥ 3–4 semaines avant.</p>`;
  }
  function step3(w) {
    const pr = w.protocoleId ? R.proto(w.protocoleId) : null; const cures = calcCures(); const art = pr ? R.article(pr.articleId) : null; const poids = poidsW(w);
    const blocs = () => {
      const pt = protoTemp(), ind = w.induction, sans = !!w.sansInduction, e = w.entretien, mI = modePhase(w, pr, 'induction'), mE = modePhase(w, pr, 'entretien'), der = dernierJour(inductionW(w));
      const lignes = ind.map((x, i) => { const dt = dtEtape(pr, x, 'induction'); return `<tr><td><input class="inline-input w70" value="${esc(x.label)}" data-change="wStep" data-i="${i}" data-k="label" aria-label="Étape"></td><td><input type="number" class="inline-input w70" value="${x.jour ?? ''}" data-change="wStep" data-i="${i}" data-k="jour" aria-label="Jour"></td><td>${dt === 'palier' || dt === 'po' ? `<span class="small">${esc(dt === 'po' ? x.texte || '' : 'selon le poids')}</span>` : `<input type="number" step="any" min="0" class="inline-input w70" value="${x.dose ?? ''}" data-change="wStep" data-i="${i}" data-k="dose" aria-label="${libDose(dt)}">`}</td><td><select class="inline-input" data-change="wStep" data-i="${i}" data-k="voie" aria-label="Voie">${['IV', 'SC', 'PO'].map(v => `<option${x.voie === v ? ' selected' : ''}>${v}</option>`).join('')}</select></td><td class="small nowrap w-calc">${calculHTML(pt, x, 'induction', poids)}</td><td class="actions"><button type="button" class="btn sm ghost" data-action="wDelStep" data-i="${i}"${ind.length <= 1 ? ' disabled title="Au moins une séance : cochez « Pas d’induction » pour supprimer l’induction"' : ' title="Supprimer cette séance"'}>${R.icon('x')}</button></td></tr>`; }).join('');
      const indHTML = `<div class="phase-block ind"><div class="row between mb8"><div class="caps"><span class="badge info" style="padding:1px 8px">Induction</span> Phase d’induction <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">— même couleur que dans la planification</span></div>${sans ? '' : choixMode(w, pr, 'induction')}</div>
        <label class="check${sans ? ' on' : ''}"><input type="checkbox" data-change="wSansInd"${sans ? ' checked' : ''}><span><b>Pas d’induction — commencer directement en entretien</b><span>relais ou patient déjà en entretien : la première séance est une séance d’entretien, à J0</span></span></label>
        ${sans ? `<p class="small muted mt8" style="margin-bottom:0">Aucune séance d’induction ne sera planifiée ; l’entretien commence à J0.${ind.length ? ` Les ${ind.length} séance(s) saisie(s) sont conservées et reviennent si vous décochez.` : ''}</p>` : `<div class="row mt8 mb8"><label class="small" for="w-nbind">Nombre de séances d’induction</label><input type="number" id="w-nbind" min="1" max="12" step="1" class="inline-input w70" value="${ind.length}" data-change="wNbInd"><span class="xs muted">une séance ajoutée reprend le dernier écart, la dose et la voie de la précédente</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Étape</th><th>Jour</th><th>${libDose(mI)}</th><th>Voie</th><th>Calcul</th><th></th></tr></thead><tbody>${lignes}</tbody></table></div><button type="button" class="btn sm mt8" data-action="wAddStep"${ind.length >= 12 ? ' disabled' : ''}>Ajouter une étape d’induction</button>`}</div>`;
      const auto = !sans && der != null && +e.debutJour === der + (+e.intervalleJours);
      const entHTML = `<div class="phase-block ent mt16"><div class="row between mb8"><div class="caps"><span class="badge good" style="padding:1px 8px">Entretien</span> Phase d’entretien</div>${choixMode(w, pr, 'entretien')}</div><div class="form-grid"><div class="field"><label>Début (jour après J0)</label><input type="number" value="${e.debutJour ?? ''}" data-change="wEnt" data-k="debutJour"><span class="hint">${sans ? 'J0 : pas d’induction' : auto ? 'calculé : dernière induction + intervalle, modifiable' : der != null ? `${R.libelleJour(+e.debutJour || 0)} · dernière induction à J${der}` : ''}</span></div><div class="field"><label>Intervalle (jours)</label><input type="number" value="${e.intervalleJours ?? ''}" data-change="wEnt" data-k="intervalleJours"><span class="hint">28 = 4 sem · 42 = 6 sem · 56 = 8 sem · 84 = 12 sem</span></div><div class="field"><label>${libDose(mE)}</label>${mE === 'palier' || mE === 'po' ? `<div class="small" style="padding:8px 0">${esc(mE === 'po' ? e.texte || '' : 'selon le poids')}</div>` : `<input type="number" step="any" min="0" value="${e.dose ?? ''}" data-change="wEnt" data-k="dose">`}${mE === 'po' ? '' : `<span class="hint w-calc-ent">${calculHTML(pt, e, 'entretien', poids, ' par séance')}</span>`}</div><div class="field"><label>Voie</label><select data-change="wEnt" data-k="voie">${['IV', 'SC', 'PO'].map(v => `<option${e.voie === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div></div></div>`;
      return indHTML + entHTML;
    };
    const carte = p => `<button type="button" class="proto" style="text-align:left;cursor:pointer;${w.protocoleId === p.id ? 'border-color:var(--accent);background:var(--accent-tint)' : ''}" data-action="wProto" data-id="${p.id}"><div class="row between"><h3>${esc(p.dci)}</h3>${w.protocoleId === p.id ? R.icon('check', 'ico') : ''}</div><div class="spec">${esc(p.classe)} · ${esc(p.voie)} · ${p.indications.join(' / ')}</div><div class="small">${p.induction.map(e => e.label).join(' · ')} puis ${esc(p.entretien?.label || '')}</div></button>`;
    const indiques = S.protocoles.filter(p => p.indications.includes(w.d.pathologie)), autres = S.protocoles.filter(p => !p.indications.includes(w.d.pathologie));
    return `<section class="card mb16"><div class="card-head"><div><h2>Choix du protocole</h2><div class="sub">protocoles indiqués pour ${esc(R.PATHOS[w.d.pathologie]?.label)} — les autres restent accessibles</div></div></div><div class="card-body"><div class="proto-grid">${indiques.map(carte).join('')}</div>${autres.length ? `<details class="mt16"><summary class="small muted" style="cursor:pointer">Autres protocoles (${autres.length})</summary><div class="proto-grid mt8">${autres.map(carte).join('')}</div></details>` : ''}</div></section>
    ${pr ? `<div class="grid c21"><section class="card"><div class="card-head"><div><h2>Cycles de traitement — ${esc(pr.dci)}</h2><div class="sub">doses recalculées sur ${w.d.poids || '?'} kg · arrondi au flacon de ${art ? art.unite + ' ' + art.uniteLib : '—'}</div></div></div><div class="card-body">
        <div class="form-grid mb16"><div class="field span2"><label>Posologie</label><select data-change="wVariante">${R.varianteOptions(pr, w.variante)}</select><span class="hint">applique seulement les doses et l’intervalle de la variante ; séances et jours inchangés</span></div><div class="field"><label>Date de la 1re cure (J0)</label><input type="date" value="${w.dateDebut}" data-change="wBindR" data-k="dateDebut" data-root="1"></div><div class="field"><label>Poids (kg)</label><input type="number" step="0.1" value="${esc(w.d.poids)}" data-change="wBindR" data-k="poids">${poids ? '' : '<span class="hint" style="color:var(--crit-ink)">requis pour calculer les doses en mg/kg et par paliers</span>'}</div><div class="field"><label>Heure souhaitée</label><input type="time" value="${w.heure}" data-change="wBindR" data-k="heure" data-root="1"><span class="hint">le fauteuil est attribué automatiquement</span></div><div class="field"><label>Horizon de planification</label><select data-change="wBindR" data-k="horizon" data-root="1">${[[182, '6 mois'], [365, '12 mois'], [548, '18 mois']].map(x => `<option value="${x[0]}"${w.horizon == x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select></div></div>
        ${blocs()}${w.dateDebut < R.today() ? `<div class="caps mt16 mb8">Dossier repris en cours de traitement</div><label class="check${reprise(w) ? ' on' : ''}"><input type="checkbox" data-change="wReprise"${reprise(w) ? ' checked' : ''}><span><b>Ne créer que les séances et contrôles à venir</b><span>le J0 est dans le passé : les séances déjà faites ailleurs ne sont pas inventées dans Ryze ; décochez pour créer tout le calendrier depuis J0</span></span></label>` : ''}<div class="caps mt16 mb8">Carnet de suivi</div><label class="check${w.carnetMixte ? ' on' : ''}"><input type="checkbox" data-change="wMixte"${w.carnetMixte ? ' checked' : ''}><span><b>Planification unifiée</b><span>séances et contrôles dans un seul calendrier, dans le dossier comme dans le carnet imprimé. Décoché : deux tableaux séparés.</span></span></label>
        <div class="caps mt16 mb8">Prémédication</div><div class="field"><select data-change="wBindR" data-k="premed" data-root="1"><option${w.premed === 'Aucune' ? ' selected' : ''}>Aucune</option><option${w.premed === 'Paracétamol 1 g PO' ? ' selected' : ''}>Paracétamol 1 g PO</option><option${w.premed === 'Paracétamol 1 g + dexchlorphéniramine 5 mg IV' ? ' selected' : ''}>Paracétamol 1 g + dexchlorphéniramine 5 mg IV</option><option${w.premed === 'Paracétamol 1 g + dexchlorphéniramine 5 mg + hydrocortisone 100 mg IV' ? ' selected' : ''}>Paracétamol 1 g + dexchlorphéniramine 5 mg + hydrocortisone 100 mg IV</option></select><span class="hint">Protocole : ${esc(pr.premedication)}</span></div>
      </div></section>
      <section class="card"><div class="card-head"><div><h2>Calendrier prévisionnel</h2><div class="sub">${cures.length} cures · dernière le ${R.fmtDate(cures[cures.length - 1]?.datePrevue)}${poids ? '' : ' · <span style="color:var(--warn-ink)">poids à renseigner : doses non calculées</span>'}</div></div></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>Phase</th><th>Date · créneau</th><th>Dose</th><th class="right">Fl.</th></tr></thead><tbody>${cures.map(c => `<tr><td class="mono">${c.n}</td><td>${c.phase === 'Induction' ? R.badge('info', c.label) : `<span class="tag">${R.esc(c.label)}</span>`} <span class="xs muted">${c.voie}</span></td><td class="nowrap">${R.fmtDate(c.datePrevue, { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}${c.voie === 'IV' ? `<div class="xs muted">${c.heure} · F${c.fauteuil || '?'}${c.decalee ? ' · <b>décalée</b>' : ''}${c.sansCreneau ? ' · <b style="color:var(--crit-ink)">sans créneau</b>' : ''}</div>` : ''}</td><td class="small dose">${esc(c.doseTexte)}</td><td class="right num">${c.flacons || '—'}</td></tr>`).join('')}</tbody></table></div><div class="card-foot">Chaque séance IV réserve un fauteuil libre (${R.hdj().fauteuils} fauteuils, ${R.hdj().maxParJour} séances/jour max). Une séance « décalée » a glissé au premier jour disponible.</div></section></div>` : '<div class="callout info">Sélectionnez un protocole pour construire les cycles.</div>'}`;
  }
  function apercuHTML(w) {
    const apercu = R.genererSurveillanceCfg(w.cfg, w.dateDebut, w.horizon, 1).filter(s => s.mode === 'echeance');
    return `<section class="card" id="w-apercu"><div class="card-head"><div><h2>Aperçu</h2><div class="sub">${apercu.length} contrôles sur ${Math.round(w.horizon / 30.4)} mois</div></div></div><div class="card-body flush tbl-wrap" style="max-height:420px;overflow:auto"><table class="tbl"><tbody>${apercu.slice(0, 40).map(s => `<tr><td class="nowrap">${R.fmtDate(s.echeance)}</td><td class="small">${esc(s.label)}${s.sous ? `<div class="xs muted">${s.sous.map(x => (R.itemBilan('biostd').sous.find(o => o.id === x) || { label: x }).label).join(', ')}</div>` : ''}</td></tr>`).join('')}${apercu.length > 40 ? `<tr><td colspan="2" class="muted small">… et ${apercu.length - 40} autres</td></tr>` : ''}</tbody></table></div></section>`;
  }
  function step4(w) {
    if (!w.cfg) w.cfg = R.cfgDefaut(R.proto(w.protocoleId));
    R.ui.cfgCtx = { get: () => W().cfg, after: (light) => { R.brouillon(); if (!light) { R.render(); return; } const a = document.getElementById('w-apercu'); if (a) a.outerHTML = apercuHTML(W()); } };
    return `<div class="grid c13"><section><div class="card-head" style="padding:0 0 10px"><div><h2>Plan de surveillance</h2><div class="sub">proposé par le protocole — ajustez les périodes, les analyses et les dosages libres</div></div></div>${R.formPlanSurveillance(w.cfg)}</section>
    <div class="stack">${apercuHTML(w)}
    <section class="card"><div class="card-head"><h2>Contrôles personnalisés</h2></div><div class="card-body stack">${w.survCustom.map((c, i) => `<div class="row between subtle"><div><b>${esc(c.label)}</b><div class="small muted">${R.fmtDateLong(c.date)}</div></div><button type="button" class="btn sm ghost" data-action="wSurvCustomDel" data-i="${i}">${R.icon('x')}</button></div>`).join('') || '<span class="small muted">Aucun</span>'}
      <div class="form-grid"><div class="field span2"><label>Libellé</label><input type="text" id="w-custom-label" placeholder="ex. IRM pelvienne (fistule), consultation stomathérapie"></div><div class="field"><label>Échéance</label><input type="date" id="w-custom-date" value="${R.addDays(w.dateDebut, 90)}"></div></div><button type="button" class="btn sm" data-action="wSurvCustomAdd">Ajouter</button></div></section></div></div>`;
  }
  function step5(w) {
    const pr = R.proto(w.protocoleId), cures = calcCures(), d = w.d; const app = w.bilan.filter(b => b.statut !== 'na'), attente = app.filter(b => b.statut === 'attente');
    const apercu = construirePatient();
    return `<div class="callout mb16"><b>${esc(d.nom.toUpperCase())} ${esc(d.prenom)}</b> · ${esc(pr.dci)} · ${cures.length} séances planifiées du ${R.fmtDate(cures[0]?.datePrevue)} au ${R.fmtDate(cures[cures.length - 1]?.datePrevue)} · ${R.genererSurveillanceCfg(w.cfg || R.cfgDefaut(pr), w.dateDebut, w.horizon, 1).filter(s => s.mode === 'echeance').length + w.survCustom.length} contrôles planifiés${attente.length ? ` · <span style="color:var(--warn-ink)">${attente.length} examen(s) du bilan en attente</span>` : ''}. Vérifiez le carnet ci-dessous puis enregistrez.</div>
    ${R.carnetHTML(apercu)}`;
  }

  R.pages.nouveau = {
    render() {
      const w = W(); const steps = ['Patient', 'Traitement et cycles', 'Carnet'];
      return `<div class="page-head"><div><h1>Nouveau dossier de biothérapie</h1><p>Trois étapes : le patient, le protocole avec ses cycles, puis le carnet à imprimer</p></div><div class="page-actions"><button class="btn ghost" data-action="wAbandon">Abandonner</button></div></div>
      <div class="stepper" style="grid-template-columns:repeat(3,1fr)">${steps.map((s, i) => `<div class="step${w.step === i + 1 ? ' active' : w.step > i + 1 ? ' done' : ''}"><span class="step-n">${w.step > i + 1 ? '✓' : i + 1}</span><span class="lbl">${s}</span></div>`).join('')}</div>
      ${monBrouillon() && monBrouillon().d && monBrouillon().d.nom && w.step === 1 ? `<div class="callout info mb16">Brouillon conservé automatiquement : vous pouvez fermer la page et reprendre plus tard.</div>` : ''}
      ${w.step === 1 ? step1(w) : ''}
      ${w.step === 2 ? step3(w) + (w.protocoleId ? '<div class="mt16">' + step4(w) + '</div>' : '') : ''}
      ${w.step === 3 ? step5(w) : ''}
      <div class="row between mt24"><div>${w.step > 1 ? `<button class="btn" data-action="wPrev">${R.icon('chevL')}Précédent</button>` : ''}</div><div class="row">${w.step < 3 ? `<button class="btn primary" data-action="wNext">Suivant ${R.icon('chevR')}</button>` : `<button class="btn" data-action="wCreate">Enregistrer le dossier</button><button class="btn primary" data-action="wCreatePrint">${R.icon('print')}Enregistrer et imprimer le carnet</button>`}</div></div>`;
    }
  };

  function valider(step) {
    const w = W();
    if (step === 1) { const m = ['nom', 'prenom', 'ddn', 'poids'].filter(k => !String(w.d[k] || '').trim()); if (m.length) { R.toast('Champs obligatoires : ' + m.join(', '), 'crit'); return false; }
      if (!(+w.d.poids > 0 && +w.d.poids < 400)) { R.toast('Poids invalide', 'crit'); return false; } if (w.d.taille && !(+w.d.taille > 30 && +w.d.taille < 260)) { R.toast('Taille invalide (en cm)', 'crit'); return false; }
      if (isNaN(R.parse(w.d.ddn)) || w.d.ddn > R.today()) { R.toast('Date de naissance invalide', 'crit'); return false; } }
    if (step === 2 && !w.protocoleId) { R.toast('Choisissez un protocole', 'crit'); return false; }
    if (step === 2 && (!w.dateDebut || isNaN(R.parse(w.dateDebut)))) { R.toast('Date de début (J0) invalide', 'crit'); return false; }
    if (step === 2) {
      const pr = R.proto(w.protocoleId), ind = inductionW(w), e = w.entretien, poids = poidsW(w); const ko = m => { R.toast(m, 'crit'); return false; };
      if (!poids || poids >= 400) return ko('Poids invalide : renseignez le poids (kg) pour calculer les doses');
      if (ind.some(x => x.jour === null || x.jour === '' || !(+x.jour >= 0))) return ko('Vérifiez les jours de l’induction');
      for (const [x, ph] of [...ind.map(x => [x, 'induction']), ...(e ? [[e, 'entretien']] : [])]) {
        const dt = dtEtape(pr, x, ph), qui = ph === 'entretien' ? 'd’entretien' : `d’induction (${x.label || 'J' + x.jour})`;
        if (dt === 'mgkg' && x.voie !== 'IV') return ko('Dose en mg/kg réservée aux perfusions IV : choisissez une dose fixe pour les injections');
        if (dt !== 'mgkg' && dt !== 'mg') continue;
        if (!(+x.dose > 0)) return ko(`Dose ${qui} manquante : saisissez une dose supérieure à 0`);
        if (dt === 'mgkg' && +x.dose > 20) return ko(`Dose ${qui} de ${nb(x.dose)} mg/kg : 20 mg/kg maximum — pour une dose totale, choisissez « Dose totale (mg) »`);
        if ((dt === 'mgkg' ? Math.round(x.dose * poids) : +x.dose) > 5000) return ko(`Dose ${qui} supérieure à 5 000 mg : vérifiez la dose`);
      }
      if (new Set(ind.map(x => +x.jour)).size !== ind.length) return ko('Deux séances d’induction le même jour : corrigez les jours');
      if (e && (e.debutJour === null || e.debutJour === '' || !(+e.debutJour >= 0))) return ko('Début de l’entretien invalide');
      if (e && ind.some(x => +x.jour >= +e.debutJour)) return ko(`Les séances d’induction doivent précéder le début de l’entretien (J${e.debutJour}) : avancez-les ou retardez l’entretien`);
      if (e && !(+e.intervalleJours >= 7)) return ko('Intervalle d’entretien : 7 jours minimum');
    }
    return true;
  }
  function construirePatient() {
    const w = W(); const pr = R.proto(w.protocoleId), cures = calcCures(); if (!w.cfg) w.cfg = R.cfgDefaut(pr);
    let surveillance = R.genererSurveillanceCfg(w.cfg, w.dateDebut, w.horizon, 1); if (reprise(w)) { const t = R.today(); surveillance = surveillance.filter(s => s.mode === 'cure' || s.echeance >= t); }
    w.survCustom.forEach(c => surveillance.push({ id: R.uid('sv'), label: c.label, cat: 'Personnalisé', mode: 'echeance', jour: R.diffDays(w.dateDebut, c.date), echeance: c.date, statut: 'prevue' }));
    surveillance.sort((a, b) => (a.jour || 0) - (b.jour || 0));
    const d = w.d, ind = inductionW(w), sans = !ind.length, pt = protoTemp(), e = w.entretien, copie = x => JSON.parse(JSON.stringify(x, (k, v) => k === 'memoDose' ? undefined : v)); /* mémoire de saisie : propre à l'assistant */
    /* posologie « personnalisée » si le schéma diffère du protocole (ou de la variante) choisi */
    const ref = R.appliquerVariante(pr, w.variante != null && pr.variantes ? pr.variantes[w.variante] : null); if (sans && ref.entretien) { ref.induction = []; ref.entretien.debutJour = 0; }
    const sig = (li, x) => JSON.stringify([li.map(y => [+y.jour, y.dose ?? null, y.voie, dtEtape(pr, y, 'induction')]), x ? [+x.debutJour, +x.intervalleJours, x.dose ?? null, x.voie, dtEtape(pr, x, 'entretien')] : null]);
    const posologie = (w.variante != null && pr.variantes ? pr.variantes[w.variante].nom : 'Posologie standard') + (sig(ind, e) !== sig(ref.induction, ref.entretien) ? ' — personnalisée' : '');
    const doses = (li, ph) => [...new Set(li.map(y => R.doseEtape(pt, y, +d.poids, ph).texte))].join(' / ');
    const schema = sans ? `sans induction (entretien direct) : entretien tous les ${e.intervalleJours} j dès J${+e.debutJour || 0} (${doses([e], 'entretien')})` : `${ind.length} séance(s) d’induction (${doses(ind, 'induction')}) puis entretien tous les ${e.intervalleJours} j (${doses([e], 'entretien')})`;
    return { id: R.uid('p'), ipp: d.ipp.trim() || R.numeroDossier(), nom: d.nom.trim().toUpperCase(), prenom: d.prenom.trim(), ddn: d.ddn, sexe: d.sexe, poids: +d.poids, taille: +d.taille || null, tel: d.tel, pathologie: d.pathologie, paris: Object.assign({}, d.paris || {}), dateDiag: d.dateDiag, medecinId: d.medecinId, protocoleId: pr.id, dateDebut: w.dateDebut, traitementsAssocies: d.traitementsAssocies || '—', allergies: d.allergies || '—', antecedentsBio: d.antecedentsBio || 'Aucune biothérapie antérieure', comorbidites: d.comorbidites, premedication: w.premed, statut: cures.some(c => c.phase === 'Induction') ? 'induction' : 'entretien', motifSuspension: '', cures, surveillance, planSurveillance: JSON.parse(JSON.stringify(w.cfg)), carnetMixte: !!w.carnetMixte, cycleCourant: 1, historiqueProtocoles: [{ cycle: 1, protocoleId: pr.id, dateDebut: w.dateDebut, poids: +d.poids, statut: 'en cours', debut: sans ? 'entretien' : 'induction', posologie, intervalle: +e.intervalleJours, modifications: [], planifieJusqua: cures.length ? cures[cures.length - 1].label : '—', par: S.user }], bilan: JSON.parse(JSON.stringify(w.bilan)), notes: [{ date: R.today(), heure: new Date().toTimeString().slice(0, 5), par: S.user, txt: `Dossier créé — ${pr.dci}, ${schema}.` }], creeLe: R.today(), creePar: S.user, derniereCure: null, protocoleSnapshot: { protocoleId: pr.id, sansInduction: sans, induction: copie(ind), entretien: copie(e) } };
  }
  function creer() { if (!valider(1) || !valider(2)) return null; if (S.patients.some(x => x.ipp && x.ipp === W().d.ipp.trim())) { R.toast('Ce numéro de dossier existe déjà', 'crit'); return null; } const p = construirePatient(); R.alignerTdm(p); S.patients.push(p); R.journal(`Dossier créé — ${R.nomComplet(p)} (${R.proto(p.protocoleId).dci})`); R.ui.w = null; if (S.brouillons) delete S.brouillons[S.user]; R.touch(); return p; }
  Object.assign(R.actions, {
    wBind(el) { const w = W(); if (el.dataset.root) w[el.dataset.k] = el.value; else w.d[el.dataset.k] = el.value; R.brouillon(); },
    wBindR(el) { R.actions.wBind(el); R.render(); },
    wParis(el) { const d = W().d; d.paris = d.paris || {}; delete d.paris.aVerifier; const k = el.dataset.k; if (el.type === 'checkbox') d.paris[k] = el.checked; else d.paris[k] = el.value || undefined; if (!d.paris[k]) delete d.paris[k]; R.brouillon(); R.render(); },
    wNext() { const w = W(); if (!valider(w.step)) return; w.step++; R.brouillon(); R.render(); },
    wPrev() { W().step--; R.render(); },
    wAbandon() { R.confirmer('Abandonner la saisie ?', 'Les informations saisies dans l’assistant seront perdues.', 'wAbandonOk'); },
    wAbandonOk() { R.ui.w = null; if (S.brouillons) delete S.brouillons[S.user]; R.save(); R.go('patients'); },
    wBilan(el) { const b = W().bilan.find(x => x.id === el.dataset.bid); b[el.dataset.k] = el.value; if (el.dataset.k === 'statut') { if (el.value.startsWith('fait') && !b.date) b.date = R.today(); R.render(); } },
    wBilanTout() { const homme = W().d.sexe === 'M'; W().bilan.forEach(b => { if (b.statut === 'attente') { if (homme && (b.id === 'fcu' || b.id === 'hcg')) { b.statut = 'na'; return; } b.statut = 'fait_normal'; b.date = b.date || R.today(); } }); R.render(); },
    wProto(el) { const w = W(); const pr = R.proto(el.dataset.id); w.protocoleId = pr.id; w.variante = null; setTimeout(R.brouillon, 0); w.induction = JSON.parse(JSON.stringify(pr.induction)); w.entretien = JSON.parse(JSON.stringify(pr.entretien || { debutJour: 56, intervalleJours: 56, dose: null, voie: 'IV', label: '' })); w.sansInduction = false; delete w.memoInd; w.cfg = R.cfgDefaut(pr); w.surv = {}; w.premed = /Non systématique|Aucune|—/.test(pr.premedication) ? 'Aucune' : pr.premedication; R.render(); },
    wStep(el) { const w = W(), e = w.induction[+el.dataset.i], k = el.dataset.k, avant = dernierJour(w.induction); if (!e) return;
      if (k === 'label' || k === 'voie') e[k] = el.value; else { const v = el.value === '' ? null : +el.value; if (k === 'jour' && v != null && e.label === R.libelleJour(e.jour)) e.label = R.libelleJour(v); e[k] = v; }
      if (k === 'jour') { w.induction.sort((a, b) => (a.jour ?? 1e6) - (b.jour ?? 1e6)); recaler(w, avant); } /* étapes toujours dans l'ordre des jours */
      R.brouillon(); R.render(); },
    wAddStep() { const w = W(); if (w.induction.length >= 12) return; const avant = dernierJour(w.induction); w.induction.push(suite(w)); recaler(w, avant); R.brouillon(); R.render(); },
    wDelStep(el) { const w = W(); if (w.induction.length <= 1) return; const avant = dernierJour(w.induction); w.induction.splice(+el.dataset.i, 1); recaler(w, avant); R.brouillon(); R.render(); },
    wNbInd(el) { const w = W(), n = +el.value; if (!(Number.isInteger(n) && n >= 1 && n <= 12)) { R.toast('Nombre de séances d’induction : de 1 à 12 (pour aucune, cochez « Pas d’induction »)', 'crit'); R.render(); return; }
      const avant = dernierJour(w.induction); if (n < w.induction.length) w.induction.splice(n); while (w.induction.length < n) w.induction.push(suite(w)); recaler(w, avant); R.brouillon(); R.render(); },
    /* pas d'induction : l'entretien part de J0 ; les séances et le début d'entretien saisis sont conservés pour être restaurés à l'identique */
    wSansInd(el) { const w = W(), e = w.entretien; if (el.checked && !w.sansInduction) { w.memoInd = { debutJour: e.debutJour }; w.sansInduction = true; e.debutJour = 0; } else if (!el.checked && w.sansInduction) { w.sansInduction = false; if (w.memoInd) e.debutJour = w.memoInd.debutJour; delete w.memoInd; if (!w.induction.length) w.induction.push(suite(w)); recaler(w, null); } R.brouillon(); R.render(); },
    /* mode de dose d'une phase : les valeurs saisies sont converties au poids du patient ; retour au mode précédent sans saisie ni changement de poids : valeur tapée restituée à l'identique */
    wMode(el) { const w = W(), pr = R.proto(w.protocoleId), ph = el.dataset.phase, vers = el.dataset.v, poids = poidsW(w); let perdu = false;
      (ph === 'entretien' ? [w.entretien] : w.induction).forEach(e => { const de = dtEtape(pr, e, ph), m = e.memoDose, retour = m && m.de === vers && m.vers === de && m.v === e.dose && m.poids === poids;
        const v = retour ? m.dose : convertir(pr, ph, e.dose, de, vers, poids); if (v == null && vers !== 'palier' && (e.dose != null || de === 'palier')) perdu = true; if (de !== vers) e.memoDose = { de, dose: e.dose, vers, v, poids }; e.dose = v; e.doseType = vers; });
      if (perdu) R.toast('Poids non renseigné : conversion impossible, saisissez la dose', 'warn'); R.brouillon(); R.render(); },
    wEnt(el) { const k = el.dataset.k; W().entretien[k] = k === 'voie' ? el.value : (el.value === '' ? null : +el.value); R.brouillon(); R.render(); },
    wSurvCustomAdd() { const l = document.getElementById('w-custom-label').value.trim(), d = document.getElementById('w-custom-date').value; if (!l || !d) { R.toast('Libellé et date requis', 'crit'); return; } if (isNaN(R.parse(d)) || d < W().dateDebut) { R.toast('La date doit être postérieure au début du traitement', 'crit'); return; } W().survCustom.push({ label: l, date: d }); R.render(); },
    wSurvCustomDel(el) { W().survCustom.splice(+el.dataset.i, 1); R.render(); },
    wMixte(el) { W().carnetMixte = el.checked; R.render(); },
    wReprise(el) { W().reprise = el.checked; R.brouillon(); R.render(); },
    wSection(el) { W().sec = +el.dataset.i; R.render(); },
    /* posologie : seules les doses et l'intervalle qu'elle définit changent (unités du protocole, modes remis par défaut) ; séances, jours, début de l'entretien et « pas d'induction » sont conservés */
    wVariante(el) { const w = W(), pr = R.proto(w.protocoleId), v = el.value === '' ? null : pr.variantes[+el.value], ref = R.appliquerVariante(pr, v), re = ref.entretien; w.variante = v ? +el.value : null;
      const poser = (e, r) => { e.dose = r.dose ?? null; if (r.doseType) e.doseType = r.doseType; else delete e.doseType; delete e.memoDose; };
      if (!v || v.doseInduction != null) w.induction.forEach((e, i) => poser(e, ref.induction[Math.min(i, ref.induction.length - 1)] || {}));
      if (re && w.entretien) { if (!v || v.doseEntretien != null) poser(w.entretien, re); if (!v || v.intervalleJours) w.entretien.intervalleJours = re.intervalleJours; w.entretien.label = re.label; }
      R.brouillon(); R.render(); },
    wCreate() { const p = creer(); if (!p) return; R.toast('Dossier créé, carnet généré', 'good'); R.go('patient', { id: p.id }); },
    wCreatePrint() { const p = creer(); if (!p) return; R.go('carnet', { id: p.id }); setTimeout(R.imprimer, 400); }
  });

  /* ---------- Carnet de suivi (document imprimable) ---------- */
  R.pages.carnet = {
    render(params) {
      const p = R.patient(params.id); if (!p) return '<div class="empty">Dossier introuvable.</div>';
      return `<div class="row between no-print mb16"><button class="btn" data-go="patient" data-params='${R.params({ id: p.id })}'>${R.icon('back')}Retour au dossier</button><div class="row"><span class="small muted">Format A4</span>${R.boutonsDoc()}</div></div>${R.carnetHTML(p)}`;
    }
  };
  /* schéma réellement planifié du cycle en cours : instantané de l'assistant pour le 1er cycle, sinon protocole avec la variante choisie (entretien direct à J0 le cas échéant, comme R.changerProtocole) ;
     « actuel » : entretien après la dernière modification de posologie (dose et intervalle) */
  R.schemaPatient = p => {
    const hs = p.historiqueProtocoles || [], h = hs.find(x => x.cycle === (p.cycleCourant || 1)) || hs.slice(-1)[0] || {}, snap = p.protocoleSnapshot, pr0 = R.proto(p.protocoleId) || {};
    const ok = !!snap && (p.cycleCourant || 1) === 1 && (!snap.protocoleId || snap.protocoleId === p.protocoleId), direct = ok ? !!snap.sansInduction : h.debut === 'entretien';
    const pr = ok ? pr0 : R.appliquerVariante(pr0, (pr0.variantes || []).find(v => v.nom === h.posologie) || null), dc = h.doseCourante;
    const e = (ok && snap.entretien) || (pr.entretien && direct ? Object.assign({}, pr.entretien, { debutJour: 0 }) : pr.entretien);
    return { pr, induction: direct ? [] : (ok ? snap.induction : pr.induction) || [], entretien: e, actuel: e && Object.assign({}, e, +h.intervalle ? { intervalleJours: +h.intervalle } : {}, dc ? { dose: dc.val, doseType: dc.type } : {}), modif: dc ? (h.modifications || []).slice(-1)[0] || {} : null, poids: h.poids || p.poids };
  };
  R.schemaTexte = p => {
    const s = R.schemaPatient(p), pr = s.pr, e = s.entretien, pt = Object.assign({}, pr, { induction: s.induction, entretien: e }), n = s.induction.length, po = pr.doseType === 'po';
    const dose = (x, ph) => R.doseEtape(pt, x, s.poids, ph).texte, freq = x => { const j = +x.intervalleJours || 56; return j % 7 ? `tous les ${j} jours` : `toutes les ${j / 7} semaine${j > 7 ? 's' : ''}`; };
    const ind = n ? `${po ? '' : n + ' séance' + (n > 1 ? 's' : '') + ' d’induction '}${s.induction.map(x => x.label).join(' · ')} — ${[...new Set(s.induction.map(x => dose(x, 'induction') + ' ' + x.voie))].join(' / ')}` : 'Sans induction (entretien direct)';
    if (!e) return ind;
    /* voie orale : libellé du protocole seulement s'il décrit le début réel de l'entretien ; sinon posologie quotidienne et renouvellement */
    const ent = po && n && +e.debutJour === +(pr.entretien || {}).debutJour ? e.label || '' : po ? `${dose(e, 'entretien')} ${e.voie} dès ${R.libelleJour(+e.debutJour || 0)} — renouvellement ${freq(e)}` : `entretien dès ${R.libelleJour(+e.debutJour || 0)} ${freq(e)} — ${dose(e, 'entretien')} ${e.voie}`;
    return ind + (n ? ', puis ' : ' : ') + ent + (s.modif ? ` ; posologie modifiée${s.modif.date ? ' le ' + R.fmtDate(s.modif.date) : ''} : ${dose(s.actuel, 'entretien')} ${s.actuel.voie} ${freq(s.actuel)}` : '');
  };
  R.carnetHTML = function (p) {
      const pr = R.proto(p.protocoleId), s = S.settings, art = R.article(pr.articleId), t = R.today();
      const band = `<div class="doc-band"><div><b>${esc(s.etablissement)}</b>${esc(s.service)}<br>${esc(s.unite)}</div><div class="r"><b>Carnet de suivi biothérapique</b>${esc(R.nomComplet(p))} · IPP ${esc(p.ipp)}<br>Édité le ${R.fmtDate(t)}</div></div>`;
      const foot = n => `<div class="doc-foot"><span>Document remis au patient — à présenter à chaque venue et à tout professionnel de santé consulté</span><span>Page ${n} / 4</span></div>`;
      const cureCourante = R.prochaineCure(p) || R.derniereCure(p);
      const vacc = p.bilan.find(b => b.id === 'vacc'); const bilanApp = p.bilan.filter(b => b.statut !== 'na');
      const ech = p.surveillance.filter(x => x.mode === 'echeance' && x.statut !== 'annulee').sort((a, b) => a.echeance.localeCompare(b.echeance));
      const curesVis = p.cures.filter(c => c.statut !== 'annulee');
      const hist = p.historiqueProtocoles || [];
      const histHTML = hist.length > 1 || (hist[0] && (hist[0].modifications || []).length) ? `<div class="doc-h2">Historique du traitement</div><table class="doc-table"><thead><tr><th>Cycle</th><th>Protocole</th><th>Début (J0)</th><th>Planifié jusqu’à</th><th>Fin / arrêt</th><th>Motif et modifications</th></tr></thead><tbody>${hist.map(x => `<tr><td class="m">${x.cycle}</td><td><b>${esc(R.proto(x.protocoleId)?.dci || x.protocoleId)}</b></td><td class="m">${R.fmtDate(x.dateDebut)}</td><td class="m">${esc(x.planifieJusqua || '—')}</td><td>${x.dateFin ? `${R.fmtDate(x.dateFin)} — arrêté à ${esc(x.arreteA || '')}` : 'en cours'}</td><td style="font-size:8.5pt">${x.motif ? 'Mise en place : ' + esc(x.motif) + '<br>' : ''}${x.motifFin ? 'Arrêt : ' + esc(x.motifFin) + '<br>' : ''}${(x.modifications || []).map(m => R.fmtDate(m.date) + ' — ' + esc(m.txt)).join('<br>')}</td></tr>`).join('')}</tbody></table>` : '';
      const ligneCure = c => `<tr class="${c.statut === 'realisee' ? 'doc-done' : ''}"><td class="m">${R.fmtDate(c.datePrevue)}${c.heure && c.voie === 'IV' ? '<br><span style="color:#7E8C88">' + c.heure + '</span>' : ''}</td><td><b>Séance</b> ${esc(c.label)}${(c.cycle || 1) > 1 ? ' <span style="color:#7E8C88">(c' + c.cycle + ')</span>' : ''}<br><span style="font-size:8pt;color:#7E8C88">${esc(R.proto(c.protocoleId || p.protocoleId)?.dci || '')} · ${esc(c.phase)} · ${c.voie}</span></td><td>${c.statut === 'realisee' ? (c.dose ? c.dose + ' mg' : esc(c.doseTexte)) : esc(c.doseTexte)}${c.flacons ? ` <span style="color:#7E8C88">(${c.flacons} u.)</span>` : ''}</td><td class="m">${c.dateReelle ? R.fmtDate(c.dateReelle) : ''}</td><td style="font-size:8.5pt">${c.statut === 'realisee' ? (c.poids ? c.poids + ' kg · ' : '') + (c.lot ? 'lot ' + esc(c.lot) + ' · ' : '') + esc((c.tolerance || '').slice(0, 60)) + (c.clinique && !R.cliniqueVide(c.clinique) ? '<br><i>' + esc(R.resumeClinique(c.clinique)) + '</i>' : '') : c.statut === 'reportee' ? 'Reportée — ' + esc((c.motif || '').slice(0, 50)) : ''}</td><td style="font-size:8pt">${c.statut === 'realisee' ? esc(R.userName(c.ide)) : ''}</td></tr>`;
      const ligneCtrl = x => `<tr class="${x.statut === 'faite' ? 'doc-done' : ''}"><td class="m">${R.fmtDate(x.echeance)}</td><td><b>Contrôle</b> ${esc(x.label)}<br><span style="font-size:8pt;color:#7E8C88">${esc(x.cat)} · ${R.libelleControle(x.jour || 0)}${x.cible ? ' · cible ' + esc(x.cible) : ''}</span></td><td></td><td class="m">${x.dateFaite ? R.fmtDate(x.dateFaite) : ''}</td><td style="font-size:8.5pt">${esc(x.resultat || '')}${x.note ? '<br><i>' + esc(x.note) + '</i>' : ''}</td><td style="font-size:8pt">${x.par ? esc(R.userName(x.par)) : ''}</td></tr>`;
      const planUnifie = [...curesVis.map(c => ({ d: c.datePrevue + (c.heure || ''), h: ligneCure(c) })), ...ech.map(x => ({ d: x.echeance + '50', h: ligneCtrl(x) }))].sort((a, b) => a.d.localeCompare(b.d)).map(x => x.h).join('');
      const vides = n => Array.from({ length: n }, () => `<tr><td class="m">&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('');
      const html = `<div class="carnet-wrap">
      <div class="carnet-page">${band}
        <div class="doc-title">Carnet de suivi biothérapique</div><div class="doc-sub">${esc(R.PATHOS[p.pathologie]?.label)} — traitement par ${esc(pr.dci)}</div>
        <div class="doc-h2">Identité du patient</div>
        <dl class="doc-kv"><div><dt>Nom, prénom</dt><dd>${esc(p.nom)} ${esc(p.prenom)}</dd></div><div><dt>Né(e) le</dt><dd>${R.fmtDate(p.ddn)} (${R.age(p.ddn)} ans) · ${p.sexe === 'F' ? 'F' : 'M'}</dd></div><div><dt>IPP</dt><dd>${esc(p.ipp)}</dd></div><div><dt>Téléphone</dt><dd>${esc(p.tel || '')}</dd></div><div><dt>Poids / taille</dt><dd>${p.poids} kg · ${p.taille || '—'} cm</dd></div><div><dt>Allergies</dt><dd>${esc(p.allergies)}</dd></div><div><dt>Maladie</dt><dd>${esc(R.PATHOS[p.pathologie]?.label)}${R.parisCode(p.paris, p.pathologie) ? ' · Paris ' + esc(R.parisCode(p.paris, p.pathologie)) : ''}</dd></div><div><dt>Diagnostic</dt><dd>${R.fmtDate(p.dateDiag, { month: 'long', year: 'numeric' })}</dd></div></dl>
        <div class="doc-h2">Traitement</div>
        <dl class="doc-kv"><div><dt>Biothérapie</dt><dd>${esc(pr.dci)} <span class="ui" style="font-weight:400">(${esc(pr.specialites)})</span></dd></div><div><dt>Classe</dt><dd>${esc(pr.classe)}</dd></div><div><dt>Voie</dt><dd>${esc(pr.voie)}</dd></div><div><dt>Présentation</dt><dd>${art ? esc(art.libelle) : '—'}</dd></div><div><dt>Schéma</dt><dd>${esc(R.schemaTexte(p))}${p.cycleCourant > 1 ? ` <span class="ui" style="font-weight:400">(cycle ${p.cycleCourant}, depuis le ${R.fmtDate(R.j0(p))})</span>` : ''}</dd></div><div><dt>Posologie actuelle</dt><dd>${esc(cureCourante?.doseTexte || '')}</dd></div><div><dt>Début du traitement</dt><dd>${R.fmtDate(p.dateDebut)}${p.cycleCourant > 1 ? ' · cycle en cours depuis le ' + R.fmtDate(R.j0(p)) : ''}</dd></div><div><dt>Prémédication</dt><dd>${esc(p.premedication || (p.cures.find(c => c.premedication && c.premedication !== 'Aucune') ? p.cures.filter(c => c.premedication && c.premedication !== 'Aucune').slice(-1)[0].premedication : 'Aucune'))}</dd></div><div><dt>Traitements associés</dt><dd>${esc(p.traitementsAssocies)}</dd></div><div><dt>Biothérapies antérieures</dt><dd>${esc(p.antecedentsBio)}</dd></div><div><dt>Médecin référent</dt><dd>${esc(R.userName(p.medecinId))}</dd></div><div><dt>Chef de service</dt><dd>${esc(s.chef)}</dd></div></dl>
        <div class="doc-box alert ui" style="margin-top:14px"><b>En cas de fièvre, d’infection ou de signe inhabituel, contactez l’hôpital de jour : ${esc(s.telHDJ)}</b><br>Urgences : ${esc(s.telUrgences)}. Présentez ce carnet à tout médecin, pharmacien, dentiste ou chirurgien.</div>
        <div class="doc-h2">Bilan pré-thérapeutique</div>
        <table class="doc-table"><thead><tr><th>Examen</th><th>Résultat</th><th>Date</th><th>Examen</th><th>Résultat</th><th>Date</th></tr></thead><tbody>${(() => { const rows = bilanApp.map(b => { const c = R.BILAN_PRE.find(x => x.id === b.id); return [esc(c.label.split(' (')[0].split(' :')[0]), b.statut === 'attente' ? 'en attente' : (b.statut === 'fait_anormal' ? 'anormal' : 'normal') + (b.commentaire ? ' — ' + esc(b.commentaire) : ''), b.date ? R.fmtDate(b.date) : '']; }); let h = ''; for (let i = 0; i < rows.length; i += 2) { const a = rows[i], b = rows[i + 1] || ['', '', '']; h += `<tr><td>${a[0]}</td><td>${a[1]}</td><td class="m">${a[2]}</td><td>${b[0]}</td><td>${b[1]}</td><td class="m">${b[2]}</td></tr>`; } return h; })()}</tbody></table>
        <p class="ui" style="font-size:9pt;margin:8px 0 0"><b>Vaccinations :</b> ${esc(vacc && vacc.commentaire ? vacc.commentaire : 'à compléter')} — vaccins vivants atténués contre-indiqués pendant le traitement et après l’arrêt pendant un délai propre à chaque molécule (voir le médecin) ; grippe chaque année, pneumocoque, hépatite B, HPV, zona recombinant recommandés.</p>
        ${foot(1)}</div>

      ${p.carnetMixte ? `<div class="carnet-page">${band}
        <div class="doc-h2" style="margin-top:0">Planification du traitement — séances et contrôles</div>
        <p class="ui" style="font-size:9pt;margin:0 0 8px;color:#4E5E59">Une seule chronologie : chaque ligne est une séance de perfusion ou un contrôle à réaliser. L’équipe note la date de réalisation, le résultat ou la tolérance, et signe. Objectifs STRIDE-II : disparition des symptômes, CRP normale, calprotectine < 250 µg/g, cicatrisation endoscopique à 6–12 mois.</p>
        ${histHTML}
        <table class="doc-table" style="margin-top:8px"><thead><tr><th>Date prévue</th><th>Élément</th><th>Dose</th><th>Réalisé le</th><th>Résultat / tolérance / notes</th><th>Visa</th></tr></thead><tbody>${planUnifie}${Array.from({ length: Math.max(3, 14 - curesVis.length - ech.length) }, () => '<tr><td class="m">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
        <div class="doc-h2">À chaque séance</div>
        <ul class="doc-list ui" style="font-size:9.5pt"><li>Examen clinique : poids, taille, puberté, syndrome digestif, douleur (articulaire ou abdominale), fièvre et température, signes cutanés et atteinte périnéale (abcès, fissure, fistule).</li><li>Tension artérielle et pouls avant l’administration ; recherche d’une infection en cours ; grossesse éventuelle.</li>${pr.voie.includes('IV') ? `<li>Perfusion : ${esc(pr.dureePerfusion)}. ${esc(pr.surveillancePerf)}</li>` : ''}</ul>
        ${foot(2)}</div>
      <div class="carnet-page">${band}
        <div class="doc-h2" style="margin-top:0">Auto-surveillance entre les séances (à noter par le patient)</div>
        <table class="doc-table"><thead><tr><th>Date</th><th>Symptômes (selles/jour, sang, douleurs, fièvre)</th><th>Poids</th><th>Événement (infection, voyage, autre traitement…)</th></tr></thead><tbody>${Array.from({ length: 14 }, () => '<tr><td class="m">&nbsp;</td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
        <div class="doc-h2">Injections à domicile (formes sous-cutanées)</div>
        <table class="doc-table"><thead><tr><th>Date</th><th>Dose</th><th>Site d’injection</th><th>Lot</th><th>Remarques</th></tr></thead><tbody>${Array.from({ length: 8 }, () => '<tr><td class="m">&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
        ${foot(3)}</div>` : `<div class="carnet-page">${band}
        <div class="doc-h2" style="margin-top:0">Tableau des séances — ${esc(pr.dci)}</div>${histHTML}
        <p class="ui" style="font-size:9pt;margin:0 0 8px;color:#4E5E59">Dose calculée sur le poids du jour. Le numéro de lot et la signature de l’infirmier(ère) sont reportés à chaque administration. Pour les injections sous-cutanées à domicile, le patient note la date, le site d’injection et le lot.</p>
        <table class="doc-table"><thead><tr><th>N°</th><th>Phase</th><th>Prévue le</th><th>Réalisée le</th><th>Poids</th><th>Dose</th><th>Lot</th><th>Tolérance / remarques</th><th>Visa IDE · PUI</th></tr></thead><tbody>
        ${curesVis.map(c => `<tr class="${c.statut === 'realisee' ? 'doc-done' : ''}"><td class="m">${c.n}</td><td>${esc(c.phase)} ${esc(c.label)}${(c.cycle || 1) > 1 ? ' (c' + c.cycle + ')' : ''}<br><span style="font-size:8pt;color:#7E8C88">${c.voie}</span></td><td class="m">${R.fmtDate(c.datePrevue)}</td><td class="m">${c.dateReelle ? R.fmtDate(c.dateReelle) : ''}</td><td class="m">${c.poids ? c.poids + ' kg' : ''}</td><td>${c.statut === 'realisee' ? (c.dose ? c.dose + ' mg' : esc(c.doseTexte)) : esc(c.doseTexte)}${c.flacons ? ` <span style="color:#7E8C88">(${c.flacons} u.)</span>` : ''}</td><td class="m">${esc(c.lot || '')}</td><td style="font-size:8.5pt">${c.statut === 'realisee' ? esc((c.tolerance || '').slice(0, 70)) : c.statut === 'reportee' ? 'Reportée — ' + esc((c.motif || '').slice(0, 50)) : ''}</td><td style="font-size:8pt">${c.statut === 'realisee' ? esc(R.userName(c.ide)) + (c.validationPharma ? ' · PUI ✓' : '') : ''}</td></tr>`).join('')}
        ${vides(Math.max(3, 18 - curesVis.length))}</tbody></table>
        ${foot(2)}</div>

      <div class="carnet-page">${band}
        <div class="doc-h2" style="margin-top:0">Calendrier des contrôles</div>
        <p class="ui" style="font-size:9pt;margin:0 0 8px;color:#4E5E59">Objectifs du traitement (STRIDE-II) : disparition des symptômes, CRP normale, calprotectine fécale < 250 µg/g, cicatrisation endoscopique à 6–12 mois.</p>
        <table class="doc-table"><thead><tr><th>Examen</th><th>Échéance</th><th>Réalisé le</th><th>Résultat</th><th>Visa</th></tr></thead><tbody>
        ${ech.map(x => `<tr class="${x.statut === 'faite' ? 'doc-done' : ''}"><td>${esc(x.label)}${x.cible ? `<br><span style="font-size:8pt;color:#7E8C88">Cible : ${esc(x.cible)}</span>` : ''}</td><td class="m">${R.fmtDate(x.echeance)} (${R.libelleControle(x.jour || 0)})</td><td class="m">${x.dateFaite ? R.fmtDate(x.dateFaite) : ''}</td><td style="font-size:9pt">${esc(x.resultat || '')}${x.note ? '<br><i>' + esc(x.note) + '</i>' : ''}</td><td style="font-size:8pt">${x.par ? esc(R.userName(x.par)) : ''}</td></tr>`).join('')}
        ${Array.from({ length: Math.max(2, 14 - ech.length) }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
        <div class="doc-h2">À chaque cure</div>
        <ul class="doc-list ui" style="font-size:9.5pt"><li>Examen clinique : poids, taille, puberté, syndrome digestif, douleur (articulaire ou abdominale), fièvre et température, signes cutanés et atteinte périnéale (abcès, fissure, fistule).</li><li>Tension artérielle et pouls avant l’administration ; recherche d’une infection en cours (fièvre, toux, brûlures urinaires, plaie) ; grossesse éventuelle.</li>${pr.voie.includes('IV') ? `<li>Perfusion : ${esc(pr.dureePerfusion)}. ${esc(pr.surveillancePerf)}</li>` : ''}</ul>
        <div class="doc-h2">Auto-surveillance entre les cures (à noter par le patient)</div>
        <table class="doc-table"><thead><tr><th>Date</th><th>Symptômes (selles/jour, sang, douleurs, fièvre)</th><th>Poids</th><th>Événement (infection, voyage, autre traitement…)</th></tr></thead><tbody>${Array.from({ length: 6 }, () => '<tr><td class="m">&nbsp;</td><td></td><td></td><td></td></tr>').join('')}</tbody></table>
        ${foot(3)}</div>`}

      ${(() => { const depuis = R.addDays(t, -548); const cb = R.courbesDoc(p, { depuis, max: 9, cols: 3 }); return cb ? `<div class="carnet-page">${band}<div class="doc-h2" style="margin-top:0">Évolution clinique et biologique (18 derniers mois)</div>${cb}<div class="doc-h2">Dernières valeurs</div>${R.tableDernieres(p, depuis)}${foot(4)}</div>` : ''; })()}
      <div class="carnet-page">${band}
        <div class="doc-h2" style="margin-top:0">Conduite à tenir — informations pour le patient</div>
        <div class="doc-cols ui" style="font-size:9.5pt">
          <div><div class="doc-box alert"><b>Contactez rapidement l’hôpital de jour si :</b><ul class="doc-list"><li>fièvre ≥ 38 °C, frissons, fatigue inhabituelle ;</li><li>toux persistante, essoufflement, sueurs nocturnes ;</li><li>infection urinaire, cutanée, dentaire, ORL ou herpès / zona ;</li><li>diarrhée avec sang inhabituelle ou douleurs abdominales importantes ;</li><li>éruption cutanée, démangeaisons, gonflement du visage, gêne respiratoire pendant ou après l’administration ;</li><li>jaunisse, urines foncées ;</li><li>fourmillements, troubles de la vue, faiblesse d’un membre ;</li><li>ganglions, amaigrissement, lésion cutanée qui change.</li></ul></div>
            <div class="doc-box"><b>Infections</b><br>Le traitement diminue les défenses immunitaires. Toute infection doit être traitée avant la cure suivante : ne pas réaliser la cure sans avis médical. Lavage des mains, éviter les contacts avec des personnes malades, hygiène alimentaire (listériose : produits au lait cru, charcuterie artisanale).</div>
            <div class="doc-box"><b>Vaccinations</b><br>Vaccins vivants atténués (BCG, ROR, fièvre jaune, varicelle, zona vivant) <b>contre-indiqués</b> pendant le traitement et pendant un délai après l’arrêt qui dépend du médicament : demandez l’avis du médecin avant tout vaccin. Recommandés : grippe chaque année, pneumocoque, hépatite B, HPV, zona recombinant, dTP-coq. L’entourage peut être vacciné normalement.</div></div>
          <div><div class="doc-box"><b>Grossesse, allaitement, contraception</b><br>Informez l’équipe avant tout projet de grossesse : la plupart des biothérapies peuvent être poursuivies sur avis spécialisé ; certaines molécules (inhibiteurs de JAK, modulateurs S1P) imposent une contraception efficace. Le nourrisson exposé in utero ne doit pas recevoir de vaccin vivant avant 6 à 12 mois.</div>
            <div class="doc-box"><b>Chirurgie, soins dentaires, examens</b><br>Prévenez le chirurgien, le dentiste et l’hôpital de jour : le calendrier des cures peut être adapté autour de l’intervention. Signalez toute anesthésie ou hospitalisation.</div>
            <div class="doc-box"><b>Voyages</b><br>Avis médical avant un séjour en zone tropicale (fièvre jaune = vaccin vivant, paludisme, tuberculose). Les stylos et seringues sous-cutanés voyagent au frais (2–8 °C) avec l’ordonnance et ce carnet.</div>
            <div class="doc-box"><b>Autres médicaments</b><br>Ne prenez pas de nouveau médicament (y compris sans ordonnance, plantes, compléments) sans en parler au pharmacien. Anti-inflammatoires (AINS) déconseillés en cas de poussée.</div>
            <div class="doc-box"><b>Carte de surveillance</b><br>Gardez la carte patient de la biothérapie sur vous pendant le traitement et 4 mois après la dernière administration.</div></div>
        </div>
        <div class="doc-h2">Observations de l’équipe</div>
        <div class="doc-box" style="min-height:70px"></div>
        <div class="doc-sign"><div>Médecin référent<br><span style="color:#7E8C88">${esc(R.userName(p.medecinId))}</span></div><div>Pharmacien — analyse et éducation</div><div>Infirmier(ère) — hôpital de jour</div></div>
        ${foot(4)}</div>
      </div>`;
      /* numérotation réelle des pages (leur nombre dépend du type de carnet) */
      const total = (html.match(/class="carnet-page"/g) || []).length; let num = 0;
      return html.replace(/Page \d+ \/ 4<\/span>/g, () => `Page ${++num} / ${total}</span>`);
  };


  /* ---------- Impressions ciblées : historique des bilans et contrôles, historique des séances ---------- */
  R.pages.impression = {
    render(params) {
      const p = R.patient(params.id); if (!p) return '<div class="empty">Dossier introuvable.</div>';
      const quoi = params.quoi === 'seances' ? 'seances' : 'bilans'; const mois = params.mois == null ? 12 : +params.mois; const avenir = !!params.avenir;
      const depuis = mois ? R.addDays(R.today(), -Math.round(mois * 30.44)) : null; const lien = o => R.params(Object.assign({ id: p.id, quoi, mois, avenir }, o));
      const opts = [[3, '3 mois'], [6, '6 mois'], [12, '12 mois'], [24, '24 mois'], [0, 'Tout']];
      return `<div class="row between no-print mb16" style="flex-wrap:wrap;gap:8px"><button class="btn" data-go="patient" data-params='${R.params({ id: p.id, tab: quoi === 'bilans' ? 'bilans' : (p.carnetMixte ? 'plan' : 'cures') })}'>${R.icon('back')}Retour au dossier</button>
        <div class="row" style="gap:6px;flex-wrap:wrap"><span class="small muted">Période</span>${opts.map(o => `<button type="button" class="btn sm${mois === o[0] ? ' primary' : ''}" data-go="impression" data-params='${lien({ mois: o[0] })}'>${o[1]}</button>`).join('')}
        <label class="check" style="padding:5px 9px"><input type="checkbox" data-go="impression" data-params='${lien({ avenir: !avenir })}'${avenir ? ' checked' : ''}> inclure ce qui est à venir</label>
        ${R.boutonsDoc()}</div></div>${quoi === 'bilans' ? R.impressionBilans(p, depuis, mois, avenir) : R.impressionSeances(p, depuis, mois, avenir)}`;
    }
  };
  const bandeImpr = (p, titre) => { const s = S.settings; return `<div class="doc-band"><div><b>${esc(s.etablissement)}</b>${esc(s.service)}<br>${esc(s.unite)}</div><div class="r"><b>${titre}</b>${esc(R.nomComplet(p))} · IPP ${esc(p.ipp)}<br>Édité le ${R.fmtDate(R.today())}</div></div>`; };
  const identiteImpr = p => { const pr = R.proto(p.protocoleId) || {}; const paris = R.parisCode(p.paris, p.pathologie); return `<dl class="doc-kv"><div><dt>Patient</dt><dd>${esc(p.nom)} ${esc(p.prenom)} · ${p.sexe === 'F' ? 'F' : 'M'} · ${R.age(p.ddn)} ans</dd></div><div><dt>Né(e) le</dt><dd>${R.fmtDate(p.ddn)}</dd></div><div><dt>Maladie</dt><dd>${esc((R.PATHOS[p.pathologie] || {}).label || '')}${paris ? ' · Paris ' + esc(paris) : ''}</dd></div><div><dt>Traitement</dt><dd>${esc(pr.dci || '')}${(p.cycleCourant || 1) > 1 ? ' · cycle ' + p.cycleCourant : ''}</dd></div></dl>`; };
  const periodeTxt = mois => mois ? `sur les ${mois} derniers mois` : 'depuis le début du suivi';
  const docTable = html => html.replace(/<div class="tbl-wrap">/g, '<div>').replace(/class="tbl"/g, 'class="doc-table"');
  const piedImpr = p => `<div class="doc-foot"><span>${esc(R.nomComplet(p))} — document médical confidentiel</span><span></span></div>`;

  R.impressionBilans = (p, depuis, mois, avenir) => {
    const t = R.today();
    const faits = p.surveillance.filter(s => s.statut === 'faite' && (!depuis || (s.dateFaite || '') >= depuis));
    const tdms = faits.filter(s => s.id === 'tdm').sort((a, b) => b.dateFaite.localeCompare(a.dateFaite));
    const autres = faits.filter(s => s.mode === 'echeance' && !R.estBio(s) && !R.estClin(s)).sort((a, b) => b.dateFaite.localeCompare(a.dateFaite));
    const annules = p.surveillance.filter(s => s.statut === 'annulee' && !s.annuleAuto && s.annuleLe && (!depuis || s.annuleLe >= depuis));
    const retard = p.surveillance.filter(s => s.statut === 'prevue' && s.mode === 'echeance' && s.echeance < t);
    const aVenir = avenir ? p.surveillance.filter(s => s.statut === 'prevue' && s.mode === 'echeance' && s.echeance >= t).sort((a, b) => a.echeance.localeCompare(b.echeance)).slice(0, 12) : [];
    const nbBio = faits.filter(s => R.estBio(s) && s.id !== 'tdm').length, nbClin = R.lignesCliniques(p).filter(r => r.d && (!depuis || r.date >= depuis)).length;
    const courbes = R.courbesDoc(p, { depuis, max: 9, cols: 3 });
    return `<div class="carnet-wrap"><div class="carnet-page">${bandeImpr(p, 'Compte rendu des bilans et contrôles')}${identiteImpr(p)}
      <div class="doc-box" style="margin-top:10px;font-size:10pt"><b>Période :</b> ${periodeTxt(mois)} — ${nbBio} bilan(s) biologique(s), ${tdms.length} dosage(s) pharmacologique(s), ${autres.length} endoscopie(s), imagerie(s) ou autre(s) contrôle(s), ${nbClin} examen(s) clinique(s).${retard.length ? ` <b>${retard.length} contrôle(s) en retard</b> : ${retard.map(s => esc(s.label.split(' (')[0]) + ' (' + R.fmtDate(s.echeance) + ')').join(', ')}.` : ''}</div>
      <div class="doc-h2">Dernières valeurs</div>${R.tableDernieres(p, depuis)}
      ${courbes ? `<div class="doc-h2">Évolution ${periodeTxt(mois)}</div>${courbes}` : ''}
      <div class="doc-h2">Résultats biologiques</div><div class="doc-dense">${docTable(R.tableBio(Object.assign({}, p, { surveillance: p.surveillance.filter(s => s.id !== 'tdm') }), depuis))}</div>
      ${tdms.length ? `<div class="doc-h2">Dosages pharmacologiques</div><table class="doc-table"><thead><tr><th>Date</th><th>Résultat</th><th>Lecture</th><th>Remarques</th></tr></thead><tbody>${tdms.map(s => { const i = R.interpTdm(R.tdmDe(s, p)); return `<tr><td class="m">${R.fmtDate(s.dateFaite)}</td><td>${esc(s.resultat || '')}</td><td style="font-size:9pt">${esc(s.interpretation || i.texte || '')}${i.cible ? ` <span style="color:#7E8C88">(cible ${esc(i.cible)})</span>` : ''}</td><td style="font-size:9pt">${esc(s.note || '')}</td></tr>`; }).join('')}</tbody></table>` : ''}
      ${autres.length ? `<div class="doc-h2">Endoscopies, imagerie et autres contrôles</div><table class="doc-table"><thead><tr><th>Date</th><th>Examen</th><th>Résultat</th><th>Remarques</th></tr></thead><tbody>${autres.map(s => `<tr><td class="m">${R.fmtDate(s.dateFaite)}</td><td><b>${esc(s.label)}</b><br><span style="font-size:8.5pt;color:#7E8C88">${esc(s.cat || '')}</span></td><td>${esc(s.resultat || '')}</td><td style="font-size:9pt">${esc(s.note || '')}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="doc-h2">Examens cliniques</div><div class="doc-dense">${docTable(R.tableClinique(p, depuis))}</div>
      ${annules.length ? `<div class="doc-h2">Contrôles annulés</div><table class="doc-table"><tbody>${annules.map(s => `<tr><td class="m" style="width:24mm">${R.fmtDate(s.echeance)}</td><td>${esc(s.label)}${s.note ? ' — ' + esc(s.note) : ''} <span style="color:#7E8C88">(annulé le ${R.fmtDate(s.annuleLe)}${s.annulePar ? ' par ' + esc(R.userName(s.annulePar)) : ''})</span></td></tr>`).join('')}</tbody></table>` : ''}
      ${aVenir.length ? `<div class="doc-h2">Contrôles à venir</div><table class="doc-table"><tbody>${aVenir.map(s => `<tr><td class="m" style="width:24mm">${R.fmtDate(s.echeance)}</td><td>${esc(s.label)}${s.avantSeance ? ' — à prélever avant la perfusion ' + esc(s.avantSeance) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="doc-sign" style="grid-template-columns:1fr 1fr"><div>Médecin<br><span style="color:#7E8C88">${esc(R.userName(p.medecinId))}</span></div><div>Date et signature</div></div>
      ${piedImpr(p)}</div></div>`;
  };

  R.impressionSeances = (p, depuis, mois, avenir) => {
    const t = R.today(); const dateDe = c => c.dateReelle || c.datePrevue;
    const liste = p.cures.filter(c => (!depuis || dateDe(c) >= depuis) && (avenir || dateDe(c) <= t || c.statut !== 'prevue')).sort((a, b) => dateDe(a).localeCompare(dateDe(b)));
    const faites = liste.filter(c => c.statut === 'realisee'); const reactions = faites.filter(c => /Réaction/.test(c.tolerance || ''));
    const absences = p.cures.reduce((n, c) => n + (c.absences || []).filter(a => !depuis || a.date >= depuis).length, 0) || liste.filter(c => c.statut === 'manquee').length;
    const deplacements = p.cures.flatMap(c => (c.reports || []).filter(r => r.vers && (!depuis || r.date >= depuis))).length;
    const annulees = liste.filter(c => c.statut === 'annulee').length;
    const inter = faites.slice(1).map((c, i) => R.diffDays(faites[i].dateReelle, c.dateReelle)).filter(x => x > 0); const interMoy = inter.length ? Math.round(inter.reduce((a, b) => a + b, 0) / inter.length) : null;
    const mgkg = faites.filter(c => c.dose && c.poids && c.voie === 'IV').map(c => c.dose / c.poids); const mgkgMoy = mgkg.length ? (mgkg.reduce((a, b) => a + b, 0) / mgkg.length) : null;
    const statut = c => ({ realisee: 'Réalisée', prevue: dateDe(c) < t ? 'Non enregistrée' : 'Prévue', reportee: 'Reportée', manquee: 'Manquée', annulee: 'Annulée' })[c.statut] || c.statut;
    const ligne = c => { const pr = R.protoDeCure(p, c) || {}; const k = c.constantes || {}; const cl = c.clinique && !R.cliniqueVide(c.clinique) ? R.resumeClinique(c.clinique) : '';
      const reps = (c.reports || []).filter(r => r.vers).map(r => `déplacée du ${R.fmtDate(r.de)}${r.vers ? ' au ' + R.fmtDate(r.vers) : ''} (${esc(R.CATS_REPORT[r.categorie] || r.categorie || '')}${r.motif ? ' : ' + esc(r.motif) : ''})`);
      const abs = (c.absences || []).map(a => `absent le ${R.fmtDate(a.date)}${a.motif ? ' (' + esc(a.motif) + ')' : ''}`);
      return `<tr class="${c.statut === 'realisee' ? '' : 'doc-done'}"><td class="m">${R.fmtDate(dateDe(c))}${c.heure && c.voie === 'IV' ? '<br>' + c.heure : ''}</td><td><b>${esc(c.label)}</b><br><span style="font-size:8.5pt;color:#7E8C88">${esc(c.phase || '')}${(c.cycle || 1) > 1 ? ' · cycle ' + c.cycle : ''}</span></td><td>${esc(pr.dci || '')} ${esc(c.doseTexte || '')}<br><span style="font-size:8.5pt;color:#4E5E59">${c.voie || ''}${c.flacons ? ' · ' + c.flacons + ' unité(s)' : ''}${c.lot ? ' · lot ' + esc(c.lot) : ''}</span></td><td class="m">${c.poids ? c.poids + ' kg' : ''}${c.constantes ? `<br><span style="font-size:8pt">TA ${esc(k.ta || '—')} · FC ${esc(k.fc || '—')} · ${esc(k.temp || '—')} °C</span>` : ''}</td><td style="font-size:9pt">${c.statut === 'realisee' ? esc(c.tolerance || '') : esc(c.motif || '')}${c.premedication && c.premedication !== 'Aucune' ? `<br>Prémédication : ${esc(c.premedication)}` : ''}${cl ? `<br><span style="color:#4E5E59">${esc(cl)}</span>` : ''}${reps.length || abs.length ? `<br><span style="color:#7E8C88">${[...abs, ...reps].join(' ; ')}</span>` : ''}</td><td style="font-size:9pt"><b>${statut(c)}</b>${c.statut === 'realisee' && c.ide ? '<br>' + esc(R.userName(c.ide)) : ''}</td></tr>`; };
    return `<div class="carnet-wrap"><div class="carnet-page">${bandeImpr(p, 'Historique des séances')}${identiteImpr(p)}
      <div class="doc-box" style="margin-top:10px;font-size:10pt"><b>Période :</b> ${periodeTxt(mois)} — ${faites.length} séance(s) réalisée(s), ${absences} absence(s), ${deplacements} déplacement(s), ${annulees} annulation(s), ${reactions.length ? `<b>${reactions.length} réaction(s) à la perfusion</b>` : 'aucune réaction à la perfusion'}.${interMoy ? ` Intervalle moyen réel entre deux séances : ${interMoy} jours.` : ''}${mgkgMoy ? ` Dose moyenne reçue en perfusion : ${R.fmtV(mgkgMoy)} mg/kg.` : ''}</div>
      ${reactions.length ? `<div class="doc-h2">Réactions à la perfusion</div><ul class="doc-list">${reactions.map(c => `<li><b>${R.fmtDate(c.dateReelle)} — ${esc(c.label)}</b> : ${esc(c.tolerance)}</li>`).join('')}</ul>` : ''}
      <div class="doc-h2">Séances</div>
      ${liste.length ? `<table class="doc-table"><thead><tr><th style="width:18mm">Date</th><th style="width:18mm">Séance</th><th>Traitement · dose · lot</th><th style="width:26mm">Poids · constantes</th><th>Tolérance · examen · déplacements</th><th style="width:22mm">Statut</th></tr></thead><tbody>${liste.map(ligne).join('')}</tbody></table>` : '<p class="cr-p">Aucune séance sur cette période.</p>'}
      <div class="doc-sign" style="grid-template-columns:1fr 1fr"><div>Hôpital de jour<br><span style="color:#7E8C88">${esc(S.settings.unite || '')}</span></div><div>Date et signature</div></div>
      ${piedImpr(p)}</div></div>`;
  };
  /* ---------- Compte rendu de suivi : document clinique structuré (résumé, résultats, remarques, conclusion) ---------- */
  R.pages.compteRendu = {
    render(params) {
      const p = R.patient(params.id); if (!p) return '<div class="empty">Dossier introuvable.</div>';
      const mois = params.mois == null ? 12 : +params.mois; const depuis = mois ? R.addDays(R.today(), -Math.round(mois * 30.44)) : null;
      const opts = [[6, '6 mois'], [12, '12 mois'], [24, '24 mois'], [0, 'Tout le suivi']];
      return `<div class="row between no-print mb16" style="flex-wrap:wrap;gap:8px"><button class="btn" data-go="patient" data-params='${R.params({ id: p.id })}'>${R.icon('back')}Retour au dossier</button><div class="row" style="gap:6px;flex-wrap:wrap"><span class="small muted">Période</span>${opts.map(o => `<button type="button" class="btn sm${mois === o[0] ? ' primary' : ''}" data-go="compteRendu" data-params='${R.params({ id: p.id, mois: o[0] })}'>${o[1]}</button>`).join('')}${R.can('dossier', 'w') ? '<span class="small muted" style="margin-left:8px">Les zones en pointillé se modifient avant impression</span>' : ''}${R.boutonsDoc()}</div></div>${R.compteRenduHTML(p, depuis, mois)}`;
    }
  };
  const grpBilan = s => ((R.itemBilan(s.id) || {}).groupe || {}).id || (String(s.id).match(/^libre-(\w+)/) || [])[1] || '';
  const rythme = j => !j ? '' : j === 7 ? 'chaque semaine' : j % 7 === 0 ? `toutes les ${j / 7} semaines` : `tous les ${j} jours`;
  const phr = s => String(s).trim().replace(/[\s.;,:]+$/, '') + '.';
  const CE = (() => { try { const x = document.createElement('div'); x.contentEditable = 'plaintext-only'; return x.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; } catch (e) { return 'true'; } })(); /* zones du compte rendu en texte brut quand le navigateur le permet */
  /* éléments du suivi sur la période, communs au résumé et au corps du document */
  function donneesCR(p, depuis) {
    const t = R.today(), pr = R.proto(p.protocoleId) || {}, hist = p.historiqueProtocoles || [];
    const cyc = hist.find(h => h.statut === 'en cours') || hist.slice(-1)[0] || {}; const cc = R.prochaineCure(p) || R.derniereCure(p);
    const faites = p.cures.filter(c => c.statut === 'realisee' && c.dateReelle && (!depuis || c.dateReelle >= depuis)).sort((a, b) => a.dateReelle.localeCompare(b.dateReelle));
    const inter = faites.slice(1).map((c, i) => R.diffDays(faites[i].dateReelle, c.dateReelle)).filter(x => x > 0);
    const morpho = p.surveillance.filter(x => x.statut === 'faite' && x.dateFaite && x.mode === 'echeance' && !R.estBio(x) && !R.estClin(x)).sort((a, b) => b.dateFaite.localeCompare(a.dateFaite));
    const voie = (cc && cc.voie) || pr.voie || '', ryt = pr.doseType === 'po' || voie === 'PO' ? '' : rythme(+cyc.intervalle || +(pr.entretien || {}).intervalleJours || 0); /* voie orale : l'intervalle du protocole est le renouvellement, pas un rythme de prise */
    /* induction en cours : dose d'induction, puis entretien tel que planifié (première séance d'entretien qui suit) */
    const ind = cc && /induction/i.test(cc.phase || '') && cc.statut !== 'realisee' ? { phase: cc.phase.toLowerCase(), dose: [cc.doseTexte, cc.voie].filter(Boolean).join(' ') } : null;
    const ent = ind && p.cures.filter(c => c.phase === 'Entretien' && (c.cycle || 1) === (cc.cycle || 1) && !['annulee', 'realisee'].includes(c.statut) && c.datePrevue >= cc.datePrevue).sort((a, b) => a.datePrevue.localeCompare(b.datePrevue))[0];
    if (ind) ind.suite = ent ? [ent.doseTexte, ent.voie, ryt, 'dès ' + ent.label].filter(Boolean).join(' ') : (pr.entretien || {}).label || 'entretien';
    const voies = new Set((faites.length ? faites : [cc || {}]).map(c => c.voie || pr.voie));
    const tdm = p.surveillance.filter(x => x.id === 'tdm' && x.statut === 'faite' && x.dateFaite).sort((a, b) => b.dateFaite.localeCompare(a.dateFaite))[0] || null;
    const mol = tdm ? ((R.tdmDe(tdm, p) || {}).molecule || R.moleculeCycle(p, tdm.cycle)).toLowerCase() : '';
    return { t, pr, cyc, cc, faites, morpho, examens: morpho.filter(x => !depuis || x.dateFaite >= depuis).slice(0, 6), interMoy: inter.length ? Math.round(inter.reduce((a, b) => a + b, 0) / inter.length) : null,
      manquees: p.cures.reduce((n, c) => n + (c.absences || []).filter(a => !depuis || a.date >= depuis).length, 0) || p.cures.filter(c => c.statut === 'manquee' && (!depuis || c.datePrevue >= depuis)).length,
      reactions: faites.filter(c => /Réaction/.test(c.tolerance || '')), lieu: voies.size > 1 ? ' à l’administration' : voies.has('IV') ? ' à la perfusion' : voies.has('SC') ? ' à l’injection' : '',
      /* dosage d'un cycle antérieur : molécule nommée, sans valeur de recommandation pour le traitement en cours */
      tdm, tdmAutre: !!tdm && (tdm.cycle || 1) !== (p.cycleCourant || 1), tdmMol: !mol || mol === 'autre' ? '' : (/^[aeiouyh]/.test(mol) ? 'd’' : 'de ') + mol,
      rythme: ryt, voie, ind, poso: ind ? `${ind.dose} (${ind.phase}), puis ${ind.suite}` : [cc && cc.doseTexte, voie, ryt].filter(Boolean).join(' · ') };
  }
  /* résumé automatique de la période, en phrases courtes : modifiable, régénérable */
  R.resumeCR = (p, depuis, mois) => {
    const d = donneesCR(p, depuis), t = d.t, fem = p.sexe === 'F', paris = R.parisCode(p.paris, p.pathologie), L = [];
    const patho = ((R.PATHOS[p.pathologie] || {}).label || '').replace(/^./, c => c.toLowerCase());
    L.push(`${fem ? 'Patiente' : 'Patient'} de ${R.age(p.ddn)} ans${patho ? ` ${fem ? 'suivie' : 'suivi'} pour une ${patho}${paris ? ` (Paris ${paris})` : ''}${p.dateDiag ? ` diagnostiquée en ${R.fmtDate(p.dateDiag, { month: 'long', year: 'numeric' })}` : ''}` : ''}.`);
    const phase = { induction: `phase d’induction${d.rythme ? ', entretien prévu ' + d.rythme : ''}`, entretien: 'phase d’entretien', suspendu: `traitement suspendu${p.motifSuspension ? ' (' + p.motifSuspension + ')' : ''}`, termine: `traitement arrêté${p.dateFin ? ' le ' + R.fmtDate(p.dateFin) : ''}${p.motifFin ? ' (' + p.motifFin + ')' : ''}` }[p.statut] || '';
    L.push(phr(`Traitement : ${[d.pr.dci, d.cc && d.cc.doseTexte, d.voie, p.statut !== 'induction' && d.rythme].filter(Boolean).join(' ')} depuis le ${R.fmtDate(d.cyc.dateDebut || p.dateDebut)}${(p.cycleCourant || 1) > 1 ? ` (cycle ${p.cycleCourant})` : ''}${phase ? ' — ' + phase : ''}`));
    L.push(`${depuis ? `Sur les ${mois} derniers mois` : 'Depuis le début du suivi'} : ${d.faites.length} séance(s) réalisée(s), ${d.manquees ? d.manquees + ' séance(s) manquée(s)' : 'aucune séance manquée'}, ${d.reactions.length ? `${d.reactions.length} réaction(s)${d.lieu} (${d.reactions.map(c => R.fmtDate(c.dateReelle)).join(', ')})` : 'aucune réaction' + d.lieu}.`);
    const series = R.seriesBio(p);
    const bio = [['crp', 'CRP'], ['calpro', 'calprotectine'], ['hb', 'hémoglobine'], ['alb', 'albumine']].map(([k, nom]) => { const ch = series.find(c => c.key === k); if (!ch) return ''; const ev = R.evolSerie(ch, ch.lignes[0]); if (!ev.last || (depuis && ev.last.date < depuis)) return '';
      const det = [ev.hors ? 'hors référence' : '', ev.sens, ev.prev ? `précédent ${ev.prev.sym || ''}${R.fmtV(ev.prev.v)}` : ''].filter(Boolean).join(', '); return `${nom} ${ev.last.sym || ''}${R.fmtV(ev.last.v)}${ch.unite ? ' ' + ch.unite : ''}${det ? ` (${det})` : ''}`; }).filter(Boolean);
    L.push(bio.length ? `Biologie : ${bio.join(' ; ')}.` : `Aucun résultat biologique chiffré ${depuis ? `sur les ${mois} derniers mois` : 'depuis le début du suivi'}.`);
    if (d.tdm) { const td = R.tdmDe(d.tdm, p) || {}; const i = R.interpTdm(td); const niv = { bas: 'sous la cible', haut: 'au-dessus de la cible', cible: 'dans la cible' }[i.niveau];
      L.push(phr(`Dernier dosage pharmacologique${d.tdmMol ? ' ' + d.tdmMol : ''} (${R.fmtDate(d.tdm.dateFaite)}${d.tdmAutre ? ', traitement précédent' : ''}) : ${td.taux != null ? `résiduel ${R.fmtV(td.taux)} µg/mL, ${R.AC_LIB[td.ac] || R.AC_LIB.nd}` : d.tdm.resultat || 'résultat non chiffré'}${niv ? ` — ${niv}${i.cible ? ` (${i.cible})` : ''}` : ''}`)); }
    const endo = d.morpho.find(x => grpBilan(x) === 'endo' || /scopie/i.test(x.label)), imag = d.morpho.find(x => grpBilan(x) === 'radio' || /IRM|échographie|scanner|radiographie|imagerie/i.test(x.label));
    [[endo, 'Dernière endoscopie'], [imag, 'Dernière imagerie']].forEach(([x, lib]) => { if (x) L.push(phr(`${lib} (${R.fmtDate(x.dateFaite)}) : ${x.label.split(' (')[0]}${x.resultat ? ' — ' + x.resultat : ''}`)); });
    const nextC = ['suspendu', 'termine'].includes(p.statut) ? null : p.cures.filter(c => c.statut === 'prevue' && c.datePrevue >= t).sort((a, b) => a.datePrevue.localeCompare(b.datePrevue))[0];
    const ech = p.surveillance.filter(s => s.statut === 'prevue' && s.mode === 'echeance' && s.echeance).sort((a, b) => a.echeance.localeCompare(b.echeance)); const nextS = ech.find(s => s.echeance >= t), retard = ech.filter(s => s.echeance < t);
    const suite = [nextC ? `prochaine séance le ${R.fmtDate(nextC.datePrevue)} (${nextC.label})` : '', nextS ? `prochain contrôle le ${R.fmtDate(nextS.echeance)} : ${nextS.label.split(' (')[0]}` : '', retard.length ? `${retard.length} contrôle(s) en retard : ${retard.slice(0, 3).map(s => `${s.label.split(' (')[0]} (${R.fmtDate(s.echeance)})`).join(', ')}` : ''].filter(Boolean);
    if (suite.length) L.push(phr(suite.join(' ; ').replace(/^./, c => c.toUpperCase())));
    return L.join('\n');
  };
  R.compteRenduHTML = function (p, depuis, mois) {
    const s = S.settings, d = donneesCR(p, depuis), t = d.t, pr = d.pr, cc = d.cc, cr = p.cr || {}, ed = R.can('dossier', 'w');
    /* zones modifiables avec le droit d'écriture sur le dossier (texte brut) ; résumé et conclusion modifiés : repris seulement s'ils partent du texte automatique actuel, sinon texte à jour + alerte */
    const e = (k, def, tag, ph) => {
      const suivi = k === 'resume' || k === 'conclusion', perime = suivi && cr[k] != null && cr[k + 'Auto'] !== def, v = cr[k] != null && !perime ? cr[k] : def; tag = tag || 'span';
      if (!ed) return ph && !v ? '' : `<${tag}${tag === 'div' ? ' class="cr-bloc"' : ''}>${esc(v)}</${tag}>`;
      const lib = k === 'resume' ? ['Votre résumé modifié', 'le résumé à jour ci-dessous sera imprimé'] : ['Votre conclusion modifiée', 'la conclusion à jour ci-dessous sera imprimée'];
      const alerte = perime ? `<div class="callout warn no-print ui cr-perime mb8" data-k="${k}">${lib[0]}${cr[k + 'Le'] ? ' le ' + R.fmtDate(cr[k + 'Le']) : ''} portait sur d’autres données (période ou dossier modifiés depuis) : ${lib[1]} à sa place.<div class="row mt8" style="gap:6px"><button type="button" class="btn sm" data-action="crRestaurer" data-pid="${p.id}" data-k="${k}">Restaurer ma version</button><button type="button" class="btn sm ghost" data-action="crRegenerer" data-pid="${p.id}" data-k="${k}">Régénérer</button></div></div>` : '';
      return `${alerte}<${tag} class="cr-edit${tag === 'div' ? ' cr-bloc' : ''}${ph && !v ? ' vide' : ''}" contenteditable="${CE}" data-input="crChamp" data-pid="${p.id}" data-k="${k}"${suivi ? ` data-auto="${esc(def)}"` : ''}${ph ? ` data-placeholder="${esc(ph)}"` : ''} spellcheck="true">${esc(v)}</${tag}>`;
    };
    const fem = p.sexe === 'F'; const paris = R.parisCode(p.paris, p.pathologie);
    const periode = mois ? `sur les ${mois} derniers mois` : 'depuis le début du suivi';
    const faits = R.faitsMarquants(p).filter(x => !depuis || x.date >= depuis || /Début du traitement/.test(x.titre)).slice(0, 8);
    const tdmI = d.tdm ? R.interpTdm(R.tdmDe(d.tdm, p)) : null; const der = d.faites[d.faites.length - 1];
    const aVenir = R.planPatient(p, 'tout').filter(x => x.date >= t && ((x.c && x.c.statut === 'prevue') || (x.s && x.s.statut === 'prevue'))).slice(0, 6);
    const epingles = p.notes.filter(n => n.epingle).slice(0, 4);
    const statut = { induction: 'induction', entretien: 'entretien', suspendu: 'suspendu', termine: 'arrêté' }[p.statut] || '';
    /* le dosage n'oriente la conclusion que pour le traitement en cours (pas un cycle antérieur, pas un traitement arrêté) */
    const conclDef = [tdmI && tdmI.texte && !d.tdmAutre && p.statut !== 'termine' ? phr(`Dernier dosage (${R.fmtDate(d.tdm.dateFaite)}) : ${d.tdm.resultat}`) + ' ' + tdmI.texte : '', p.statut === 'suspendu' ? phr(`Traitement suspendu${p.motifSuspension ? ' : ' + p.motifSuspension : ''}`) + ' Reprise à rediscuter.' : p.statut === 'termine' ? 'Traitement arrêté.' : `Poursuite ${pr.dci ? 'du traitement par ' + pr.dci.replace(/^./, c => c.toLowerCase()) : 'de la biothérapie'}${d.ind ? ` : ${d.ind.phase} ${d.ind.dose}, puis ${d.ind.suite},` : cc && cc.doseTexte ? ' (' + cc.doseTexte + ')' : ''} selon le calendrier prévu.`].filter(Boolean).join(' ');
    const band = `<div class="doc-band"><div><b>${esc(s.etablissement)}</b>${esc(s.service)}<br>${esc(s.unite)} · Tél. ${esc(s.telHDJ || '')}</div><div class="r"><b>Compte rendu de suivi</b>${esc(R.nomComplet(p))} · IPP ${esc(p.ipp)}<br>${R.fmtDateLong(t)}</div></div>`;
    const foot = (n, tot) => `<div class="doc-foot" style="break-before:avoid"><span>Compte rendu de suivi — ${esc(R.nomComplet(p))} — document médical confidentiel</span><span>Page ${n} / ${tot}</span></div>`;
    /* page 2 sur une feuille A4 : le tableau n'est pas borné, les courbes lui cèdent la place (6, puis 3, puis aucune) */
    const tab = R.tableDernieres(p, depuis), place = (d.tdm ? 13 : 16) - ((tab.match(/<tr>/g) || []).length - 1), nC = place >= 0 ? 6 : place >= -6 ? 3 : 0;
    const courbes = nC ? R.courbesDoc(p, { depuis, max: nC, cols: 3 }) : '';
    const p1 = `<dl class="doc-kv"><div><dt>Patient</dt><dd>${esc(p.nom)} ${esc(p.prenom)}</dd></div><div><dt>IPP</dt><dd>${esc(p.ipp)}</dd></div><div><dt>Sexe · âge</dt><dd>${fem ? 'Femme' : 'Homme'} · ${R.age(p.ddn)} ans · ${fem ? 'née' : 'né'} le ${R.fmtDate(p.ddn)}</dd></div><div><dt>Maladie</dt><dd>${esc((R.PATHOS[p.pathologie] || {}).label || p.pathologie || '—')}${paris ? ' · Paris ' + esc(paris) : ''}</dd></div><div><dt>Diagnostic</dt><dd>${p.dateDiag ? R.fmtDate(p.dateDiag, { month: 'long', year: 'numeric' }) : '—'}</dd></div><div><dt>Médecin référent</dt><dd>${esc(R.userName(p.medecinId))}</dd></div>${p.medecinTraitant ? `<div><dt>Médecin traitant</dt><dd>${esc(p.medecinTraitant)}</dd></div>` : ''}<div><dt>Période couverte</dt><dd>${mois ? `${mois} derniers mois (${R.fmtDate(depuis)} → ${R.fmtDate(t)})` : `tout le suivi (depuis le ${R.fmtDate(p.dateDebut)})`}</dd></div></dl>
        <div class="doc-h2 cr-h2">Résumé${ed ? `<button type="button" class="btn sm ghost no-print${cr.resume != null ? '' : ' hidden'}" data-action="crRegenerer" data-pid="${p.id}" data-k="resume">Régénérer le résumé</button>` : ''}</div>${e('resume', R.resumeCR(p, depuis, mois), 'div')}
        <div class="doc-h2">Traitement</div>
        <dl class="doc-kv"><div><dt>Biothérapie</dt><dd>${esc(pr.dci || '')} <span class="ui" style="font-weight:400">(${esc(pr.specialites || '')})</span></dd></div><div><dt>Posologie</dt><dd>${esc(d.poso)}</dd></div><div><dt>Depuis le</dt><dd>${R.fmtDate(d.cyc.dateDebut || p.dateDebut)}${(p.cycleCourant || 1) > 1 ? ` · cycle ${p.cycleCourant}` : ''}${statut ? ' · ' + statut : ''}</dd></div><div><dt>Traitements associés</dt><dd>${esc(p.traitementsAssocies || '—')}</dd></div><div><dt>Biothérapies antérieures</dt><dd>${esc(p.antecedentsBio || '—')}</dd></div><div><dt>Allergies · comorbidités</dt><dd>${esc(p.allergies || '—')} · ${esc(p.comorbidites || '—')}</dd></div></dl>
        ${faits.length ? `<div class="doc-h2">Faits marquants</div><table class="doc-table"><tbody>${faits.map(f => `<tr><td class="m" style="width:24mm">${R.fmtDate(f.date)}</td><td>${esc(f.titre)}</td></tr>`).join('')}</tbody></table>` : ''}
        <div class="doc-h2">Déroulement des séances ${periode}</div>
        <p class="cr-p">${d.faites.length} séance(s) réalisée(s)${der ? ` — dernière le ${R.fmtDate(der.dateReelle)} (${esc(der.label)})` : ''}${d.interMoy ? `, intervalle moyen ${d.interMoy} jours` : ''} ; ${d.manquees ? d.manquees + ' séance(s) manquée(s)' : 'aucune séance manquée'} ; ${d.reactions.length ? `${d.reactions.length} réaction(s)${d.lieu} (${d.reactions.map(c => R.fmtDate(c.dateReelle)).join(', ')})` : 'aucune réaction' + d.lieu}.${p.statut === 'suspendu' ? ` <b>Traitement actuellement suspendu</b> : ${esc(p.motifSuspension || '')}.` : ''}</p>`;
    const p2 = `<div class="doc-h2">Résultats</div>${tab}
        ${d.tdm ? `<div class="doc-box" style="margin-top:8px"><b>Dosage pharmacologique${d.tdmMol ? ' ' + esc(d.tdmMol) : ''} du ${R.fmtDate(d.tdm.dateFaite)}${d.tdmAutre ? ' (traitement précédent)' : ''}</b> — ${esc(d.tdm.resultat || '')}${tdmI && tdmI.texte && !(d.tdmAutre && !tdmI.cible) ? `<br><span style="font-size:9.5pt">${d.tdmAutre ? '' : esc(tdmI.texte)}${tdmI.cible ? `${d.tdmAutre ? '' : ' '}Cible indicative : ${esc(tdmI.cible)}.` : ''}</span>` : ''}</div>` : ''}
        ${courbes ? `<div class="doc-h2">Évolution ${periode}</div>${courbes}` : ''}`;
    const p3 = `${d.examens.length ? `<div class="doc-h2">Endoscopies et imagerie</div><table class="doc-table"><tbody>${d.examens.map(x => `<tr><td class="m" style="width:24mm">${R.fmtDate(x.dateFaite)}</td><td><b>${esc(x.label)}</b>${x.resultat ? ' — ' + esc(x.resultat) : ''}${x.note ? `<br><span style="font-size:9pt;color:#4E5E59">${esc(x.note)}</span>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
        ${ed || epingles.length || cr.remarques ? `<div class="cr-sec"><div class="doc-h2">Remarques</div>${epingles.length ? `<ul class="doc-list">${epingles.map(n => `<li><b>${esc(R.titreNote(n))}</b>${n.titre ? ' — ' + esc(n.txt) : ''} <span style="color:#7E8C88">(${R.fmtDate(n.date)})</span></li>`).join('')}</ul>` : ''}${e('remarques', '', 'div', 'Remarques libres : tolérance, observance, projet thérapeutique… (facultatif, non imprimé si vide)')}</div>` : ''}
        <div class="doc-h2">Suite de la prise en charge</div>
        ${aVenir.length ? `<table class="doc-table"><tbody>${aVenir.map(x => `<tr><td class="m" style="width:24mm">${R.fmtDate(x.date)}</td><td>${x.c ? `Séance ${esc(x.c.label)} — ${esc((R.protoDeCure(p, x.c) || {}).dci || '')} ${esc(x.c.doseTexte || '')}` : `Contrôle — ${esc(x.s.label)}${x.s.avantSeance ? ` (avant la ${d.voie === 'IV' ? 'perfusion' : 'séance'})` : ''}`}</td></tr>`).join('')}</tbody></table>` : '<p class="cr-p">Aucune échéance programmée.</p>'}
        <div class="doc-h2">Conclusion</div>
        ${e('conclusion', conclDef, 'div')}
        <div class="doc-box" style="font-size:9pt;margin-top:10px"><b>Consignes</b> — Fièvre, infection ou symptôme inhabituel : contacter l’hôpital de jour${s.telHDJ ? ' au ' + esc(s.telHDJ) : ''} avant la séance suivante. Pas de vaccin vivant atténué sous biothérapie ; vaccins inactivés recommandés (grippe, pneumocoque, zona recombinant). Tout nouveau traitement est à signaler à l’équipe.</div>
        <div class="doc-sign" style="grid-template-columns:1fr 1fr"><div>Médecin<br>${e('signataire', R.userName(p.medecinId) + ' — ' + ((R.userById(p.medecinId) || {}).fonction || 'Gastro-entérologue'))}</div><div>Date et signature</div></div>`;
    const pages = courbes || !nC ? [p1, p2, p3] : [p1, p2 + p3]; /* sans courbes (peu de données), résultats et suite tiennent sur une page */
    return `<div class="carnet-wrap cr">${pages.map((c, i) => `<div class="carnet-page">${band}${c}${foot(i + 1, pages.length)}</div>`).join('')}</div>`;
  };
  /* saisie : garde du droit ici, la délégation « input » ne passe pas par R.autorise ; le texte automatique de départ est gardé pour détecter une version périmée */
  R.actions.crChamp = el => { const p = R.patient(el.dataset.pid); if (!p || !R.can('dossier', 'w')) return; p.cr = p.cr || {}; const k = el.dataset.k, v = el.innerText.trim(); p.cr[k] = v; if (el.dataset.auto != null) { p.cr[k + 'Auto'] = el.dataset.auto; p.cr[k + 'Le'] = R.today(); } if (el.dataset.placeholder) el.classList.toggle('vide', !v); const a = document.querySelector(`.cr-perime[data-k="${k}"]`); if (a) a.remove(); const b = document.querySelector(`.cr-h2 [data-action="crRegenerer"][data-k="${k}"]`); if (b) b.classList.remove('hidden'); clearTimeout(R.ui.crTimer); R.ui.crTimer = setTimeout(() => R.touch(), 500); };
  R.actions.crRegenerer = el => { const q = el.dataset.params ? JSON.parse(el.dataset.params) : el.dataset, p = R.patient(q.pid), k = q.k; if (!p || !p.cr || !R.can('dossier', 'w')) return;
    if (!q.ok && p.cr[k]) { R.confirmer(`Régénérer ${k === 'conclusion' ? 'la conclusion' : 'le résumé'} ?`, 'Votre version modifiée sera remplacée par le texte automatique à jour. Cette action est définitive.', 'crRegenerer', { pid: p.id, k, ok: 1 }); return; }
    R.closeModal(); clearTimeout(R.ui.crTimer); delete p.cr[k]; delete p.cr[k + 'Auto']; delete p.cr[k + 'Le']; R.touch(); R.render(); };
  R.actions.crRestaurer = el => { const p = R.patient(el.dataset.pid), k = el.dataset.k, z = document.querySelector(`.cr-edit[data-k="${k}"]`); if (!p || !p.cr || p.cr[k] == null || !z || !R.can('dossier', 'w')) return; p.cr[k + 'Auto'] = z.dataset.auto; R.touch(); R.render(); };
  /* collage dans le compte rendu : texte brut seulement, ce qui est imprimé est ce qui est enregistré (repli pour les navigateurs sans « plaintext-only ») */
  document.addEventListener('paste', ev => { const z = ev.target && ev.target.closest && ev.target.closest('.cr-edit'); if (!z || z.contentEditable === 'plaintext-only' || !ev.clipboardData) return; ev.preventDefault(); document.execCommand('insertText', false, ev.clipboardData.getData('text/plain')); });
})(window.RYZE);
