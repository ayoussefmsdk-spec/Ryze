/* =====================================================================
   Ryze — core.js : état, accès, capacité HDJ, calendrier, coquille,
   tableau de bord
   ===================================================================== */
'use strict';
(function (R) {
  const KEY = 'ryze-hdj-v1', VERSION = 3;
  const S = {};
  R.S = S; R.ui = { filtres: {}, semaineOffset: 0, cal: {} };
  R.pages = {}; R.actions = {};

  /* ---------- Migration des données locales ---------- */
  function migrer(s) {
    const seedUsers = R.seed().users;
    if (s.version === 1) {
      const map = { medecin: 'complet', pharmacien: 'complet', admin: 'complet', ide: 'hdj', secretaire: 'hdj' };
      (s.users || []).forEach(u => { if (!R.ROLES[u.role]) { u.medecin = u.role === 'medecin'; u.role = map[u.role] || 'hdj'; } });
      s.version = 2;
    }
    (s.users || []).forEach(u => { if (!R.ROLES[u.role]) u.role = 'hdj'; const ref = seedUsers.find(x => x.id === u.id); if (!u.code) u.code = ref ? ref.code : 'HDJ' + Math.floor(100 + Math.random() * 900); if (u.medecin === undefined) u.medecin = ref ? ref.medecin : false; });
    if (s.version === 2) {
      s.settings = s.settings || {}; s.settings.hdj = s.settings.hdj || { jours: [1, 2, 3, 4, 5], ouverture: '08:00', fermeture: '16:00', fauteuils: s.settings.fauteuils || 6, maxParJour: 12, pas: 30 };
      (s.patients || []).forEach(p => { p.cures.forEach(c => { c.cycle = c.cycle || 1; c.protocoleId = c.protocoleId || p.protocoleId; }); p.cycleCourant = p.cycleCourant || 1; p.carnetMixte = !!p.carnetMixte; p.historiqueProtocoles = p.historiqueProtocoles || [{ cycle: 1, protocoleId: p.protocoleId, dateDebut: p.dateDebut, poids: p.poids, statut: 'en cours', modifications: [], planifieJusqua: p.cures.length ? p.cures[p.cures.length - 1].label : '—' }]; });
      s.version = 3;
    }
    if (s.user && !(s.users || []).some(u => u.id === s.user)) s.user = null;
    return s;
  }
  function charger() {
    try { const raw = localStorage.getItem(KEY); if (!raw) return null; const s = JSON.parse(raw); if (!s || !s.users || !s.patients) return null; if (s.version > VERSION) return null; if (!s.dirty && s.semaineSeed !== R.semaineRef()) return null; return migrer(s); } catch (e) { return null; }
  }
  function remplacer(obj) { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, obj); }
  remplacer(charger() || Object.assign(R.seed(), { semaineSeed: R.semaineRef(), version: VERSION }));
  S.version = VERSION;
  R.save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ } };
  R.touch = () => { S.dirty = true; R.save(); };
  R.reset = () => { try { localStorage.removeItem(KEY); } catch (e) {} const u = S.user; remplacer(Object.assign(R.seed(), { semaineSeed: R.semaineRef(), version: VERSION, user: u })); R.save(); R.go('dashboard'); R.toast('Données de démonstration réinitialisées', 'good'); };
  R.vider = () => { try { localStorage.removeItem(KEY); } catch (e) {} const u = S.user; remplacer(Object.assign(R.seedVide(), { semaineSeed: R.semaineRef(), version: VERSION, user: u })); R.save(); R.go('dashboard'); R.toast('Base vide : ajoutez vos patients et rendez-vous', 'good'); };
  R.journal = (txt) => { S.journal = S.journal || []; S.journal.unshift({ date: R.today(), heure: new Date().toTimeString().slice(0, 5), par: S.user, txt }); S.journal = S.journal.slice(0, 200); };

  /* ---------- Helpers ---------- */
  R.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  R.user = () => S.users.find(u => u.id === S.user);
  R.userById = id => S.users.find(u => u.id === id);
  R.userName = id => { const u = R.userById(id); return u ? `${u.titre ? u.titre + ' ' : ''}${u.prenom ? u.prenom[0] + '. ' : ''}${u.nom}` : '—'; };
  R.initials = (p, n) => (((p || '')[0] || '') + ((n || '')[0] || '')).toUpperCase();
  R.can = (mod, lvl) => { const u = R.user(); if (!u) return false; const p = (R.PERMS[u.role] || {})[mod] || '-'; if (lvl === 'w') return p === 'rw'; return p !== '-'; };
  R.patient = id => S.patients.find(p => p.id === id);
  R.proto = id => S.protocoles.find(p => p.id === id);
  R.imc = p => p.poids && p.taille ? (p.poids / Math.pow(p.taille / 100, 2)).toFixed(1) : '—';
  R.uid = (pfx) => pfx + Math.random().toString(36).slice(2, 8);
  R.nomComplet = p => `${p.nom} ${p.prenom}`;
  R.params = obj => R.esc(JSON.stringify(obj || {}));
  R.prochaineCure = p => p.cures.find(c => c.statut === 'prevue') || null;
  R.derniereCure = p => [...p.cures].reverse().find(c => c.statut === 'realisee') || null;
  R.badge = (cls, txt) => `<span class="badge ${cls}"><i class="dot"></i>${R.esc(txt)}</span>`;
  R.statutPatientBadge = p => p.statut === 'suspendu' ? R.badge('crit', 'Suspendu') : p.statut === 'induction' ? R.badge('info', 'Induction') : p.statut === 'termine' ? R.badge('', 'Terminé') : R.badge('good', 'Entretien');
  R.statutCureBadge = c => { const t = R.today(); if (c.statut === 'realisee') return R.badge('good', 'Réalisée'); if (c.statut === 'reportee') return R.badge('warn', 'Reportée'); if (c.statut === 'annulee') return R.badge('', 'Annulée'); if (c.datePrevue < t) return R.badge('crit', 'En retard'); if (c.datePrevue === t) return R.badge('accent', 'Aujourd’hui'); return R.badge('', 'Prévue'); };
  R.statutSurvBadge = s => { const t = R.today(); if (s.statut === 'faite') return R.badge('good', 'Fait'); if (s.statut === 'annulee') return R.badge('', 'Annulé'); if (s.echeance < t) return R.badge('crit', `En retard (${R.diffDays(s.echeance, t)} j)`); if (R.diffDays(t, s.echeance) <= 14) return R.badge('warn', `Dans ${R.diffDays(t, s.echeance)} j`); return R.badge('', 'Prévu'); };
  R.pathoBadge = p => `<span class="badge ${p.pathologie === 'MC' ? 'info' : 'accent'}">${R.esc(R.PATHOS[p.pathologie]?.court || p.pathologie)}</span>`;
  R.voieBadge = v => `<span class="tag">${R.esc(v)}</span>`;
  R.protoDeCure = (p, c) => R.proto(c.protocoleId || p.protocoleId);

  /* ---------- Semaine, cures, contrôles, rendez-vous ---------- */
  R.semaine = (lundi) => { lundi = lundi || R.semaineRef(); return { lundi, dimanche: R.addDays(lundi, 6), jours: [0, 1, 2, 3, 4, 5, 6].map(i => R.addDays(lundi, i)) }; };
  R.curesEntre = (a, b) => S.patients.flatMap(p => p.cures.filter(c => c.datePrevue >= a && c.datePrevue <= b && c.statut !== 'annulee').map(c => ({ cure: c, patient: p }))).sort((x, y) => (x.cure.datePrevue + (x.cure.heure || '99')).localeCompare(y.cure.datePrevue + (y.cure.heure || '99')));
  R.controlesEntre = (a, b) => S.patients.flatMap(p => p.surveillance.filter(s => s.mode === 'echeance' && s.statut !== 'annulee' && s.echeance >= a && s.echeance <= b).map(s => ({ surv: s, patient: p }))).sort((x, y) => x.surv.echeance.localeCompare(y.surv.echeance));
  R.rdvEntre = (a, b) => S.rdv.filter(r => r.date >= a && r.date <= b).sort((x, y) => (x.date + x.heure).localeCompare(y.date + y.heure));

  /* ---------- Capacité de l'hôpital de jour ---------- */
  const pad = n => String(n).padStart(2, '0');
  R.toMin = h => { const [a, b] = String(h || '00:00').split(':').map(Number); return a * 60 + (b || 0); };
  R.toH = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  R.hdj = () => S.settings.hdj;
  R.jourOuvert = d => R.hdj().jours.includes(R.parse(d).getDay());
  R.dureeSeance = (proto, cure) => (cure && cure.voie !== 'IV') ? 0 : (proto && proto.dureeSeanceMin != null ? proto.dureeSeanceMin : 180);
  /* séances IV d'une date : { deb, fin, fauteuil, patient, cure } ; exclude = { pid, n } ; extra = séances virtuelles */
  R.seances = (date, exclude, extra) => {
    const out = [];
    S.patients.forEach(p => p.cures.forEach(c => { if (c.datePrevue !== date || c.voie !== 'IV' || c.statut === 'annulee' || c.statut === 'reportee') return; if (exclude && exclude.pid === p.id && exclude.n === c.n) return; const deb = R.toMin(c.heure || R.hdj().ouverture); out.push({ deb, fin: deb + R.dureeSeance(R.protoDeCure(p, c), c), fauteuil: c.fauteuil || 0, patient: p, cure: c }); }));
    (extra || []).filter(x => x.date === date).forEach(x => out.push({ deb: R.toMin(x.heure), fin: R.toMin(x.heure) + x.duree, fauteuil: x.fauteuil, patient: null, cure: null }));
    return out.sort((a, b) => a.deb - b.deb);
  };
  R.verifierCreneau = (date, heure, duree, exclude, extra) => {
    const h = R.hdj(); if (!R.jourOuvert(date)) return { ok: false, motif: 'hôpital de jour fermé ce jour' };
    const deb = R.toMin(heure), fin = deb + duree;
    if (deb < R.toMin(h.ouverture) || fin > R.toMin(h.fermeture)) return { ok: false, motif: `hors horaires (${h.ouverture}–${h.fermeture}, séance de ${duree} min)` };
    const s = R.seances(date, exclude, extra);
    if (s.length >= h.maxParJour) return { ok: false, motif: `journée complète (${h.maxParJour} séances)` };
    const chev = s.filter(x => x.deb < fin && deb < x.fin);
    if (chev.length >= h.fauteuils) return { ok: false, motif: `les ${h.fauteuils} fauteuils sont occupés à ${heure}` };
    const pris = new Set(chev.map(x => x.fauteuil)); let f = 1; while (pris.has(f)) f++;
    return { ok: true, fauteuil: Math.min(f, h.fauteuils), occupes: chev.length };
  };
  R.prochainCreneau = (date, duree, heureSouhaitee, exclude, extra) => {
    const h = R.hdj(); const pas = h.pas || 30;
    for (let i = 0; i < 90; i++) {
      const d = R.addDays(date, i); if (!R.jourOuvert(d)) continue;
      const start = i === 0 && heureSouhaitee ? R.toMin(heureSouhaitee) : R.toMin(h.ouverture);
      for (let m = start; m + duree <= R.toMin(h.fermeture); m += pas) { const v = R.verifierCreneau(d, R.toH(m), duree, exclude, extra); if (v.ok) return { date: d, heure: R.toH(m), fauteuil: v.fauteuil, decale: i > 0 }; }
    }
    return null;
  };
  /* Réserve un créneau pour chaque cure IV d'une liste (dans l'ordre), en tenant compte des cures déjà réservées de la liste */
  R.reserverCures = (cures, heureSouhaitee, extra) => {
    const virt = [...(extra || [])];
    cures.forEach(c => {
      if (c.voie !== 'IV' || c.statut === 'annulee' || c.statut === 'realisee') return;
      const duree = R.dureeSeance(R.proto(c.protocoleId), c);
      const cr = R.prochainCreneau(c.datePrevue, duree, heureSouhaitee, null, virt);
      if (cr) { if (cr.date !== c.datePrevue) { c.dateTheorique = c.datePrevue; c.datePrevue = cr.date; c.decalee = true; } c.heure = cr.heure; c.fauteuil = cr.fauteuil; virt.push({ date: cr.date, heure: cr.heure, duree, fauteuil: cr.fauteuil }); }
      else { c.heure = heureSouhaitee || R.hdj().ouverture; c.fauteuil = 0; c.sansCreneau = true; }
    });
    return cures;
  };
  R.occupationJour = d => { const s = R.seances(d); const h = R.hdj(); let max = 0; s.forEach(x => { const n = s.filter(y => y.deb < x.fin && x.deb < y.fin).length; if (n > max) max = n; }); return { seances: s.length, max: h.maxParJour, fauteuilsMax: max, fauteuils: h.fauteuils, ouvert: R.jourOuvert(d) }; };

  /* ---------- Calendrier mensuel ---------- */
  R.calendrierMois = ({ mois, selection, compter, actionJour, actionNav }) => {
    const [y, m] = mois.split('-').map(Number); const premier = new Date(y, m - 1, 1); const nb = new Date(y, m, 0).getDate();
    const decal = (premier.getDay() + 6) % 7; const t = R.today(); const cells = [];
    for (let i = 0; i < decal; i++) cells.push('<div class="cal-cell vide"></div>');
    for (let d = 1; d <= nb; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`; const c = compter(iso); const ferme = !R.jourOuvert(iso);
      cells.push(`<button type="button" class="cal-cell${iso === t ? ' today' : ''}${iso === selection ? ' sel' : ''}${ferme ? ' ferme' : ''}" data-action="${actionNav ? actionJour : 'calJour'}" data-date="${iso}"><span class="n">${d}</span><span class="dots">${c.seances ? `<i class="d-seance" title="${c.seances} séance(s)"></i><b>${c.seances}</b>` : ''}${c.controles ? `<i class="d-ctrl" title="${c.controles} contrôle(s)"></i>` : ''}${c.rdv ? `<i class="d-rdv" title="${c.rdv} rendez-vous"></i>` : ''}${c.plein ? '<span class="plein">plein</span>' : ''}</span></button>`);
    }
    const nomMois = premier.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `<div class="cal"><div class="cal-head"><button type="button" class="btn sm" data-action="${actionNav || 'calMois'}" data-delta="-1">${R.icon('chevL')}</button><b style="text-transform:capitalize">${nomMois}</b><div class="row" style="gap:4px"><button type="button" class="btn sm ghost" data-action="${actionNav || 'calMois'}" data-delta="0">Aujourd’hui</button><button type="button" class="btn sm" data-action="${actionNav || 'calMois'}" data-delta="1">${R.icon('chevR')}</button></div></div>
      <div class="cal-grid">${['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map(j => `<div class="cal-dow">${j}</div>`).join('')}${cells.join('')}</div>
      <div class="legend" style="margin-top:10px"><span><i class="sw" style="background:var(--accent)"></i>Séance de perfusion</span><span><i class="sw" style="background:var(--info)"></i>Contrôle</span><span><i class="sw" style="background:var(--warn)"></i>Rendez-vous</span></div></div>`;
  };
  R.compterJour = (iso, patientId) => {
    const pats = patientId ? S.patients.filter(p => p.id === patientId) : S.patients;
    const seances = pats.reduce((n, p) => n + p.cures.filter(c => c.datePrevue === iso && c.statut !== 'annulee' && (c.voie === 'IV' || patientId)).length, 0);
    const controles = pats.reduce((n, p) => n + p.surveillance.filter(s => s.mode === 'echeance' && s.echeance === iso && s.statut !== 'annulee').length, 0);
    const rdv = S.rdv.filter(r => r.date === iso && (!patientId || r.patientId === patientId)).length;
    return { seances, controles, rdv, plein: !patientId && seances >= R.hdj().maxParJour };
  };

  /* ---------- Alertes ---------- */
  R.alertes = () => {
    const out = [], t = R.today();
    S.patients.forEach(p => {
      p.cures.filter(c => c.statut === 'prevue' && c.datePrevue < t).forEach(c => out.push({ sev: 'crit', t: `Séance n°${c.n} non réalisée — ${R.nomComplet(p)}`, d: `${R.protoDeCure(p, c)?.dci} ${c.label} prévue le ${R.fmtDate(c.datePrevue)}`, go: ['patient', { id: p.id, tab: 'plan' }] }));
      p.cures.filter(c => c.statut === 'reportee').forEach(c => out.push({ sev: 'warn', t: `Séance à replanifier — ${R.nomComplet(p)}`, d: `${c.label} · ${c.motif || ''}`, go: ['patient', { id: p.id, tab: 'plan' }] }));
      p.cures.filter(c => c.sansCreneau && c.statut === 'prevue').forEach(c => out.push({ sev: 'warn', t: `Aucun créneau trouvé — ${R.nomComplet(p)}`, d: `Séance ${c.label} du ${R.fmtDate(c.datePrevue)} : capacité dépassée, à replacer manuellement`, go: ['patient', { id: p.id, tab: 'plan' }] }));
      p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance < t).forEach(s => out.push({ sev: 'warn', t: `Contrôle en retard — ${R.nomComplet(p)}`, d: `${s.label} · échéance ${R.fmtDate(s.echeance)}`, go: ['patient', { id: p.id, tab: 'plan' }] }));
      if (p.statut === 'induction') { const manq = p.bilan.filter(b => b.statut === 'attente' && ['igra', 'rxt', 'vhb'].includes(b.id)); if (manq.length) out.push({ sev: 'warn', t: `Bilan pré-thérapeutique incomplet — ${R.nomComplet(p)}`, d: manq.map(b => R.BILAN_PRE.find(x => x.id === b.id)?.label.split(' (')[0]).join(' · '), go: ['patient', { id: p.id, tab: 'bilan' }] }); }
      if (p.statut === 'suspendu') out.push({ sev: 'info', t: `Traitement suspendu — ${R.nomComplet(p)}`, d: p.motifSuspension, go: ['patient', { id: p.id }] });
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
    team: '<path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>', chevL: '<polyline points="15 18 9 12 15 6"/>', chevR: '<polyline points="9 18 15 12 9 6"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    drop: '<path d="M12 2.7s-6 6.3-6 10.3a6 6 0 0 0 12 0c0-4-6-10.3-6-10.3z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    lab: '<path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3"/>'
  };
  R.icon = (n, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  /* ---------- Modale, toast ---------- */
  R.modal = ({ title, body, foot, wide, form }) => {
    document.getElementById('modal-root').innerHTML = `<div class="modal-overlay"><form class="modal${wide ? ' wide' : ''}" ${form ? `data-form="${form}"` : ''} novalidate>
      <div class="modal-head"><h3>${title}</h3><button type="button" class="x-btn" data-action="closeModal" aria-label="Fermer">${R.icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</form></div>`;
    const first = document.querySelector('#modal-root input:not([readonly]):not([type=hidden]), #modal-root select, #modal-root textarea'); if (first) first.focus();
  };
  R.closeModal = () => { document.getElementById('modal-root').innerHTML = ''; };
  R.toast = (msg, type) => { const root = document.getElementById('toast-root'); const el = document.createElement('div'); el.className = 'toast ' + (type || ''); el.textContent = msg; root.appendChild(el); setTimeout(() => el.remove(), 4200); };
  R.confirmer = (titre, texte, action, params) => R.modal({ title: titre, body: `<p style="margin:0">${texte}</p>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="button" class="btn primary" data-action="${action}" data-params='${R.params(params)}'>Confirmer</button>` });

  /* ---------- Graphique en colonnes ---------- */
  function topRect(x, y, w, h, r) { r = Math.min(r, w / 2, h); return `M${x},${y + h} V${y + r} a${r},${r} 0 0 1 ${r},-${r} H${x + w - r} a${r},${r} 0 0 1 ${r},${r} V${y + h} Z`; }
  R.columnChart = ({ labels, series, height }) => {
    const W = 680, H = height || 230, padL = 30, padR = 6, padT = 14, padB = 24, n = labels.length;
    const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const max = Math.max(1, ...totals); const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10; const yMax = Math.ceil(max / step) * step;
    const plotW = W - padL - padR, plotH = H - padT - padB, band = plotW / n, bw = Math.min(24, band * 0.62);
    const y = v => padT + plotH - (v / yMax) * plotH;
    let g = ''; for (let v = 0; v <= yMax; v += step) g += `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${padL - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v}</text>`;
    let bars = ''; const iMax = totals.indexOf(Math.max(...totals));
    labels.forEach((lab, i) => {
      let acc = 0; const x = padL + band * i + (band - bw) / 2;
      series.forEach(s => { const v = s.values[i] || 0; if (!v) return; const yTop = y(acc + v), yBot = y(acc) - (acc ? 2 : 0); const h = Math.max(0.5, yBot - yTop); const last = acc + v === totals[i]; const tip = `${R.esc(lab)} · ${R.esc(s.name)} : ${v} (total ${totals[i]})`; bars += last ? `<path class="bar" d="${topRect(x, yTop, bw, h, 4)}" fill="${s.color}" data-tip="${tip}"/>` : `<rect class="bar" x="${x}" y="${yTop}" width="${bw}" height="${h}" fill="${s.color}" data-tip="${tip}"/>`; acc += v; });
      bars += `<text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle">${R.esc(lab)}</text>`;
      if (totals[i] && (i === n - 1 || i === iMax)) bars += `<text x="${x + bw / 2}" y="${(y(totals[i]) - 5).toFixed(1)}" text-anchor="middle" style="fill:var(--ink-2);font-weight:600">${totals[i]}</text>`;
    });
    const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i class="sw" style="background:${s.color}"></i>${R.esc(s.name)}</span>`).join('')}</div>` : '';
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Séances réalisées par mois">${g}<line class="axis" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>${bars}</svg>${legend}</div>`;
  };
  R.curesParMois = () => {
    const mois = []; const d = new Date(); for (let i = 11; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); mois.push(R.iso(m).slice(0, 7)); }
    const series = [{ key: 'Infliximab', name: 'Infliximab', color: 'var(--s1)' }, { key: 'Vedolizumab', name: 'Vedolizumab', color: 'var(--s2)' }, { key: 'Ustekinumab', name: 'Ustekinumab', color: 'var(--s3)' }, { key: 'autres', name: 'Autres', color: 'var(--s4)' }];
    series.forEach(s => s.values = mois.map(() => 0));
    S.patients.forEach(p => p.cures.filter(c => c.statut === 'realisee' && c.voie === 'IV').forEach(c => { const i = mois.indexOf((c.dateReelle || c.datePrevue).slice(0, 7)); if (i < 0) return; const dci = (R.protoDeCure(p, c)?.dci || '').split(' ')[0]; (series.find(x => x.key === dci) || series[3]).values[i]++; }));
    return { labels: mois.map(m => R.fmtMois(m + '-01')), series };
  };

  /* ---------- Navigation et rendu ---------- */
  const NAV = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'dash', mod: 'dashboard' },
    { id: 'planning', label: 'Planning HDJ', icon: 'cal', mod: 'planning' },
    { id: 'patients', label: 'Patients', icon: 'users', mod: 'patients' },
    { id: 'nouveau', label: 'Nouveau dossier', icon: 'plus', mod: 'dossier', w: true },
    { id: 'protocoles', label: 'Protocoles', icon: 'proto', mod: 'protocoles' },
    { id: 'equipe', label: 'Équipe & codes', icon: 'team', mod: 'equipe' }
  ];
  R.go = (page, params) => { R.closeModal(); S.route = { page, params: params || {} }; R.save(); R.render(); window.scrollTo(0, 0); };
  R.render = () => {
    try { rendre(); } catch (e) {
      console.error('Rendu impossible, réinitialisation des données locales', e);
      try { localStorage.removeItem(KEY); } catch (x) {}
      remplacer(Object.assign(R.seed(), { semaineSeed: R.semaineRef(), version: VERSION }));
      try { rendre(); R.toast('Données locales incompatibles : démonstration rechargée', 'warn'); } catch (e2) { document.getElementById('app').innerHTML = '<div class="empty">Erreur d’affichage : ' + R.esc(e2.message) + '</div>'; }
    }
  };
  function rendre() {
    const app = document.getElementById('app');
    if (!S.user) { app.innerHTML = loginView(); return; }
    const page = R.pages[S.route.page] ? S.route.page : 'dashboard';
    const item = NAV.find(i => i.id === page);
    if (item && !R.can(item.mod, item.w ? 'w' : 'r')) { S.route = { page: 'dashboard', params: {} }; return rendre(); }
    const pg = R.pages[page]; const alertes = R.alertes(); const nCrit = alertes.filter(a => a.sev === 'crit').length; const u = R.user(); const sem = R.semaine();
    app.innerHTML = `<div class="shell">
      <aside class="rail" id="rail">
        <div class="brand"><div class="brand-mark">Rz</div><div><b>Ryze</b><span>Biothérapies · Hôpital de jour</span></div></div>
        <nav class="nav"><div style="height:8px"></div>${NAV.filter(i => R.can(i.mod, i.w ? 'w' : 'r')).map(i => `<button class="nav-item${(page === i.id || (i.id === 'patients' && (page === 'patient' || page === 'carnet'))) ? ' active' : ''}" data-go="${i.id}">${R.icon(i.icon)}<span>${i.label}</span>${i.id === 'dashboard' && nCrit ? `<span class="count">${nCrit}</span>` : ''}</button>`).join('')}</nav>
        <div class="rail-foot">${R.esc(S.settings.service)}<br>${R.esc(S.settings.unite)}</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="menu-btn" data-action="toggleRail" aria-label="Menu">${R.icon('menu')}</button>
          <div class="search">${R.icon('search')}<input type="search" id="global-search" placeholder="Rechercher un patient (nom, IPP)…" data-input="globalSearch" autocomplete="off"><div id="search-results"></div></div>
          <span class="week-chip">Semaine du ${R.fmtDate(sem.lundi, { day: 'numeric', month: 'short' })} au ${R.fmtDate(sem.jours[4], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <div class="user-chip"><div class="who"><b>${R.esc(R.userName(u.id))}</b><span>${R.esc((R.ROLES[u.role] || R.ROLES.hdj).label)} · ${R.esc(u.fonction)}</span></div><div class="avatar">${R.initials(u.prenom, u.nom)}</div>${R.can('equipe', 'w') ? `<button class="btn sm ghost" data-go="parametres" title="Paramètres et capacité de l’HDJ">${R.icon('cog')}</button>` : ''}<button class="btn sm ghost" data-action="logout" title="Se déconnecter">${R.icon('logout')}</button></div>
        </header>
        <main class="content">${pg.render(S.route.params)}</main>
      </div></div>`;
  }

  function loginView() {
    const actifs = S.users.filter(u => u.actif);
    return `<div class="login"><div class="login-box">
      <div class="login-left">
        <div class="brand" style="padding:0"><div class="brand-mark">Rz</div><div><b>Ryze</b><span>Suivi biothérapique</span></div></div>
        <h1>Gestion des biothérapies en hôpital de jour</h1>
        <p>${R.esc(S.settings.service)} — ${R.esc(S.settings.unite)}.</p>
        <ul class="feature-list">
          <li>${R.icon('check')}<span>Dossier patient et protocole par cycles, doses calculées au poids, historique des changements.</span></li>
          <li>${R.icon('check')}<span>Planning des fauteuils sans double réservation, calendrier mensuel navigable.</span></li>
          <li>${R.icon('check')}<span>Séances et contrôles dans une seule planification, marqués réalisés avec notes.</span></li>
          <li>${R.icon('check')}<span>Carnet de suivi imprimable pour chaque patient.</span></li>
        </ul>
        <div class="demo-note">${S.vide ? 'Base vide : aucun patient. ' : 'Prototype de démonstration — patients et effectifs fictifs. '}<button type="button" class="btn sm ghost" data-action="${S.vide ? 'resetDemo' : 'viderDemoConfirm'}">${S.vide ? 'Recharger la démonstration' : 'Démarrer avec une base vide'}</button></div>
      </div>
      <div class="login-right">
        <form data-form="loginCode" class="stack">
          <div class="caps">Connexion</div>
          <div class="field"><label for="login-code">Code d’accès personnel</label><input type="text" id="login-code" name="code" class="mono" style="font-size:18px;letter-spacing:.12em;text-transform:uppercase" placeholder="ex. MED001" autocomplete="off" autofocus required></div>
          <button type="submit" class="btn primary" style="justify-content:center">Entrer</button>
        </form>
        <div class="subtle mt24"><div class="caps mb8">Codes de démonstration (cliquer pour entrer)</div>
          <div class="stack" style="gap:6px">${actifs.map(u => `<div class="row between small" style="flex-wrap:nowrap"><span class="grow" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${R.esc(R.userName(u.id))} <span class="muted">· ${R.esc(u.fonction)}</span></span><span class="row" style="gap:6px;flex-wrap:nowrap"><span class="badge ${u.role === 'complet' ? 'accent' : ''}">${(R.ROLES[u.role] || R.ROLES.hdj).court}</span><button type="button" class="tag" data-action="loginFill" data-code="${R.esc(u.code)}" style="cursor:pointer">${R.esc(u.code)}</button></span></div>`).join('')}</div>
          <p class="xs muted" style="margin:10px 0 0">Les codes sont créés dans Équipe & codes par un accès complet. En production, cette liste n’est pas affichée.</p></div>
      </div></div></div>`;
  }

  /* ---------- Tableau de bord ---------- */
  R.pages.dashboard = {
    render() {
      const sem = R.semaine(), t = R.today();
      const actifs = S.patients.filter(p => p.statut !== 'termine');
      const curesSem = R.curesEntre(sem.lundi, sem.dimanche); const iv = curesSem.filter(x => x.cure.voie === 'IV');
      const faites = iv.filter(x => x.cure.statut === 'realisee').length;
      const ctrl = R.controlesEntre(sem.lundi, sem.dimanche); const rdv = R.rdvEntre(sem.lundi, sem.dimanche);
      const alertes = R.alertes(); const retards = alertes.filter(a => a.sev === 'crit').length + S.patients.reduce((n, p) => n + p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance < t).length, 0);
      const chart = R.curesParMois();
      return `
      <div class="page-head"><div><h1>Tableau de bord</h1><p>${R.esc(S.settings.unite)} · semaine du ${R.fmtDateLong(sem.lundi)} au ${R.fmtDateLong(sem.jours[4])}</p></div>
        <div class="page-actions">${R.can('dossier', 'w') ? `<button class="btn primary" data-go="nouveau">${R.icon('plus')}Nouveau dossier</button>` : ''}<button class="btn" data-go="planning">${R.icon('cal')}Planning</button></div></div>
      <div class="kpis">
        <button class="kpi" data-go="patients"><div class="label">Patients suivis</div><div class="value">${actifs.length}<small>${actifs.filter(p => p.statut === 'induction').length} en induction</small></div><div class="sub">${S.patients.filter(p => p.statut === 'suspendu').length} traitement(s) suspendu(s)</div></button>
        <button class="kpi" data-go="planning"><div class="label">Séances de perfusion cette semaine</div><div class="value">${iv.length}<small>${faites} réalisée${faites > 1 ? 's' : ''}</small></div><div class="sub">${R.hdj().fauteuils} fauteuils · ${R.hdj().maxParJour} séances max/jour</div></button>
        <button class="kpi" data-go="planning"><div class="label">Contrôles et rendez-vous</div><div class="value">${ctrl.length + rdv.length}</div><div class="sub">${ctrl.length} contrôle(s) · ${rdv.length} rendez-vous cette semaine</div></button>
        <button class="kpi${retards ? ' attention' : ''}" data-go="patients"><div class="label">Retards</div><div class="value">${retards}</div><div class="sub">séances non réalisées et contrôles dépassés</div></button>
      </div>
      <div class="grid c21">
        <section class="card"><div class="card-head"><div><h2>Séances de perfusion réalisées par mois</h2><div class="sub">12 derniers mois</div></div></div><div class="card-body">${R.columnChart(chart)}</div></section>
        <section class="card"><div class="card-head"><h2>À traiter</h2><span class="badge ${alertes.some(a => a.sev === 'crit') ? 'crit' : alertes.length ? 'warn' : 'good'}">${alertes.length}</span></div>
          <div class="card-body" style="padding-top:4px;padding-bottom:4px">${!S.patients.length ? `<div class="empty">Aucun patient. ${R.can('dossier', 'w') ? '<br><button class="btn sm primary mt8" data-go="nouveau">Créer le premier dossier</button>' : ''}</div>` : alertes.length ? alertes.slice(0, 8).map(a => `<button class="alert-row" data-go="${a.go[0]}" data-params='${R.params(a.go[1])}'><i class="sev ${a.sev}"></i><div><div class="t">${R.esc(a.t)}</div><div class="d">${R.esc(a.d)}</div></div></button>`).join('') : '<div class="empty">Rien à signaler</div>'}</div>
          ${alertes.length > 8 ? `<div class="card-foot">${alertes.length - 8} autre(s) — voir Patients</div>` : ''}</section>
      </div>
      <div class="grid c21">
        <section class="card"><div class="card-head"><div><h2>Séances de la semaine</h2><div class="sub">perfusions à l’hôpital de jour</div></div><button class="btn sm" data-go="planning">Ouvrir le planning</button></div>
          <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Jour</th><th>Heure</th><th>Patient</th><th>Biothérapie</th><th>Dose</th><th>Fauteuil</th><th>Statut</th>${R.can('cures', 'w') ? '<th></th>' : ''}</tr></thead><tbody>
          ${iv.map(x => { const c = x.cure, p = x.patient, pr = R.protoDeCure(p, c); return `<tr class="row-link${c.datePrevue === t ? ' today' : ''}${c.statut === 'realisee' ? ' done' : ''}" data-go="patient" data-params='${R.params({ id: p.id, tab: 'plan' })}'>
            <td class="nowrap">${R.fmtDate(c.datePrevue, { weekday: 'short', day: 'numeric' })}</td><td class="mono">${c.heure || '—'}</td>
            <td class="name">${R.esc(R.nomComplet(p))}<small>${R.esc(p.ipp)}</small></td>
            <td>${R.esc(pr?.dci || '')} <span class="tag">${c.label}</span></td>
            <td class="small dose">${R.esc(c.doseTexte)}</td><td class="num">${c.fauteuil || '—'}</td>
            <td>${R.statutCureBadge(c)}</td>${R.can('cures', 'w') ? `<td class="actions">${c.statut === 'prevue' ? `<button class="btn sm primary" data-action="cureEnregistrer" data-pid="${p.id}" data-n="${c.n}">Marquer réalisée</button>` : ''}</td>` : ''}</tr>`; }).join('') || '<tr><td colspan="8" class="empty">Aucune séance cette semaine</td></tr>'}
          </tbody></table></div></section>
        <section class="card"><div class="card-head"><div><h2>Contrôles de la semaine</h2><div class="sub">biologie, calprotectine, endoscopie…</div></div></div>
          <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Jour</th><th>Patient</th><th>Contrôle</th><th>Statut</th></tr></thead><tbody>${ctrl.map(x => `<tr class="row-link${x.surv.statut === 'faite' ? ' done' : ''}" data-go="patient" data-params='${R.params({ id: x.patient.id, tab: 'plan' })}'><td class="nowrap">${R.fmtDate(x.surv.echeance, { weekday: 'short', day: 'numeric' })}</td><td class="name">${R.esc(R.nomComplet(x.patient))}</td><td class="small">${R.esc(x.surv.label)}</td><td>${R.statutSurvBadge(x.surv)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucun contrôle cette semaine</td></tr>'}</tbody></table></div></section>
      </div>`;
    }
  };

  /* ---------- Actions globales ---------- */
  Object.assign(R.actions, {
    loginCode(f, fd) { const code = String(fd.get('code') || '').trim().toUpperCase(); const u = S.users.find(x => x.actif && String(x.code).toUpperCase() === code); if (!u) { R.toast('Code inconnu ou désactivé', 'crit'); return; } u.derniere = R.today(); S.user = u.id; S.route = { page: 'dashboard', params: {} }; R.save(); R.render(); },
    loginFill(el) { const i = document.getElementById('login-code'); i.value = el.dataset.code; i.form.requestSubmit(); },
    logout() { S.user = null; R.save(); R.render(); },
    closeModal() { R.closeModal(); },
    toggleRail() { const r = document.getElementById('rail'); r.classList.toggle('open'); let b = document.getElementById('rail-backdrop'); if (r.classList.contains('open')) { if (!b) { b = document.createElement('div'); b.id = 'rail-backdrop'; b.className = 'rail-backdrop'; b.setAttribute('data-action', 'toggleRail'); document.body.appendChild(b); } } else if (b) b.remove(); },
    globalSearch(el) {
      const q = el.value.trim().toLowerCase(); const box = document.getElementById('search-results'); if (q.length < 2) { box.innerHTML = ''; return; }
      const res = S.patients.filter(p => (p.nom + ' ' + p.prenom + ' ' + p.ipp).toLowerCase().includes(q)).slice(0, 6);
      box.innerHTML = res.length ? `<div class="search-results">${res.map(p => `<button type="button" data-go="patient" data-params='${R.params({ id: p.id })}'><div class="avatar" style="width:26px;height:26px;font-size:10px">${R.initials(p.prenom, p.nom)}</div><div><b>${R.esc(R.nomComplet(p))}</b> <span class="mono muted">${R.esc(p.ipp)}</span></div><span class="muted small" style="margin-left:auto">${R.esc(R.proto(p.protocoleId)?.dci || '')}</span></button>`).join('')}</div>` : `<div class="search-results"><div class="empty" style="padding:14px">Aucun patient</div></div>`;
    },
    resetDemo() { R.reset(); }, viderDemo() { R.vider(); },
    viderDemoConfirm() { R.confirmer('Démarrer avec une base vide ?', 'Les patients et rendez-vous de démonstration seront supprimés. Les protocoles et les codes d’accès sont conservés.', 'viderDemo'); }
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
