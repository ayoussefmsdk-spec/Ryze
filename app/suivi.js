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
  R.periodeDecompose = j => { j = +j; if (!j) return null; const m = Math.round(j / 30.44); if (m >= 1 && Math.abs(j - m * 30.44) < 1.6) return { n: m, u: 'mois' }; if (j % 7 === 0) return { n: j / 7, u: 'sem' }; return { n: Math.max(1, Math.round(j / 7)), u: 'sem' }; };
  R.periodeJours = (n, u) => u === 'mois' ? Math.round(n * 30.44) : n * 7;
  R.periodeLabel = j => { if (j === 'cure') return 'à chaque séance'; const p = R.PERIODES.find(x => x[0] === +j); if (p) return p[1]; const d = R.periodeDecompose(j); if (!d) return '—'; return d.u === 'mois' ? `tous les ${d.n} mois` : d.n === 1 ? 'chaque semaine' : `toutes les ${d.n} semaines`; };
  /* lit la période choisie dans un sélecteur (liste standard, ou nombre + unité si « Personnalisé ») */
  R.lirePeriode = el => { if (el.dataset.part) { const w = el.closest('.per'); const n = Math.max(1, +w.querySelector('[data-part="n"]').value || 1); const u = w.querySelector('[data-part="u"]').value; return R.periodeJours(n, u); } if (el.value === 'custom') return 28; if (el.value === '') return null; return +el.value; };
  R.BILANS = [
    { id: 'clinique', label: 'Bilan clinique', periode: 'cure', desc: 'rempli à chaque séance, dans la fenêtre « Fait »', items: [
      { id: 'clin', label: 'Examen clinique de la séance', type: 'clinique', desc: 'le poids et les remarques sont toujours relevés ; cochez les autres éléments à examiner', fixe: true, sous: [
        { id: 'taille', label: 'Taille' }, { id: 'puberte', label: 'Puberté (Tanner)' }, { id: 'digestif', label: 'Syndrome digestif' }, { id: 'douleur', label: 'Douleur articulaire / abdominale' }, { id: 'fievre', label: 'Fièvre et température' }, { id: 'perineal', label: 'Signes cutanés · atteinte périnéale' }
      ] }
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
  R.CATALOGUE_SURV = () => R.BILANS.flatMap(g => g.items.map(it => ({ id: it.id, cat: g.label, label: it.label })));
  /* Anciens contrôles du premier catalogue (avant le référentiel du service) : on garde uniquement
     les résultats déjà saisis des examens qui existent dans le référentiel (calprotectine, dosage anti-TNF,
     entéro-IRM, échographie, coloscopie), renommés ; tout le reste est retiré puis le plan du service
     est régénéré pour les échéances à venir. */
  const ANC_CATS = ['Clinique', 'Biologie', 'Pharmacologie', 'Morphologie', 'Sécurité'];
  const EQUIV = { calpro: 'calpro', tdm: 'tdm', irm: 'irm', echo: 'echo', endo: 'colo' };
  R.purgerAncienCatalogue = s => {
    const t = R.today(); let retires = 0, convertis = 0;
    (s.patients || []).forEach(p => {
      const anciens = (p.surveillance || []).filter(x => ANC_CATS.includes(x.cat)); if (!anciens.length) return;
      p.surveillance = p.surveillance.filter(x => {
        if (!ANC_CATS.includes(x.cat)) return true;
        const nid = EQUIV[x.id]; const it = nid && R.itemBilan(nid);
        if (x.statut === 'faite' && it) { x.id = nid; x.label = it.label; x.cat = it.groupe.label; x.type = it.type; x.unite = it.unite || x.unite; x.cible = it.cible || x.cible; convertis++; return true; }
        retires++; return false;
      });
      const pr = (s.protocoles || []).find(x => x.id === p.protocoleId);
      const cfg = p.planSurveillance || R.cfgDefaut(pr); p.planSurveillance = cfg;
      const cyc = p.cycleCourant || 1; const h = (p.historiqueProtocoles || []).find(x => x.cycle === cyc); const j0 = (h && h.dateDebut) || p.dateDebut; if (!j0) return;
      const prev = (p.cures || []).filter(c => c.statut === 'prevue').map(c => c.datePrevue).sort(); const fin = prev.length ? prev[prev.length - 1] : R.addDays(t, 365);
      const horizon = Math.max(R.diffDays(j0, fin), R.diffDays(j0, t) + 365);
      const gen = R.genererSurveillanceCfg(cfg, j0, horizon, cyc).filter(x => x.mode === 'cure' || x.echeance >= t);
      gen.forEach(g => {
        if (g.mode === 'cure') { if (!p.surveillance.some(x => x.mode === 'cure' && x.id === g.id)) p.surveillance.push(g); return; }
        const doublon = p.surveillance.some(x => x.id === g.id && (x.nom || '') === (g.nom || '') && x.statut !== 'annulee' && (x.echeance || x.dateFaite) && Math.abs(R.diffDays(x.echeance || x.dateFaite, g.echeance)) < 21);
        if (!doublon) p.surveillance.push(g);
      });
    });
    return { retires, convertis };
  };

  /* ---------- Configuration d'un plan de surveillance ---------- */
  R.cfgDefaut = proto => {
    const cfg = { groupes: {}, items: {} }; const ANC = { nfs: 'biostd', crp: 'biostd', bh: 'biostd', creat: 'biostd', endo: 'colo', coloscopie: 'colo', calprotectine: 'calpro', tdm: 'tdm' }; const defs = ((proto && proto.surveillanceDefaut) || []).map(id => ANC[id] || id); if (defs.includes('colo') && ((proto && proto.surveillanceDefaut) || []).includes('endo')) defs.push('recto');
    const antiTNF = proto && /TNF/.test(proto.classe || '');
    R.BILANS.forEach(g => g.items.forEach(it => { const on = it.fixe || defs.includes(it.id) || (it.defaut !== false && !defs.length) || (antiTNF && (it.id === 'tdm' || it.id === 'actnf')); cfg.items[it.id] = { on: !!on, periode: null, sous: it.sous ? it.sous.map(s => s.id) : undefined, entries: it.type === 'libre' ? [] : undefined }; if (it.id === 'tdm' && on && !cfg.items[it.id].periode) cfg.items[it.id].periode = 91; }));
    cfg.libres = {};
    return cfg;
  };
  R.cfgDepuisPatient = p => { const cfg = R.cfgDefaut(null); Object.values(cfg.items).forEach(c => c.on = false); if (p.planSurveillance) return JSON.parse(JSON.stringify(p.planSurveillance)); R.BILANS.forEach(g => g.items.forEach(it => { const e = p.surveillance.filter(s => s.id === it.id); if (e.length) { cfg.items[it.id].on = true; if (it.sous && e[0].sous) cfg.items[it.id].sous = e[0].sous; if (it.type === 'libre') cfg.items[it.id].entries = [...new Set(e.map(x => x.nom).filter(Boolean))].map(nom => ({ nom, periode: e.find(x => x.nom === nom).periode || 91 })); else if (e[0].periode) cfg.items[it.id].periode = e[0].periode; } })); cfg.items.clin.on = true;
    cfg.libres = {}; p.surveillance.filter(s => /^libre-/.test(s.id) && s.nom && s.statut !== 'annulee').forEach(s => { const gid = s.id.slice(6); cfg.libres[gid] = cfg.libres[gid] || []; if (!cfg.libres[gid].some(e => e.nom === s.nom)) cfg.libres[gid].push({ nom: s.nom, periode: s.periode || 91 }); });
    return cfg; };
  R.periodeItem = (cfg, g, it, c) => { if (it.periode === 'cure' || g.periode === 'cure') return 'cure'; return +(c && c.periode) || it.periode || +(cfg.groupes && cfg.groupes[g.id]) || g.periode; };
  R.genererSurveillanceCfg = (cfg, dateDebut, horizon, cycle) => {
    const out = []; horizon = horizon || 365;
    const serie = (g, it, per, extra) => { const base = Object.assign({ id: it.id, label: it.label, cat: g.label, type: it.type, cible: it.cible, unite: it.unite, gen: true, cycle: cycle || 1 }, extra); if (per === 'cure') { out.push(Object.assign(base, { mode: 'cure', echeance: null, statut: 'cure' })); return; } per = Math.max(7, +per || 91); for (let j = per; j <= horizon; j += per) out.push(Object.assign({}, base, { mode: 'echeance', jour: j, echeance: R.addDays(dateDebut, j), statut: 'prevue', periode: per })); };
    R.BILANS.forEach(g => g.items.forEach(it => { const c = cfg.items && cfg.items[it.id]; if (!c || !c.on) return;
      if (it.type === 'libre') { (c.entries || []).filter(e => e.nom && e.nom.trim()).forEach(e => serie(g, it, +e.periode || R.periodeItem(cfg, g, it, c), { label: `${it.label} : ${e.nom.trim()}`, nom: e.nom.trim() })); return; }
      if (it.type === 'composite' && Array.isArray(c.sous) && !c.sous.length) return; /* aucune analyse cochée : rien à programmer */
      serie(g, it, R.periodeItem(cfg, g, it, c), it.sous ? { sous: (Array.isArray(c.sous) ? c.sous : it.sous.map(s => s.id)) } : {}); }));
    /* examens personnalisés ajoutés dans chaque bilan */
    Object.keys(cfg.libres || {}).forEach(gid => { const g = R.BILANS.find(x => x.id === gid); if (!g) return; (cfg.libres[gid] || []).filter(e => e.nom && e.nom.trim()).forEach(e => { const per = +e.periode || (g.periode === 'cure' ? 91 : (+(cfg.groupes && cfg.groupes[gid]) || g.periode)); serie(g, { id: 'libre-' + gid, label: e.nom.trim(), type: 'libre' }, per, { nom: e.nom.trim() }); }); });
    return out.sort((a, b) => (a.jour || 0) - (b.jour || 0));
  };

  /* Formulaire de configuration (assistant et dossier) — ctx : { get: () => cfg, after: fn } */
  R.formPlanSurveillance = (cfg) => {
    const perSel = (val, id, extra, vide) => { const std = val === '' || val == null || R.PERIODES.some(p => p[0] === +val); const d = std ? null : R.periodeDecompose(val);
      return `<span class="per row" style="gap:4px;flex-wrap:nowrap"><select class="inline-input" data-change="${id}" ${extra}>${vide ? `<option value="">${esc(vide)}</option>` : ''}${R.PERIODES.map(p => `<option value="${p[0]}"${std && +val === p[0] ? ' selected' : ''}>${p[1]}</option>`).join('')}<option value="custom"${std ? '' : ' selected'}>Personnalisé…</option></select>${std ? '' : `<input type="number" min="1" max="520" class="inline-input w70" value="${d.n}" data-change="${id}" data-part="n" ${extra} title="nombre"><select class="inline-input" data-change="${id}" data-part="u" ${extra}><option value="sem"${d.u === 'sem' ? ' selected' : ''}>sem</option><option value="mois"${d.u === 'mois' ? ' selected' : ''}>mois</option></select>`}</span>`; };
    const libresGroupe = (g, gp) => { const L = (cfg.libres && cfg.libres[g.id]) || []; return `<div class="stack" style="width:100%;gap:6px;padding-top:8px;border-top:1px dashed var(--line)"><span class="small muted">Examens personnalisés de ce bilan</span>${L.map((e, i) => `<div class="row" style="gap:6px"><input type="text" class="inline-input" style="width:260px!important" value="${esc(e.nom || '')}" placeholder="ex. fibroscopie haute, capsule, IRM pelvienne, ostéodensitométrie" data-input="cfgGrpLibreNom" data-g="${g.id}" data-i="${i}">${perSel(e.periode || '', 'cfgGrpLibrePer', `data-g="${g.id}" data-i="${i}"`, g.periode === 'cure' ? '' : `suivre le bilan (${R.periodeLabel(gp)})`)}<button type="button" class="btn sm ghost" data-action="cfgGrpLibreDel" data-g="${g.id}" data-i="${i}" title="Retirer">${R.icon('x', 'ico')}</button></div>`).join('')}<div><button type="button" class="btn sm" data-action="cfgGrpLibreAdd" data-g="${g.id}">+ Ajouter un examen personnalisé</button></div></div>`; };
    return `<div class="stack">${R.BILANS.map(g => { const gp = (cfg.groupes && cfg.groupes[g.id]) || g.periode; return `<div class="card"><div class="card-head"><div><h2>${esc(g.label)}</h2>${g.desc ? `<div class="sub">${esc(g.desc)}</div>` : ''}</div>${g.periode === 'cure' ? '<span class="badge accent">à chaque séance</span>' : `<div class="row"><span class="small muted">Période du bilan</span>${perSel(gp, 'cfgGroupe', `data-g="${g.id}"`)}</div>`}</div>
      <div class="card-body stack" style="gap:8px">${g.items.map(it => { const c = (cfg.items && cfg.items[it.id]) || { on: false }; const per = R.periodeItem(cfg, g, it, c); const propre = it.periode && it.periode !== 'cure';
        return `<div class="check${c.on ? ' on' : ''}" style="flex-wrap:wrap"><input type="checkbox" id="cfg-${it.id}" data-change="cfgItem" data-id="${it.id}"${c.on ? ' checked' : ''}${it.fixe ? ' disabled' : ''}><label for="cfg-${it.id}" class="grow" style="cursor:pointer"><b>${esc(it.label)}</b><span>${it.desc ? esc(it.desc) + ' · ' : ''}${per === 'cure' ? 'à chaque séance' : (c.periode ? 'période propre : ' : propre ? 'période propre : ' : 'suit le bilan : ') + R.periodeLabel(per)}</span></label>
          ${c.on && per !== 'cure' ? `<div class="row" style="width:100%;padding-left:24px;gap:8px"><span class="small muted">Période de ce contrôle</span>${perSel(c.periode || '', 'cfgPeriode', `data-id="${it.id}"`, `suivre le bilan (${R.periodeLabel(propre ? it.periode : gp)})`)}</div>` : ''}
          ${c.on && it.sous ? `<div class="row" style="width:100%;padding-left:24px;gap:6px">${it.sous.map(s => `<label class="check" style="padding:4px 8px"><input type="checkbox" data-change="cfgSous" data-id="${it.id}" data-sid="${s.id}"${(Array.isArray(c.sous) ? c.sous : it.sous.map(x => x.id)).includes(s.id) ? ' checked' : ''}> ${esc(s.label)}</label>`).join('')}</div>` : ''}
          ${c.on && it.type === 'libre' ? `<div class="stack" style="width:100%;padding-left:24px;gap:6px">${(c.entries || []).map((e, i) => `<div class="row" style="gap:6px"><input type="text" class="inline-input" style="width:240px!important" value="${esc(e.nom || '')}" placeholder="${esc(it.placeholder || '')}" data-input="cfgLibreNom" data-id="${it.id}" data-i="${i}">${perSel(e.periode || 91, 'cfgLibrePer', `data-id="${it.id}" data-i="${i}"`)}<button type="button" class="btn sm ghost" data-action="cfgLibreDel" data-id="${it.id}" data-i="${i}">${R.icon('x', 'ico')}</button></div>`).join('')}<div><button type="button" class="btn sm" data-action="cfgLibreAdd" data-id="${it.id}">+ Ajouter un dosage</button></div></div>` : ''}</div>`; }).join('')}${libresGroupe(g, gp)}</div></div>`; }).join('')}</div>`;
  };
  const ctx = () => R.ui.cfgCtx; const cfgOf = () => ctx().get();
  Object.assign(R.actions, {
    cfgGroupe(el) { const cfg = cfgOf(); cfg.groupes = cfg.groupes || {}; cfg.groupes[el.dataset.g] = R.lirePeriode(el) || undefined; ctx().after(!!el.dataset.part); },
    cfgItem(el) { const cfg = cfgOf(); const it = R.itemBilan(el.dataset.id); cfg.items[el.dataset.id] = cfg.items[el.dataset.id] || { on: false, periode: null, sous: it && it.type === 'composite' ? it.sous.map(s => s.id) : undefined, entries: it && it.type === 'libre' ? [] : undefined }; cfg.items[el.dataset.id].on = el.checked; if (el.checked && el.dataset.id === 'tdm' && !cfg.items.tdm.periode) cfg.items.tdm.periode = 91; if (el.checked && it && it.type === 'libre' && !cfg.items[el.dataset.id].entries.length) cfg.items[el.dataset.id].entries.push({ nom: '', periode: 91 }); ctx().after(); },
    cfgPeriode(el) { cfgOf().items[el.dataset.id].periode = R.lirePeriode(el); ctx().after(!!el.dataset.part); },
    cfgSous(el) { const c = cfgOf().items[el.dataset.id]; c.sous = c.sous || []; if (el.checked) { if (!c.sous.includes(el.dataset.sid)) c.sous.push(el.dataset.sid); } else c.sous = c.sous.filter(x => x !== el.dataset.sid); const it = R.itemBilan(el.dataset.id); c.sous.sort((a, b) => it.sous.findIndex(s => s.id === a) - it.sous.findIndex(s => s.id === b)); ctx().after(true); },
    cfgLibreAdd(el) { const c = cfgOf().items[el.dataset.id]; c.entries = c.entries || []; c.entries.push({ nom: '', periode: 91 }); ctx().after(); },
    cfgLibreDel(el) { cfgOf().items[el.dataset.id].entries.splice(+el.dataset.i, 1); ctx().after(); },
    cfgLibreNom(el) { cfgOf().items[el.dataset.id].entries[+el.dataset.i].nom = el.value; ctx().after(true); },
    cfgLibrePer(el) { cfgOf().items[el.dataset.id].entries[+el.dataset.i].periode = R.lirePeriode(el) || 91; ctx().after(!!el.dataset.part); },
    cfgGrpLibreAdd(el) { const cfg = cfgOf(); cfg.libres = cfg.libres || {}; cfg.libres[el.dataset.g] = cfg.libres[el.dataset.g] || []; const g0 = R.BILANS.find(x => x.id === el.dataset.g); cfg.libres[el.dataset.g].push({ nom: '', periode: g0 && g0.periode === 'cure' ? 91 : null }); ctx().after(); setTimeout(() => { const inp = [...document.querySelectorAll(`[data-input="cfgGrpLibreNom"][data-g="${el.dataset.g}"]`)].pop(); if (inp) inp.focus(); }, 30); },
    cfgGrpLibreDel(el) { const cfg = cfgOf(); cfg.libres[el.dataset.g].splice(+el.dataset.i, 1); ctx().after(); },
    cfgGrpLibreNom(el) { cfgOf().libres[el.dataset.g][+el.dataset.i].nom = el.value; ctx().after(true); },
    cfgGrpLibrePer(el) { cfgOf().libres[el.dataset.g][+el.dataset.i].periode = R.lirePeriode(el); ctx().after(!!el.dataset.part); }
  });
  /* éléments cliniques retenus dans le plan du patient (null = tous) */
  R.sousClin = p => { if (!p) return null; const c = p.planSurveillance && p.planSurveillance.items && p.planSurveillance.items.clin; if (c && Array.isArray(c.sous)) return c.sous; const e = p.surveillance.find(s => s.id === 'clin' && s.mode === 'cure'); return e && Array.isArray(e.sous) ? e.sous : null; };

  /* ---------- Examen clinique (à chaque séance) ---------- */
  R.CLINIQUE = { puberte: ['Non applicable (adulte)', 'Tanner 1', 'Tanner 2', 'Tanner 3', 'Tanner 4', 'Tanner 5'], douleurLoc: [['articulaire', 'Articulaire'], ['abdominale', 'Abdominale']], perineal: [['abces', 'Abcès'], ['fissure', 'Fissure'], ['fistule', 'Fistule']] };
  R.formClinique = (d, o) => { d = d || {}; o = o || {}; const chk = (name, arr, sel) => arr.map(x => `<label class="check" style="padding:5px 9px"><input type="checkbox" name="${name}" value="${x[0]}"${(sel || []).includes(x[0]) ? ' checked' : ''}> ${x[1]}</label>`).join('');
    const has = k => !Array.isArray(o.sous) || o.sous.includes(k);
    return `<div class="form-grid">
      ${o.avecPoids ? `<div class="field"><label>Poids (kg)</label><input type="number" step="0.1" name="cl_poids" value="${d.poids ?? ''}"></div>` : ''}
      ${has('taille') ? `<div class="field"><label>Taille (cm)</label><input type="number" name="cl_taille" value="${d.taille ?? ''}"></div>` : ''}
      ${has('puberte') ? `<div class="field"><label>Puberté</label><select name="cl_puberte">${R.CLINIQUE.puberte.map(x => `<option${(d.puberte || R.CLINIQUE.puberte[0]) === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>` : ''}
      ${has('digestif') ? `<div class="field span3"><label>Syndrome digestif</label><input type="text" name="cl_digestif" value="${esc(d.digestif || '')}" placeholder="ex. 3 selles/j, sans sang, pas de douleur nocturne"></div>` : ''}
      ${!has('douleur') ? '' : `<div class="field span3"><label>Douleur</label><div class="row" style="gap:6px"><label class="check" style="padding:5px 9px"><input type="checkbox" name="cl_douleur"${d.douleur ? ' checked' : ''}> <b>Présente</b></label>${chk('cl_douleurLoc', R.CLINIQUE.douleurLoc, d.douleurLoc)}<input type="text" name="cl_douleurNote" class="grow" value="${esc(d.douleurNote || '')}" placeholder="où exactement, intensité, horaire…"></div></div>`}
      ${!has('fievre') ? '' : `<div class="field span3"><label>Fièvre</label><div class="row" style="gap:6px"><label class="check" style="padding:5px 9px"><input type="radio" name="cl_fievre" value="non"${d.fievre ? '' : ' checked'}> Non</label><label class="check" style="padding:5px 9px"><input type="radio" name="cl_fievre" value="oui"${d.fievre ? ' checked' : ''}> Oui</label><input type="number" step="0.1" name="cl_temperature" class="inline-input w110" value="${d.temperature ?? ''}" placeholder="T° °C"><input type="text" name="cl_fievreNote" class="grow" value="${esc(d.fievreNote || '')}" placeholder="depuis quand, frissons, foyer…"></div></div>`}
      ${!has('perineal') ? '' : `<div class="field span3"><label>Signes cutanés · atteinte périnéale</label><div class="row" style="gap:6px">${chk('cl_perineal', R.CLINIQUE.perineal, d.perineal)}<input type="text" name="cl_cutaneNote" class="grow" value="${esc(d.cutaneNote || '')}" placeholder="autres signes cutanés, siège, évolution…"></div></div>`}
      <div class="field span3"><label>Remarques</label><input type="text" name="cl_remarques" value="${esc(d.remarques || '')}" placeholder="tout élément utile pour le suivi"></div></div>`; };
  R.lireClinique = fd => { const g = k => fd.get(k); const d = { taille: g('cl_taille') ? +g('cl_taille') : null, puberte: g('cl_puberte') || '', digestif: (g('cl_digestif') || '').trim(), douleur: !!g('cl_douleur'), douleurLoc: fd.getAll('cl_douleurLoc'), douleurNote: (g('cl_douleurNote') || '').trim(), fievre: g('cl_fievre') === 'oui', temperature: g('cl_temperature') ? +g('cl_temperature') : null, fievreNote: (g('cl_fievreNote') || '').trim(), perineal: fd.getAll('cl_perineal'), cutaneNote: (g('cl_cutaneNote') || '').trim(), remarques: (g('cl_remarques') || '').trim() }; if (fd.has('cl_poids') && g('cl_poids')) d.poids = +g('cl_poids'); if (d.douleurLoc.length || d.douleurNote) d.douleur = true; if (d.temperature && d.temperature >= 38) d.fievre = true; return d; };
  R.cliniqueVide = d => !d || !(d.douleur || d.fievre || (d.perineal && d.perineal.length) || d.digestif || d.remarques || d.taille || d.cutaneNote || (d.puberte && !/Non applicable/.test(d.puberte)));
  R.resumeClinique = d => { if (!d) return ''; const p = []; if (d.douleur) p.push('Douleur ' + ((d.douleurLoc || []).map(x => (R.CLINIQUE.douleurLoc.find(y => y[0] === x) || [x, x])[1].toLowerCase()).join(' + ') || 'présente') + (d.douleurNote ? ' (' + d.douleurNote + ')' : '')); if (d.fievre) p.push('Fièvre' + (d.temperature ? ' ' + d.temperature + ' °C' : '') + (d.fievreNote ? ' (' + d.fievreNote + ')' : '')); if (d.perineal && d.perineal.length) p.push('Périnéal : ' + d.perineal.map(x => (R.CLINIQUE.perineal.find(y => y[0] === x) || [x, x])[1].toLowerCase()).join(', ') + (d.cutaneNote ? ' (' + d.cutaneNote + ')' : '')); else if (d.cutaneNote) p.push('Cutané : ' + d.cutaneNote); if (d.digestif) p.push('Digestif : ' + d.digestif); if (d.puberte && !/Non applicable/.test(d.puberte)) p.push(d.puberte); if (d.remarques) p.push(d.remarques); return p.length ? p.join(' · ') : 'Examen clinique sans particularité'; };
  R.alerteClinique = d => !!d && (d.fievre || (d.perineal && d.perineal.includes('abces')) || (d.perineal && d.perineal.includes('fistule')));

  /* ---------- Saisie d'un contrôle selon son type ---------- */
  R.formSaisieControle = s => {
    const it = R.itemBilan(s.id) || {};
    if (s.type === 'clinique' || it.type === 'clinique') return R.formClinique(s.clinique, { avecPoids: true, sous: Array.isArray(s.sous) ? s.sous : null });
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
  R.tableClinique = (p, depuis) => {
    const rows = [...p.cures.filter(c => c.statut === 'realisee' && c.clinique && !R.cliniqueVide(c.clinique)).map(c => ({ date: c.dateReelle, src: `Séance ${c.label}`, poids: c.poids, d: c.clinique })), ...p.surveillance.filter(s => s.statut === 'faite' && s.clinique).map(s => ({ date: s.dateFaite, src: s.label, poids: s.clinique.poids, d: s.clinique }))].filter(r => !depuis || r.date >= depuis).sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Contexte</th><th>Poids</th><th>Taille</th><th>Douleur</th><th>Fièvre</th><th>Périnéal / cutané</th><th>Digestif · remarques</th></tr></thead><tbody>${rows.map(r => `<tr class="${R.alerteClinique(r.d) ? '' : ''}"><td class="nowrap">${R.fmtDate(r.date)}</td><td class="small">${esc(r.src)}</td><td class="num">${r.poids ? r.poids + ' kg' : '—'}</td><td class="num">${r.d.taille ? r.d.taille + ' cm' : '—'}</td><td class="small">${r.d.douleur ? `<span class="badge warn">${(r.d.douleurLoc || []).map(x => (R.CLINIQUE.douleurLoc.find(y => y[0] === x) || [x, x])[1]).join(' + ') || 'oui'}</span> ${esc(r.d.douleurNote || '')}` : '<span class="muted">non</span>'}</td><td class="small">${r.d.fievre ? `<span class="badge crit">${r.d.temperature ? r.d.temperature + ' °C' : 'oui'}</span> ${esc(r.d.fievreNote || '')}` : '<span class="muted">non</span>'}</td><td class="small">${(r.d.perineal || []).length ? `<span class="badge crit">${r.d.perineal.map(x => (R.CLINIQUE.perineal.find(y => y[0] === x) || [x, x])[1]).join(', ')}</span> ` : ''}${esc(r.d.cutaneNote || '')}${!(r.d.perineal || []).length && !r.d.cutaneNote ? '<span class="muted">RAS</span>' : ''}</td><td class="small">${esc(r.d.digestif || '')}${r.d.digestif && r.d.remarques ? ' · ' : ''}${esc(r.d.remarques || '')}${r.d.puberte && !/Non applicable/.test(r.d.puberte) ? ' · ' + esc(r.d.puberte) : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun examen clinique saisi — remplissez le bilan clinique dans la fenêtre « Fait » d’une séance</td></tr>'}</tbody></table></div>`;
  };
  R.estBio = s => !!(s.valeurs || ['calpro', 'tdm', 'vit', 'actnf', 'libre-bio'].includes(s.id) || (R.itemBilan(s.id) && R.itemBilan(s.id).groupe.id === 'bio'));
  R.estClin = s => s.id === 'clin' || s.type === 'clinique' || !!s.clinique;
  /* Endoscopies, imagerie, contrôles personnalisés : prévus, faits et annulés */
  R.tableAutres = (p, w, d) => {
    const t = R.today(); const rows = p.surveillance.map((s, i) => ({ s, i })).filter(x => x.s.mode === 'echeance' && !R.estBio(x.s) && !R.estClin(x.s)).sort((a, b) => { const pa = a.s.statut === 'prevue', pb = b.s.statut === 'prevue'; if (pa !== pb) return pa ? -1 : 1; const da = a.s.dateFaite || a.s.echeance || '', db = b.s.dateFaite || b.s.echeance || ''; return pa ? da.localeCompare(db) : db.localeCompare(da); }); /* à venir d'abord (le plus proche en tête), puis faits et annulés du plus récent au plus ancien */
    if (!rows.length) return '<div class="empty">Aucune endoscopie, imagerie ou contrôle personnalisé dans ce dossier — ajoutez-en depuis Planification → Contrôle</div>';
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Échéance</th><th>Contrôle</th><th>Bilan</th><th>Statut</th><th>Fait le</th><th>Résultat</th><th>Remarques</th><th></th></tr></thead><tbody>${rows.map(({ s, i }) => `<tr class="${s.statut === 'annulee' ? 'done' : ''}"><td class="nowrap">${R.fmtDate(s.echeance)}${s.echeance < t && s.statut === 'prevue' ? ' <span class="badge crit" style="padding:0 6px">retard</span>' : ''}</td><td><b>${esc(s.label)}</b>${(s.reports || []).length ? ` <span class="tag" title="reporté ${s.reports.length} fois">reporté</span>` : ''}</td><td class="small">${esc(s.cat || '')}</td><td>${R.statutSurvBadge(s)}</td><td class="nowrap">${s.dateFaite ? R.fmtDate(s.dateFaite) : '—'}</td><td class="small">${esc(s.resultat || '')}</td><td class="small">${esc(s.note || '')}</td><td class="actions">${R.actionsControle ? R.actionsControle(p, s, i, w, d) : ''}</td></tr>`).join('')}</tbody></table></div>`;
  };
  R.tableBio = (p, depuis) => {
    const faits = p.surveillance.filter(s => s.statut === 'faite' && R.estBio(s) && (!depuis || (s.dateFaite || '') >= depuis));
    if (!faits.length) return '<div class="empty">Aucun résultat biologique saisi</div>';
    const cols = []; const add = (k, l) => { if (!cols.some(c => c.k === k)) cols.push({ k, l }); };
    const bio = R.itemBilan('biostd'); faits.forEach(s => { if (s.valeurs) Object.keys(s.valeurs).forEach(k => add(k, (bio.sous.find(x => x.id === k) || { label: k }).label)); else add(s.id + (s.nom ? ':' + s.nom : ''), s.nom ? s.nom : s.label.split(' (')[0]); });
    const dates = [...new Set(faits.map(s => s.dateFaite))].sort((a, b) => b.localeCompare(a));
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th>${cols.map(c => `<th>${esc(c.l)}</th>`).join('')}<th>Remarques</th></tr></thead><tbody>${dates.map(d => { const ss = faits.filter(s => s.dateFaite === d); return `<tr><td class="nowrap">${R.fmtDate(d)}</td>${cols.map(c => { let v = ''; ss.forEach(s => { if (s.valeurs && s.valeurs[c.k]) v = s.valeurs[c.k]; else if (!s.valeurs && c.k === s.id + (s.nom ? ':' + s.nom : '')) v = s.resultat; }); return `<td class="num small">${esc(v || '')}</td>`; }).join('')}<td class="small">${esc(ss.map(s => s.note).filter(Boolean).join(' · '))}</td></tr>`; }).join('')}</tbody></table></div>`;
  };

  /* ---------- Courbes : séries biologiques et cliniques ---------- */
  R.nums = s => (String(s ?? '').replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  R.num = s => { const n = R.nums(s); return n.length ? n[0] : null; };
  R.uniteDe = s => { const m = String(s || '').match(/-?\d+(?:[.,]\d+)?\s*([a-zA-Zµ%]+(?:\/[a-zA-Zµ]+)?)/); return m ? m[1] : ''; };
  /* zones de référence indicatives (adulte) : à adapter aux normes du laboratoire */
  R.REFS = { crp: [0, 5], transa: [0, 40], alb: [35, 50], ferr: [30, 300], b12: [200, 900], calpro: [0, 250], temperature: [36, 37.5], fc: [50, 100], hbF: [12, 16], hbM: [13, 17] };
  const nouvChart = (key, titre, unite, ref) => ({ key, titre, unite: unite || '', ref: ref || null, lignes: [] });
  const ajouterPt = (ch, nom, pt) => { let l = ch.lignes.find(x => x.nom === nom); if (!l) { l = { nom, pts: [] }; ch.lignes.push(l); } l.pts.push(pt); };
  const finaliser = charts => Object.values(charts).map(ch => { ch.lignes.forEach(l => l.pts.sort((a, b) => a.date.localeCompare(b.date))); ch.lignes = ch.lignes.filter(l => l.pts.length); return ch; }).filter(ch => ch.lignes.length);

  R.seriesBio = p => {
    const charts = {}; const bio = R.itemBilan('biostd') || { sous: [] }; const antiTNF = /TNF/.test((R.proto(p.protocoleId) || {}).classe || '');
    p.surveillance.filter(s => s.statut === 'faite' && s.dateFaite && R.estBio(s)).forEach(s => {
      const note = s.note || '';
      if (s.valeurs) {
        Object.keys(s.valeurs).forEach(k => {
          const brut = s.valeurs[k]; const def = bio.sous.find(x => x.id === k) || { id: k, label: k, unite: '' }; const n = R.nums(brut); if (!n.length) return;
          if (k === 'transa' && n.length >= 2) { const ch = charts.transa || (charts.transa = nouvChart('transa', 'ASAT / ALAT', def.unite || 'UI/L', R.REFS.transa)); ajouterPt(ch, 'ASAT', { date: s.dateFaite, v: n[0], brut, note }); ajouterPt(ch, 'ALAT', { date: s.dateFaite, v: n[1], brut, note }); return; }
          if (k === 'nfs') { const hb = /h[ée]mo|hb/i.test(brut); const ch = charts.nfs || (charts.nfs = nouvChart('nfs', hb ? 'Hémoglobine (NFS)' : 'NFS — première valeur saisie', def.unite || R.uniteDe(brut), hb ? (p.sexe === 'F' ? R.REFS.hbF : R.REFS.hbM) : null)); ajouterPt(ch, ch.titre, { date: s.dateFaite, v: n[0], brut, note }); return; }
          const ch = charts[k] || (charts[k] = nouvChart(k, def.label, def.unite || R.uniteDe(brut), R.REFS[k] || null)); ajouterPt(ch, def.label, { date: s.dateFaite, v: n[0], brut, note });
        });
        return;
      }
      const n = R.nums(s.resultat); if (!n.length) return; const it = R.itemBilan(s.id) || {};
      const key = s.id + (s.nom ? ':' + s.nom : ''); const titre = s.nom ? `${s.nom}` : (s.id === 'tdm' ? 'Taux résiduel anti-TNF' : (it.label || s.label));
      const ref = s.id === 'calpro' ? R.REFS.calpro : s.id === 'tdm' && antiTNF ? (/infliximab/i.test(R.proto(p.protocoleId)?.dci || '') ? [3, 7] : /adalimumab/i.test(R.proto(p.protocoleId)?.dci || '') ? [7.5, 12] : null) : null;
      const ch = charts[key] || (charts[key] = nouvChart(key, titre, it.unite || s.unite || R.uniteDe(s.resultat), ref)); ajouterPt(ch, titre, { date: s.dateFaite, v: n[0], brut: s.resultat, note });
    });
    return finaliser(charts);
  };

  /* lignes cliniques : une par séance réalisée ou consultation faite */
  R.lignesCliniques = p => {
    const rows = [...p.cures.filter(c => c.statut === 'realisee' && c.dateReelle).map(c => ({ date: c.dateReelle, src: `Séance ${c.label}`, poids: c.poids || null, taille: (c.clinique && c.clinique.taille) || null, temp: R.num(c.constantes && c.constantes.temp) ?? (c.clinique && c.clinique.temperature) ?? null, fc: R.num(c.constantes && c.constantes.fc), ta: (c.constantes && c.constantes.ta) || '', d: c.clinique || null, tolerance: c.tolerance || '' })),
      ...p.surveillance.filter(s => s.statut === 'faite' && s.dateFaite && s.clinique).map(s => ({ date: s.dateFaite, src: s.label, poids: s.clinique.poids || null, taille: s.clinique.taille || null, temp: s.clinique.temperature || null, fc: null, ta: '', d: s.clinique, tolerance: '' }))];
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  };
  R.seriesClinique = p => {
    const charts = {}; const rows = R.lignesCliniques(p);
    rows.forEach(r => {
      if (r.poids) { const ch = charts.poids || (charts.poids = nouvChart('poids', 'Poids', 'kg', null)); ajouterPt(ch, 'Poids', { date: r.date, v: r.poids, brut: r.poids + ' kg', note: r.src }); const taille = r.taille || p.taille; if (taille) { const imc = +(r.poids / Math.pow(taille / 100, 2)).toFixed(1); const c2 = charts.imc || (charts.imc = nouvChart('imc', 'IMC', 'kg/m²', [18.5, 25])); ajouterPt(c2, 'IMC', { date: r.date, v: imc, brut: imc + ' kg/m²', note: `${r.poids} kg · ${taille} cm` }); } }
      if (r.taille) { const ch = charts.taille || (charts.taille = nouvChart('taille', 'Taille', 'cm', null)); ajouterPt(ch, 'Taille', { date: r.date, v: r.taille, brut: r.taille + ' cm', note: r.src }); }
      if (r.temp != null && r.temp > 30) { const ch = charts.temp || (charts.temp = nouvChart('temp', 'Température', '°C', R.REFS.temperature)); ajouterPt(ch, 'Température', { date: r.date, v: r.temp, brut: r.temp + ' °C', note: r.src }); }
      if (r.fc) { const ch = charts.fc || (charts.fc = nouvChart('fc', 'Fréquence cardiaque', 'bpm', R.REFS.fc)); ajouterPt(ch, 'FC', { date: r.date, v: r.fc, brut: r.fc + ' bpm', note: r.src }); }
      const ta = R.nums(r.ta); if (ta.length >= 2) { const ch = charts.ta || (charts.ta = nouvChart('ta', 'Tension artérielle', 'mmHg', null)); ajouterPt(ch, 'Systolique', { date: r.date, v: ta[0], brut: r.ta, note: r.src }); ajouterPt(ch, 'Diastolique', { date: r.date, v: ta[1], brut: r.ta, note: r.src }); }
    });
    /* la taille n'a d'intérêt en courbe que si elle change (enfant, adolescent) */
    if (charts.taille && new Set(charts.taille.lignes[0].pts.map(x => x.v)).size < 2) delete charts.taille;
    const ordre = ['poids', 'imc', 'taille', 'temp', 'fc', 'ta'];
    return finaliser(charts).sort((a, b) => ordre.indexOf(a.key) - ordre.indexOf(b.key));
  };

  /* ---------- Traceur : courbe temporelle SVG avec survol et clavier ---------- */
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const fmtV = v => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('fr-FR');
  const niceStep = span => { const raw = span / 4 || 1; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
  R.courbe = (ch, o) => {
    o = o || {}; const W = 520, H = o.h || 176, padL = 44, padR = 74, padT = 12, padB = 26; const plotW = W - padL - padR, plotH = H - padT - padB;
    const dates = [...new Set(ch.lignes.flatMap(l => l.pts.map(p => p.date)))].sort(); const t0 = R.parse(dates[0]).getTime(), t1 = R.parse(dates[dates.length - 1]).getTime();
    const span = Math.max(t1 - t0, 1); const x = d => dates.length === 1 ? padL + plotW / 2 : padL + (R.parse(d).getTime() - t0) / span * plotW;
    const vals = ch.lignes.flatMap(l => l.pts.map(p => p.v)); let lo = Math.min(...vals), hi = Math.max(...vals);
    if (ch.ref) { lo = Math.min(lo, ch.ref[0]); hi = Math.max(hi, ch.ref[1]); }
    if (lo === hi) { lo -= 1; hi += 1; } const marge = (hi - lo) * 0.12; lo -= marge; hi += marge; if (lo > 0 && lo < 0.35 * hi) lo = 0; if (Math.min(...vals) >= 0 && lo < 0) lo = 0;
    const step = niceStep(hi - lo); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; const y = v => padT + plotH - (v - lo) / (hi - lo) * plotH;
    let g = ''; for (let v = lo; v <= hi + 1e-9; v += step) g += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${padL - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${fmtV(v)}</text>`;
    /* graduations de l'axe des dates : au plus 5, sur des débuts de mois */
    let xt = ''; if (dates.length > 1) { const d0 = R.parse(dates[0]), d1 = R.parse(dates[dates.length - 1]); const nbMois = (d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth() + 1; const pas = Math.max(1, Math.ceil(nbMois / 5)); let d = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); if (nbMois <= 2) d = new Date(d0.getFullYear(), d0.getMonth(), 1); for (let i = 0; d <= d1 && i < 12; d = new Date(d.getFullYear(), d.getMonth() + pas, 1), i++) { if (d < d0) continue; const px = x(R.iso(d)); xt += `<text x="${px.toFixed(1)}" y="${H - 8}" text-anchor="middle">${MOIS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}</text>`; } } else xt += `<text x="${x(dates[0]).toFixed(1)}" y="${H - 8}" text-anchor="middle">${R.fmtDate(dates[0])}</text>`;
    const ref = ch.ref ? `<rect class="ref" x="${padL}" y="${y(ch.ref[1]).toFixed(1)}" width="${plotW}" height="${Math.max(1, y(ch.ref[0]) - y(ch.ref[1])).toFixed(1)}"/><text class="ref-lbl" x="${W - padR + 4}" y="${((y(ch.ref[0]) + y(ch.ref[1])) / 2 + 3.5).toFixed(1)}">réf. ${fmtV(ch.ref[0])}–${fmtV(ch.ref[1])}</text>` : '';
    const lignes = ch.lignes.map((l, i) => { const cls = 's' + (i + 1); const d = l.pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' '); const last = l.pts[l.pts.length - 1]; const lab = ch.lignes.length === 1 || i === 0 ? `<text class="fin" x="${(x(last.date) + 8).toFixed(1)}" y="${(y(last.v) + 3.5).toFixed(1)}">${fmtV(last.v)}</text>` : ''; return `<path class="ligne ${cls}" d="${d}"/>${l.pts.map(p => `<circle class="pt ${cls}" cx="${x(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4"/>`).join('')}${ch.ref ? '' : lab}`; }).join('');
    const data = { dates, unite: ch.unite, lignes: ch.lignes.map(l => ({ nom: l.nom, v: dates.map(d => { const p = l.pts.find(q => q.date === d); return p ? { v: p.v, brut: p.brut, note: p.note } : null; }) })), xs: dates.map(d => +x(d).toFixed(1)), ys: ch.lignes.map(l => dates.map(d => { const p = l.pts.find(q => q.date === d); return p ? +y(p.v).toFixed(1) : null; })) };
    return `<div class="courbe" data-courbe="${esc(JSON.stringify(data))}"><svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="${esc(ch.titre)}${ch.unite ? ' en ' + esc(ch.unite) : ''}, ${dates.length} valeur(s)">${g}${ref}${xt}<line class="axis" x1="${padL}" x2="${W - padR}" y1="${(padT + plotH).toFixed(1)}" y2="${(padT + plotH).toFixed(1)}"/>${lignes}<line class="cross" x1="0" x2="0" y1="${padT}" y2="${padT + plotH}"/><circle class="focus" r="6" cx="-20" cy="-20"/></svg>${ch.lignes.length > 1 ? `<div class="legend courbe-legend">${ch.lignes.map((l, i) => `<span><i class="lk s${i + 1}"></i>${esc(l.nom)}</span>`).join('')}</div>` : ''}</div>`;
  };

  /* signes cliniques par séance : une ligne par signe, un point par date */
  R.stripSignes = rows => {
    const items = rows.filter(r => r.d); if (!items.length) return '<div class="empty">Aucun examen clinique saisi</div>';
    const SIGNES = [['douleur', 'Douleur', r => r.d.douleur, r => ((r.d.douleurLoc || []).join(' + ') + (r.d.douleurNote ? ' — ' + r.d.douleurNote : '')) || 'présente'], ['fievre', 'Fièvre', r => r.d.fievre, r => (r.d.temperature ? r.d.temperature + ' °C' : 'oui') + (r.d.fievreNote ? ' — ' + r.d.fievreNote : '')], ['perineal', 'Périnéal', r => (r.d.perineal || []).length > 0, r => (r.d.perineal || []).join(', ') + (r.d.cutaneNote ? ' — ' + r.d.cutaneNote : '')], ['digestif', 'Digestif', r => !!r.d.digestif, r => r.d.digestif]];
    const W = 520, rowH = 22, padL = 70, padR = 16, padT = 6, padB = 24; const H = padT + rowH * SIGNES.length + padB; const plotW = W - padL - padR;
    const t0 = R.parse(items[0].date).getTime(), t1 = R.parse(items[items.length - 1].date).getTime(); const x = d => items.length === 1 ? padL + plotW / 2 : padL + (R.parse(d).getTime() - t0) / Math.max(1, t1 - t0) * plotW;
    let svg = ''; SIGNES.forEach(([k, lab], i) => { const cy = padT + rowH * i + rowH / 2; svg += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${cy}" y2="${cy}"/><text x="${padL - 8}" y="${cy + 3.5}" text-anchor="end">${lab}</text>`; items.forEach(r => { const on = SIGNES[i][2](r); svg += `<circle class="sig ${on ? 'on' : 'off'}" cx="${x(r.date).toFixed(1)}" cy="${cy}" r="${on ? 5 : 3}"><title>${esc(R.fmtDate(r.date))} · ${lab} : ${on ? esc(SIGNES[i][3](r)) : 'non'}</title></circle>`; }); });
    items.forEach((r, i) => { if (items.length <= 8 || i % Math.ceil(items.length / 8) === 0 || i === items.length - 1) svg += `<text x="${x(r.date).toFixed(1)}" y="${H - 8}" text-anchor="middle">${R.fmtDate(r.date, { day: '2-digit', month: '2-digit', year: '2-digit' })}</text>`; });
    return `<div class="courbe strip"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Signes cliniques par séance">${svg}</svg><div class="legend"><span><i class="sw" style="background:var(--crit)"></i>signe présent</span><span><i class="sw" style="background:var(--line-strong);width:6px;height:6px;border-radius:50%"></i>examiné, absent</span></div></div>`;
  };

  /* survol et clavier : un seul écouteur pour toutes les courbes de la page */
  let tip = null; const getTip = () => { if (!tip) { tip = document.createElement('div'); tip.id = 'courbe-tip'; document.body.appendChild(tip); } return tip; };
  const montrer = (wrap, idx, cx, cy) => {
    let data; try { data = JSON.parse(wrap.dataset.courbe); } catch (e) { return; } if (!data || idx == null || idx < 0 || idx >= data.dates.length) return;
    const svg = wrap.querySelector('svg'); const cross = svg.querySelector('.cross'); const foc = svg.querySelector('.focus'); const px = data.xs[idx]; cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.opacity = '.7';
    const firstY = data.ys.map(a => a[idx]).find(v => v != null); if (firstY != null) { foc.setAttribute('cx', px); foc.setAttribute('cy', firstY); }
    const t = getTip(); t.textContent = ''; const h = document.createElement('div'); h.className = 'tip-date'; h.textContent = R.fmtDateLong(data.dates[idx]); t.appendChild(h);
    data.lignes.forEach((l, i) => { const p = l.v[idx]; if (!p) return; const row = document.createElement('div'); row.className = 'tip-row'; const k = document.createElement('i'); k.className = 'lk s' + (i + 1); const nom = document.createElement('span'); nom.textContent = l.nom; const val = document.createElement('b'); val.textContent = `${fmtV(p.v)}${data.unite ? ' ' + data.unite : ''}`; row.appendChild(k); row.appendChild(nom); row.appendChild(val); t.appendChild(row); if (p.note) { const n = document.createElement('div'); n.className = 'tip-note'; n.textContent = p.note; t.appendChild(n); } });
    t.style.display = 'block'; const r = svg.getBoundingClientRect(); const sx = r.left + (px / 520) * r.width; const left = Math.min(window.innerWidth - t.offsetWidth - 8, sx + 12); const top = Math.max(8, (cy != null ? cy : r.top + 20) - t.offsetHeight - 10); t.style.left = left + 'px'; t.style.top = top + 'px';
    wrap.dataset.idx = idx;
  };
  const cacher = wrap => { if (tip) tip.style.display = 'none'; if (wrap) { const c = wrap.querySelector('.cross'); if (c) c.style.opacity = '0'; const f = wrap.querySelector('.focus'); if (f) { f.setAttribute('cx', -20); f.setAttribute('cy', -20); } } };
  document.addEventListener('pointermove', e => { const wrap = e.target.closest && e.target.closest('.courbe[data-courbe]'); if (!wrap) { if (tip && tip.style.display === 'block' && !e.target.closest('#courbe-tip')) { document.querySelectorAll('.courbe[data-courbe]').forEach(cacher); cacher(); } return; } let data; try { data = JSON.parse(wrap.dataset.courbe); } catch (x) { return; } const svg = wrap.querySelector('svg'); const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * 520; let best = 0, bd = Infinity; data.xs.forEach((x, i) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = i; } }); montrer(wrap, best, e.clientX, e.clientY); });
  /* l'infobulle disparaît quand on clique ailleurs (fermeture d'une fenêtre comprise) ou sur Échap */
  document.addEventListener('click', e => { if (tip && tip.style.display === 'block' && !(e.target.closest && e.target.closest('.courbe[data-courbe]'))) document.querySelectorAll('.courbe[data-courbe]').forEach(cacher), cacher(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && tip) { document.querySelectorAll('.courbe[data-courbe]').forEach(cacher); cacher(); } }, true);
  document.addEventListener('pointerleave', e => { if (e.target && e.target.closest && e.target.closest('.courbe[data-courbe]')) cacher(e.target.closest('.courbe')); }, true);
  document.addEventListener('keydown', e => { const wrap = e.target.closest && e.target.closest('.courbe[data-courbe]'); if (!wrap) return; if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return; e.preventDefault(); let data; try { data = JSON.parse(wrap.dataset.courbe); } catch (x) { return; } const n = data.dates.length; let idx = wrap.dataset.idx != null ? +wrap.dataset.idx : n - 1; idx = e.key === 'ArrowLeft' ? Math.max(0, idx - 1) : e.key === 'ArrowRight' ? Math.min(n - 1, idx + 1) : e.key === 'Home' ? 0 : n - 1; const r = wrap.querySelector('svg').getBoundingClientRect(); montrer(wrap, idx, null, r.top + r.height / 2); });
  document.addEventListener('focusin', e => { const wrap = e.target.closest && e.target.closest('.courbe[data-courbe]'); if (!wrap) return; let data; try { data = JSON.parse(wrap.dataset.courbe); } catch (x) { return; } const r = wrap.querySelector('svg').getBoundingClientRect(); montrer(wrap, data.dates.length - 1, null, r.top + r.height / 2); });
  document.addEventListener('focusout', e => { const wrap = e.target.closest && e.target.closest('.courbe[data-courbe]'); if (wrap) cacher(wrap); });

  /* ---------- Fenêtre « Détails et courbes » ---------- */
  const carteCourbe = ch => { const l0 = ch.lignes[0]; const last = l0.pts[l0.pts.length - 1], prev = l0.pts[l0.pts.length - 2]; const delta = prev ? (last.v - prev.v) : null;
    return `<div class="courbe-card"><div class="row between" style="align-items:baseline"><b>${esc(ch.titre)}</b><span class="small muted">${esc(ch.unite || '')}</span></div><div class="small ink2" style="margin:2px 0 6px">${ch.lignes.length > 1 ? esc(l0.nom) + ' ' : ''}<b class="mono">${fmtV(last.v)}${ch.unite ? ' ' + esc(ch.unite) : ''}</b> le ${R.fmtDate(last.date)}${prev ? ` · <span class="muted">${delta > 0 ? '+' : ''}${fmtV(delta)} depuis le ${R.fmtDate(prev.date)}</span>` : ' · <span class="muted">première valeur</span>'}</div>${R.courbe(ch)}</div>`; };
  const filtrePeriode = () => { const per = (R.ui.courbes && R.ui.courbes.periode) || 0; const opts = [[6, '6 mois'], [12, '12 mois'], [24, '24 mois'], [0, 'Tout']]; return `<div class="row" style="gap:6px;align-items:center"><span class="small muted">Période</span>${opts.map(o => `<button type="button" class="btn sm${per === o[0] ? ' primary' : ''}" data-action="courbesPeriode" data-mois="${o[0]}">${o[1]}</button>`).join('')}</div>`; };
  const depuis = () => { const per = (R.ui.courbes && R.ui.courbes.periode) || 0; return per ? R.addDays(R.today(), -Math.round(per * 30.44)) : null; };
  const filtrerCharts = (charts, d) => !d ? charts : charts.map(ch => ({ ...ch, lignes: ch.lignes.map(l => ({ ...l, pts: l.pts.filter(p => p.date >= d) })).filter(l => l.pts.length) })).filter(ch => ch.lignes.length);
  R.modalCourbes = (p, quoi) => {
    R.ui.courbes = R.ui.courbes || { periode: 12 }; const d = depuis(); const bio = quoi === 'bio';
    const charts = filtrerCharts(bio ? R.seriesBio(p) : R.seriesClinique(p), d);
    const rows = bio ? null : R.lignesCliniques(p).filter(r => !d || r.date >= d);
    const body = `<div class="row between" style="gap:10px"><div class="small ink2">${bio ? 'Une courbe par analyse : les valeurs sont celles saisies dans les contrôles marqués « Fait ». Survolez un point ou utilisez les flèches du clavier pour lire les valeurs.' : 'Une courbe par mesure : poids, IMC, température, fréquence cardiaque et tension viennent de chaque séance réalisée et de chaque consultation saisie.'}</div>${filtrePeriode()}</div>
      ${charts.length ? `<div class="courbes-grid">${charts.map(carteCourbe).join('')}</div>` : `<div class="empty">Aucune valeur numérique${d ? ' sur cette période' : ''}. ${bio ? 'Saisissez les résultats dans la fenêtre « Fait » des contrôles biologiques.' : 'Renseignez le poids et les constantes dans la fenêtre « Fait » des séances.'}</div>`}
      ${bio ? '' : `<div><div class="caps mb8">Signes cliniques par séance</div>${R.stripSignes(rows)}</div>`}
      <div><div class="caps mb8">${bio ? 'Tableau des résultats' : 'Tableau des examens cliniques'}</div>${bio ? R.tableBio(p, d) : R.tableClinique(p, d)}</div>
      ${bio ? '<p class="small muted" style="margin:0">Les zones de référence sont indicatives (adulte) : adaptez-les aux normes de votre laboratoire.</p>' : ''}`;
    R.modal({ title: `${bio ? 'Résultats biologiques' : 'Examens cliniques'} — ${esc(R.nomComplet(p))}`, wide: true, body, foot: `<button type="button" class="btn primary" data-action="closeModal">Fermer</button>` });
    R.ui.courbes.pid = p.id; R.ui.courbes.quoi = quoi;
  };
  Object.assign(R.actions, {
    bioCourbes(el) { R.modalCourbes(R.patient(el.dataset.pid), 'bio'); },
    cliniqueCourbes(el) { R.modalCourbes(R.patient(el.dataset.pid), 'clinique'); },
    courbesPeriode(el) { R.ui.courbes.periode = +el.dataset.mois; const p = R.patient(R.ui.courbes.pid); if (p) R.modalCourbes(p, R.ui.courbes.quoi); }
  });
})(window.RYZE);
