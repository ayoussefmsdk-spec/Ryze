# video/ — studio d'enregistrement des films de démonstration HDJ

Bibliothèque (`studio.js`) pour filmer l'application `app/index.html` avec les
calques de la direction artistique (`docs/VIDEO-SCENARIO.md`, § 1 et § 4) :
cartons verts avec logo sur plaque blanche, pastille de chapitre, sous-titres
« lower third », curseur à trajectoire courbe, anneau de clic, zooms nets,
rampes de vitesse, fondus, barre de progression. Sans son. Base de
démonstration **fictive** uniquement.

| Fichier | Rôle |
|---|---|
| `studio.js` | la bibliothèque (`ouvrir()` → objet studio) |
| `essai.js` | essai de ~26 s qui utilise toute l'API |
| `controle.js` | contrôle qualité d'un mp4 (ffprobe, planche, images clés, minutage, écart au scénario) |
| `scenes.js` | les scènes des films (une fonction `async (st, v)` par scène, variante `longue` ou `courte`) |
| `longue.js` | version longue (≈ 4 min 30, 10 chapitres) |
| `courte.js` | version courte (≈ 90 s, 8 plans), mêmes scènes en variante « courte » |

## Rendre les deux films de démonstration

Base vitrine `demo/vitrine.json` (31 dossiers fictifs), code `AAA111`
(Dr Y. MOUSSADDEK), horloge de la page figée au lundi 9/11/2026 10:00
(`ouvrir({ horloge })`) : le film est identique quel que soit le jour du rendu.
Le profil Chromium est jetable : la séance marquée réalisée et le dossier
fictif créé pendant le film n'existent que dans ce profil.

```sh
export NODE_PATH=$(npm root -g)
SP=/tmp/claude-0/-home-user-Ryze/d683416b-3238-53e6-a9a0-b6d3024a5424/scratchpad   # sorties hors du dépôt
node video/longue.js --ips 24                  # essai (≈ 8 min) → $SP/video/longue/
node video/longue.js                           # final 60 i/s (≈ 17 min)
node video/longue.js --segment documents       # refaire un seul chapitre (les autres sont repris)
node video/controle.js $SP/video/longue/HDJ-demo-longue.mp4
node video/courte.js --ips 24 && node video/courte.js
node video/controle.js $SP/video/courte/HDJ-demo-courte.mp4
```

Segments de la version longue : `ouverture`, `connexion`, `tableau-de-bord`,
`dossier-patient`, `nouveau-dossier`, `planning`, `documents`, `rapport`,
`securite`, `fin` ; de la version courte : `ouverture`, `tableau-de-bord`,
`dossier`, `planning`, `carnet`, `rapport`, `securite`, `fin`. Les durées
prévues par le scénario sont passées à `ouvrir({ prevu })` et contrôlées par
`controle.js` (± 10 % par segment) ; `DUREE` (barre de progression) est la
durée réelle mesurée. Après un `--segment` qui change la durée d'un segment,
rendre le film entier (le minutage des segments repris serait décalé).

Choix de mise en scène propres à ces films (voir les commentaires de
`scenes.js`) : pastille de chapitre en haut à droite (`pastille: { right: 16,
top: 72 }`) pour ne pas couvrir la marque « HDJ » du menu ; zooms par
`cadrer()` (l'élément est amené au-dessus du sous-titre avant le zoom) ; la
carte « Sauvegarde automatique sur le disque » est montrée repliée, car son
texte cite le nom technique des fichiers de sauvegarde.

## Lancer

```sh
export NODE_PATH=$(npm root -g)
node video/essai.js --ips 24              # rendu rapide (cadrage, durées)
node video/essai.js                       # rendu final à 60 i/s
node video/essai.js --segment dossier     # ne refait que ce segment (les autres sont repris)
node video/controle.js <scratchpad>/video/essai/HDJ-essai.mp4
```

Sorties (jamais dans le dépôt : `ouvrir()` refuse un dossier de sortie dans le
dépôt) : `seg-XX-nom.mp4` (un fichier par segment), le film assemblé,
`minutage.json` ; `controle.js` ajoute `planche.jpg`, `images/` et
`controle.txt` à côté du film.

Options de ligne de commande lues par `studio.arguments()` : `--ips N`,
`--segment nom` (répétable ; nom, slug ou numéro), `--sortie dossier`,
`--base fichier.json`.

## Squelette d'un scénario

```js
const studio = require('./studio');
const a = studio.arguments();
const st = await studio.ouvrir({ base: '/home/user/Ryze/demo/vitrine.json', code: 'MED001', ips: a.ips || 60,
  sortie: '/chemin/scratchpad/video/longue', dureeTotale: 270, seulement: a.seulement });
try {
  await st.segment('ouverture');
  st.cacherCurseur();
  await st.carton({ titre: 'HDJ', sousTitre: '…', lignes: ['…'], duree: 6 });
  st.montrerCurseur();
  await st.segment('connexion');
  st.chapitre(1, 'Connexion');
  await st.sousTitre('Un code personnel par soignant', 'deux niveaux d’accès…');
  await st.connexion();
  // …
  await st.segment('fin');
  await st.cartonFin({ auteurs: '…', encadrant: '…', service: '…', note: '…' });
  await st.assembler('HDJ-demo-longue.mp4');
} finally { await st.fermer(); }
```

Règles : toutes les méthodes sont `async` sauf `chapitre`, `cacherCurseur`,
`montrerCurseur` ; durées en **secondes** ; une image = un pas de temps
(`1 / ips`). Une `cible` est un sélecteur Playwright (CSS, `:has-text("…")`,
`>> nth=1`…) ou un point `{ x, y }` en pixels d'écran. Le temps du film
courant est `st.t` (s) ; la page Playwright est `st.page`.

## API

### Ouverture, segments, assemblage

- **`ouvrir(options)`** → studio. Options : `base` (chemin JSON ou `null` = démo
  intégrée, figée : `RYZE.S.dirty = true; RYZE.save()`), `code` (`'MED001'`),
  `ips` (60), `sortie`, `largeur`/`hauteur` (1920×1080), `dureeTotale` (s, pour
  la barre de progression ; absente = pas de barre), `seulement` (noms de
  segments à rendre, les autres sont repris), `pastille` (`{ left, top }` ou
  `{ right, top }` pour l'ancrer à droite ; défaut 8/8), `horloge` (date ISO :
  `Date` de la page figée par `page.clock.setFixedTime`, minuteries normales),
  `prevu` (`{ segment: secondes }`, durées du scénario recopiées dans
  `minutage.json` et contrôlées par `controle.js`), `fuseau` (ex. `'Africa/Casablanca'`), `dialogues`
  (`'accepter'` par défaut ou `'refuser'` pour `confirm()`), `qualite` (JPEG,
  90), `preset`/`crf` (`slow`/19), `interdits` (RegExp de textes interdits à
  l'écran, défaut : Ryze, undefined, NaN, [object Object]), `silencieux`.
  Profil Chromium jetable, viewport 1920×1080, thème clair, `fr-FR`, polices
  attendues.
- **`segment(nom)`** : ferme le segment en cours et ouvre `seg-XX-nom.mp4`
  (ffmpeg dédié). Une image capturée hors segment ouvre un segment `film`.
- **`finSegment()`** : termine l'encodage du segment (appelée par `segment`
  et `assembler`).
- **`assembler(nomFinal)`** → `{ film, minutage, duree }` : concat demuxer
  sans ré-encodage + `minutage.json` (segments, chapitres, sous-titres avec
  `affichage` et `complement`, cartons, zooms, rampes, textes interdits vus,
  vitesse de rendu).
- **`fermer()`** : ferme ffmpeg et le navigateur ; renvoie le bilan de rendu.

```js
await st.segment('dossier');  …  await st.assembler('HDJ-demo-courte.mp4');
```

### Cartons, chapitres, sous-titres

- **`carton({ titre, sousTitre, lignes, logo = true, duree = 3, cascade = true, entree = 0, sortie = 0.4, tailleTitre = 96, ecart = 0.3, sortieContenu, pendant })`**
  Fond `#14332E`, logo de l'établissement (`R.etab().logo`) sur plaque
  blanche (jamais sur le vert ; sans logo, la plaque est retirée), éléments en
  cascade (fondu + glissement 12 px sur 0,5 s, 0,3 s d'écart), fondu de sortie
  vers l'application. `entree` = fondu au vert. `lignes` : chaînes ou
  `{ texte, forte: true }`. `pendant(page, st)` s'exécute quand le carton
  couvre l'écran (navigation en coulisse, sans image). `sortieContenu: true`
  efface le contenu mais garde le vert.
  ```js
  await st.carton({ titre: 'HDJ', sousTitre: 'Gestion des biothérapies · Hôpital de jour', lignes: ['Unité …'], duree: 6 });
  ```
- **`cartonChapitre(numero, titre, { duree = 1.0, entree = 0.4, sortie = 0.4, logo, pendant })`** :
  fondu au vert 0,4 s + carton (numéro, titre, petit logo) ; la pastille du
  chapitre apparaît ensuite.
  ```js
  await st.cartonChapitre(3, 'Dossier patient', { pendant: async () => st.allerA('patients') });
  ```
- **`cartonFin({ mots, auteurs, encadrant, service, note, titre, titreMots, dureeMots = 6, dureeCredits = 9 })`** :
  « HDJ en quatre mots » (pastilles en cascade ; détails par défaut pour Sûr,
  Organisé, Documenté, Autonome, ou `{ mot, detail }`), puis générique avec
  logo ; se termine sur le vert.
- **`chapitre(numero, titre)`** (synchrone) : pastille « 03 · Dossier patient »
  en haut à gauche (fondu 0,3 s) ; `chapitre(null)` la retire.
- **`sousTitre(ligne1, ligne2)`** : lower third (carte `rgba(16,28,26,.88)` +
  flou, barre `#1C9C8A`, 34/22 px, entrée glissement 24 px + fondu 0,35 s).
  Remplace le précédent après sa sortie (0,25 s) : jamais deux à l'écran. Si le
  précédent est resté moins de 2,5 s, le studio filme d'abord le complément
  (noté `complement` dans le minutage). Les animations se déroulent pendant les
  actions suivantes (non bloquant).
- **`effacerSousTitre()`** : sortie 0,25 s (même garantie de 2,5 s). Un
  carton efface le sous-titre en cours.

### Curseur, clics, saisie

- **`vers(cible, duree?)`** : trajectoire courbe, ease in-out (durée auto
  0,5–1,1 s selon la distance) ; si la cible est sous la barre du haut ou
  derrière le sous-titre, défilement doux d'abord. Le survol réel (`:hover`)
  est appliqué à l'arrivée.
- **`deplacer(x, y, duree?)`**, **`survoler(cible, duree = 0.6)`**,
  **`cacherCurseur()`**, **`montrerCurseur()`**.
- **`clic({ apres = 0.15, button, clickCount })`** : anneau de clic (0,2 s)
  puis vrai clic souris au point du curseur. Pendant un zoom, un clic sur un
  élément `[data-go]` (navigation) dézoome d'abord puis retrouve la cible.
- **`cliquer(cible, opts)`** = `vers` + `clic`.
- **`naviguer(cible, { attente = 0.4 })`** : dézoom si besoin, `vers` + `clic`,
  attente de stabilité, ré-injection des calques si le document a changé,
  contrôle des textes interdits.
  ```js
  await st.naviguer('.nav [data-go="patients"]');
  ```
- **`taper(cible, texte, { rampe = true, caracteresParSeconde = 9, vitesseMax = 3, effacer, apres = 0.25 })`** :
  clic dans le champ puis frappe par `page.keyboard.type` (écouteurs de
  l'application déclenchés) ; rampe 1× → 3× → 1× (accélération sur 0,6 s,
  décélération planifiée pour finir à 1×). Un texte court n'atteint pas 3×.
  `cible = null` tape dans le champ qui a déjà le focus.
  ```js
  await st.taper('#f-q', 'Tazi', { rampe: true });
  ```
- **`appuyer(touche, apres = 0.3)`** (ex. `'Enter'`).
- **`choisir(cible, valeur, { apres })`** : `<select>` — curseur, anneau,
  focus visible, `selectOption` (la liste native n'est pas dessinée en
  headless : seul le changement de valeur se voit).
- **`connexion({ visible = true, code, rampe })`** : saisie filmée du code de
  `ouvrir({ code })` puis « Entrer » ; `visible: false` = en coulisse.

### Caméra, défilement, fondus, temps

- **`zoom(cible, echelle?, duree = 1.0)`** : zoom progressif (ease in-out)
  centré sur l'élément, échelle bornée 1–1,8 (sans échelle : ajustée à
  l'élément, ≤ 1,8). Le cadre reste dans la page (pas de bord vide), le
  curseur suit le contenu. Appliqué à `#app` et aux fenêtres `#modal-root`,
  jamais aux calques.
- **`dezoom(duree = 0.8)`** : retour à 1×.
  ```js
  await st.zoom('.dose-calculee', 1.6, 1.0); await st.attendre(2); await st.dezoom();
  ```
- **`defiler(cible | deltaY, { duree, rampe, vitesse = 650, position = 0.36, conteneur })`** :
  défilement doux du conteneur défilant de la cible (ou de celui sous le
  curseur, sinon la fenêtre). Avec une cible, son haut est amené à 36 % de la
  zone visible. `rampe` (auto au-delà de 1 400 px) : profil 1× → 3× → 1×.
  ```js
  await st.defiler(1800, { rampe: true });   await st.defiler('.courbes');
  ```
- **`attendre(duree)`**, **`images(n)`**, **`image()`** (une image).
- **`fondu(duree = 0.4, couleur = '#14332E')`** : voile vers la couleur ;
  **`retourFondu(duree)`** : retour ; **`voiler(opacite, duree, couleur)`** :
  voile à une opacité donnée. Un carton couvre et remet le voile à zéro.
- **`fonduEnchaine(duree, action)`** : image figée de l'écran (sans
  calques), `action(page, st)` en coulisse, puis l'image s'efface sur le
  nouvel écran (fondu croisé).
  ```js
  await st.fonduEnchaine(0.4, () => st.allerA('patient', { id: 'p3', tab: 'plan' }));
  ```
- **`coulisse(fn)`** : exécute `fn(page, st)` sans image ni temps qui passe.
- **`allerA(route, params)`** : `RYZE.go` sans image, caméra à 1×.
- **`evaluer(fn, arg)`** : `page.evaluate`.
- **`stable()`** : 2 `requestAnimationFrame` + polices (fait automatiquement
  avant chaque capture).
- **`verifierCalques()`** → `{ present, injections }` ;
  **`controlerTexte()`** : relève les textes interdits visibles.

## Choix techniques

- **Captures sans disque** : chaque image est une capture CDP
  `Page.captureScreenshot` (JPEG 90) écrite sur l'entrée standard de ffmpeg
  (`-f image2pipe -c:v mjpeg -i -`), avec contre-pression (`drain`). Encodage
  `libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart`.
- **Temps déterministe** : l'état des calques (curseur, sous-titre, pastille,
  carton, voile, caméra, défilement) est calculé en Node pour chaque image puis
  appliqué dans la page (`window.__studio.appliquer`, installé par
  `addInitScript` dans chaque document) ; 2 rAF + `document.fonts.ready`
  avant chaque capture.
- **Calques** : un seul conteneur `#vs-racine` (`position:fixed`,
  `pointer-events:none`, z-index maximal) ajouté à `document.body`, hors de
  `#app` : les re-rendus de `#app` (`innerHTML`) ne le touchent pas ; il est
  ré-injecté automatiquement s'il disparaît (rechargement, `body` remplacé).
  Vérifié par l'essai après navigation, carnet et document imprimable : aucune
  ré-injection nécessaire. Tous les textes passent par `textContent` ou par un
  échappement HTML (`esc`).
- **Zoom net** : `transform: translate() scale()` posé à chaque image sur
  `#app` (origine 0 0, sans `will-change` ni transition) : Chromium
  re-rastérise le texte à l'échelle courante, le texte est net à 1,6–1,8×
  (vérifié sur des images du film, pendant et après le zoom). La propriété
  `zoom` et `deviceScaleFactor: 2` n'ont pas été nécessaires. Les clics
  pendant un zoom visent `boundingBox()` (coordonnées transformées) et
  atteignent la bonne cible ; dézoom automatique avant navigation.
- **Segments** : un mp4 par segment, mêmes réglages partout, concaténés sans
  ré-encodage ; `--segment nom` rejoue tout le scénario mais ne capture que
  ce segment (les autres sont « muets » : actions jouées, images comptées,
  fichiers existants repris ; un nombre d'images différent est signalé).
- **Fichiers locaux uniquement** ; Chromium lancé sans trafic de fond.
- **Langue** : Chromium est lancé avec `LANG=fr_FR.UTF-8`, `LANGUAGE=fr` et
  `--lang=fr-FR` ; sans cela les champs date et heure natifs s'affichent à
  l'américaine (« 11/09/2026 », « 08:00 AM ») malgré `locale: 'fr-FR'`.

## Vitesse mesurée (essai, 4 cœurs)

- 60 i/s : ≈ 16 images rendues par seconde (capture ≈ 54 ms/image, encodage
  en parallèle) → un film de 4 min 30 (16 200 images) ≈ **17 min** ; la
  version courte (5 400 images) ≈ 6 min.
- 24 i/s : ≈ 13–14 images/s → 4 min 30 ≈ 8 min.
- Un segment seul se refait avec `--segment` (les autres passent en quelques
  secondes).

## Limites connues

- Les animations et minuteries **de l'application** (transitions CSS,
  messages `toast` de 4 s, recherches différées) tournent en temps réel, pas
  au temps du film : le rendu étant ~4× plus lent que le temps réel à 60 i/s,
  un message de 4 s ne reste ≈ 1 s dans le film. Pour un message à lire,
  filmer juste après l'action ou le doubler d'un sous-titre.
- La pastille de chapitre (en haut à gauche par défaut) recouvre la marque
  « HDJ » du menu (les films la placent en haut à droite) ; le sous-titre recouvre le bas gauche (pied du menu et bas du
  contenu) : `vers` fait défiler une cible située derrière, mais un zoom ou une
  capture sur cette zone doit en tenir compte. Position réglable
  (`ouvrir({ pastille })`).
- Pendant un zoom, les éléments `position: fixed` internes à `#app`
  (infobulles, menu mobile) se positionnent par rapport à `#app` ; les
  messages (`#toast-root`) ne sont pas zoomés.
- `RYZE.go` remet le défilement en haut : enchaîner les défilements après la
  navigation.
- Les listes déroulantes natives (`<select>`) et les boîtes `confirm()` ne
  sont pas dessinées en headless (les `confirm()` sont acceptées par défaut).
- La barre de progression suit `dureeTotale` : la mettre à la durée réelle
  mesurée (l'essai et `controle.js` signalent un écart).
- `controle.js` ne lit pas le texte des images : « aucun Ryze, aucun anglais »
  reste à vérifier à l'œil (le studio relève seulement les textes interdits
  présents dans le DOM visible).
