/* =====================================================================
   HDJ — video/controle.js : contrôle qualité d'un film rendu par le studio.
     node video/controle.js <film.mp4> [--minutage minutage.json] [--sortie dossier]
   - ffprobe : codec, dimensions, images/s, durée, nombre d'images ;
   - planche.jpg : une image toutes les 5 s en mosaïque (filtre tile), horodatée ;
   - images/ : 8 images pleines aux instants clés (sous-titres, zooms, cartons) ;
   - détection d'images noires ou blanches (blackdetect) ;
   - minutage.json : sous-titres ≥ 2,5 s, compléments ajoutés, segments
     cohérents avec la durée du film, durée annoncée (± 10 %).
   Résumé imprimé et écrit dans controle.txt (à côté de la planche).
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const args = process.argv.slice(2);
const film = args.find(a => !a.startsWith('--') && /\.mp4$/i.test(a));
if (!film || !fs.existsSync(film)) { console.error('usage : node video/controle.js <film.mp4> [--minutage minutage.json] [--sortie dossier]'); process.exit(2); }
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const dossier = path.resolve(opt('--sortie') || path.dirname(film));
const fMinutage = opt('--minutage') || path.join(path.dirname(film), 'minutage.json');
fs.mkdirSync(path.join(dossier, 'images'), { recursive: true });
const POLICE = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/freefont/FreeSans.ttf'].find(f => fs.existsSync(f));

const lignes = []; let alertes = 0;
const dire = s => { lignes.push(s); console.log(s); };
const alerte = s => { alertes++; dire('  ⚠ ' + s); };
const ff = a => spawnSync('/usr/bin/ffmpeg', ['-hide_banner', '-nostats', ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/* ---------- ffprobe ---------- */
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,avg_frame_rate,pix_fmt,nb_read_frames', '-show_entries', 'format=duration,size', '-of', 'json', film], { encoding: 'utf8' }));
const v = probe.streams[0], [a1, b1] = v.r_frame_rate.split('/').map(Number), ips = a1 / (b1 || 1), duree = +probe.format.duration;
dire(`Film : ${path.resolve(film)}`);
dire(`  ${v.codec_name} ${v.pix_fmt} · ${v.width}×${v.height} · ${+ips.toFixed(3)} i/s · ${duree.toFixed(2)} s · ${v.nb_read_frames} images · ${(probe.format.size / 1048576).toFixed(1)} Mo`);
if (v.width !== 1920 || v.height !== 1080) alerte(`dimensions ${v.width}×${v.height} (attendu 1920×1080)`);
if (v.pix_fmt !== 'yuv420p') alerte(`format de pixels ${v.pix_fmt} (attendu yuv420p)`);

/* ---------- minutage ---------- */
let M = null; try { M = JSON.parse(fs.readFileSync(fMinutage, 'utf8')); } catch (e) { alerte(`minutage illisible : ${fMinutage}`); }
if (M) {
  dire(`Minutage : ${path.resolve(fMinutage)}`);
  if (Math.abs(M.ips - ips) > 0.01) alerte(`ips du minutage ${M.ips} ≠ film ${ips}`);
  if (Math.abs(M.duree - duree) > 2 / ips + 0.05) alerte(`durée du minutage ${M.duree} s ≠ film ${duree.toFixed(3)} s`);
  if (M.dureeAnnoncee) { const e = (duree - M.dureeAnnoncee) / M.dureeAnnoncee; dire(`  durée annoncée ${M.dureeAnnoncee} s, réelle ${duree.toFixed(2)} s (${e >= 0 ? '+' : ''}${(e * 100).toFixed(1)} %)`); if (Math.abs(e) > 0.10) alerte('écart de durée > 10 % : ajuster dureeTotale (barre de progression) ou le scénario'); }
  dire('  Segments :');
  let fin = 0;
  (M.segments || []).forEach(s => { dire(`    ${String(s.numero).padStart(2, '0')} ${s.nom.padEnd(22)} ${s.debut.toFixed(2).padStart(7)} → ${s.fin.toFixed(2).padStart(7)} s  (${s.duree.toFixed(2)} s, ${s.images} images${s.imagesParSeconde ? `, rendu ${s.imagesParSeconde} i/s` : ''})`); if (Math.abs(s.debut - fin) > 1e-3) alerte(`segment ${s.nom} : début ${s.debut} ≠ fin du précédent ${fin}`); fin = s.fin; });
  if (Math.abs(fin - duree) > 2 / ips + 0.05) alerte(`somme des segments ${fin} s ≠ durée du film ${duree.toFixed(3)} s`);
  dire('  Chapitres : ' + ((M.chapitres || []).map(c => `${c.numero} ${c.titre} (${c.debut.toFixed(1)}–${c.fin.toFixed(1)} s)`).join(' · ') || 'aucun'));
  dire('  Sous-titres :');
  (M.sousTitres || []).forEach(s => { dire(`    ${s.debut.toFixed(2).padStart(7)} → ${s.fin.toFixed(2).padStart(7)} s  ${s.affichage.toFixed(2)} s  « ${s.ligne1} »${s.complement ? `  (+${s.complement.toFixed(2)} s ajoutées pour atteindre 2,5 s)` : ''}`); if (s.affichage < 2.5 - 1 / ips) alerte(`sous-titre « ${s.ligne1} » affiché ${s.affichage} s (< 2,5 s)`); });
  for (let i = 1; i < (M.sousTitres || []).length; i++) if (M.sousTitres[i].debut < M.sousTitres[i - 1].fin - 1e-3) alerte(`sous-titres superposés : « ${M.sousTitres[i - 1].ligne1} » / « ${M.sousTitres[i].ligne1} »`);
  if ((M.zooms || []).length) dire('  Zooms : ' + M.zooms.map(z => `${z.echelle}× ${z.debut.toFixed(1)}–${z.fin != null ? z.fin.toFixed(1) : '?'} s`).join(' · '));
  if ((M.zooms || []).some(z => z.echelle > 1.8 || z.echelle < 1)) alerte('zoom hors de 1–1,8×');
  if ((M.rampes || []).length) dire('  Rampes : ' + M.rampes.map(r => `${r.type} ${r.debut.toFixed(1)}–${r.fin.toFixed(1)} s${r.vitesseMax ? ` (pic ${r.vitesseMax}×)` : ''}`).join(' · '));
  if ((M.textesInterdits || []).length) M.textesInterdits.forEach(x => alerte(`texte interdit à l'écran (${x.segment}) : ${x.trouve}`));
  if (M.rendu) dire(`  Rendu : ${M.rendu.images} images capturées en ${M.rendu.secondes} s → ${M.rendu.imagesParSeconde} i/s (capture ${M.rendu.msParCapture} ms/image)`);
}

/* ---------- planche (une image toutes les 5 s) ---------- */
const nPlanche = Math.max(1, Math.floor(duree / 5) + 1), col = 4, rangs = Math.ceil(nPlanche / col);
const horo = POLICE ? `,drawtext=fontfile=${POLICE}:text='%{pts\\:hms}':x=w-tw-14:y=12:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6` : '';
const planche = path.join(dossier, 'planche.jpg');
let r = ff(['-y', '-loglevel', 'error', '-i', film, '-vf', `select='isnan(prev_selected_t)+gte(t-prev_selected_t\,4.999)'${horo},scale=480:-2,tile=${col}x${rangs}:padding=8:margin=8:color=white`, '-fps_mode', 'passthrough', '-frames:v', '1', '-q:v', '3', planche]);
if (r.status !== 0) alerte('planche : ' + r.stderr.trim()); else dire(`Planche : ${planche} (${nPlanche} images, ${col}×${rangs})`);

/* ---------- 8 images aux instants clés ---------- */
const cles = [];
if (M) {
  (M.zooms || []).forEach(z => cles.push({ t: z.atteint != null ? z.atteint + 0.3 : z.debut + 1.2, q: 'zoom' }));
  (M.cartons || []).forEach(c => cles.push({ t: Math.min(c.fin - 0.5, c.debut + 1.6), q: 'carton-' + (c.type || '') }));
  (M.sousTitres || []).forEach(s => cles.push({ t: s.debut + Math.min(1.2, s.affichage / 2), q: 'sous-titre' }));
  (M.rampes || []).forEach(x => cles.push({ t: (x.debut + x.fin) / 2, q: 'rampe-' + x.type }));
}
/* priorité : zooms, cartons, sous-titres, rampes (ordre d'insertion), puis tri chronologique */
let choisies = cles.filter(c => c.t > 0 && c.t < duree - 0.05).filter((c, i, l) => !l.slice(0, i).some(d => Math.abs(d.t - c.t) < 0.8)).sort((a, b) => a.t - b.t);
while (choisies.length > 8) { /* on retire l'instant le plus proche de son voisin */ let k = 1, m = Infinity; for (let i = 1; i < choisies.length; i++) { const d = choisies[i].t - choisies[i - 1].t; if (d < m) { m = d; k = i; } } choisies.splice(k, 1); }
for (let i = 1; choisies.length < 8; i++) { const t = duree * i / 9; if (!choisies.some(c => Math.abs(c.t - t) < 0.8)) choisies.push({ t, q: 'regulier' }); if (i > 40) break; }
choisies.sort((a, b) => a.t - b.t);
fs.readdirSync(path.join(dossier, 'images')).filter(f => f.endsWith('.jpg')).forEach(f => fs.rmSync(path.join(dossier, 'images', f)));
choisies.slice(0, 8).forEach((c, i) => { const f = path.join(dossier, 'images', `${String(i + 1).padStart(2, '0')}-${c.t.toFixed(2)}s-${c.q}.jpg`); const x = ff(['-y', '-loglevel', 'error', '-ss', c.t.toFixed(3), '-i', film, '-frames:v', '1', '-q:v', '2', f]); if (x.status !== 0) alerte('image ' + f + ' : ' + x.stderr.trim()); });
dire(`Images clés : ${path.join(dossier, 'images')}/ (${choisies.slice(0, 8).map(c => c.t.toFixed(1) + ' s ' + c.q).join(', ')})`);

/* ---------- images noires / blanches ---------- */
const plages = (vf) => { const x = ff(['-i', film, '-vf', vf, '-an', '-f', 'null', '-']); return [...(x.stderr || '').matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map(m => [+m[1], +m[2]]); };
const noires = plages('blackdetect=d=0:pix_th=0.08:pic_th=0.98'), blanches = plages('negate,blackdetect=d=0:pix_th=0.04:pic_th=0.98');
if (noires.length) noires.forEach(([a, b]) => alerte(`image(s) noire(s) ${a.toFixed(2)}–${b.toFixed(2)} s`)); else dire('Aucune image noire.');
if (blanches.length) blanches.forEach(([a, b]) => alerte(`image(s) blanche(s) ${a.toFixed(2)}–${b.toFixed(2)} s`)); else dire('Aucune image blanche.');

dire(alertes ? `Bilan : ${alertes} alerte(s) — relire les images.` : 'Bilan : aucune alerte automatique — relire la planche et les images clés (texte net, sous-titres, cartons, aucun « Ryze »).');
fs.writeFileSync(path.join(dossier, 'controle.txt'), lignes.join('\n') + '\n');
process.exit(alertes ? 1 : 0);
