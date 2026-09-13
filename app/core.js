/* =====================================================================
   Ryze — core.js : état, droits, navigation, coquille, tableau de bord
   ===================================================================== */
'use strict';
(function (R) {
  const KEY = 'ryze-hdj-v1';
  const S = {};
  R.S = S; R.ui = { filtres: {}, semaineOffset: 0 };
  R.pages = {}; R.actions = {};

  function charger() {
    try { const raw = localStorage.getItem(KEY); if (!raw) return null; const s = JSON.parse(raw); if (s.version !== 1) return null; if (!s.dirty && s.semaineSeed !== R.semaineRef()) return null; return s; } catch (e) { return null; }
  }
  function remplacer(obj) { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, obj); }
  remplacer(charger() || Object.assign(R.seed(), { semaineSeed: R.semaineRef() }));
  R.save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible : la session reste en mémoire */ } };
  R.touch = () => { S.dirty = true; R.save(); };
  R.vider = () => { try { localStorage.removeItem(KEY); } catch (e) {} const u = S.user; remplacer(Object.assign(R.seedVide(), { semaineSeed: R.semaineRef(), user: u })); R.save(); R.go(u ? 'dashboard' : 'dashboard'); R.toast('Base vide : ajoutez vos patients, lots et rendez-vous', 'good'); };
  R.reset = () => { try { localStorage.removeItem(KEY); } catch (e) {} const u = S.user; remplacer(Object.assign(R.seed(), { semaineSeed: R.semaineRef(), user: u })); R.save(); R.go('dashboard'); R.toast('Données de démonstration réinitialisées', 'good'); };
  R.journal = (txt) => { S.journal.unshift({ date: R.today(), heure: new Date().toTimeString().slice(0, 5), par: S.user, txt }); S.journal = S.journal.slice(0, 200); };

  /* ---------- Helpers ---------- */
  R.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  R.user = () => S.users.find(u => u.id === S.user);
  R.userById = id => S.users.find(u => u.id === id);
  R.userName = id => { const u = R.userById(id); return u ? `${u.titre ? u.titre + ' ' : ''}${u.prenom ? u.prenom[0] + '. ' : ''}${u.nom}` : '—'; };
  R.initials = (p, n) => (((p || '')[0] || '') + ((n || '')[0] || '')).toUpperCase();
  R.can = (mod, lvl) => { const u = R.user(); if (!u) return false; const p = (R.PERMS[u.role] || {})[mod] || '-'; if (lvl === 'w') return p === 'rw'; if (lvl === 'v') return p === 'v' || p === 'rw'; return p !== '-'; };
  R.patient = id => S.patients.find(p => p.id === id);
  R.proto = id => S.protocoles.find(p => p.id === id);
  R.stockItem = id => S.stock.find(s => s.articleId === id);
  R.qte = item => item.lots.reduce((a, l) => a + (l.qte || 0), 0);
  R.imc = p => p.poids && p.taille ? (p.poids / Math.pow(p.taille / 100, 2)).toFixed(1) : '—';
  R.uid = (pfx) => pfx + Math.random().toString(36).slice(2, 8);
  R.nomComplet = p => `${p.nom} ${p.prenom}`;
  R.params = obj => R.esc(JSON.stringify(obj || {}));

  R.prochaineCure = p => p.cures.find(c => c.statut === 'prevue') || null;
  R.derniereCure = p => [...p.cures].reverse().find(c => c.statut === 'realisee') || null;
  R.badge = (cls, txt) => `<span class="badge ${cls}"><i class="dot"></i>${R.esc(txt)}</span>`;
  R.statutPatientBadge = p => p.statut === 'suspendu' ? R.badge('crit', 'Suspendu') : p.statut === 'induction' ? R.badge('info', 'Induction') : p.statut === 'termine' ? R.badge('', 'Terminé') : R.badge('good', 'Entretien');
  R.statutCureBadge = c => {
    const t = R.today();
    if (c.statut === 'realisee') return R.badge('good', 'Réalisée');
    if (c.statut === 'reportee') return R.badge('warn', 'Reportée');
    if (c.statut === 'annulee') return R.badge('', 'Annulée');
    if (c.datePrevue < t) return R.badge('crit', 'En retard');
    if (c.datePrevue === t) return R.badge('accent', 'Aujourd’hui');
    return R.badge('', 'Prévue');
  };
  R.pathoBadge = p => `<span class="badge ${p.pathologie === 'MC' ? 'info' : 'accent'}">${R.esc(R.PATHOS[p.pathologie]?.court || p.pathologie)}</span>`;
  R.voieBadge = v => `<span class="tag">${R.esc(v)}</span>`;

  /* ---------- Semaine, cures, rendez-vous ---------- */
  R.semaine = (lundi) => { lundi = lundi || R.semaineRef(); return { lundi, dimanche: R.addDays(lundi, 6), jours: [0, 1, 2, 3, 4].map(i => R.addDays(lundi, i)) }; };
  R.curesEntre = (a, b) => S.patients.flatMap(p => p.cures.filter(c => c.datePrevue >= a && c.datePrevue <= b).map(c => ({ cure: c, patient: p }))).sort((x, y) => (x.cure.datePrevue + (x.cure.heure || '99')).localeCompare(y.cure.datePrevue + (y.cure.heure || '99')));
  R.rdvEntre = (a, b) => S.rdv.filter(r => r.date >= a && r.date <= b).sort((x, y) => (x.date + x.heure).localeCompare(y.date + y.heure));

  /* ---------- Analyse de stock ---------- */
  R.analyseStock = item => {
    const art = R.article(item.articleId), qte = R.qte(item), cmj = (item.cmm || 0) / 30, t = R.today();
    const couverture = cmj > 0 ? Math.round(qte / cmj) : null;
    const secu = Math.ceil(cmj * S.settings.stockSecuriteJours);
    const pointCommande = Math.ceil(cmj * (item.delaiLivraison || 0)) + secu;
    const fin = R.addDays(t, S.settings.horizonPrevisionJours);
    const cures = S.patients.flatMap(p => p.cures.filter(c => c.statut === 'prevue' && c.articleId === item.articleId && c.datePrevue >= t && c.datePrevue <= fin).map(c => ({ cure: c, patient: p })));
    const besoin = cures.reduce((a, x) => a + (x.cure.flacons || 0), 0);
    const aCommander = Math.max(0, besoin + secu - qte);
    let etat = 'ok';
    if (qte === 0) etat = 'rupture'; else if (qte <= item.seuil || qte < besoin) etat = 'faible'; else if (qte <= pointCommande) etat = 'commander';
    const lotsProches = item.lots.filter(l => l.qte > 0 && l.peremption >= t && R.diffDays(t, l.peremption) <= S.settings.joursPeremptionAlerte);
    const perimes = item.lots.filter(l => l.qte > 0 && l.peremption < t);
    return { art, qte, cmj, couverture, secu, pointCommande, besoin, aCommander, etat, lotsProches, perimes, cures };
  };
  R.etatStockBadge = etat => ({ ok: R.badge('good', 'OK'), commander: R.badge('info', 'À commander'), faible: R.badge('warn', 'Stock faible'), rupture: R.badge('crit', 'Rupture') })[etat];

  /* ---------- Alertes ---------- */
  R.alertes = () => {
    const out = [], t = R.today(), h = S.settings.horizonPrevisionJours;
    S.stock.forEach(it => {
      const a = R.analyseStock(it), u = a.art.uniteLib === 'u' ? 'unité(s)' : (a.art.voie === 'IV' ? 'flacon(s)' : 'unité(s)');
      if (a.etat === 'rupture') out.push({ sev: 'crit', cat: 'stock', t: `Rupture — ${a.art.libelle}`, d: a.besoin ? `${a.besoin} ${u} nécessaires dans les ${h} prochains jours (${a.cures.map(x => x.patient.nom).join(', ')})` : 'Aucune cure planifiée sur l’horizon de prévision', go: ['stock', {}] });
      else if (a.etat === 'faible') out.push({ sev: 'warn', cat: 'stock', t: `Stock faible — ${a.art.dci} ${a.art.voie !== '—' ? a.art.voie : ''} : ${a.qte} ${u}`, d: `Seuil ${it.seuil} · besoin ${a.besoin} sur ${h} j · quantité à commander ${a.aCommander}`, go: ['stock', {}] });
      a.perimes.forEach(l => out.push({ sev: 'crit', cat: 'stock', t: `Lot périmé — ${a.art.dci} lot ${l.lot}`, d: `${l.qte} ${u} · péremption ${R.fmtDate(l.peremption)} — à retirer du stock`, go: ['stock', {}] }));
      a.lotsProches.forEach(l => out.push({ sev: 'warn', cat: 'stock', t: `Péremption proche — ${a.art.dci} lot ${l.lot}`, d: `${l.qte} ${u} · péremption ${R.fmtDate(l.peremption)} (${R.diffDays(t, l.peremption)} j) — à utiliser en priorité`, go: ['stock', {}] }));
    });
    S.patients.forEach(p => {
      p.cures.filter(c => c.statut === 'prevue' && c.datePrevue < t).forEach(c => out.push({ sev: 'crit', cat: 'patient', t: `Cure n°${c.n} en retard — ${R.nomComplet(p)}`, d: `${R.proto(p.protocoleId)?.dci} ${c.label} prévue le ${R.fmtDate(c.datePrevue)}`, go: ['patient', { id: p.id, tab: 'cures' }] }));
      p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance < t).forEach(s => out.push({ sev: 'warn', cat: 'patient', t: `Surveillance en retard — ${R.nomComplet(p)}`, d: `${s.label} · échéance ${R.fmtDate(s.echeance)}`, go: ['patient', { id: p.id, tab: 'surveillance' }] }));
      if (p.statut === 'induction') { const manq = p.bilan.filter(b => b.statut === 'attente'); if (manq.length) out.push({ sev: 'warn', cat: 'patient', t: `Bilan pré-thérapeutique incomplet — ${R.nomComplet(p)}`, d: manq.map(b => R.BILAN_PRE.find(x => x.id === b.id)?.label).join(' · '), go: ['patient', { id: p.id, tab: 'bilan' }] }); }
      if (p.statut === 'suspendu') out.push({ sev: 'info', cat: 'patient', t: `Traitement suspendu — ${R.nomComplet(p)}`, d: p.motifSuspension, go: ['patient', { id: p.id }] });
    });
    const rank = { crit: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  };

  /* ---------- Icônes ---------- */
  const ICONS = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    proto: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    team: '<path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    chevL: '<polyline points="15 18 9 12 15 6"/>', chevR: '<polyline points="9 18 15 12 9 6"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    drop: '<path d="M12 2.7s-6 6.3-6 10.3a6 6 0 0 0 12 0c0-4-6-10.3-6-10.3z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };
  R.icon = (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  /* ---------- Modale, toast ---------- */
  R.modal = ({ title, body, foot, wide, form }) => {
    document.getElementById('modal-root').innerHTML = `<div class="modal-overlay"><form class="modal${wide ? ' wide' : ''}" ${form ? `data-form="${form}"` : ''} novalidate>
      <div class="modal-head"><h3>${title}</h3><button type="button" class="x-btn" data-action="closeModal" aria-label="Fermer">${R.icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</form></div>`;
    const first = document.querySelector('#modal-root input:not([readonly]), #modal-root select, #modal-root textarea'); if (first) first.focus();
  };
  R.closeModal = () => { document.getElementById('modal-root').innerHTML = ''; };
  R.toast = (msg, type) => { const root = document.getElementById('toast-root'); const el = document.createElement('div'); el.className = 'toast ' + (type || ''); el.textContent = msg; root.appendChild(el); setTimeout(() => el.remove(), 3800); };
  R.confirmer = (titre, texte, action, params) => R.modal({ title: titre, body: `<p style="margin:0">${texte}</p>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="button" class="btn primary" data-action="${action}" data-params='${R.params(params)}'>Confirmer</button>` });

  /* ---------- Graphique en colonnes empilées ---------- */
  function topRect(x, y, w, h, r) { r = Math.min(r, w / 2, h); return `M${x},${y + h} V${y + r} a${r},${r} 0 0 1 ${r},-${r} H${x + w - r} a${r},${r} 0 0 1 ${r},${r} V${y + h} Z`; }
  R.columnChart = ({ labels, series, height }) => {
    const W = 680, H = height || 230, padL = 30, padR = 6, padT = 14, padB = 24, n = labels.length;
    const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const max = Math.max(1, ...totals); const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10; const yMax = Math.ceil(max / step) * step;
    const plotW = W - padL - padR, plotH = H - padT - padB, band = plotW / n, bw = Math.min(24, band * 0.62);
    const y = v => padT + plotH - (v / yMax) * plotH;
    let g = '';
    for (let v = 0; v <= yMax; v += step) g += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${padL - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
    let bars = ''; const iMax = totals.indexOf(Math.max(...totals));
    labels.forEach((lab, i) => {
      let acc = 0; const x = padL + band * i + (band - bw) / 2;
      series.forEach(s => {
        const v = s.values[i] || 0; if (!v) return;
        const yTop = y(acc + v), yBot = y(acc) - (acc ? 2 : 0); const h = Math.max(0.5, yBot - yTop);
        const last = acc + v === totals[i];
        bars += last ? `<path class="bar" d="${topRect(x, yTop, bw, h, 4)}" fill="${s.color}" data-tip="${R.esc(lab)} · ${R.esc(s.name)} : ${v} (total ${totals[i]})"/>` : `<rect class="bar" x="${x}" y="${yTop}" width="${bw}" height="${h}" fill="${s.color}" data-tip="${R.esc(lab)} · ${R.esc(s.name)} : ${v} (total ${totals[i]})"/>`;
        acc += v;
      });
      bars += `<text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle">${R.esc(lab)}</text>`;
      if (totals[i] && (i === n - 1 || i === iMax)) bars += `<text x="${x + bw / 2}" y="${(y(totals[i]) - 5).toFixed(1)}" text-anchor="middle" style="fill:var(--ink-2);font-weight:600">${totals[i]}</text>`;
    });
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="sw" style="background:${s.color}"></i>${R.esc(s.name)}</span>`).join('')}</div>` : '';
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cures réalisées par mois">${g}<line class="axis" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>${bars}</svg>${legend}</div>`;
  };
  R.curesParMois = () => {
    const mois = []; const d = new Date();
    for (let i = 11; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); mois.push(R.iso(m).slice(0, 7)); }
    const series = [{ key: 'IFX100', name: 'Infliximab', color: 'var(--s1)' }, { key: 'VDZ300', name: 'Vedolizumab', color: 'var(--s2)' }, { key: 'UST130', name: 'Ustekinumab IV', color: 'var(--s3)' }, { key: 'autres', name: 'Autres IV', color: 'var(--s4)' }];
    series.forEach(s => s.values = mois.map(() => 0));
    S.patients.forEach(p => p.cures.filter(c => c.statut === 'realisee' && c.voie === 'IV').forEach(c => { const i = mois.indexOf((c.dateReelle || c.datePrevue).slice(0, 7)); if (i < 0) return; (series.find(x => x.key === c.articleId) || series[3]).values[i]++; }));
    return { labels: mois.map(m => R.fmtMois(m + '-01')), series };
  };

  /* ---------- Navigation et rendu ---------- */
  const NAV = [{ label: '', items: [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'dash', mod: 'dashboard' },
    { id: 'planning', label: 'Planning HDJ', icon: 'cal', mod: 'planning' },
    { id: 'patients', label: 'Patients', icon: 'users', mod: 'patients' },
    { id: 'nouveau', label: 'Nouveau dossier', icon: 'plus', mod: 'dossier', w: true },
    { id: 'protocoles', label: 'Protocoles', icon: 'proto', mod: 'protocoles' },
    { id: 'stock', label: 'Stock', icon: 'box', mod: 'stock' },
    { id: 'equipe', label: 'Équipe & codes', icon: 'team', mod: 'equipe' }
  ] }];
  R.go = (page, params) => { R.closeModal(); S.route = { page, params: params || {} }; R.save(); R.render(); window.scrollTo(0, 0); };
  R.render = () => {
    const app = document.getElementById('app');
    if (!S.user) { app.innerHTML = loginView(); return; }
    const page = R.pages[S.route.page] ? S.route.page : 'dashboard';
    const item = NAV.flatMap(g => g.items).find(i => i.id === page);
    if (item && !R.can(item.mod, item.w ? 'w' : 'r')) { S.route = { page: 'dashboard', params: {} }; return R.render(); }
    const pg = R.pages[page];
    const alertes = R.alertes(); const nCrit = alertes.filter(a => a.sev === 'crit').length;
    const u = R.user(); const sem = R.semaine();
    app.innerHTML = `<div class="shell">
      <aside class="rail" id="rail">
        <div class="brand"><div class="brand-mark">Rz</div><div><b>Ryze</b><span>Biothérapies · Hôpital de jour</span></div></div>
        <nav class="nav">${NAV.map(g => { const items = g.items.filter(i => R.can(i.mod, i.w ? 'w' : 'r')); return items.length ? `${g.label ? `<div class="nav-label">${g.label}</div>` : '<div style="height:8px"></div>'}${items.map(i => `<button class="nav-item${(page === i.id || (i.id === 'patients' && (page === 'patient' || page === 'carnet'))) ? ' active' : ''}" data-go="${i.id}">${R.icon(i.icon)}<span>${i.label}</span>${i.id === 'dashboard' && nCrit ? `<span class="count">${nCrit}</span>` : ''}</button>`).join('')}` : ''; }).join('')}</nav>
        <div class="rail-foot">${R.esc(S.settings.service)}<br>${R.esc(S.settings.unite)}</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="menu-btn" data-action="toggleRail" aria-label="Menu">${R.icon('menu')}</button>
          <div class="search">${R.icon('search')}<input type="search" id="global-search" placeholder="Rechercher un patient (nom, IPP)…" data-input="globalSearch" autocomplete="off"><div id="search-results"></div></div>
          <span class="week-chip">Semaine du ${R.fmtDate(sem.lundi, { day: 'numeric', month: 'short' })} au ${R.fmtDate(sem.jours[4], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <div class="user-chip"><div class="who"><b>${R.esc(R.userName(u.id))}</b><span>${R.esc(R.ROLES[u.role].label)} · ${R.esc(u.fonction)}</span></div><div class="avatar">${R.initials(u.prenom, u.nom)}</div><button class="btn sm ghost" data-action="logout" title="Changer d’utilisateur">${R.icon('logout')}</button></div>
        </header>
        <main class="content">${pg.render(S.route.params)}</main>
      </div></div>`;
  };

  function loginView() {
    const actifs = S.users.filter(u => u.actif);
    return `<div class="login"><div class="login-box">
      <div class="login-left">
        <div class="brand" style="padding:0"><div class="brand-mark">Rz</div><div><b>Ryze</b><span>Suivi biothérapique</span></div></div>
        <h1>Gestion des biothérapies en hôpital de jour</h1>
        <p>${R.esc(S.settings.service)} — ${R.esc(S.settings.unite)}.</p>
        <ul class="feature-list">
          <li>${R.icon('check')}<span>Dossier patient et protocole par cycles, doses calculées au poids.</span></li>
          <li>${R.icon('check')}<span>Planning des fauteuils, cures marquées réalisées en un clic.</span></li>
          <li>${R.icon('check')}<span>Stock par lot et péremption, besoins calculés depuis le planning.</span></li>
          <li>${R.icon('check')}<span>Carnet de suivi imprimable pour chaque patient.</span></li>
        </ul>
        <div class="demo-note">${S.vide ? 'Base vide : aucun patient ni lot. ' : 'Prototype de démonstration — patients, lots et effectifs fictifs. '}<button type="button" class="btn sm ghost" data-action="${S.vide ? 'resetDemo' : 'viderDemoConfirm'}">${S.vide ? 'Recharger la démonstration' : 'Démarrer avec une base vide'}</button></div>
      </div>
      <div class="login-right">
        <form data-form="loginCode" class="stack">
          <div class="caps">Connexion</div>
          <div class="field"><label for="login-code">Code d’accès personnel</label><input type="text" id="login-code" name="code" class="mono" style="font-size:18px;letter-spacing:.12em;text-transform:uppercase" placeholder="ex. MED001" autocomplete="off" autofocus required></div>
          <button type="submit" class="btn primary" style="justify-content:center">Entrer</button>
        </form>
        <div class="subtle mt24"><div class="caps mb8">Codes de démonstration</div>
          <div class="stack" style="gap:6px">${actifs.map(u => `<div class="row between small"><span>${R.esc(R.userName(u.id))} <span class="muted">· ${R.esc(u.fonction)}</span></span><span class="row" style="gap:6px"><span class="badge ${u.role === 'complet' ? 'accent' : ''}">${R.ROLES[u.role].court}</span><button type="button" class="tag" data-action="loginFill" data-code="${R.esc(u.code)}" style="cursor:pointer">${R.esc(u.code)}</button></span></div>`).join('')}</div>
          <p class="xs muted" style="margin:10px 0 0">Les codes sont créés dans Équipe & codes par un accès complet. En production, cette liste n’est évidemment pas affichée.</p></div>
      </div></div></div>`;
  }

  /* ---------- Tableau de bord ---------- */
  R.pages.dashboard = {
    render() {
      const sem = R.semaine(), t = R.today();
      const actifs = S.patients.filter(p => p.statut !== 'termine');
      const curesSem = R.curesEntre(sem.lundi, sem.dimanche);
      const iv = curesSem.filter(x => x.cure.voie === 'IV' && x.cure.statut !== 'annulee');
      const faites = iv.filter(x => x.cure.statut === 'realisee').length;
      const alertes = R.alertes();
      const stockAl = alertes.filter(a => a.cat === 'stock' && a.sev !== 'info').length;
      const retards = S.patients.reduce((n, p) => n + p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance < t).length, 0);
      const rdv7 = R.rdvEntre(t, R.addDays(t, 7)).length;
      const induction = actifs.filter(p => p.statut === 'induction').length;
      const chart = R.curesParMois();
      const stockIV = S.stock.filter(it => R.article(it.articleId).voie === 'IV' && R.article(it.articleId).serie > 0);
      return `
      <div class="page-head"><div><h1>Tableau de bord</h1><p>${R.esc(S.settings.unite)} · semaine du ${R.fmtDateLong(sem.lundi)} au ${R.fmtDateLong(sem.jours[4])}</p></div>
        <div class="page-actions">${R.can('dossier', 'w') ? `<button class="btn primary" data-go="nouveau">${R.icon('plus')}Nouveau dossier</button>` : ''}<button class="btn" data-go="planning">${R.icon('cal')}Planning</button></div></div>
      <div class="kpis">
        <button class="kpi" data-go="patients"><div class="label">Patients suivis</div><div class="value">${actifs.length}<small>${induction} en induction</small></div><div class="sub">${S.patients.filter(p => p.statut === 'suspendu').length} traitement(s) suspendu(s)</div></button>
        <button class="kpi" data-go="planning"><div class="label">Cures IV cette semaine</div><div class="value">${iv.length}<small>${faites} réalisée${faites > 1 ? 's' : ''}</small></div><div class="sub">${iv.reduce((a, x) => a + (x.cure.flacons || 0), 0)} flacons à préparer · ${rdv7} rendez-vous à 7 j</div></button>
        <button class="kpi${stockAl ? ' attention' : ''}" data-go="stock"><div class="label">Alertes stock</div><div class="value">${stockAl}</div><div class="sub">${S.stock.filter(it => R.analyseStock(it).etat === 'rupture').length} rupture(s) · ${S.stock.filter(it => R.analyseStock(it).lotsProches.length).length} lot(s) proche(s) de péremption</div></button>
        <button class="kpi${retards ? ' attention' : ''}" data-go="patients"><div class="label">Surveillances en retard</div><div class="value">${retards}</div><div class="sub">examens non réalisés à l’échéance</div></button>
      </div>
      <div class="grid c21">
        <section class="card"><div class="card-head"><div><h2>Cures IV réalisées par mois</h2><div class="sub">12 derniers mois · toutes molécules</div></div></div><div class="card-body">${R.columnChart(chart)}</div></section>
        <section class="card"><div class="card-head"><h2>À traiter</h2><span class="badge ${alertes.some(a => a.sev === 'crit') ? 'crit' : 'warn'}">${alertes.length}</span></div>
          <div class="card-body" style="padding-top:4px;padding-bottom:4px">${!S.patients.length ? `<div class="empty">Aucun patient. ${R.can('dossier', 'w') ? '<br><button class="btn sm primary mt8" data-go="nouveau">Créer le premier dossier</button>' : ''}</div>` : alertes.length ? alertes.slice(0, 8).map(a => `<button class="alert-row" data-go="${a.go[0]}" data-params='${R.params(a.go[1])}'><i class="sev ${a.sev}"></i><div><div class="t">${R.esc(a.t)}</div><div class="d">${R.esc(a.d)}</div></div></button>`).join('') : '<div class="empty">Rien à signaler</div>'}</div>
          ${alertes.length > 8 ? `<div class="card-foot">${alertes.length - 8} autre(s) alerte(s) — voir Patients et Stock</div>` : ''}</section>
      </div>
      <div class="grid c21">
        <section class="card"><div class="card-head"><div><h2>Programme de la semaine</h2><div class="sub">cures IV et dispensations SC · ${S.settings.fauteuils} fauteuils</div></div><button class="btn sm" data-go="planning">Ouvrir le planning</button></div>
          <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Jour</th><th>Heure</th><th>Patient</th><th>Biothérapie</th><th>Dose</th><th class="right">Flacons</th><th>Statut</th>${R.can('cures', 'w') ? '<th></th>' : ''}</tr></thead><tbody>
          ${curesSem.filter(x => x.cure.statut !== 'annulee').map(x => { const c = x.cure, p = x.patient, pr = R.proto(p.protocoleId); return `<tr class="row-link${c.datePrevue === t ? ' today' : ''}${c.statut === 'realisee' ? ' done' : ''}" data-go="patient" data-params='${R.params({ id: p.id, tab: 'cures' })}'>
            <td class="nowrap">${R.fmtDate(c.datePrevue, { weekday: 'short', day: 'numeric' })}</td><td class="mono">${c.heure || (c.voie === 'SC' ? 'SC' : '—')}</td>
            <td class="name">${R.esc(R.nomComplet(p))}<small>${R.esc(p.ipp)}</small></td>
            <td>${R.esc(pr?.dci || '')} <span class="tag">${c.label}</span> ${R.voieBadge(c.voie)}</td>
            <td class="small dose">${R.esc(c.doseTexte)}</td><td class="right num">${c.flacons || '—'}</td>
            <td>${R.statutCureBadge(c)}</td>${R.can('cures', 'w') ? `<td class="actions">${c.statut === 'prevue' || c.statut === 'reportee' ? `<button class="btn sm primary" data-action="cureEnregistrer" data-pid="${p.id}" data-n="${c.n}">Marquer réalisée</button>` : ''}</td>` : ''}</tr>`; }).join('') || '<tr><td colspan="8" class="empty">Aucune cure cette semaine</td></tr>'}
          </tbody></table></div></section>
        <section class="card"><div class="card-head"><div><h2>Stock des biothérapies IV</h2><div class="sub">flacons disponibles · couverture en jours</div></div><button class="btn sm" data-go="stock">Gérer</button></div>
          <div class="card-body" style="padding-top:4px;padding-bottom:4px">${stockIV.map(it => { const a = R.analyseStock(it); const ratio = Math.min(1, a.qte / Math.max(1, it.seuil * 2.5)); const cls = a.etat === 'rupture' ? 'crit' : a.etat === 'faible' ? 'warn' : 'good'; return `<div class="stock-row"><div class="nm">${R.esc(a.art.dci)} <span class="tag">${a.art.unite} ${a.art.uniteLib}</span><small>seuil ${it.seuil} · besoin ${a.besoin} sur ${S.settings.horizonPrevisionJours} j</small></div><div class="meter"><i class="${cls}" style="width:${(ratio * 100).toFixed(0)}%"></i></div><div class="num right"><b>${a.qte}</b> <span class="muted small">/ ${a.couverture === null ? '—' : a.couverture + ' j'}</span></div></div>`; }).join('')}</div></section>
      </div>`;
    }
  };

  /* ---------- Actions globales ---------- */
  Object.assign(R.actions, {
    loginCode(f, fd) { const code = String(fd.get('code') || '').trim().toUpperCase(); const u = S.users.find(x => x.actif && x.code === code); if (!u) { R.toast('Code inconnu ou désactivé', 'crit'); return; } u.derniere = R.today(); S.user = u.id; S.route = { page: 'dashboard', params: {} }; R.save(); R.render(); },
    loginFill(el) { const i = document.getElementById('login-code'); i.value = el.dataset.code; i.form.requestSubmit(); },
    logout() { S.user = null; R.save(); R.render(); },
    closeModal() { R.closeModal(); },
    toggleRail() { const r = document.getElementById('rail'); r.classList.toggle('open'); let b = document.getElementById('rail-backdrop'); if (r.classList.contains('open')) { if (!b) { b = document.createElement('div'); b.id = 'rail-backdrop'; b.className = 'rail-backdrop'; b.setAttribute('data-action', 'toggleRail'); document.body.appendChild(b); } } else if (b) b.remove(); },
    globalSearch(el) {
      const q = el.value.trim().toLowerCase(); const box = document.getElementById('search-results');
      if (q.length < 2) { box.innerHTML = ''; return; }
      const res = S.patients.filter(p => (p.nom + ' ' + p.prenom + ' ' + p.ipp).toLowerCase().includes(q)).slice(0, 6);
      box.innerHTML = res.length ? `<div class="search-results">${res.map(p => `<button type="button" data-go="patient" data-params='${R.params({ id: p.id })}'><div class="avatar" style="width:26px;height:26px;font-size:10px">${R.initials(p.prenom, p.nom)}</div><div><b>${R.esc(R.nomComplet(p))}</b> <span class="mono muted">${R.esc(p.ipp)}</span></div><span class="muted small" style="margin-left:auto">${R.esc(R.proto(p.protocoleId)?.dci || '')}</span></button>`).join('')}</div>` : `<div class="search-results"><div class="empty" style="padding:14px">Aucun patient</div></div>`;
    },
    resetDemo() { R.reset(); },
    viderDemo() { R.vider(); },
    viderDemoConfirm() { R.confirmer('Démarrer avec une base vide ?', 'Les patients, lots, mouvements et rendez-vous de démonstration seront supprimés. Les protocoles, les articles de stock et les comptes sont conservés.', 'viderDemo'); }
  });

  /* ---------- Délégation d'événements ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-go],[data-action]');
    if (!t) { if (e.target.classList.contains('modal-overlay')) R.closeModal(); return; }
    if (t.dataset.go) { let p = {}; try { p = t.dataset.params ? JSON.parse(t.dataset.params) : {}; } catch (err) {} R.go(t.dataset.go, p); return; }
    const fn = R.actions[t.dataset.action]; if (fn) fn(t, e);
  });
  document.addEventListener('submit', e => { const f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault(); const fn = R.actions[f.dataset.form]; if (fn) fn(f, new FormData(f)); });
  document.addEventListener('change', e => { const t = e.target.closest('[data-change]'); if (t) { const fn = R.actions[t.dataset.change]; if (fn) fn(t, e); } });
  document.addEventListener('input', e => { const t = e.target.closest('[data-input]'); if (t) { const fn = R.actions[t.dataset.input]; if (fn) fn(t, e); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') R.closeModal(); });
  document.addEventListener('mousemove', e => { const tip = document.getElementById('tooltip'); const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) { tip.hidden = true; return; } tip.textContent = t.dataset.tip; tip.hidden = false; const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8); tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px'; });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) { const b = document.getElementById('search-results'); if (b) b.innerHTML = ''; } });

  window.addEventListener('DOMContentLoaded', R.render);
  if (document.readyState !== 'loading') setTimeout(R.render, 0);
})(window.RYZE);
