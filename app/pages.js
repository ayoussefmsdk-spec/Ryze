/* =====================================================================
   Ryze — pages.js : patients, fiche patient, planning, protocoles,
   stock, équipe, paramètres
   ===================================================================== */
'use strict';
(function (R) {
  const S = R.S, esc = R.esc;
  const opt = (arr, val, lab, sel) => arr.map(x => `<option value="${esc(val(x))}"${val(x) === sel ? ' selected' : ''}>${esc(lab(x))}</option>`).join('');
  const medecins = () => S.users.filter(u => u.role === 'medecin' && u.actif);

  /* ===================== PATIENTS ===================== */
  R.pages.patients = {
    render() {
      const f = R.ui.filtres; const q = (f.q || '').toLowerCase();
      let list = S.patients.filter(p => !q || (p.nom + ' ' + p.prenom + ' ' + p.ipp).toLowerCase().includes(q));
      if (f.patho) list = list.filter(p => p.pathologie === f.patho);
      if (f.proto) list = list.filter(p => p.protocoleId === f.proto);
      if (f.statut) list = list.filter(p => p.statut === f.statut);
      list.sort((a, b) => a.nom.localeCompare(b.nom));
      return `<div class="page-head"><div><h1>Patients</h1><p>${S.patients.length} dossiers · ${S.patients.filter(p => p.statut === 'induction').length} en induction · ${S.patients.filter(p => p.statut === 'suspendu').length} suspendu(s)</p></div>
        <div class="page-actions">${R.can('dossier', 'w') ? `<button class="btn primary" data-go="nouveau">${R.icon('plus')}Nouveau dossier</button>` : ''}</div></div>
      <div class="toolbar">
        <input type="search" id="f-q" name="q" placeholder="Nom, prénom ou IPP" value="${esc(f.q || '')}" data-input="filtrePatients" style="min-width:240px">
        <select name="patho" data-change="filtrePatients"><option value="">Toutes pathologies</option>${opt(Object.keys(R.PATHOS), k => k, k => R.PATHOS[k].label, f.patho)}</select>
        <select name="proto" data-change="filtrePatients"><option value="">Toutes biothérapies</option>${opt(S.protocoles, p => p.id, p => p.dci, f.proto)}</select>
        <select name="statut" data-change="filtrePatients"><option value="">Tous statuts</option>${opt([['induction', 'Induction'], ['entretien', 'Entretien'], ['suspendu', 'Suspendu']], x => x[0], x => x[1], f.statut)}</select>
        ${(f.q || f.patho || f.proto || f.statut) ? '<button class="btn sm ghost" data-action="filtreReset">Effacer les filtres</button>' : ''}
      </div>
      <section class="card"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Patient</th><th>Âge · Sexe</th><th>Pathologie</th><th>Biothérapie</th><th>Prochaine cure</th><th>Dernière cure</th><th>Statut</th><th>Médecin</th></tr></thead><tbody>
        ${list.map(p => { const pr = R.proto(p.protocoleId), n = R.prochaineCure(p), d = R.derniereCure(p); return `<tr class="row-link" data-go="patient" data-params='${R.params({ id: p.id })}'>
          <td class="name">${esc(R.nomComplet(p))}<small>${esc(p.ipp)}</small></td><td class="nowrap">${R.age(p.ddn)} ans · ${p.sexe}</td>
          <td>${R.pathoBadge(p)} <span class="tag">${esc(p.montreal)}</span></td>
          <td>${esc(pr?.dci || '—')} ${R.voieBadge(pr?.voie || '')}</td>
          <td class="nowrap">${n ? `${R.fmtDate(n.datePrevue)} <span class="tag">${n.label}</span>${n.datePrevue < R.today() ? ' ' + R.badge('crit', 'retard') : ''}` : '<span class="muted">—</span>'}</td>
          <td class="nowrap">${d ? R.fmtDate(d.dateReelle) : '<span class="muted">—</span>'}</td>
          <td>${R.statutPatientBadge(p)}</td><td class="small">${esc(R.userName(p.medecinId))}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Aucun patient ne correspond aux filtres</td></tr>'}
      </tbody></table></div></section>`;
    }
  };

  /* ===================== FICHE PATIENT ===================== */
  R.pages.patient = {
    render(params) {
      const p = R.patient(params.id); if (!p) return `<div class="empty">Dossier introuvable.</div>`;
      const pr = R.proto(p.protocoleId), tab = params.tab || 'synthese', t = R.today();
      const next = R.prochaineCure(p), last = R.derniereCure(p);
      const retards = p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance < t).length;
      const bilanApp = p.bilan.filter(b => b.statut !== 'na'), bilanFait = bilanApp.filter(b => b.statut.startsWith('fait')).length;
      const tabs = [['synthese', 'Synthèse'], ['cures', 'Cures', p.cures.filter(c => c.statut === 'realisee').length + '/' + p.cures.length], ['surveillance', 'Surveillance', retards ? retards + ' en retard' : ''], ['bilan', 'Bilan pré-thérapeutique', `${bilanFait}/${bilanApp.length}`], ['notes', 'Notes', p.notes.length || '']];
      const actions = [];
      if (R.can('carnet', 'r')) actions.push(`<button class="btn" data-go="carnet" data-params='${R.params({ id: p.id })}'>${R.icon('book')}Carnet de suivi</button>`);
      if (R.can('cures', 'w') && next) actions.push(`<button class="btn primary" data-action="cureEnregistrer" data-pid="${p.id}" data-n="${next.n}">${R.icon('drop')}Enregistrer la cure ${next.label}</button>`);
      if (R.can('dossier', 'w')) actions.push(`<button class="btn" data-action="patientModifier" data-pid="${p.id}">${R.icon('edit')}Modifier</button>`);
      if (R.can('dossier', 'w')) actions.push(p.statut === 'suspendu' ? `<button class="btn" data-action="patientReprendre" data-pid="${p.id}">Reprendre le traitement</button>` : `<button class="btn danger" data-action="patientSuspendre" data-pid="${p.id}">Suspendre</button>`);
      return `<div class="row mb8"><button class="btn sm ghost" data-go="patients">${R.icon('back')}Patients</button></div>
      <section class="card mb16"><div class="card-body"><div class="row between" style="align-items:flex-start;gap:16px">
        <div class="row" style="gap:16px;align-items:flex-start"><div class="avatar lg">${R.initials(p.prenom, p.nom)}</div><div>
          <h1 style="font-size:20px;font-weight:600">${esc(p.nom)} ${esc(p.prenom)}</h1>
          <div class="row small ink2 mt8"><span class="mono">${esc(p.ipp)}</span><span>·</span><span>${R.age(p.ddn)} ans (${R.fmtDate(p.ddn)})</span><span>·</span><span>${p.sexe === 'F' ? 'Femme' : 'Homme'}</span><span>·</span><span>${p.poids} kg · ${p.taille} cm · IMC ${R.imc(p)}</span><span>·</span><span>${esc(p.tel)}</span></div>
          <div class="row mt8">${R.pathoBadge(p)}<span class="tag">Montréal ${esc(p.montreal)}</span>${R.statutPatientBadge(p)}<span class="badge accent">${esc(pr?.dci || '')}</span>${p.allergies && p.allergies !== '—' ? R.badge('crit', 'Allergie : ' + p.allergies) : ''}</div>
        </div></div>
        <div class="page-actions">${actions.join('')}</div></div>
        ${p.statut === 'suspendu' ? `<div class="callout crit mt16"><b>Traitement suspendu</b> — ${esc(p.motifSuspension)}</div>` : ''}
      </div></section>
      <div class="tabs">${tabs.map(x => `<button class="tab${tab === x[0] ? ' active' : ''}" data-go="patient" data-params='${R.params({ id: p.id, tab: x[0] })}'>${x[1]}${x[2] ? `<span class="n">${esc(x[2])}</span>` : ''}</button>`).join('')}</div>
      ${({ synthese: tabSynthese, cures: tabCures, surveillance: tabSurveillance, bilan: tabBilan, notes: tabNotes })[tab](p, pr, next, last)}`;
    }
  };

  function tabSynthese(p, pr, next, last) {
    const t = R.today();
    const alertes = R.alertes().filter(a => a.go[1] && a.go[1].id === p.id);
    const echeances = [...p.cures.filter(c => c.statut === 'prevue' && c.datePrevue >= t).map(c => ({ date: c.datePrevue, txt: `Cure n°${c.n} ${c.label} — ${pr?.dci} ${c.doseTexte}`, type: 'cure', go: 'cures' })), ...p.surveillance.filter(s => s.statut === 'prevue' && s.echeance && s.echeance >= t).map(s => ({ date: s.echeance, txt: s.label, type: 'surv', go: 'surveillance' })), ...S.rdv.filter(r => r.patientId === p.id && r.date >= t).map(r => ({ date: r.date, txt: `${r.type} — ${r.objet}`, type: 'rdv' }))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
    const histo = [...p.cures.filter(c => c.statut === 'realisee').map(c => ({ date: c.dateReelle, txt: `Cure n°${c.n} ${c.label} — ${c.dose ? c.dose + ' mg' : c.doseTexte}${c.lot ? ' · lot ' + c.lot : ''}`, cls: /Réaction/.test(c.tolerance || '') ? 'warn' : '' })), ...p.surveillance.filter(s => s.statut === 'faite').map(s => ({ date: s.dateFaite, txt: `${s.label} : ${s.resultat || 'fait'}`, cls: '' })), ...p.notes.map(n => ({ date: n.date, txt: `Note (${R.userName(n.par)}) : ${n.txt}`, cls: '' }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const cureCourante = next || last;
    return `${alertes.length ? `<div class="stack mb16">${alertes.map(a => `<div class="callout ${a.sev}"><b>${esc(a.t)}</b> — ${esc(a.d)}</div>`).join('')}</div>` : ''}
    <div class="grid c11">
      <section class="card"><div class="card-head"><h2>Traitement en cours</h2>${R.can('dossier', 'w') ? `<button class="btn sm" data-action="posologieModifier" data-pid="${p.id}">Modifier la posologie</button>` : ''}</div><div class="card-body"><dl class="dl">
        <div><dt>Protocole</dt><dd><b>${esc(pr?.dci)}</b> <span class="muted small">${esc(pr?.specialites)}</span></dd></div>
        <div><dt>Classe · voie</dt><dd>${esc(pr?.classe)} · ${esc(pr?.voie)}</dd></div>
        <div><dt>Posologie actuelle</dt><dd>${cureCourante ? `${esc(cureCourante.doseTexte)} — ${cureCourante.flacons ? cureCourante.flacons + ' flacon(s) de ' + R.article(cureCourante.articleId)?.unite + ' mg' : 'voie ' + cureCourante.voie}` : '—'}</dd></div>
        <div><dt>Phase</dt><dd>${next ? next.phase : 'Entretien'} ${next && next.phase === 'Entretien' ? `<span class="muted small">· ${esc(pr?.entretien?.label || '')}</span>` : ''}</dd></div>
        <div><dt>Début (J0)</dt><dd>${R.fmtDate(p.dateDebut)} <span class="muted small">(${Math.floor(R.diffDays(p.dateDebut, t) / 7)} semaines de traitement)</span></dd></div>
        <div><dt>Prochaine cure</dt><dd>${next ? `${R.fmtDateLong(next.datePrevue)} <span class="tag">${next.label}</span> ${next.heure ? '· ' + next.heure + ' · fauteuil ' + next.fauteuil : ''}` : '—'}</dd></div>
        <div><dt>Dernière cure</dt><dd>${last ? `${R.fmtDateLong(last.dateReelle)} <span class="tag">${last.label}</span> · ${esc(last.tolerance === 'Bonne' ? 'bien tolérée' : last.tolerance)}` : '—'}</dd></div>
        <div><dt>Médecin référent</dt><dd>${esc(R.userName(p.medecinId))}</dd></div>
        <div><dt>Traitements associés</dt><dd>${esc(p.traitementsAssocies)}</dd></div>
        <div><dt>Biothérapies antérieures</dt><dd>${esc(p.antecedentsBio)}</dd></div>
        <div><dt>Diagnostic</dt><dd>${esc(R.PATHOS[p.pathologie]?.label)} — ${esc(p.montreal)} · depuis ${R.fmtDate(p.dateDiag, { month: 'long', year: 'numeric' })}</dd></div>
      </dl></div></section>
      <div class="stack">
        <section class="card"><div class="card-head"><h2>Prochaines échéances</h2></div><div class="card-body"><ul class="timeline">${echeances.map(e => `<li class="future"><div class="when">${R.fmtDateLong(e.date)} · dans ${R.diffDays(t, e.date)} j</div><div>${esc(e.txt)}</div></li>`).join('') || '<li class="muted">Aucune échéance programmée</li>'}</ul></div></section>
        <section class="card"><div class="card-head"><h2>Historique récent</h2></div><div class="card-body"><ul class="timeline">${histo.map(e => `<li class="${e.cls}"><div class="when">${R.fmtDateLong(e.date)}</div><div>${esc(e.txt)}</div></li>`).join('') || '<li class="muted">Aucun événement</li>'}</ul></div></section>
      </div></div>`;
  }

  function tabCures(p, pr) {
    const t = R.today(); const w = R.can('cures', 'w'), v = R.can('cures', 'v'), d = R.can('dossier', 'w');
    return `<section class="card"><div class="card-head"><div><h2>Cures — ${esc(pr?.dci)}</h2><div class="sub">${p.cures.filter(c => c.statut === 'realisee').length} réalisée(s) · ${p.cures.filter(c => c.statut === 'prevue').length} planifiée(s) · horizon ${R.fmtDate(p.cures[p.cures.length - 1]?.datePrevue)}</div></div>
      <div class="row">${d ? `<button class="btn sm" data-action="cureAjouter" data-pid="${p.id}">Ajouter une cure</button><button class="btn sm" data-action="posologieModifier" data-pid="${p.id}">Modifier la posologie</button>` : ''}</div></div>
      <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>Phase</th><th>Prévue</th><th>Réalisée</th><th>Voie</th><th>Poids</th><th>Dose</th><th class="right">Flacons</th><th>Lot</th><th>PUI</th><th>Tolérance</th><th>Statut</th><th></th></tr></thead><tbody>
      ${p.cures.map(c => `<tr class="${c.statut === 'realisee' ? 'done' : ''}${c.datePrevue === t && c.statut === 'prevue' ? ' today' : ''}">
        <td class="mono">${c.n}</td><td>${esc(c.phase)} <span class="tag">${c.label}</span></td><td class="nowrap">${R.fmtDate(c.datePrevue)}${c.heure ? ` <span class="muted small">${c.heure}</span>` : ''}</td><td class="nowrap">${c.dateReelle ? R.fmtDate(c.dateReelle) : '—'}</td>
        <td>${R.voieBadge(c.voie)}</td><td class="num">${c.poids ? c.poids + ' kg' : '—'}</td><td class="small dose">${esc(c.doseTexte)}</td><td class="right num">${c.flacons || '—'}</td><td class="mono">${esc(c.lot || '—')}</td>
        <td>${c.voie !== 'IV' ? '<span class="muted">—</span>' : c.validationPharma ? `<span class="badge good" title="${esc(R.userName(c.validationPharma.par))} le ${R.fmtDate(c.validationPharma.date)}"><i class="dot"></i>Validée</span>` : (c.statut === 'prevue' ? R.badge('warn', 'En attente') : '—')}</td>
        <td class="small" style="max-width:220px">${c.tolerance ? (c.tolerance === 'Bonne' ? '<span class="muted">Bonne</span>' : `<span style="color:var(--warn-ink)">${esc(c.tolerance.slice(0, 60))}${c.tolerance.length > 60 ? '…' : ''}</span>`) : (c.motif ? `<span class="muted">${esc(c.motif.slice(0, 60))}</span>` : '—')}</td>
        <td>${R.statutCureBadge(c)}</td>
        <td class="actions">${c.statut === 'realisee' ? `<button class="btn sm ghost" data-action="cureDetail" data-pid="${p.id}" data-n="${c.n}">Détails</button>` : ''}
          ${c.statut === 'prevue' && c.voie === 'IV' && !c.validationPharma && v ? `<button class="btn sm" data-action="cureValiderPUI" data-pid="${p.id}" data-n="${c.n}">Valider PUI</button>` : ''}
          ${(c.statut === 'prevue' || c.statut === 'reportee') && w ? `<button class="btn sm primary" data-action="cureEnregistrer" data-pid="${p.id}" data-n="${c.n}">Enregistrer</button>` : ''}
          ${(c.statut === 'prevue' || c.statut === 'reportee') && (w || d || R.can('planning', 'w')) ? `<button class="btn sm ghost" data-action="cureReporter" data-pid="${p.id}" data-n="${c.n}">${c.statut === 'reportee' ? 'Replanifier' : 'Reporter'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card-foot">Dose calculée sur le poids du jour ; arrondi au flacon entier supérieur. Perfusion : ${esc(pr?.dureePerfusion || '—')}. Prémédication : ${esc(pr?.premedication || '—')}</div></section>`;
  }

  function tabSurveillance(p) {
    const t = R.today(); const w = R.can('cures', 'w') || R.can('dossier', 'w');
    const parCure = p.surveillance.filter(s => s.mode === 'cure'); const ech = p.surveillance.filter(s => s.mode === 'echeance').sort((a, b) => a.echeance.localeCompare(b.echeance));
    const badge = s => s.statut === 'faite' ? R.badge('good', 'Faite') : s.echeance < t ? R.badge('crit', `En retard (${R.diffDays(s.echeance, t)} j)`) : R.diffDays(t, s.echeance) <= 14 ? R.badge('warn', `Dans ${R.diffDays(t, s.echeance)} j`) : R.badge('', 'Prévue');
    return `<div class="grid c21">
      <section class="card"><div class="card-head"><div><h2>Plan de surveillance</h2><div class="sub">objectifs STRIDE-II : rémission clinique, CRP normale, calprotectine 100–250 µg/g, cicatrisation endoscopique</div></div>${R.can('dossier', 'w') ? `<button class="btn sm" data-action="survAjouter" data-pid="${p.id}">Ajouter un élément</button>` : ''}</div>
      <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Élément</th><th>Catégorie</th><th>Échéance</th><th>Statut</th><th>Résultat</th><th></th></tr></thead><tbody>
      ${ech.map((s, i) => `<tr class="${s.statut === 'faite' ? 'done' : ''}"><td>${esc(s.label)}${s.cible ? `<div class="xs muted">Cible : ${esc(s.cible)}</div>` : ''}</td><td class="small">${esc(s.cat)}</td><td class="nowrap">${R.fmtDate(s.echeance)} <span class="tag">${R.libelleJour(s.jour || R.diffDays(p.dateDebut, s.echeance))}</span></td><td>${badge(s)}</td><td class="small">${s.statut === 'faite' ? `${esc(s.resultat || '')} <span class="muted">(${R.fmtDate(s.dateFaite)})</span>` : '—'}</td>
        <td class="actions">${w && s.statut !== 'faite' ? `<button class="btn sm" data-action="survSaisir" data-pid="${p.id}" data-i="${p.surveillance.indexOf(s)}">Saisir le résultat</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucune échéance</td></tr>'}
      </tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>À chaque cure</h2></div><div class="card-body"><div class="stack">${parCure.map(s => `<div class="row"><span class="badge accent">${esc(s.cat)}</span><span>${esc(s.label)}</span></div>`).join('') || '<span class="muted">—</span>'}</div>
        <div class="callout info mt16">Biologie de sécurité (NFS, bilan hépatique, CRP) recommandée à J15, puis mensuelle pendant 3 mois, puis trimestrielle ; en pratique HDJ : prélèvement à chaque venue.</div></div></section>
    </div>`;
  }

  function tabBilan(p) {
    const w = R.can('dossier', 'w') || R.can('cures', 'w');
    const app = p.bilan.filter(b => b.statut !== 'na'), fait = app.filter(b => b.statut.startsWith('fait')).length;
    const manque = ['igra', 'rxt', 'vhb'].filter(id => { const b = p.bilan.find(x => x.id === id); return b && b.statut === 'attente'; });
    const cats = [...new Set(R.BILAN_PRE.map(b => b.cat))];
    return `<section class="card"><div class="card-head"><div><h2>Bilan pré-thérapeutique</h2><div class="sub">check-list GETAID / ECCO avant biothérapie ou petite molécule</div></div><div class="row" style="min-width:220px"><div class="meter"><i class="${fait === app.length ? 'good' : 'warn'}" style="width:${app.length ? (fait / app.length * 100).toFixed(0) : 0}%"></i></div><span class="num small">${fait}/${app.length}</span></div></div>
      ${manque.length ? `<div class="card-body" style="padding-bottom:0"><div class="callout crit">Éléments bloquants en attente : ${manque.map(id => esc(R.BILAN_PRE.find(b => b.id === id).label)).join(' · ')}. Le dépistage de la tuberculose et de l’hépatite B doit précéder la première cure.</div></div>` : ''}
      <div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Catégorie</th><th>Examen</th><th>Statut</th><th>Date</th><th>Commentaire</th></tr></thead><tbody>
      ${cats.map(cat => R.BILAN_PRE.filter(b => b.cat === cat).map(b => { const r = p.bilan.find(x => x.id === b.id) || { statut: 'attente', date: '', commentaire: '' }; const cls = r.statut === 'fait_anormal' ? 'crit' : r.statut === 'fait_normal' ? 'good' : r.statut === 'attente' ? 'warn' : ''; return `<tr class="${r.statut === 'na' ? 'done' : ''}"><td class="small muted">${esc(cat)}</td><td>${esc(b.label)}</td>
        <td>${w ? `<select class="inline-input w150" data-change="bilanChange" data-pid="${p.id}" data-bid="${b.id}" data-k="statut">${opt(Object.keys(R.BILAN_STATUTS), k => k, k => R.BILAN_STATUTS[k], r.statut)}</select>` : R.badge(cls, R.BILAN_STATUTS[r.statut])}</td>
        <td>${w ? `<input type="date" class="inline-input w150" value="${esc(r.date)}" data-change="bilanChange" data-pid="${p.id}" data-bid="${b.id}" data-k="date">` : R.fmtDate(r.date)}</td>
        <td>${w ? `<input type="text" class="inline-input" style="width:100%!important" value="${esc(r.commentaire)}" placeholder="résultat, remarque" data-change="bilanChange" data-pid="${p.id}" data-bid="${b.id}" data-k="commentaire">` : esc(r.commentaire || '—')}</td></tr>`; }).join('')).join('')}
      </tbody></table></div></section>`;
  }

  function tabNotes(p) {
    return `<div class="grid c21"><section class="card"><div class="card-head"><h2>Notes de suivi</h2></div><div class="card-body"><ul class="timeline">${p.notes.map(n => `<li><div class="when">${R.fmtDateLong(n.date)} · ${esc(R.userName(n.par))}</div><div>${esc(n.txt)}</div></li>`).join('') || '<li class="muted">Aucune note</li>'}</ul></div></section>
    ${R.can('patients', 'w') || R.can('cures', 'w') ? `<section class="card"><div class="card-head"><h2>Ajouter une note</h2></div><form class="card-body" data-form="noteAdd"><input type="hidden" name="pid" value="${p.id}"><div class="field"><textarea name="txt" required placeholder="Observation clinique, appel du patient, décision de staff…"></textarea></div><div class="row mt8" style="justify-content:flex-end"><button class="btn primary" type="submit">Enregistrer la note</button></div></form></section>` : ''}</div>`;
  }

  /* ---------- actions patient ---------- */
  function lotsOptions(articleId, sel) { const it = R.stockItem(articleId); const lots = it ? it.lots.filter(l => l.qte > 0).sort((a, b) => a.peremption.localeCompare(b.peremption)) : []; return lots.map(l => `<option value="${esc(l.lot)}"${l.lot === sel ? ' selected' : ''}>${esc(l.lot)} — pér. ${R.fmtDate(l.peremption)} — ${l.qte} dispo.</option>`).join('') + '<option value="__autre">Autre lot (hors stock)</option>'; }
  function recalcStatut(p) { if (p.statut === 'suspendu' || p.statut === 'termine') return; p.statut = p.cures.some(c => c.phase === 'Induction' && (c.statut === 'prevue' || c.statut === 'reportee')) ? 'induction' : 'entretien'; }
  function renumeroter(p) { p.cures.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue)); p.cures.forEach((c, i) => c.n = i + 1); }

  Object.assign(R.actions, {
    filtrePatients(el) { R.ui.filtres[el.name] = el.value; const id = el.id, pos = el.selectionStart; R.render(); if (id) { const e2 = document.getElementById(id); if (e2) { e2.focus(); try { e2.setSelectionRange(pos, pos); } catch (e) {} } } },
    filtreReset() { R.ui.filtres = {}; R.render(); },
    cureEnregistrer(el) {
      const p = R.patient(el.dataset.pid), c = p.cures.find(x => x.n == el.dataset.n), pr = R.proto(p.protocoleId), art = R.article(c.articleId);
      R.modal({ title: `Enregistrer la cure n°${c.n} (${c.label}) — ${esc(R.nomComplet(p))}`, form: 'cureSave', wide: true, body: `
        <input type="hidden" name="pid" value="${p.id}"><input type="hidden" name="n" value="${c.n}">
        <div class="callout">${esc(pr.dci)} · ${esc(c.doseTexte)} · voie ${c.voie}${c.voie === 'IV' ? ` · ${esc(pr.dureePerfusion)}` : ''}${c.validationPharma ? '' : (c.voie === 'IV' ? ' · <b>analyse pharmaceutique non validée</b>' : '')}</div>
        <div class="form-grid">
          <div class="field"><label>Date d’administration</label><input type="date" name="dateReelle" value="${c.datePrevue <= R.today() ? R.today() : c.datePrevue}" required></div>
          <div class="field"><label>Heure de début</label><input type="time" name="heure" value="${c.heure || '09:00'}"></div>
          <div class="field"><label>Poids du jour (kg)</label><input type="number" step="0.1" name="poids" value="${p.poids}" required></div>
          <div class="field"><label>Dose administrée (mg)</label><input type="number" name="dose" value="${c.dose ?? ''}" ${c.dose === null ? 'placeholder="voie orale"' : ''}></div>
          <div class="field"><label>Flacons / unités utilisés</label><input type="number" name="flacons" value="${c.flacons || 0}" min="0"><span class="hint">${art ? `${art.unite} ${art.uniteLib} par unité` : ''}</span></div>
          <div class="field"><label>Lot (FEFO : péremption la plus proche d’abord)</label><select name="lot">${lotsOptions(c.articleId, null)}</select></div>
          <div class="field"><label>N° de lot si hors stock</label><input type="text" name="lotAutre" placeholder="ex. RMS25K031"></div>
          <div class="field"><label>Prémédication</label><select name="premedication"><option>Aucune</option><option>Paracétamol 1 g PO</option><option>Paracétamol 1 g + dexchlorphéniramine 5 mg IV</option><option>Paracétamol 1 g + dexchlorphéniramine 5 mg + hydrocortisone 100 mg IV</option></select></div>
          <div class="field"><label>Durée de perfusion</label><select name="duree"><option>30 min</option><option>1 h</option><option${c.voie === 'IV' && /2 h/.test(pr.dureePerfusion) ? ' selected' : ''}>2 h</option><option>Autre</option><option${c.voie !== 'IV' ? ' selected' : ''}>— (SC / PO)</option></select></div>
          <div class="field"><label>TA (mmHg)</label><input type="text" name="ta" placeholder="120/75"></div>
          <div class="field"><label>FC (bpm)</label><input type="number" name="fc" placeholder="72"></div>
          <div class="field"><label>Température (°C)</label><input type="number" step="0.1" name="temp" placeholder="36.8"></div>
          <div class="field"><label>Tolérance</label><select name="tolerance"><option>Bonne</option><option>Réaction mineure (gérée, perfusion terminée)</option><option>Réaction sévère (perfusion arrêtée)</option></select></div>
          <div class="field span2"><label>Observations</label><input type="text" name="commentaire" placeholder="ex. prurit à 40 min, débit réduit, reprise sans incident"></div>
          <div class="field"><label>Administré par</label><input type="text" value="${esc(R.userName(S.user))}" readonly></div>
        </div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Enregistrer et décrémenter le stock</button>` });
    },
    cureSave(f, fd) {
      const p = R.patient(fd.get('pid')), c = p.cures.find(x => x.n == fd.get('n'));
      c.statut = 'realisee'; c.dateReelle = fd.get('dateReelle'); c.heure = fd.get('heure'); c.poids = +fd.get('poids'); if (fd.get('dose')) c.dose = +fd.get('dose'); c.flacons = +fd.get('flacons') || 0;
      const lot = fd.get('lot') === '__autre' ? (fd.get('lotAutre') || '—') : fd.get('lot'); c.lot = lot;
      c.premedication = fd.get('premedication'); c.duree = fd.get('duree'); c.constantes = { ta: fd.get('ta'), fc: fd.get('fc'), temp: fd.get('temp') };
      c.tolerance = fd.get('tolerance') + (fd.get('commentaire') ? ' — ' + fd.get('commentaire') : ''); c.ide = S.user; c.motif = '';
      p.poids = c.poids;
      const it = R.stockItem(c.articleId); const l = it && it.lots.find(x => x.lot === lot);
      if (l && c.flacons) { const q = Math.min(l.qte, c.flacons); l.qte -= q; S.mouvements.unshift({ date: c.dateReelle, type: 'sortie', articleId: c.articleId, qte: q, lot, motif: `Cure n°${c.n} — ${R.nomComplet(p)}`, par: S.user }); if (q < c.flacons) R.toast(`Attention : lot ${lot} insuffisant, ${c.flacons - q} unité(s) non décrémentée(s)`, 'warn'); }
      recalcStatut(p); p.derniereCure = c.dateReelle; R.journal(`Cure n°${c.n} enregistrée — ${R.nomComplet(p)}`); R.touch(); R.closeModal(); R.toast(`Cure n°${c.n} enregistrée${l ? ' · stock mis à jour' : ''}`, 'good'); R.render();
    },
    cureDetail(el) {
      const p = R.patient(el.dataset.pid), c = p.cures.find(x => x.n == el.dataset.n);
      R.modal({ title: `Cure n°${c.n} — ${c.label} — ${esc(R.nomComplet(p))}`, body: `<dl class="dl">
        <div><dt>Date</dt><dd>${R.fmtDateLong(c.dateReelle)} ${c.heure ? '· ' + c.heure : ''} ${c.fauteuil ? '· fauteuil ' + c.fauteuil : ''}</dd></div><div><dt>Prévue le</dt><dd>${R.fmtDate(c.datePrevue)}</dd></div>
        <div><dt>Dose</dt><dd>${esc(c.doseTexte)} — ${c.dose ? c.dose + ' mg' : ''} · ${c.flacons || 0} unité(s) · lot <span class="mono">${esc(c.lot || '—')}</span></dd></div>
        <div><dt>Poids</dt><dd>${c.poids} kg</dd></div><div><dt>Prémédication</dt><dd>${esc(c.premedication || '—')}</dd></div><div><dt>Durée</dt><dd>${esc(c.duree || '—')}</dd></div>
        <div><dt>Constantes</dt><dd>${c.constantes ? `TA ${esc(c.constantes.ta || '—')} · FC ${esc(c.constantes.fc || '—')} · T° ${esc(c.constantes.temp || '—')}` : '—'}</dd></div>
        <div><dt>Tolérance</dt><dd>${esc(c.tolerance || '—')}</dd></div><div><dt>Administré par</dt><dd>${esc(R.userName(c.ide))}</dd></div>
        <div><dt>Analyse pharmaceutique</dt><dd>${c.validationPharma ? `${esc(R.userName(c.validationPharma.par))} le ${R.fmtDate(c.validationPharma.date)}` : 'non tracée'}</dd></div></dl>`, foot: `<button type="button" class="btn" data-action="closeModal">Fermer</button>` });
    },
    cureValiderPUI(el) { const p = R.patient(el.dataset.pid), c = p.cures.find(x => x.n == el.dataset.n); c.validationPharma = { par: S.user, date: R.today() }; R.journal(`Analyse pharmaceutique validée — cure n°${c.n} ${R.nomComplet(p)}`); R.touch(); R.toast('Analyse pharmaceutique validée', 'good'); R.render(); },
    cureReporter(el) {
      const p = R.patient(el.dataset.pid), c = p.cures.find(x => x.n == el.dataset.n);
      R.modal({ title: `${c.statut === 'reportee' ? 'Replanifier' : 'Reporter'} la cure n°${c.n} (${c.label})`, form: 'cureReporterSave', body: `<input type="hidden" name="pid" value="${p.id}"><input type="hidden" name="n" value="${c.n}">
        <div class="form-grid"><div class="field"><label>Nouvelle date</label><input type="date" name="date" value="${c.datePrevue}"><span class="hint">Laisser vide pour reporter sans date (statut « reportée »)</span></div><div class="field"><label>Heure</label><input type="time" name="heure" value="${c.heure || '09:00'}"></div><div class="field"><label>Fauteuil</label><input type="number" name="fauteuil" min="1" max="${S.settings.fauteuils}" value="${c.fauteuil || 1}"></div>
        <div class="field span3"><label>Motif</label><input type="text" name="motif" value="${esc(c.motif || '')}" placeholder="infection en cours, indisponibilité, rupture de stock…" required></div>
        <div class="field span3"><label class="check"><input type="checkbox" name="decaler" checked><span><b>Décaler les cures suivantes du même intervalle</b><span>conserve l’intervalle du protocole après la nouvelle date</span></span></label></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Enregistrer</button>` });
    },
    cureReporterSave(f, fd) {
      const p = R.patient(fd.get('pid')), c = p.cures.find(x => x.n == fd.get('n')); const nd = fd.get('date');
      if (nd) { const delta = R.diffDays(c.datePrevue, nd); c.datePrevue = nd; c.heure = fd.get('heure'); c.fauteuil = +fd.get('fauteuil'); c.statut = 'prevue'; c.motif = 'Reportée : ' + fd.get('motif'); c.label = R.libelleJour(R.diffDays(p.dateDebut, nd)); if (fd.get('decaler') && delta) p.cures.filter(x => x.n > c.n && x.statut === 'prevue').forEach(x => { x.datePrevue = R.addDays(x.datePrevue, delta); x.label = R.libelleJour(R.diffDays(p.dateDebut, x.datePrevue)); }); }
      else { c.statut = 'reportee'; c.motif = fd.get('motif'); }
      renumeroter(p); R.journal(`Cure ${c.label} reportée — ${R.nomComplet(p)} (${fd.get('motif')})`); R.touch(); R.closeModal(); R.toast('Cure reportée', 'good'); R.render();
    },
    cureAjouter(el) {
      const p = R.patient(el.dataset.pid), pr = R.proto(p.protocoleId); const e = pr.entretien || {}; const d = R.doseEtape(pr, { dose: e.dose, doseType: e.doseType, texte: e.texte }, p.poids, 'entretien');
      R.modal({ title: `Ajouter une cure — ${esc(R.nomComplet(p))}`, form: 'cureAjouterSave', body: `<input type="hidden" name="pid" value="${p.id}"><div class="form-grid">
        <div class="field"><label>Phase</label><select name="phase"><option>Entretien</option><option>Induction</option><option>Ré-induction</option><option>Hors protocole</option></select></div>
        <div class="field"><label>Date prévue</label><input type="date" name="date" value="${R.addDays(R.today(), 7)}" required></div>
        <div class="field"><label>Voie</label><select name="voie"><option${e.voie === 'IV' ? ' selected' : ''}>IV</option><option${e.voie === 'SC' ? ' selected' : ''}>SC</option><option${e.voie === 'PO' ? ' selected' : ''}>PO</option></select></div>
        <div class="field"><label>Dose (mg)</label><input type="number" name="dose" value="${d.dose ?? ''}"></div>
        <div class="field"><label>Article de stock</label><select name="articleId">${opt(R.ARTICLES.filter(a => a.serie > 0), a => a.id, a => a.libelle, pr.articleEntretienId || pr.articleId)}</select></div>
        <div class="field"><label>Unités / flacons</label><input type="number" name="flacons" value="${d.flacons || 0}" min="0"></div>
        <div class="field"><label>Heure (HDJ)</label><input type="time" name="heure" value="09:00"></div><div class="field"><label>Fauteuil</label><input type="number" name="fauteuil" value="1" min="1" max="${S.settings.fauteuils}"></div>
        <div class="field span3"><label>Motif / commentaire</label><input type="text" name="motif" placeholder="ex. perfusion supplémentaire S10 (non-réponse), ré-induction après arrêt"></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Ajouter</button>` });
    },
    cureAjouterSave(f, fd) {
      const p = R.patient(fd.get('pid')); const date = fd.get('date'); const dose = fd.get('dose') ? +fd.get('dose') : null;
      p.cures.push({ n: 0, phase: fd.get('phase'), label: R.libelleJour(R.diffDays(p.dateDebut, date)), jour: R.diffDays(p.dateDebut, date), datePrevue: date, voie: fd.get('voie'), dose, doseTexte: dose ? dose + ' mg' : '—', flacons: +fd.get('flacons') || 0, articleId: fd.get('articleId'), statut: 'prevue', heure: fd.get('heure'), fauteuil: +fd.get('fauteuil'), motif: fd.get('motif') });
      renumeroter(p); recalcStatut(p); R.journal(`Cure ajoutée le ${R.fmtDate(date)} — ${R.nomComplet(p)}`); R.touch(); R.closeModal(); R.toast('Cure ajoutée au calendrier', 'good'); R.render();
    },
    posologieModifier(el) {
      const p = R.patient(el.dataset.pid), pr = R.proto(p.protocoleId), next = R.prochaineCure(p);
      R.modal({ title: `Modifier la posologie d’entretien — ${esc(R.nomComplet(p))}`, form: 'posologieSave', body: `<input type="hidden" name="pid" value="${p.id}">
        <div class="callout">Protocole de référence : ${esc(pr.dci)} — ${esc(pr.entretien?.label || '')}. ${esc(pr.optimisation || '')}</div>
        <div class="form-grid"><div class="field"><label>Type de dose</label><select name="type"><option value="mgkg"${pr.doseType === 'mgkg' ? ' selected' : ''}>mg/kg</option><option value="mg"${pr.doseType !== 'mgkg' ? ' selected' : ''}>mg (dose fixe)</option></select></div>
        <div class="field"><label>Valeur</label><input type="number" step="0.5" name="valeur" value="${pr.doseType === 'mgkg' ? pr.doseRef : (pr.entretien?.dose || '')}" required></div>
        <div class="field"><label>Intervalle (jours)</label><input type="number" name="intervalle" value="${pr.entretien?.intervalleJours || 56}" required><span class="hint">56 j = 8 sem · 42 j = 6 sem · 28 j = 4 sem</span></div>
        <div class="field"><label>À partir de la cure n°</label><input type="number" name="depuis" value="${next ? next.n : p.cures.length}" min="1" required></div>
        <div class="field span2"><label>Article de stock</label><select name="articleId">${opt(R.ARTICLES.filter(a => a.serie > 0), a => a.id, a => a.libelle, next?.articleId || pr.articleId)}</select></div>
        <div class="field span3"><label>Justification (tracée au dossier)</label><input type="text" name="motif" placeholder="ex. taux résiduel 1,8 µg/mL, ADA négatifs, calprotectine 620 µg/g → optimisation" required></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Appliquer aux cures à venir</button>` });
    },
    posologieSave(f, fd) {
      const p = R.patient(fd.get('pid')); const type = fd.get('type'), val = +fd.get('valeur'), inter = +fd.get('intervalle'), depuis = +fd.get('depuis'), art = R.article(fd.get('articleId'));
      let prev = null; p.cures.filter(c => c.n >= depuis && c.statut === 'prevue').forEach(c => {
        c.dose = type === 'mgkg' ? Math.round(val * p.poids) : val; c.flacons = art ? Math.ceil(c.dose / art.unite) : c.flacons; c.articleId = art ? art.id : c.articleId; c.voie = art ? art.voie : c.voie;
        c.doseTexte = (type === 'mgkg' ? `${val} mg/kg → ${c.dose} mg` : `${c.dose} mg`) + ' (optimisation)';
        if (prev) c.datePrevue = R.addDays(prev, inter); prev = c.datePrevue; c.label = R.libelleJour(R.diffDays(p.dateDebut, c.datePrevue)); c.validationPharma = null;
      });
      p.notes.unshift({ date: R.today(), par: S.user, txt: `Posologie modifiée à partir de la cure n°${depuis} : ${val} ${type === 'mgkg' ? 'mg/kg' : 'mg'} tous les ${inter} j — ${fd.get('motif')}` });
      renumeroter(p); R.journal(`Posologie modifiée — ${R.nomComplet(p)}`); R.touch(); R.closeModal(); R.toast('Posologie mise à jour, validation pharmaceutique à refaire', 'good'); R.render();
    },
    patientSuspendre(el) { const p = R.patient(el.dataset.pid); R.modal({ title: `Suspendre le traitement — ${esc(R.nomComplet(p))}`, form: 'patientSuspendreSave', body: `<input type="hidden" name="pid" value="${p.id}"><div class="field"><label>Motif</label><textarea name="motif" required placeholder="infection en cours, chirurgie programmée, grossesse, effet indésirable…"></textarea></div><p class="small muted">La prochaine cure planifiée passe en « reportée » ; les suivantes restent au calendrier jusqu’à replanification.</p>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn danger">Suspendre</button>` }); },
    patientSuspendreSave(f, fd) { const p = R.patient(fd.get('pid')); p.statut = 'suspendu'; p.motifSuspension = fd.get('motif'); const n = R.prochaineCure(p); if (n) { n.statut = 'reportee'; n.motif = fd.get('motif'); } p.notes.unshift({ date: R.today(), par: S.user, txt: 'Traitement suspendu : ' + fd.get('motif') }); R.journal(`Traitement suspendu — ${R.nomComplet(p)}`); R.touch(); R.closeModal(); R.toast('Traitement suspendu', 'warn'); R.render(); },
    patientReprendre(el) { const p = R.patient(el.dataset.pid); p.statut = 'entretien'; p.notes.unshift({ date: R.today(), par: S.user, txt: 'Reprise du traitement autorisée (' + p.motifSuspension + ')' }); p.motifSuspension = ''; recalcStatut(p); R.journal(`Reprise du traitement — ${R.nomComplet(p)}`); R.touch(); R.toast('Traitement repris : replanifiez la cure reportée', 'good'); R.render(); },
    patientModifier(el) {
      const p = R.patient(el.dataset.pid);
      R.modal({ title: `Modifier le dossier — ${esc(R.nomComplet(p))}`, form: 'patientSave', wide: true, body: `<input type="hidden" name="pid" value="${p.id}"><div class="form-grid">
        <div class="field"><label>Nom</label><input type="text" name="nom" value="${esc(p.nom)}" required></div><div class="field"><label>Prénom</label><input type="text" name="prenom" value="${esc(p.prenom)}" required></div>
        <div class="field"><label>IPP</label><input type="text" name="ipp" value="${esc(p.ipp)}" required></div><div class="field"><label>Date de naissance</label><input type="date" name="ddn" value="${p.ddn}" required></div>
        <div class="field"><label>Sexe</label><select name="sexe"><option value="F"${p.sexe === 'F' ? ' selected' : ''}>Femme</option><option value="M"${p.sexe === 'M' ? ' selected' : ''}>Homme</option></select></div><div class="field"><label>Téléphone</label><input type="tel" name="tel" value="${esc(p.tel)}"></div>
        <div class="field"><label>Poids (kg)</label><input type="number" step="0.1" name="poids" value="${p.poids}" required></div><div class="field"><label>Taille (cm)</label><input type="number" name="taille" value="${p.taille}"></div>
        <div class="field"><label>Pathologie</label><select name="pathologie">${opt(Object.keys(R.PATHOS), k => k, k => R.PATHOS[k].label, p.pathologie)}</select></div><div class="field"><label>Classification de Montréal</label><input type="text" name="montreal" value="${esc(p.montreal)}"></div>
        <div class="field"><label>Date du diagnostic</label><input type="date" name="dateDiag" value="${p.dateDiag}"></div><div class="field"><label>Médecin référent</label><select name="medecinId">${opt(medecins(), u => u.id, u => R.userName(u.id), p.medecinId)}</select></div>
        <div class="field span3"><label>Traitements associés</label><input type="text" name="traitementsAssocies" value="${esc(p.traitementsAssocies)}"></div>
        <div class="field span3"><label>Allergies</label><input type="text" name="allergies" value="${esc(p.allergies)}"></div>
        <div class="field span3"><label>Biothérapies antérieures</label><input type="text" name="antecedentsBio" value="${esc(p.antecedentsBio)}"></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Enregistrer</button>` });
    },
    patientSave(f, fd) { const p = R.patient(fd.get('pid')); ['nom', 'prenom', 'ipp', 'ddn', 'sexe', 'tel', 'pathologie', 'montreal', 'dateDiag', 'medecinId', 'traitementsAssocies', 'allergies', 'antecedentsBio'].forEach(k => p[k] = fd.get(k)); p.poids = +fd.get('poids'); p.taille = +fd.get('taille'); p.nom = p.nom.toUpperCase(); R.journal(`Dossier modifié — ${R.nomComplet(p)}`); R.touch(); R.closeModal(); R.toast('Dossier mis à jour', 'good'); R.render(); },
    survSaisir(el) { const p = R.patient(el.dataset.pid), s = p.surveillance[+el.dataset.i]; R.modal({ title: `Résultat — ${esc(s.label)}`, form: 'survSave', body: `<input type="hidden" name="pid" value="${p.id}"><input type="hidden" name="i" value="${el.dataset.i}"><div class="form-grid"><div class="field"><label>Date de réalisation</label><input type="date" name="date" value="${R.today()}" required></div><div class="field span2"><label>Résultat</label><input type="text" name="resultat" required placeholder="${esc(s.cible ? 'cible : ' + s.cible : 'résultat, conclusion')}"></div><div class="field span3"><label>Interprétation / conduite à tenir</label><input type="text" name="commentaire" placeholder="ex. calprotectine 480 µg/g → discuter optimisation en staff"></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Enregistrer</button>` }); },
    survSave(f, fd) { const p = R.patient(fd.get('pid')), s = p.surveillance[+fd.get('i')]; s.statut = 'faite'; s.dateFaite = fd.get('date'); s.resultat = fd.get('resultat') + (fd.get('commentaire') ? ' — ' + fd.get('commentaire') : ''); R.journal(`Surveillance saisie (${s.label}) — ${R.nomComplet(p)}`); R.touch(); R.closeModal(); R.toast('Résultat enregistré', 'good'); R.render(); },
    survAjouter(el) { const p = R.patient(el.dataset.pid); R.modal({ title: 'Ajouter un élément de surveillance', form: 'survAjouterSave', body: `<input type="hidden" name="pid" value="${p.id}"><div class="form-grid"><div class="field span2"><label>Élément du catalogue</label><select name="id"><option value="">— Élément personnalisé —</option>${opt(R.SURVEILLANCE.filter(s => s.mode !== 'cure'), s => s.id, s => s.cat + ' · ' + s.label, '')}</select></div><div class="field"><label>Échéance</label><input type="date" name="date" value="${R.addDays(R.today(), 90)}" required></div><div class="field span3"><label>Libellé (si personnalisé)</label><input type="text" name="label" placeholder="ex. IRM pelvienne (fistule), consultation stomathérapie"></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Ajouter</button>` }); },
    survAjouterSave(f, fd) { const p = R.patient(fd.get('pid')); const cat = R.surv(fd.get('id')); const label = cat ? cat.label : (fd.get('label') || 'Élément de surveillance'); p.surveillance.push({ id: cat ? cat.id : R.uid('sv'), label, cat: cat ? cat.cat : 'Personnalisé', mode: 'echeance', jour: R.diffDays(p.dateDebut, fd.get('date')), echeance: fd.get('date'), statut: 'prevue', cible: cat?.cible }); R.touch(); R.closeModal(); R.toast('Élément ajouté au plan de surveillance', 'good'); R.render(); },
    bilanChange(el) { const p = R.patient(el.dataset.pid); let b = p.bilan.find(x => x.id === el.dataset.bid); if (!b) { b = { id: el.dataset.bid, statut: 'attente', date: '', commentaire: '' }; p.bilan.push(b); } b[el.dataset.k] = el.value; if (el.dataset.k === 'statut' && el.value.startsWith('fait') && !b.date) b.date = R.today(); R.touch(); if (el.dataset.k === 'statut') R.render(); },
    noteAdd(f, fd) { const p = R.patient(fd.get('pid')); p.notes.unshift({ date: R.today(), par: S.user, txt: fd.get('txt').trim() }); R.touch(); R.toast('Note enregistrée', 'good'); R.render(); }
  });

  /* ===================== PLANNING ===================== */
  R.pages.planning = {
    render() {
      const base = R.addDays(R.semaineRef(), 7 * (R.ui.semaineOffset || 0)); const sem = R.semaine(base), t = R.today();
      const cures = R.curesEntre(sem.lundi, sem.dimanche).filter(x => x.cure.statut !== 'annulee'); const rdv = R.rdvEntre(sem.lundi, sem.dimanche);
      const horsSemaine = cures.filter(x => x.cure.datePrevue > sem.jours[4]);
      const jours = sem.jours.map(d => { const ev = [...cures.filter(x => x.cure.datePrevue === d).map(x => ({ h: x.cure.heure || (x.cure.voie === 'IV' ? '—' : x.cure.voie), sort: x.cure.heure || '98', cls: x.cure.voie !== 'IV' ? 'sc' : (x.cure.statut === 'realisee' ? 'done' : x.cure.statut === 'reportee' ? 'reportee' : (x.cure.datePrevue < t ? 'retard' : '')), t: R.nomComplet(x.patient), d: `${R.proto(x.patient.protocoleId)?.dci} ${x.cure.label} · ${x.cure.doseTexte}${x.cure.voie === 'IV' ? ' · F' + (x.cure.fauteuil || '?') : ''}`, pid: x.patient.id, iv: x.cure.voie === 'IV' && x.cure.statut !== 'reportee' })), ...rdv.filter(r => r.date === d).map(r => ({ h: r.heure, sort: r.heure, cls: 'rdv', t: R.nomComplet(R.patient(r.patientId) || { nom: '?', prenom: '' }), d: `${r.type} · ${r.objet}`, pid: r.patientId, iv: false }))].sort((a, b) => a.sort.localeCompare(b.sort)); return { d, ev, iv: ev.filter(e => e.iv).length }; });
      return `<div class="page-head"><div><h1>Planning de l’hôpital de jour</h1><p>${S.settings.fauteuils} fauteuils · cures IV, dispensations SC et rendez-vous</p></div>
        <div class="page-actions"><div class="week-nav"><button class="btn sm" data-action="semainePrec">${R.icon('chevL')}</button><button class="btn sm" data-action="semaineAuj">Semaine en cours</button><button class="btn sm" data-action="semaineSuiv">${R.icon('chevR')}</button></div>${R.can('planning', 'w') ? `<button class="btn primary" data-action="rdvAjouter">${R.icon('plus')}Rendez-vous</button>` : ''}</div></div>
      <div class="caps mb8">Semaine du ${R.fmtDateLong(sem.lundi)} au ${R.fmtDateLong(sem.jours[4])}</div>
      <div class="tbl-wrap mb16"><div class="week">
        ${jours.map(j => `<div class="day-head${j.d === t ? ' today' : ''}"><b>${R.fmtDate(j.d, { weekday: 'long' })}</b><small>${R.fmtDate(j.d, { day: 'numeric', month: 'short' })} · ${j.iv} perfusion(s)</small><div class="occ" title="${j.iv}/${S.settings.fauteuils} fauteuils">${Array.from({ length: S.settings.fauteuils }, (_, i) => `<i class="${i < j.iv ? 'on' : ''}"></i>`).join('')}</div></div>`).join('')}
        ${jours.map(j => `<div class="day">${j.ev.map(e => `<div class="evt ${e.cls}" data-go="patient" data-params='${R.params({ id: e.pid, tab: e.cls === 'rdv' ? 'synthese' : 'cures' })}'><span class="h">${esc(e.h)}</span><b>${esc(e.t)}</b>${esc(e.d)}</div>`).join('') || '<div class="muted small center" style="padding:12px 0">—</div>'}</div>`).join('')}
      </div></div>
      <div class="legend mb16"><span><i class="sw" style="background:var(--accent)"></i>Cure IV</span><span><i class="sw" style="background:var(--s3)"></i>Dispensation SC / oral</span><span><i class="sw" style="background:var(--info)"></i>Rendez-vous</span><span><i class="sw" style="background:var(--warn)"></i>Reportée</span><span><i class="sw" style="background:var(--crit)"></i>En retard</span></div>
      ${horsSemaine.length ? `<section class="card"><div class="card-head"><h2>Week-end</h2></div><div class="card-body">${horsSemaine.map(x => `<div>${R.fmtDateLong(x.cure.datePrevue)} — ${esc(R.nomComplet(x.patient))} · ${esc(x.cure.label)}</div>`).join('')}</div></section>` : ''}`;
    }
  };
  Object.assign(R.actions, {
    semainePrec() { R.ui.semaineOffset = (R.ui.semaineOffset || 0) - 1; R.render(); },
    semaineSuiv() { R.ui.semaineOffset = (R.ui.semaineOffset || 0) + 1; R.render(); },
    semaineAuj() { R.ui.semaineOffset = 0; R.render(); },
    rdvAjouter() { R.modal({ title: 'Nouveau rendez-vous', form: 'rdvSave', body: `<div class="form-grid"><div class="field span2"><label>Patient</label><select name="patientId" required>${opt([...S.patients].sort((a, b) => a.nom.localeCompare(b.nom)), p => p.id, p => R.nomComplet(p) + ' — ' + p.ipp, '')}</select></div><div class="field"><label>Type</label><select name="type"><option>Consultation</option><option>Endoscopie</option><option>Imagerie</option><option>Biologie</option><option>Éducation</option><option>Autre</option></select></div><div class="field"><label>Date</label><input type="date" name="date" value="${R.addDays(R.today(), 1)}" required></div><div class="field"><label>Heure</label><input type="time" name="heure" value="14:00" required></div><div class="field"><label>Avec</label><select name="avec">${opt(S.users.filter(u => u.actif && u.role !== 'admin'), u => u.id, u => R.userName(u.id), S.user)}</select></div><div class="field span3"><label>Objet</label><input type="text" name="objet" required placeholder="ex. consultation de réévaluation à S14"></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Enregistrer</button>` }); },
    rdvSave(f, fd) { S.rdv.push({ date: fd.get('date'), heure: fd.get('heure'), patientId: fd.get('patientId'), type: fd.get('type'), objet: fd.get('objet'), avec: fd.get('avec') }); R.touch(); R.closeModal(); R.toast('Rendez-vous enregistré', 'good'); R.render(); }
  });

  /* ===================== PROTOCOLES ===================== */
  function schemaChips(pr) { return pr.induction.map(e => `<span class="chip ind">${esc(e.label)} · ${e.dose === null ? esc(e.texte || (pr.doseType === 'palier' ? 'palier poids' : '')) : (pr.doseType === 'mgkg' && !e.doseType ? e.dose + ' mg/kg' : e.dose + ' mg')} ${e.voie}</span>`).join('<span class="arrow">→</span>'); }
  R.pages.protocoles = {
    render() {
      const f = R.ui.filtres.protoVoie || 'tous';
      const list = S.protocoles.filter(pr => f === 'tous' || (f === 'IV' ? /IV/.test(pr.voie) : f === 'SC' ? pr.voie === 'SC' : pr.voie === 'PO'));
      return `<div class="page-head"><div><h1>Protocoles thérapeutiques</h1><p>${S.protocoles.length} protocoles validés par le service · schémas d’induction et d’entretien, prémédication, surveillance par défaut</p></div>
        <div class="page-actions"><div class="btn-group">${[['tous', 'Tous'], ['IV', 'Perfusions IV'], ['SC', 'Sous-cutané'], ['PO', 'Voie orale']].map(x => `<button class="btn sm${f === x[0] ? ' on' : ''}" data-action="protoFiltre" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>${R.can('protocoles', 'w') ? `<button class="btn primary" data-action="protoEditer">${R.icon('plus')}Nouveau protocole</button>` : ''}</div></div>
      <div class="proto-grid">${list.map(pr => `<article class="proto"><div class="row between"><h3>${esc(pr.dci)}</h3><span class="badge accent">${esc(pr.classe)}</span></div><div class="spec">${esc(pr.specialites)}</div>
        <div class="row">${pr.indications.map(i => `<span class="badge ${i === 'MC' ? 'info' : 'accent'}">${i}</span>`).join('')}<span class="tag">${esc(pr.voie)}</span>${pr.articleId ? `<span class="tag">${esc(R.article(pr.articleId)?.unite)} ${esc(R.article(pr.articleId)?.uniteLib)} / flacon</span>` : ''}</div>
        <div><div class="caps">Induction</div><div class="schema mt8">${schemaChips(pr)}</div></div>
        <div><div class="caps">Entretien</div><div class="small mt8">${esc(pr.entretien?.label || '—')}</div></div>
        <div class="small muted">Perfusion : ${esc(pr.dureePerfusion)}</div>
        <div class="foot"><button class="btn sm" data-action="protoDetail" data-id="${pr.id}">Détails</button>${R.can('protocoles', 'w') ? `<button class="btn sm" data-action="protoEditer" data-id="${pr.id}">${R.icon('edit')}Modifier</button>` : ''}</div></article>`).join('')}</div>`;
    }
  };
  Object.assign(R.actions, {
    protoFiltre(el) { R.ui.filtres.protoVoie = el.dataset.v; R.render(); },
    protoDetail(el) {
      const pr = R.proto(el.dataset.id); const art = R.article(pr.articleId), art2 = R.article(pr.articleEntretienId);
      R.modal({ title: `${esc(pr.dci)} — ${esc(pr.classe)}`, wide: true, body: `<dl class="dl">
        <div><dt>Spécialités</dt><dd>${esc(pr.specialites)}</dd></div><div><dt>Indications</dt><dd>${pr.indications.map(i => R.PATHOS[i]?.label).join(', ')} · voie ${esc(pr.voie)}</dd></div>
        <div><dt>Induction</dt><dd><div class="schema">${schemaChips(pr)}</div>${pr.paliers ? `<div class="small muted mt8">Paliers : ${pr.paliers.map(x => `${x.max === Infinity ? '> 85 kg' : '≤ ' + x.max + ' kg'} → ${x.dose} mg (${x.flacons} fl.)`).join(' · ')}</div>` : ''}</dd></div>
        <div><dt>Entretien</dt><dd>${esc(pr.entretien?.label || '—')} — à partir de J${pr.entretien?.debutJour} tous les ${pr.entretien?.intervalleJours} j</dd></div>
        <div><dt>Présentation</dt><dd>${art ? esc(art.libelle) : '—'}${art2 ? ' · entretien : ' + esc(art2.libelle) : ''}</dd></div>
        <div><dt>Conservation</dt><dd>${art ? esc(art.conservation) + '. ' + esc(art.stabilite) : '—'}</dd></div>
        <div><dt>Préparation</dt><dd>${esc(pr.preparation)}</dd></div><div><dt>Durée de perfusion</dt><dd>${esc(pr.dureePerfusion)}</dd></div>
        <div><dt>Prémédication</dt><dd>${esc(pr.premedication)}</dd></div><div><dt>Surveillance perfusion</dt><dd>${esc(pr.surveillancePerf)}</dd></div>
        <div><dt>Optimisation</dt><dd>${esc(pr.optimisation)}</dd></div>
        <div><dt>Surveillance par défaut</dt><dd>${pr.surveillanceDefaut.map(id => `<span class="tag">${esc(R.surv(id)?.label.split(' (')[0] || id)}</span>`).join(' ')}</dd></div>
        ${pr.remarque ? `<div><dt>Remarque</dt><dd>${esc(pr.remarque)}</dd></div>` : ''}</dl>`, foot: `<button type="button" class="btn" data-action="closeModal">Fermer</button>${R.can('protocoles', 'w') ? `<button type="button" class="btn primary" data-action="protoEditer" data-id="${pr.id}">Modifier</button>` : ''}` });
    },
    protoEditer(el) {
      const pr = el.dataset.id ? R.proto(el.dataset.id) : { id: '', dci: '', specialites: '', classe: 'Anti-TNFα', voie: 'IV', indications: ['MC', 'RCH'], articleId: 'IFX100', articleEntretienId: '', doseType: 'mgkg', doseRef: 5, induction: [{ label: 'S0', jour: 0, dose: 5, voie: 'IV' }, { label: 'S2', jour: 14, dose: 5, voie: 'IV' }, { label: 'S6', jour: 42, dose: 5, voie: 'IV' }], entretien: { debutJour: 98, intervalleJours: 56, dose: 5, voie: 'IV', label: 'toutes les 8 semaines' }, dureePerfusion: '', preparation: '', premedication: 'Aucune.', surveillancePerf: '', optimisation: '', surveillanceDefaut: ['nfs', 'crp', 'bh', 'clin', 'calpro', 'endo', 'vacc'], remarque: '' };
      const row = (e, i) => `<tr><td><input type="text" name="ind_label" value="${esc(e.label)}" class="inline-input w70" required></td><td><input type="number" name="ind_jour" value="${e.jour}" class="inline-input w70" required></td><td><input type="number" step="0.5" name="ind_dose" value="${e.dose ?? ''}" class="inline-input w70"></td><td><select name="ind_voie" class="inline-input"><option${e.voie === 'IV' ? ' selected' : ''}>IV</option><option${e.voie === 'SC' ? ' selected' : ''}>SC</option><option${e.voie === 'PO' ? ' selected' : ''}>PO</option></select></td><td><button type="button" class="btn sm ghost" data-action="protoDelStep">${R.icon('x')}</button></td></tr>`;
      R.modal({ title: pr.id ? `Modifier le protocole — ${esc(pr.dci)}` : 'Nouveau protocole', form: 'protoSave', wide: true, body: `<input type="hidden" name="id" value="${esc(pr.id)}">
        <div class="form-grid"><div class="field"><label>DCI / intitulé</label><input type="text" name="dci" value="${esc(pr.dci)}" required></div><div class="field"><label>Spécialités</label><input type="text" name="specialites" value="${esc(pr.specialites)}"></div><div class="field"><label>Classe</label><input type="text" name="classe" value="${esc(pr.classe)}" list="classes"><datalist id="classes"><option>Anti-TNFα</option><option>Anti-intégrine α4β7</option><option>Anti-IL-12/23 (p40)</option><option>Anti-IL-23 (p19)</option><option>Inhibiteur de JAK</option><option>Modulateur S1P</option></datalist></div>
        <div class="field"><label>Voie</label><select name="voie">${['IV', 'IV puis SC', 'SC', 'PO'].map(v => `<option${pr.voie === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>Indications</label><div class="row"><label class="check" style="padding:6px 10px"><input type="checkbox" name="ind" value="MC"${pr.indications.includes('MC') ? ' checked' : ''}> MC</label><label class="check" style="padding:6px 10px"><input type="checkbox" name="ind" value="RCH"${pr.indications.includes('RCH') ? ' checked' : ''}> RCH</label></div></div>
        <div class="field"><label>Type de dose (induction)</label><select name="doseType"><option value="mgkg"${pr.doseType === 'mgkg' ? ' selected' : ''}>mg/kg</option><option value="mg"${pr.doseType === 'mg' ? ' selected' : ''}>mg fixe</option><option value="palier"${pr.doseType === 'palier' ? ' selected' : ''}>paliers de poids (ustekinumab)</option><option value="po"${pr.doseType === 'po' ? ' selected' : ''}>voie orale (texte)</option></select></div>
        <div class="field"><label>Article de stock (induction)</label><select name="articleId"><option value="">—</option>${opt(R.ARTICLES.filter(a => a.serie > 0), a => a.id, a => a.libelle, pr.articleId)}</select></div>
        <div class="field"><label>Article de stock (entretien)</label><select name="articleEntretienId"><option value="">— identique —</option>${opt(R.ARTICLES.filter(a => a.serie > 0), a => a.id, a => a.libelle, pr.articleEntretienId || '')}</select></div></div>
        <div><div class="caps mb8">Étapes d’induction</div><div class="steps-editor tbl-wrap"><table class="tbl" id="steps"><thead><tr><th>Libellé</th><th>Jour</th><th>Dose (mg/kg ou mg)</th><th>Voie</th><th></th></tr></thead><tbody>${pr.induction.map(row).join('')}</tbody></table></div><button type="button" class="btn sm mt8" data-action="protoAddStep">Ajouter une étape</button>${pr.doseType === 'palier' ? '<div class="small muted mt8">Paliers de poids conservés tels quels (≤ 55 kg : 260 mg · 56–85 kg : 390 mg · > 85 kg : 520 mg).</div>' : ''}</div>
        <div><div class="caps mb8">Entretien</div><div class="form-grid"><div class="field"><label>Début (jour après J0)</label><input type="number" name="ent_debut" value="${pr.entretien?.debutJour ?? 98}"></div><div class="field"><label>Intervalle (jours)</label><input type="number" name="ent_intervalle" value="${pr.entretien?.intervalleJours ?? 56}"></div><div class="field"><label>Dose</label><input type="number" step="0.5" name="ent_dose" value="${pr.entretien?.dose ?? ''}"></div><div class="field"><label>Type de dose</label><select name="ent_doseType"><option value="">comme l’induction</option><option value="mg"${pr.entretien?.doseType === 'mg' ? ' selected' : ''}>mg fixe</option><option value="mgkg"${pr.entretien?.doseType === 'mgkg' ? ' selected' : ''}>mg/kg</option></select></div><div class="field"><label>Voie</label><select name="ent_voie">${['IV', 'SC', 'PO'].map(v => `<option${pr.entretien?.voie === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div><div class="field span2"><label>Libellé affiché</label><input type="text" name="ent_label" value="${esc(pr.entretien?.label || '')}"></div></div></div>
        <div class="form-grid"><div class="field span3"><label>Durée de perfusion</label><input type="text" name="dureePerfusion" value="${esc(pr.dureePerfusion)}"></div><div class="field span3"><label>Préparation</label><input type="text" name="preparation" value="${esc(pr.preparation)}"></div><div class="field span3"><label>Prémédication</label><input type="text" name="premedication" value="${esc(pr.premedication)}"></div><div class="field span3"><label>Surveillance pendant la perfusion</label><input type="text" name="surveillancePerf" value="${esc(pr.surveillancePerf)}"></div><div class="field span3"><label>Optimisation / perte de réponse</label><input type="text" name="optimisation" value="${esc(pr.optimisation)}"></div><div class="field span3"><label>Remarque</label><input type="text" name="remarque" value="${esc(pr.remarque || '')}"></div></div>
        <div><div class="caps mb8">Surveillance proposée par défaut</div><div class="form-grid">${R.SURVEILLANCE.map(s => `<label class="check${pr.surveillanceDefaut.includes(s.id) ? ' on' : ''}"><input type="checkbox" name="surv" value="${s.id}"${pr.surveillanceDefaut.includes(s.id) ? ' checked' : ''}><span><b>${esc(s.label)}</b><span>${esc(s.cat)} · ${s.mode === 'cure' ? 'à chaque cure' : s.mode === 'periodique' ? 'tous les ' + s.tousLes + ' j' : 'J' + s.jours.join(', J')}</span></span></label>`).join('')}</div></div>`,
        foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Enregistrer le protocole</button>` });
    },
    protoAddStep(el) { const tb = document.querySelector('#steps tbody'); const tr = document.createElement('tr'); tr.innerHTML = `<td><input type="text" name="ind_label" value="S${tb.children.length * 2}" class="inline-input w70" required></td><td><input type="number" name="ind_jour" value="${tb.children.length * 14}" class="inline-input w70" required></td><td><input type="number" step="0.5" name="ind_dose" value="" class="inline-input w70"></td><td><select name="ind_voie" class="inline-input"><option>IV</option><option>SC</option><option>PO</option></select></td><td><button type="button" class="btn sm ghost" data-action="protoDelStep">${R.icon('x')}</button></td>`; tb.appendChild(tr); },
    protoDelStep(el) { el.closest('tr').remove(); },
    protoSave(f, fd) {
      const id = fd.get('id') || R.uid('pr-'); const existing = R.proto(id);
      const labels = fd.getAll('ind_label'), jours = fd.getAll('ind_jour'), doses = fd.getAll('ind_dose'), voies = fd.getAll('ind_voie');
      const induction = labels.map((l, i) => ({ label: l, jour: +jours[i], dose: doses[i] === '' ? null : +doses[i], voie: voies[i] })).sort((a, b) => a.jour - b.jour);
      const pr = Object.assign(existing || {}, { id, dci: fd.get('dci'), specialites: fd.get('specialites'), classe: fd.get('classe'), voie: fd.get('voie'), indications: fd.getAll('ind'), articleId: fd.get('articleId') || null, articleEntretienId: fd.get('articleEntretienId') || undefined, doseType: fd.get('doseType'), doseRef: induction[0]?.dose ?? existing?.doseRef, induction,
        entretien: { debutJour: +fd.get('ent_debut'), intervalleJours: +fd.get('ent_intervalle'), dose: fd.get('ent_dose') === '' ? null : +fd.get('ent_dose'), doseType: fd.get('ent_doseType') || undefined, voie: fd.get('ent_voie'), label: fd.get('ent_label') },
        dureePerfusion: fd.get('dureePerfusion'), preparation: fd.get('preparation'), premedication: fd.get('premedication'), surveillancePerf: fd.get('surveillancePerf'), optimisation: fd.get('optimisation'), remarque: fd.get('remarque'), surveillanceDefaut: fd.getAll('surv') });
      if (pr.doseType === 'palier' && !pr.paliers) pr.paliers = [{ max: 55, dose: 260, flacons: 2 }, { max: 85, dose: 390, flacons: 3 }, { max: Infinity, dose: 520, flacons: 4 }];
      if (!existing) S.protocoles.push(pr);
      R.journal(`Protocole ${existing ? 'modifié' : 'créé'} — ${pr.dci}`); R.touch(); R.closeModal(); R.toast(`Protocole ${existing ? 'mis à jour' : 'créé'}`, 'good'); R.render();
    }
  });

  /* ===================== STOCK ===================== */
  R.pages.stock = {
    render() {
      const f = R.ui.filtres.stockVoie || 'tous';
      const all = S.stock.map(it => ({ it, a: R.analyseStock(it) }));
      const list = all.filter(x => f === 'tous' || (f === 'IV' ? x.a.art.voie === 'IV' && x.a.art.serie > 0 : f === 'SC' ? x.a.art.voie === 'SC' : x.a.art.serie === 0));
      const sousSeuil = all.filter(x => x.a.etat === 'faible' || x.a.etat === 'rupture').length, lots = all.reduce((n, x) => n + x.a.lotsProches.length + x.a.perimes.length, 0), aCmd = all.filter(x => x.a.aCommander > 0 || x.a.etat === 'commander');
      const prevision = all.filter(x => x.a.cures.length).sort((a, b) => b.a.besoin - a.a.besoin);
      const h = S.settings.horizonPrevisionJours;
      return `<div class="page-head"><div><h1>Stock & pharmacie</h1><p>Armoire biothérapies de l’HDJ · gestion par lot (FEFO) · ${S.settings.horizonPrevisionJours} jours de prévision</p></div><div class="page-actions"><div class="btn-group">${[['tous', 'Tous'], ['IV', 'Biothérapies IV'], ['SC', 'Formes SC'], ['conso', 'Consommables']].map(x => `<button class="btn sm${f === x[0] ? ' on' : ''}" data-action="stockFiltre" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>${R.can('stock', 'w') ? `<button class="btn primary" data-action="stockMouvement">${R.icon('plus')}Mouvement</button>` : ''}</div></div>
      <div class="kpis"><div class="kpi"><div class="label">Références suivies</div><div class="value">${S.stock.length}</div><div class="sub">${all.filter(x => x.a.art.voie === 'IV' && x.a.art.serie > 0).length} biothérapies IV</div></div><div class="kpi${sousSeuil ? ' attention' : ''}"><div class="label">Sous seuil / rupture</div><div class="value">${sousSeuil}</div><div class="sub">${all.filter(x => x.a.etat === 'rupture').length} rupture(s)</div></div><div class="kpi${lots ? ' attention' : ''}"><div class="label">Lots à surveiller</div><div class="value">${lots}</div><div class="sub">péremption < ${S.settings.joursPeremptionAlerte} j ou dépassée</div></div><div class="kpi"><div class="label">Commande suggérée</div><div class="value">${aCmd.length}<small>référence(s)</small></div><div class="sub">${aCmd.reduce((n, x) => n + x.a.aCommander, 0)} unités au total</div></div></div>
      <section class="card mb16"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Article</th><th class="right">Stock</th><th class="right">Seuil</th><th class="right">CMM</th><th class="right">Couverture</th><th class="right">Besoin ${h} j</th><th class="right">À cder</th><th>Lots</th><th>État</th><th></th></tr></thead><tbody>
        ${list.map(({ it, a }) => `<tr><td class="name" style="max-width:230px">${esc(a.art.dci)}<small style="font-family:inherit;white-space:normal">${esc(a.art.libelle)}</small></td><td class="right num"><b>${a.qte}</b></td><td class="right num">${it.seuil}</td><td class="right num">${it.cmm}</td><td class="right num">${a.couverture === null ? '—' : a.couverture + ' j'}</td><td class="right num">${a.besoin}</td><td class="right num">${a.aCommander ? `<b style="color:var(--warn-ink)">${a.aCommander}</b>` : '0'}</td>
          <td class="small">${it.lots.filter(l => l.qte > 0).length} lot(s)${it.lots.filter(l => l.qte > 0).length ? ` · prochaine pér. ${R.fmtDate([...it.lots.filter(l => l.qte > 0)].sort((x, y) => x.peremption.localeCompare(y.peremption))[0].peremption)}` : ''}${a.lotsProches.length ? ' ' + R.badge('warn', 'péremption proche') : ''}${a.perimes.length ? ' ' + R.badge('crit', 'périmé') : ''}</td>
          <td>${R.etatStockBadge(a.etat)}</td><td class="actions"><button class="btn sm" data-action="stockDetail" data-id="${it.articleId}">Détails</button></td></tr>`).join('')}
      </tbody></table></div></section>
      <div class="grid c11">
        <section class="card"><div class="card-head"><div><h2>Besoins prévisionnels — ${h} jours</h2><div class="sub">calculés depuis les cures planifiées</div></div></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Article</th><th class="right">Cures</th><th class="right">Unités</th><th class="right">Stock</th><th>Patients</th></tr></thead><tbody>${prevision.map(({ it, a }) => `<tr><td>${esc(a.art.dci)} <span class="tag">${esc(a.art.voie)}</span></td><td class="right num">${a.cures.length}</td><td class="right num"><b>${a.besoin}</b></td><td class="right num" style="color:${a.qte < a.besoin ? 'var(--crit-ink)' : 'inherit'}">${a.qte}</td><td class="small">${a.cures.map(x => `${x.patient.nom} (${R.fmtDate(x.cure.datePrevue, { day: '2-digit', month: '2-digit' })})`).join(', ')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Aucune cure planifiée</td></tr>'}</tbody></table></div></section>
        <section class="card"><div class="card-head"><div><h2>Proposition de commande</h2><div class="sub">quantité = besoin prévisionnel + stock de sécurité − stock disponible</div></div></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Article</th><th class="right">Stock</th><th class="right">Pt cde</th><th class="right">Sécu.</th><th class="right">Besoin</th><th class="right">À cder</th></tr></thead><tbody>${aCmd.map(({ it, a }) => `<tr><td>${esc(a.art.dci)} <span class="tag">${esc(a.art.voie)}</span><div class="xs muted">délai ${it.delaiLivraison} j</div></td><td class="right num">${a.qte}</td><td class="right num">${a.pointCommande}</td><td class="right num">${a.secu}</td><td class="right num">${a.besoin}</td><td class="right num"><b>${a.aCommander || '—'}</b></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucune commande nécessaire</td></tr>'}</tbody></table></div>
          <div class="card-foot">CMM = consommation moyenne mensuelle · stock de sécurité = CMM/30 × ${S.settings.stockSecuriteJours} j · point de commande = consommation pendant le délai de livraison + sécurité · couverture = stock ÷ consommation journalière. Formules paramétrables dans Paramètres.</div></section>
      </div>
      <section class="card"><div class="card-head"><h2>Derniers mouvements</h2><span class="muted small">${S.mouvements.length} au total</span></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Article</th><th class="right">Qté</th><th>Lot</th><th>Motif</th><th>Par</th></tr></thead><tbody>${S.mouvements.slice(0, 12).map(m => `<tr><td class="nowrap">${R.fmtDate(m.date)}</td><td>${m.type === 'entree' ? R.badge('good', 'Entrée') : m.type === 'sortie' ? R.badge('info', 'Sortie') : m.type === 'retrait' ? R.badge('crit', 'Retrait') : R.badge('warn', 'Ajustement')}</td><td>${esc(R.article(m.articleId)?.dci)} <span class="tag">${esc(R.article(m.articleId)?.voie)}</span></td><td class="right num">${m.type === 'sortie' || m.type === 'retrait' ? '−' : (m.qte < 0 ? '' : '+')}${m.qte}</td><td class="mono">${esc(m.lot || '—')}</td><td class="small">${esc(m.motif)}</td><td class="small">${esc(R.userName(m.par))}</td></tr>`).join('')}</tbody></table></div></section>`;
    }
  };
  Object.assign(R.actions, {
    stockFiltre(el) { R.ui.filtres.stockVoie = el.dataset.v; R.render(); },
    stockDetail(el) {
      const it = R.stockItem(el.dataset.id), a = R.analyseStock(it), t = R.today();
      R.modal({ title: esc(a.art.libelle), wide: true, form: R.can('stock', 'w') ? 'stockParamsSave' : null, body: `<input type="hidden" name="id" value="${it.articleId}">
        <div class="grid c11" style="margin-bottom:0"><dl class="dl"><div><dt>Stock</dt><dd><b>${a.qte}</b> unité(s) · ${R.etatStockBadge(a.etat)}</dd></div><div><dt>Couverture</dt><dd>${a.couverture === null ? '—' : a.couverture + ' jours'} (CMM ${it.cmm})</dd></div><div><dt>Besoin ${S.settings.horizonPrevisionJours} j</dt><dd>${a.besoin} unité(s) pour ${a.cures.length} cure(s)</dd></div><div><dt>Sécurité · point de commande</dt><dd>${a.secu} · ${a.pointCommande}</dd></div><div><dt>À commander</dt><dd><b>${a.aCommander}</b></dd></div></dl>
        <dl class="dl"><div><dt>Conservation</dt><dd>${esc(a.art.conservation)}</dd></div><div><dt>Stabilité / préparation</dt><dd>${esc(a.art.stabilite || '—')}</dd></div></dl></div>
        <div><div class="caps mb8">Lots</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Lot</th><th>Péremption</th><th class="right">Quantité</th><th>État</th></tr></thead><tbody>${it.lots.map(l => `<tr class="${l.qte ? '' : 'done'}"><td class="mono">${esc(l.lot)}</td><td>${R.fmtDate(l.peremption)}</td><td class="right num">${l.qte}</td><td>${!l.qte ? '<span class="muted">épuisé</span>' : l.peremption < t ? R.badge('crit', 'Périmé') : R.diffDays(t, l.peremption) <= S.settings.joursPeremptionAlerte ? R.badge('warn', `${R.diffDays(t, l.peremption)} j`) : R.badge('good', 'Valide')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucun lot</td></tr>'}</tbody></table></div></div>
        ${R.can('stock', 'w') ? `<div><div class="caps mb8">Paramètres de gestion</div><div class="form-grid"><div class="field"><label>Seuil d’alerte</label><input type="number" name="seuil" value="${it.seuil}"></div><div class="field"><label>CMM (unités/mois)</label><input type="number" name="cmm" value="${it.cmm}"></div><div class="field"><label>Délai de livraison (j)</label><input type="number" name="delai" value="${it.delaiLivraison}"></div></div></div>` : ''}
        <div><div class="caps mb8">Mouvements de l’article</div><div class="tbl-wrap"><table class="tbl"><tbody>${S.mouvements.filter(m => m.articleId === it.articleId).slice(0, 8).map(m => `<tr><td class="nowrap">${R.fmtDate(m.date)}</td><td>${m.type}</td><td class="right num">${m.qte}</td><td class="mono">${esc(m.lot || '')}</td><td class="small">${esc(m.motif)}</td></tr>`).join('') || '<tr><td class="empty">Aucun mouvement</td></tr>'}</tbody></table></div></div>`,
        foot: `<button type="button" class="btn" data-action="closeModal">Fermer</button>${R.can('stock', 'w') ? `<button type="button" class="btn" data-action="stockMouvement" data-id="${it.articleId}">Nouveau mouvement</button><button type="submit" class="btn primary">Enregistrer les paramètres</button>` : ''}` });
    },
    stockParamsSave(f, fd) { const it = R.stockItem(fd.get('id')); it.seuil = +fd.get('seuil'); it.cmm = +fd.get('cmm'); it.delaiLivraison = +fd.get('delai'); R.touch(); R.closeModal(); R.toast('Paramètres de stock enregistrés', 'good'); R.render(); },
    stockMouvement(el) {
      const id = el.dataset.id || S.stock[0].articleId; const it = R.stockItem(id);
      R.modal({ title: 'Mouvement de stock', form: 'mouvementSave', body: `<div class="form-grid">
        <div class="field span2"><label>Article</label><select name="articleId" data-change="mouvementArticle">${opt(S.stock, s => s.articleId, s => R.article(s.articleId).libelle, id)}</select></div>
        <div class="field"><label>Type</label><select name="type"><option value="entree">Entrée (réception PUI)</option><option value="sortie">Sortie (dispensation / préparation)</option><option value="ajustement">Ajustement d’inventaire</option><option value="retrait">Retrait (périmé, cassé, rappel de lot)</option></select></div>
        <div class="field"><label>Quantité</label><input type="number" name="qte" value="1" min="1" required></div>
        <div class="field"><label>Lot</label><select name="lot" id="mv-lot"><option value="__nouveau">Nouveau lot</option>${it.lots.map(l => `<option value="${esc(l.lot)}">${esc(l.lot)} — pér. ${R.fmtDate(l.peremption)} — ${l.qte} u.</option>`).join('')}</select></div>
        <div class="field"><label>N° de lot (si nouveau)</label><input type="text" name="lotNouveau" placeholder="ex. RMS26A007"></div><div class="field"><label>Péremption (si nouveau)</label><input type="date" name="peremption"></div>
        <div class="field span3"><label>Motif / référence</label><input type="text" name="motif" required placeholder="ex. réception commande PUI n°2026-0851"></div></div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Enregistrer le mouvement</button>` });
    },
    mouvementArticle(el) { const it = R.stockItem(el.value); const sel = document.getElementById('mv-lot'); sel.innerHTML = `<option value="__nouveau">Nouveau lot</option>` + it.lots.map(l => `<option value="${esc(l.lot)}">${esc(l.lot)} — pér. ${R.fmtDate(l.peremption)} — ${l.qte} u.</option>`).join(''); },
    mouvementSave(f, fd) {
      const it = R.stockItem(fd.get('articleId')); const type = fd.get('type'); let qte = +fd.get('qte'); let lotId = fd.get('lot');
      if (lotId === '__nouveau') { lotId = fd.get('lotNouveau') || R.uid('LOT').toUpperCase(); if (!it.lots.find(l => l.lot === lotId)) it.lots.push({ lot: lotId, peremption: fd.get('peremption') || R.addDays(R.today(), 365), qte: 0 }); }
      const l = it.lots.find(x => x.lot === lotId); if (!l) { R.toast('Lot introuvable', 'crit'); return; }
      if (type === 'entree') l.qte += qte; else if (type === 'ajustement') { l.qte = Math.max(0, l.qte + qte); } else { if (qte > l.qte) { R.toast(`Quantité supérieure au lot (${l.qte})`, 'crit'); return; } l.qte -= qte; }
      S.mouvements.unshift({ date: R.today(), type, articleId: it.articleId, qte, lot: lotId, motif: fd.get('motif'), par: S.user }); R.journal(`Mouvement de stock ${type} ${qte} × ${R.article(it.articleId).dci}`); R.touch(); R.closeModal(); R.toast('Mouvement enregistré', 'good'); R.render();
    }
  });

  /* ===================== ÉQUIPE & ACCÈS ===================== */
  R.pages.equipe = {
    render() {
      const w = R.can('equipe', 'w'); const sym = { rw: R.badge('good', 'Lecture · écriture'), r: R.badge('', 'Lecture'), v: R.badge('info', 'Validation'), '-': '<span class="muted">—</span>' };
      return `<div class="page-head"><div><h1>Équipe & accès</h1><p>${S.users.filter(u => u.actif).length} comptes actifs · droits par rôle, traçabilité des actions</p></div><div class="page-actions">${w ? `<button class="btn primary" data-action="userAjouter">${R.icon('plus')}Ajouter un membre</button>` : ''}</div></div>
      <section class="card mb16"><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Membre</th><th>Fonction</th><th>Rôle applicatif</th><th>Statut</th><th>Dernière activité</th>${w ? '<th></th>' : ''}</tr></thead><tbody>${S.users.map(u => `<tr class="${u.actif ? '' : 'done'}"><td><div class="row"><div class="avatar">${R.initials(u.prenom, u.nom)}</div><div class="name">${esc(R.userName(u.id))}${u.id === S.user ? ' <span class="tag">vous</span>' : ''}</div></div></td><td class="small">${esc(u.fonction)}</td><td>${w && u.id !== S.user ? `<select class="inline-input" data-change="userRole" data-id="${u.id}">${opt(Object.keys(R.ROLES), k => k, k => R.ROLES[k].label, u.role)}</select>` : `<span class="badge accent">${esc(R.ROLES[u.role].label)}</span>`}</td><td>${u.actif ? R.badge('good', 'Actif') : R.badge('', 'Désactivé')}</td><td class="small">${R.fmtDate(u.derniere)}</td>${w ? `<td class="actions">${u.id !== S.user ? `<button class="btn sm ${u.actif ? 'danger' : ''}" data-action="userToggle" data-id="${u.id}">${u.actif ? 'Désactiver' : 'Réactiver'}</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div></section>
      <div class="grid c21"><section class="card"><div class="card-head"><div><h2>Matrice des droits</h2><div class="sub">un rôle par compte ; le pharmacien valide les cures sans les administrer, l’IDE administre sans prescrire</div></div></div><div class="card-body flush tbl-wrap"><table class="tbl"><thead><tr><th>Module</th>${Object.keys(R.ROLES).map(r => `<th>${esc(R.ROLES[r].label)}</th>`).join('')}</tr></thead><tbody>${R.MODULES.map(m => `<tr><td><b>${esc(m.label)}</b></td>${Object.keys(R.ROLES).map(r => `<td>${sym[R.PERMS[r][m.id] || '-']}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>Journal d’activité</h2></div><div class="card-body"><ul class="timeline">${S.journal.slice(0, 12).map(j => `<li><div class="when">${R.fmtDate(j.date)} ${j.heure} · ${esc(R.userName(j.par))}</div><div class="small">${esc(j.txt)}</div></li>`).join('') || '<li class="muted small">Les actions de cette session (cures, mouvements, modifications) apparaîtront ici.</li>'}</ul></div></section></div>`;
    }
  };
  Object.assign(R.actions, {
    userAjouter() { R.modal({ title: 'Ajouter un membre de l’équipe', form: 'userSave', body: `<div class="form-grid"><div class="field"><label>Titre</label><select name="titre"><option value="">—</option><option>Dr</option><option>Pr</option></select></div><div class="field"><label>Nom</label><input type="text" name="nom" required></div><div class="field"><label>Prénom</label><input type="text" name="prenom" required></div><div class="field span2"><label>Fonction</label><input type="text" name="fonction" required placeholder="ex. IDE hôpital de jour, interne en pharmacie"></div><div class="field"><label>Rôle</label><select name="role">${opt(Object.keys(R.ROLES), k => k, k => R.ROLES[k].label, 'ide')}</select></div></div><div class="callout info">${Object.keys(R.ROLES).map(k => `<b>${R.ROLES[k].label}</b> : ${R.ROLES[k].desc}`).join('<br>')}</div>`, foot: `<button type="button" class="btn" data-action="closeModal">Annuler</button><button type="submit" class="btn primary">Créer le compte</button>` }); },
    userSave(f, fd) { S.users.push({ id: R.uid('u-'), nom: fd.get('nom').toUpperCase(), prenom: fd.get('prenom'), titre: fd.get('titre'), fonction: fd.get('fonction'), role: fd.get('role'), actif: true, derniere: R.today() }); R.journal(`Compte créé — ${fd.get('nom')}`); R.touch(); R.closeModal(); R.toast('Compte créé', 'good'); R.render(); },
    userRole(el) { const u = R.userById(el.dataset.id); u.role = el.value; R.journal(`Rôle modifié — ${u.nom} → ${R.ROLES[u.role].label}`); R.touch(); R.toast('Rôle mis à jour', 'good'); },
    userToggle(el) { const u = R.userById(el.dataset.id); u.actif = !u.actif; R.journal(`Compte ${u.actif ? 'réactivé' : 'désactivé'} — ${u.nom}`); R.touch(); R.render(); }
  });

  /* ===================== PARAMÈTRES ===================== */
  R.pages.parametres = {
    render() {
      const s = S.settings; const w = R.can('equipe', 'w') || R.can('stock', 'w');
      return `<div class="page-head"><div><h1>Paramètres</h1><p>Identité de l’établissement, capacité de l’HDJ et règles de gestion de stock</p></div></div>
      <form class="grid c11" data-form="settingsSave"><section class="card"><div class="card-head"><h2>Établissement</h2></div><div class="card-body form-grid"><div class="field span3"><label>Établissement</label><input type="text" name="etablissement" value="${esc(s.etablissement)}" ${w ? '' : 'readonly'}></div><div class="field span3"><label>Service</label><input type="text" name="service" value="${esc(s.service)}" ${w ? '' : 'readonly'}></div><div class="field span3"><label>Unité</label><input type="text" name="unite" value="${esc(s.unite)}" ${w ? '' : 'readonly'}></div><div class="field span2"><label>Chef de service</label><input type="text" name="chef" value="${esc(s.chef)}" ${w ? '' : 'readonly'}></div><div class="field"><label>Fauteuils HDJ</label><input type="number" name="fauteuils" value="${s.fauteuils}" min="1" ${w ? '' : 'readonly'}></div><div class="field span2"><label>Téléphone HDJ (carnet)</label><input type="text" name="telHDJ" value="${esc(s.telHDJ)}" ${w ? '' : 'readonly'}></div><div class="field"><label>Urgences (carnet)</label><input type="text" name="telUrgences" value="${esc(s.telUrgences)}" ${w ? '' : 'readonly'}></div></div></section>
      <div class="stack"><section class="card"><div class="card-head"><h2>Règles de gestion de stock</h2></div><div class="card-body form-grid"><div class="field"><label>Stock de sécurité (jours de CMM)</label><input type="number" name="stockSecuriteJours" value="${s.stockSecuriteJours}" ${w ? '' : 'readonly'}></div><div class="field"><label>Horizon de prévision (jours)</label><input type="number" name="horizonPrevisionJours" value="${s.horizonPrevisionJours}" ${w ? '' : 'readonly'}></div><div class="field"><label>Alerte péremption (jours)</label><input type="number" name="joursPeremptionAlerte" value="${s.joursPeremptionAlerte}" ${w ? '' : 'readonly'}></div></div><div class="card-foot">Stock de sécurité = CMM ÷ 30 × jours · Point de commande = CMM ÷ 30 × délai de livraison + sécurité · Quantité à commander = besoin prévisionnel + sécurité − stock.</div></section>
      ${w ? `<div class="row" style="justify-content:flex-end"><button type="submit" class="btn primary">Enregistrer</button></div>` : ''}
      <section class="card"><div class="card-head"><h2>Données de démonstration</h2></div><div class="card-body"><p class="small ink2" style="margin-top:0">Ce prototype conserve vos modifications dans ce navigateur uniquement. Le jeu de démonstration se recale automatiquement sur la semaine en cours tant qu’aucune modification n’a été faite.</p><button type="button" class="btn danger" data-action="resetDemoConfirm">Réinitialiser les données de démonstration</button></div></section></div></form>`;
    }
  };
  Object.assign(R.actions, {
    settingsSave(f, fd) { ['etablissement', 'service', 'unite', 'chef', 'telHDJ', 'telUrgences'].forEach(k => S.settings[k] = fd.get(k)); ['fauteuils', 'stockSecuriteJours', 'horizonPrevisionJours', 'joursPeremptionAlerte'].forEach(k => S.settings[k] = +fd.get(k)); R.touch(); R.toast('Paramètres enregistrés', 'good'); R.render(); },
    resetDemoConfirm() { R.confirmer('Réinitialiser les données ?', 'Toutes les modifications faites dans ce navigateur seront perdues et le jeu de démonstration sera régénéré sur la semaine en cours.', 'resetDemo'); }
  });
})(window.RYZE);
