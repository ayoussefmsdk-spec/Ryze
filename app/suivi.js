/* =====================================================================
   Ryze — suivi.js : bilans de surveillance structurés
   (clinique à chaque séance, endoscopique, biologique, radiologique),
   plan de surveillance configurable, formulaires de saisie, tableaux
   ===================================================================== */
'use strict';
(function (R) {
  R.actions = R.actions || {};
  const esc = s => R.esc(s);

  /* ---------- Référentiel des bilans (validé par le service) ---------- */
  R.PERIODES = [[14, '2 semaines'], [30, '1 mois'], [91, '3 mois'], [182, '6 mois'], [365, '1 an']];
  R.periodeLabel = j => j === 'cure' ? 'à chaque séance' : ((R.PERIODES.find(p => p[0] === +j) || [j, `tous les ${j} j`])[1]);
  R.BILANS = [
    { id: 'clinique', label: 'Bilan clinique', periode: 'cure', desc: 'rempli à chaque séance, dans la fenêtre « Fait »', items: [
      { id: 'clin', label: 'Examen clinique de la séance', type: 'clinique', desc: 'poids, taille, puberté, syndrome digestif, douleur (articulaire / abdominale), fièvre et température, signes cutanés et atteinte périnéale (abcès, fissure, fistule), remarques', fixe: true }
    ] },
    { id: 'endo', label: 'Bilan endoscopique', periode: 365, items: [
      { id: 'colo', label: 'Coloscopie et fibroscopie haute', desc: 'score endoscopique, biopsies' },
      { id: 'recto', label: 'Rectoscopie' }
    ] },
    { id: 'bio', label: 'Bilan biologique', periode: 91, items: [
      { id: 'biostd', label: 'Bilan biologique standard', type: 'composite', desc: 'décochez les analyses non souhaitées', sous: [
        { id: 'nfs', label: 'NFS', unite: '' }, { id: 'crp', label: 'CRP', unite: 'mg/L' }, { id: 'transa', label: 'ASAT / ALAT', unite: 'UI/L' }, { id: 'b12', label: 'Vitamine B12', unite: 'pg/mL' }, { id: 'alb', label: 'Albumine', unite: 'g/L' }, { id: 'ferr', label: 'Ferritine', unite: 'ng/mL' }
      ] },
      { id: 'vit', label: 'Dosage vitaminique', type: 'libre', desc: 'saisissez le dosage souhaité et sa période ; plusieurs possibles', placeholder: 'ex. vitamine D, folates, zinc' },
      { id: 'calpro', label: 'Calprotectine fécale', periode: 182, unite: 'µg/g', cible: '< 250 µg/g' },
      { id: 'tdm', label: 'Dosage de l’anti-TNF (taux résiduel : infliximab, adalimumab…)', periodeChoix: true, unite: 'µg/mL', cible: 'résiduel selon la molécule : infliximab 3–7 µg/mL, adalimumab ≥ 7,5 µg/mL', defaut: false },
      { id: 'actnf', label: 'Suivi annuel des anticorps anti-TNF', periode: 365, defaut: false }
    ] },
    { id: 'radio', label: 'Bilan radiologique', periode: 365, items: [
      { id: 'irm', label: 'Entéro-IRM' },
      { id: 'echo', label: 'Échographie abdominale avec doppler', periode: 182 }
    ] }
  ];
  R.itemBilan = id => { for (const g of R.BILANS) { const it = g.items.find(x => x.id === id); if (it) return Object.assign({ groupe: g }, it); } return null; };
  /* compatibilité : R.surv(id) sert encore aux anciens dossiers, à la prolongation et à l'éditeur de protocoles */
  const survAncien = R.surv;
  R.surv = id => { const it = R.itemBilan(id); if (it) { const per = it.periode || it.groupe.periode; return { id: it.id, label: it.label, cat: it.groupe.label, mode: per === 'cure' ? 'cure' : 'periodique', tousLes: per === 'cure' ? null : per, cible: it.cible, type: it.type }; } return survAncien(id); };
  R.CATALOGUE_SURV = () => [...R.BILANS.flatMap(g => g.items.map(it => ({ id: it.id, cat: g.label, label: it.label }))), ...R.SURVEILLANCE.filter(s => s.mode !== 'cure' && !R.itemBilan(s.id)).map(s => ({ id: s.id, cat: 'Autres contrôles', label: s.label }))];

  /* ---------- Configuration d'un plan de surveillance ---------- */
  R.cfgDefaut = proto => {
    const cfg = { groupes: {}, items: {} }; const ANC = { nfs: 'biostd', crp: 'biostd', bh: 'biostd', creat: 'biostd', endo: 'colo', coloscopie: 'colo', calprotectine: 'calpro', tdm: 'tdm' }; const defs = ((proto && proto.surveillanceDefaut) || []).map(id => ANC[id] || id); if (defs.includes('colo') && ((proto && proto.surveillanceDefaut) || []).includes('endo')) defs.push('recto');
    const antiTNF = proto && /TNF/.test(proto.classe || '');
    R.BILANS.forEach(g => g.items.forEach(it => { const on = it.fixe || defs.includes(it.id) || (it.defaut !== false && !defs.length) || (antiTNF && (it.id === 'tdm' || it.id === 'actnf')); cfg.items[it.id] = { on: !!on, periode: null, sous: it.type === 'composite' ? it.sous.map(s => s.id) : undefined, entries: it.type === 'libre' ? [] : undefined }; if (it.id === 'tdm' && on && !cfg.items[it.id].periode) cfg.items[it.id].periode = 91; }));
    return cfg;
  };
  R.cfgDepuisPatient = p => { const cfg = R.cfgDefaut(null); Object.values(cfg.items).forEach(c => c.on = false); if (p.planSurveillance) return JSON.parse(JSON.stringify(p.planSurveillance)); R.BILANS.forEach(g => g.items.forEach(it => { const e = p.surveillance.filter(s => s.id === it.id); if (e.length) { cfg.items[it.id].on = true; if (it.type === 'composite' && e[0].sous) cfg.items[it.id].sous = e[0].sous; if (it.type === 'libre') cfg.items[it.id].entries = [...new Set(e.map(x => x.nom).filter(Boolean))].map(nom => ({ nom, periode: e.find(x => x.nom === nom).periode || 91 })); else if (e[0].periode) cfg.items[it.id].periode = e[0].periode; } })); cfg.items.clin.on = true; return cfg; };
  R.periodeItem = (cfg, g, it, c) => { if (it.periode === 'cure' || g.periode === 'cure') return 'cure'; return +(c && c.periode) || it.periode || +(cfg.groupes && cfg.groupes[g.id]) || g.periode; };
  R.genererSurveillanceCfg = (cfg, dateDebut, horizon, cycle) => {
    const out = []; horizon = horizon || 365;
    const serie = (g, it, per, extra) => { const base = Object.assign({ id: it.id, label: it.label, cat: g.label, type: it.type, cible: it.cible, unite: it.unite, gen: true, cycle: cycle || 1 }, extra); if (per === 'cure') { out.push(Object.assign(base, { mode: 'cure', echeance: null, statut: 'cure' })); return; } per = Math.max(7, +per || 91); for (let j = per; j <= horizon; j += per) out.push(Object.assign({}, base, { mode: 'echeance', jour: j, echeance: R.addDays(dateDebut, j), statut: 'prevue', periode: per })); };
    R.BILANS.forEach(g => g.items.forEach(it => { const c = cfg.items && cfg.items[it.id]; if (!c || !c.on) return;
      if (it.type === 'libre') { (c.entries || []).filter(e => e.nom && e.nom.trim()).forEach(e => serie(g, it, +e.periode || R.periodeItem(cfg, g, it, c), { label: `${it.label} : ${e.nom.trim()}`, nom: e.nom.trim() })); return; }
      if (it.type === 'composite' && Array.isArray(c.sous) && !c.sous.length) return; /* aucune analyse cochée : rien à programmer */
      serie(g, it, R.periodeItem(cfg, g, it, c), it.type === 'composite' ? { sous: (c.sous && c.sous.length ? c.sous : it.sous.map(s => s.id)) } : {}); }));
    return out.sort((a, b) => (a.jour || 0) - (b.jour || 0));
  };

  /* Formulaire de configuration (assistant et dossier) — ctx : { get: () => cfg, after: fn } */
  R.formPlanSurveillance = (cfg) => {
    const perSel = (val, id, extra, vide) => `<select class="inline-input" data-change="${id}" ${extra}>${vide ? `<option value="">${esc(vide)}</option>` : ''}${R.PERIODES.map(p => `<option value="${p[0]}"${+val === p[0] ? ' selected' : ''}>${p[1]}</option>`).join('')}</select>`;
    return `<div class="stack">${R.BILANS.map(g => { const gp = (cfg.groupes && cfg.groupes[g.id]) || g.periode; return `<div class="card"><div class="card-head"><div><h2>${esc(g.label)}</h2>${g.desc ? `<div class="sub">${esc(g.desc)}</div>` : ''}</div>${g.periode === 'cure' ? '<span class="badge accent">à chaque séance</span>' : `<div class="row"><span class="small muted">Période du bilan</span>${perSel(gp, 'cfgGroupe', `data-g="${g.id}"`)}</div>`}</div>
      <div class="card-body stack" style="gap:8px">${g.items.map(it => { const c = (cfg.items && cfg.items[it.id]) || { on: false }; const per = R.periodeItem(cfg, g, it, c); const propre = it.periode && it.periode !== 'cure';
        return `<div class="check${c.on ? ' on' : ''}" style="flex-wrap:wrap"><input type="checkbox" id="cfg-${it.id}" data-change="cfgItem" data-id="${it.id}"${c.on ? ' checked' : ''}${it.fixe ? ' disabled' : ''}><label for="cfg-${it.id}" class="grow" style="cursor:pointer"><b>${esc(it.label)}</b><span>${it.desc ? esc(it.desc) + ' · ' : ''}${per === 'cure' ? 'à chaque séance' : (c.periode ? 'période propre : ' : propre ? 'période propre : ' : 'suit le bilan : ') + R.periodeLabel(per)}</span></label>
          ${c.on && per !== 'cure' ? `<div class="row" style="width:100%;padding-left:24px;gap:8px"><span class="small muted">Période de ce contrôle</span>${perSel(c.periode || '', 'cfgPeriode', `data-id="${it.id}"`, `suivre le bilan (${R.periodeLabel(propre ? it.periode : gp)})`)}</div>` : ''}
          ${c.on && it.type === 'composite' ? `<div class="row" style="width:100%;padding-left:24px;gap:6px">${it.sous.map(s => `<label class="check" style="padding:4px 8px"><input type="checkbox" data-change="cfgSous" data-id="${it.id}" data-sid="${s.id}"${(c.sous || []).includes(s.id) ? ' checked' : ''}> ${esc(s.label)}</label>`).join('')}</div>` : ''}
          ${c.on && it.type === 'libre' ? `<div class="stack" style="width:100%;padding-left:24px;gap:6px">${(c.entries || []).map((e, i) => `<div class="row" style="gap:6px"><input type="text" class="inline-input" style="width:240px!important" value="${esc(e.nom || '')}" placeholder="${esc(it.placeholder || '')}" data-input="cfgLibreNom" data-id="${it.id}" data-i="${i}">${perSel(e.periode || 91, 'cfgLibrePer', `data-id="${it.id}" data-i="${i}"`)}<button type="button" class="btn sm ghost" data-action="cfgLibreDel" data-id="${it.id}" data-i="${i}">${R.icon('x', 'ico')}</button></div>`).join('')}<div><button type="button" class="btn sm" data-action="cfgLibreAdd" data-id="${it.id}">+ Ajouter un dosage</button></div></div>` : ''}</div>`; }).join('')}</div></div>`; }).join('')}</div>`;
  };
  const ctx = () => R.ui.cfgCtx; const cfgOf = () => ctx().get();
  Object.assign(R.actions, {
    cfgGroupe(el) { const cfg = cfgOf(); cfg.groupes = cfg.groupes || {}; cfg.groupes[el.dataset.g] = +el.value; ctx().after(); },
    cfgItem(el) { const cfg = cfgOf(); const it = R.itemBilan(el.dataset.id); cfg.items[el.dataset.id] = cfg.items[el.dataset.id] || { on: false, periode: null, sous: it && it.type === 'composite' ? it.sous.map(s => s.id) : undefined, entries: it && it.type === 'libre' ? [] : undefined }; cfg.items[el.dataset.id].on = el.checked; if (el.checked && el.dataset.id === 'tdm' && !cfg.items.tdm.periode) cfg.items.tdm.periode = 91; if (el.checked && it && it.type === 'libre' && !cfg.items[el.dataset.id].entries.length) cfg.items[el.dataset.id].entries.push({ nom: '', periode: 91 }); ctx().after(); },
    cfgPeriode(el) { cfgOf().items[el.dataset.id].periode = el.value ? +el.value : null; ctx().after(); },
    cfgSous(el) { const c = cfgOf().items[el.dataset.id]; c.sous = c.sous || []; if (el.checked) { if (!c.sous.includes(el.dataset.sid)) c.sous.push(el.dataset.sid); } else c.sous = c.sous.filter(x => x !== el.dataset.sid); const it = R.itemBilan(el.dataset.id); c.sous.sort((a, b) => it.sous.findIndex(s => s.id === a) - it.sous.findIndex(s => s.id === b)); ctx().after(true); },
    cfgLibreAdd(el) { const c = cfgOf().items[el.dataset.id]; c.entries = c.entries || []; c.entries.push({ nom: '', periode: 91 }); ctx().after(); },
    cfgLibreDel(el) { cfgOf().items[el.dataset.id].entries.splice(+el.dataset.i, 1); ctx().after(); },
    cfgLibreNom(el) { cfgOf().items[el.dataset.id].entries[+el.dataset.i].nom = el.value; ctx().after(true); },
    cfgLibrePer(el) { cfgOf().items[el.dataset.id].entries[+el.dataset.i].periode = +el.value; ctx().after(true); }
  });

  /* ---------- Examen clinique (à chaque séance) ---------- */
  R.CLINIQUE = { puberte: ['Non applicable (adulte)', 'Tanner 1', 'Tanner 2', 'Tanner 3', 'Tanner 4', 'Tanner 5'], douleurLoc: [['articulaire', 'Articulaire'], ['abdominale', 'Abdominale']], perineal: [['abces', 'Abcès'], ['fissure', 'Fissure'], ['fistule', 'Fistule']] };
  R.formClinique = (d, o) => { d = d || {}; o = o || {}; const chk = (name, arr, sel) => arr.map(x => `<label class="check" style="padding:5px 9px"><input type="checkbox" name="${name}" value="${x[0]}"${(sel || []).includes(x[0]) ? ' checked' : ''}> ${x[1]}</label>`).join('');
    return `<div class="form-grid">
      ${o.avecPoids ? `<div class="field"><label>Poids (kg)</label><input type="number" step="0.1" name="cl_poids" value="${d.poids ?? ''}"></div>` : ''}
      <div class="field"><label>Taille (cm)</label><input type="number" name="cl_taille" value="${d.taille ?? ''}"></div>
      <div class="field"><label>Puberté</label><select name="cl_puberte">${R.CLINIQUE.puberte.map(x => `<option${(d.puberte || R.CLINIQUE.puberte[0]) === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field span3"><label>Syndrome digestif</label><input type="text" name="cl_digestif" value="${esc(d.digestif || '')}" placeholder="ex. 3 selles/j, sans sang, pas de douleur nocturne"></div>
      <div class="field span3"><label>Douleur</label><div class="row" style="gap:6px"><label class="check" style="padding:5px 9px"><input type="checkbox" name="cl_douleur"${d.douleur ? ' checked' : ''}> <b>Présente</b></label>${chk('cl_douleurLoc', R.CLINIQUE.douleurLoc, d.douleurLoc)}<input type="text" name="cl_douleurNote" class="grow" value="${esc(d.douleurNote || '')}" placeholder="où exactement, intensité, horaire…"></div></div>
      <div class="field span3"><label>Fièvre</label><div class="row" style="gap:6px"><label class="check" style="padding:5px 9px"><input type="radio" name="cl_fievre" value="non"${d.fievre ? '' : ' checked'}> Non</label><label class="check" style="padding:5px 9px"><input type="radio" name="cl_fievre" value="oui"${d.fievre ? ' checked' : ''}> Oui</label><input type="number" step="0.1" name="cl_temperature" class="inline-input w110" value="${d.temperature ?? ''}" placeholder="T° °C"><input type="text" name="cl_fievreNote" class="grow" value="${esc(d.fievreNote || '')}" placeholder="depuis quand, frissons, foyer…"></div></div>
      <div class="field span3"><label>Signes cutanés · atteinte périnéale</label><div class="row" style="gap:6px">${chk('cl_perineal', R.CLINIQUE.perineal, d.perineal)}<input type="text" name="cl_cutaneNote" class="grow" value="${esc(d.cutaneNote || '')}" placeholder="autres signes cutanés, siège, évolution…"></div></div>
      <div class="field span3"><label>Remarques</label><input type="text" name="cl_remarques" value="${esc(d.remarques || '')}" placeholder="tout élément utile pour le suivi"></div></div>`; };
  R.lireClinique = fd => { const g = k => fd.get(k); const d = { taille: g('cl_taille') ? +g('cl_taille') : null, puberte: g('cl_puberte') || '', digestif: (g('cl_digestif') || '').trim(), douleur: !!g('cl_douleur'), douleurLoc: fd.getAll('cl_douleurLoc'), douleurNote: (g('cl_douleurNote') || '').trim(), fievre: g('cl_fievre') === 'oui', temperature: g('cl_temperature') ? +g('cl_temperature') : null, fievreNote: (g('cl_fievreNote') || '').trim(), perineal: fd.getAll('cl_perineal'), cutaneNote: (g('cl_cutaneNote') || '').trim(), remarques: (g('cl_remarques') || '').trim() }; if (fd.has('cl_poids') && g('cl_poids')) d.poids = +g('cl_poids'); if (d.douleurLoc.length || d.douleurNote) d.douleur = true; if (d.temperature && d.temperature >= 38) d.fievre = true; return d; };
  R.cliniqueVide = d => !d || !(d.douleur || d.fievre || (d.perineal && d.perineal.length) || d.digestif || d.remarques || d.taille || d.cutaneNote || (d.puberte && !/Non applicable/.test(d.puberte)));
  R.resumeClinique = d => { if (!d) return ''; const p = []; if (d.douleur) p.push('Douleur ' + ((d.douleurLoc || []).map(x => (R.CLINIQUE.douleurLoc.find(y => y[0] === x) || [x, x])[1].toLowerCase()).join(' + ') || 'présente') + (d.douleurNote ? ' (' + d.douleurNote + ')' : '')); if (d.fievre) p.push('Fièvre' + (d.temperature ? ' ' + d.temperature + ' °C' : '') + (d.fievreNote ? ' (' + d.fievreNote + ')' : '')); if (d.perineal && d.perineal.length) p.push('Périnéal : ' + d.perineal.map(x => (R.CLINIQUE.perineal.find(y => y[0] === x) || [x, x])[1].toLowerCase()).join(', ') + (d.cutaneNote ? ' (' + d.cutaneNote + ')' : '')); else if (d.cutaneNote) p.push('Cutané : ' + d.cutaneNote); if (d.digestif) p.push('Digestif : ' + d.digestif); if (d.puberte && !/Non applicable/.test(d.puberte)) p.push(d.puberte); if (d.remarques) p.push(d.remarques); return p.length ? p.join(' · ') : 'Examen clinique sans particularité'; };
  R.alerteClinique = d => !!d && (d.fievre || (d.perineal && d.perineal.includes('abces')) || (d.perineal && d.perineal.includes('fistule')));

  /* ---------- Saisie d'un contrôle selon son type ---------- */
  R.formSaisieControle = s => {
    const it = R.itemBilan(s.id) || {};
    if (s.type === 'clinique' || it.type === 'clinique') return R.formClinique(s.clinique, { avecPoids: true });
    if (s.type === 'composite' || it.type === 'composite') { const sous = (s.sous && s.sous.length ? s.sous : (it.sous || []).map(x => x.id)); return `<div class="form-grid">${sous.map(sid => { const d = (it.sous || []).find(x => x.id === sid) || { id: sid, label: sid, unite: '' }; return `<div class="field"><label>${esc(d.label)}${d.unite ? ` <span class="muted">(${esc(d.unite)})</span>` : ''}</label><input type="text" name="val_${sid}" value="${esc((s.valeurs || {})[sid] || '')}" placeholder="${d.unite ? 'valeur' : 'résultat'}"></div>`; }).join('')}</div>
      <div class="field"><label>Remarques (interprétation, conduite à tenir)</label><textarea name="note" placeholder="ex. anémie ferriprive → supplémentation ; CRP normale">${esc(s.note || '')}</textarea></div>`; }
    return `<div class="form-grid"><div class="field span2"><label>Résultat${s.unite ? ` <span class="muted">(${esc(s.unite)})</span>` : ''}</label><input type="text" name="resultat" value="${esc(s.resultat || '')}" required placeholder="${esc(s.cible ? 'cible : ' + s.cible : 'résultat, conclusion')}"></div></div><div class="field"><label>Remarques (visibles dans l’historique et le carnet)</label><textarea name="note" placeholder="ex. cicatrisation muqueuse partielle → maintien du traitement">${esc(s.note || '')}</textarea></div>`;
  };
  R.lireSaisieControle = (s, fd) => {
    const it = R.itemBilan(s.id) || {};
    if (s.type === 'clinique' || it.type === 'clinique') { s.clinique = R.lireClinique(fd); s.resultat = R.resumeClinique(s.clinique); s.note = s.clinique.remarques || ''; return; }
    if (s.type === 'composite' || it.type === 'composite') { const sous = (s.sous && s.sous.length ? s.sous : (it.sous || []).map(x => x.id)); s.valeurs = {}; sous.forEach(sid => { const v = (fd.get('val_' + sid) || '').trim(); if (v) s.valeurs[sid] = v; }); s.resultat = sous.filter(sid => s.valeurs[sid]).map(sid => { const d = (it.sous || []).find(x => x.id === sid) || { label: sid, unite: '' }; return `${d.label} ${s.valeurs[sid]}${d.unite ? ' ' + d.unite : ''}`; }).join(' · ') || 'fait'; s.note = (fd.get('note') || '').trim(); return; }
    s.resultat = (fd.get('resultat') || '').trim(); s.note = (fd.get('note') || '').trim();
  };

  /* ---------- Tableaux du dossier : examens cliniques et résultats biologiques ---------- */
  R.tableClinique = p => {
    const rows = [...p.cures.filter(c => c.statut === 'realisee' && c.clinique && !R.cliniqueVide(c.clinique)).map(c => ({ date: c.dateReelle, src: `Séance ${c.label}`, poids: c.poids, d: c.clinique })), ...p.surveillance.filter(s => s.statut === 'faite' && s.clinique).map(s => ({ date: s.dateFaite, src: s.label, poids: s.clinique.poids, d: s.clinique }))].sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Contexte</th><th>Poids</th><th>Taille</th><th>Douleur</th><th>Fièvre</th><th>Périnéal / cutané</th><th>Digestif · remarques</th></tr></thead><tbody>${rows.map(r => `<tr class="${R.alerteClinique(r.d) ? '' : ''}"><td class="nowrap">${R.fmtDate(r.date)}</td><td class="small">${esc(r.src)}</td><td class="num">${r.poids ? r.poids + ' kg' : '—'}</td><td class="num">${r.d.taille ? r.d.taille + ' cm' : '—'}</td><td class="small">${r.d.douleur ? `<span class="badge warn">${(r.d.douleurLoc || []).map(x => (R.CLINIQUE.douleurLoc.find(y => y[0] === x) || [x, x])[1]).join(' + ') || 'oui'}</span> ${esc(r.d.douleurNote || '')}` : '<span class="muted">non</span>'}</td><td class="small">${r.d.fievre ? `<span class="badge crit">${r.d.temperature ? r.d.temperature + ' °C' : 'oui'}</span> ${esc(r.d.fievreNote || '')}` : '<span class="muted">non</span>'}</td><td class="small">${(r.d.perineal || []).length ? `<span class="badge crit">${r.d.perineal.map(x => (R.CLINIQUE.perineal.find(y => y[0] === x) || [x, x])[1]).join(', ')}</span> ` : ''}${esc(r.d.cutaneNote || '')}${!(r.d.perineal || []).length && !r.d.cutaneNote ? '<span class="muted">RAS</span>' : ''}</td><td class="small">${esc(r.d.digestif || '')}${r.d.digestif && r.d.remarques ? ' · ' : ''}${esc(r.d.remarques || '')}${r.d.puberte && !/Non applicable/.test(r.d.puberte) ? ' · ' + esc(r.d.puberte) : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun examen clinique saisi — remplissez le bilan clinique dans la fenêtre « Fait » d’une séance</td></tr>'}</tbody></table></div>`;
  };
  R.tableBio = p => {
    const faits = p.surveillance.filter(s => s.statut === 'faite' && (s.valeurs || ['calpro', 'tdm', 'vit', 'actnf'].includes(s.id) || (R.itemBilan(s.id) && R.itemBilan(s.id).groupe.id === 'bio')));
    if (!faits.length) return '<div class="empty">Aucun résultat biologique saisi</div>';
    const cols = []; const add = (k, l) => { if (!cols.some(c => c.k === k)) cols.push({ k, l }); };
    const bio = R.itemBilan('biostd'); faits.forEach(s => { if (s.valeurs) Object.keys(s.valeurs).forEach(k => add(k, (bio.sous.find(x => x.id === k) || { label: k }).label)); else add(s.id + (s.nom ? ':' + s.nom : ''), s.nom ? s.nom : s.label.split(' (')[0]); });
    const dates = [...new Set(faits.map(s => s.dateFaite))].sort((a, b) => b.localeCompare(a));
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th>${cols.map(c => `<th>${esc(c.l)}</th>`).join('')}<th>Remarques</th></tr></thead><tbody>${dates.map(d => { const ss = faits.filter(s => s.dateFaite === d); return `<tr><td class="nowrap">${R.fmtDate(d)}</td>${cols.map(c => { let v = ''; ss.forEach(s => { if (s.valeurs && s.valeurs[c.k]) v = s.valeurs[c.k]; else if (!s.valeurs && c.k === s.id + (s.nom ? ':' + s.nom : '')) v = s.resultat; }); return `<td class="num small">${esc(v || '')}</td>`; }).join('')}<td class="small">${esc(ss.map(s => s.note).filter(Boolean).join(' · '))}</td></tr>`; }).join('')}</tbody></table></div>`;
  };
})(window.RYZE);
