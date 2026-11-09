# HDJ — scénario des vidéos de démonstration

> Deux films sans voix ni musique, sous-titres en français, à partir de la **base de démonstration vitrine** (`demo/vitrine.json`, patients fictifs uniquement).
> **Version longue** : 4 min 30 ± 15 s (journée de présentation, commentée en direct par le présentateur).
> **Version courte** : 90 s ± 5 s (congrès, projetée pendant la communication).

---

## 1. Direction artistique

**Image** : 1920 × 1080, 60 images/s, thème clair de l'application (meilleure lisibilité sur vidéoprojecteur), fenêtre de l'application plein cadre (pas de barre d'adresse : rendu « mode application »).

**Cartons** (ouverture, chapitres, fin) : fond vert profond `#14332E`, texte blanc, logo GST sur une plaque blanche arrondie (le logo est en couleur sur fond blanc : ne jamais le poser directement sur le vert). Titre en IBM Plex Sans 600, sous-titre en 400. Apparition : fondu + léger glissement vertical (12 px) sur 0,5 s ; sortie : fondu 0,4 s vers l'application.

**Sous-titres (« lower third »)** : en bas à gauche, à 56 px du bord, carte sombre translucide `rgba(16,28,26,.88)` avec flou d'arrière-plan, coin arrondi 14 px, barre d'accent verticale `#1C9C8A` de 5 px à gauche.
- Ligne 1 : 34 px, graisse 600, blanc — *ce que l'on voit*.
- Ligne 2 : 22 px, graisse 400, blanc à 82 % — *pourquoi c'est utile*.
- Entrée : glissement depuis la gauche de 24 px + fondu sur 0,35 s ; sortie : fondu 0,25 s. Jamais deux sous-titres superposés ; **un sous-titre reste au moins 2,5 s** à l'écran (lecture confortable).
- Pastille de chapitre en haut à gauche : « 03 · Dossier patient », 18 px, fond blanc 90 %, texte vert `#14332E`, apparaît avec le chapitre, visible pendant tout le chapitre.
- Barre de progression de 4 px en bas du cadre, couleur `#1C9C8A`, proportionnelle au temps écoulé.

**Curseur** : flèche blanche à contour sombre (26 px), ombre portée ; trajectoires courbes avec accélération/décélération (ease in-out) ; anneau de clic vert `#1C9C8A` qui s'agrandit et disparaît en 0,2 s.

**Zooms** : échelle appliquée au contenu de l'application (transformation CSS sans `will-change`, pour garder le texte net), entre 1× et 1,8×, toujours progressifs (0,8–1,2 s, ease in-out), centrés sur l'élément commenté ; retour à 1× avant tout changement de page. Un zoom accompagne **chaque chiffre important** (dose, cible, taux de réalisation) et chaque texte bilingue.

**Rampes de vitesse** : les saisies de formulaire et les défilements longs passent progressivement de 1× à 3× puis reviennent à 1× (sur 0,6 s de part et d'autre), jamais de coupure sèche ; le sous-titre reste lisible pendant la rampe. Les moments clés (résultat affiché, document rendu) repassent à vitesse réelle, avec une pause de 1,5–2,5 s.

**Transitions entre chapitres** : fondu au vert 0,4 s + carton de chapitre 1,4 s, ou simple fondu croisé 0,4 s pour les chapitres enchaînés (indiqué dans le tableau).

**Rythme général** : jamais plus de 6 s sans mouvement (curseur, zoom, défilement, nouveau sous-titre).

**Interdits** : aucun nom réel, aucune donnée réelle ; aucun « Ryze » visible (le nom affiché est « HDJ ») ; pas de barre d'adresse, pas de fenêtres système ; pas de texte en anglais ; pas de curseur immobile sur un bouton pendant plus de 1 s avant un clic.

---

## 2. Version longue (≈ 4 min 30)

| # | Chapitre | Durée | Transition |
|---|---|---|---|
| 0 | Ouverture | 0:00 – 0:08 | carton |
| 1 | Connexion | 0:08 – 0:18 | fondu |
| 2 | Tableau de bord | 0:18 – 0:42 | carton |
| 3 | Dossier patient | 0:42 – 1:40 | carton |
| 4 | Nouveau dossier | 1:40 – 2:05 | carton |
| 5 | Planning et feuille du jour | 2:05 – 2:35 | carton |
| 6 | Documents | 2:35 – 3:30 | carton |
| 7 | Rapport d'activité | 3:30 – 3:55 | carton |
| 8 | Sécurité et autonomie | 3:55 – 4:15 | carton |
| 9 | Fin | 4:15 – 4:30 | carton |

### 0 · Ouverture (8 s)
Carton : logo GST sur plaque blanche → titre **« HDJ »** (96 px) → sous-titre « Gestion des biothérapies · Hôpital de jour » → ligne fine « Unité de Gastro-entérologie, Hépatologie et Nutrition Pédiatrique · Hôpital d'Enfants Abderrahim El Harouchi · CHU Ibn Rochd, Casablanca ». Les quatre éléments apparaissent en cascade (0,3 s d'écart). Fondu vers l'écran de connexion.

### 1 · Connexion (10 s)
- Écran de connexion : badge « HDJ », logo et nom de l'établissement visibles.
- Le curseur va au champ, saisie du code du médecin (rampe légère), validation.
- Sous-titre : **« Un code personnel par soignant »** / *deux niveaux d'accès : médecins et équipe de l'HDJ*.

### 2 · Tableau de bord (24 s)
- Vue d'ensemble 1,5 s, puis zoom 1,5× sur **« Ma journée »** : les séances du jour (fauteuil, heure, molécule, dose).
  Sous-titre : **« Tout ce qui se passe aujourd'hui »** / *séances du jour, patients attendus, fauteuils*.
- Dézoom, zoom sur **« À traiter »** : retards, contrôles en attente, alertes (poids à mesurer, réaction antérieure).
  Sous-titre : **« Rien n'est oublié »** / *retards, contrôles à faire et alertes remontent d'eux-mêmes*.
- Survol court du graphique « Séances de perfusion réalisées par mois » (zoom 1,3×).
  Sous-titre : **« L'activité en un coup d'œil »**.

### 3 · Dossier patient (58 s) — le cœur du film
Patient vitrine : **adolescent·e atteint·e de maladie de Crohn avec atteinte périnéale, sous infliximab, 2 cycles de traitement** (voir `demo/README.md` pour le nom fictif et le détail).
1. Liste des patients → saisie de la recherche (rampe), clic sur la ligne. Sous-titre : **« La file active »** / *recherche, pathologie, biothérapie, prochaine séance*. (6 s)
2. En-tête du dossier : identité, classification de Paris, voie et molécule, poids récent. Zoom 1,4× sur la bandeau **statut / sécurité** (allergie, réaction antérieure, prémédication). Sous-titre : **« La sécurité d'abord »** / *allergies, réactions et prémédication toujours visibles*. (7 s)
3. Onglet **Plan** : prochaine séance, **dose calculée au poids** (mg/kg → mg → flacons), prémédication. Zoom 1,6× sur la dose. Sous-titre : **« La dose se calcule toute seule »** / *mg/kg, paliers de poids ou dose fixe · alerte si le poids varie de plus de 10 %*. (8 s)
4. Onglet **Cures** : l'historique des cycles (induction → entretien → optimisation), chaque changement daté. Zoom sur la ligne d'optimisation. Sous-titre : **« Le traitement par cycles »** / *changement de molécule, optimisation, suspension, reprise : tout est tracé*. (7 s)
5. Onglet **Séances** : clic sur « Séance réalisée », formulaire (poids du jour, dose, lot, tolérance, constantes) saisi en **rampe 3×**, validation ; la ligne apparaît dans le tableau. Sous-titre pendant la saisie : **« Une séance en 30 secondes »** / *poids, lot, tolérance, constantes, examen clinique* ; après validation : **« Et la prochaine séance est déjà planifiée »**. (12 s)
6. Onglet **Surveillance** : dosages (TDM) avec la **cible pédiatrique** affichée (≥ 10 µg/mL, atteinte périnéale) et la remarque du médecin ; zoom 1,6× sur la cible et le constat. Sous-titre : **« Dosages avec cibles pédiatriques »** / *cible adaptée à l'atteinte périnéale, figée au moment du dosage*. (7 s)
7. Courbes : poids, taille, IMC, CRP, calprotectine, taux résiduel ; passage de l'une à l'autre (2 clics), zoom 1,3× sur la calprotectine qui redescend. Sous-titre : **« Les courbes qui comptent »** / *croissance et inflammation, zones de référence pédiatriques*. (6 s)
8. Onglet **Bilan** : « À retenir » (anomalies et examens en attente), puis notes d'équipe avec note épinglée. Sous-titre : **« Ce que l'équipe doit savoir »** / *bilan pré-biothérapie, notes épinglées*. (5 s)

### 4 · Nouveau dossier (25 s)
- « Nouveau dossier » → assistant en 3 étapes. Étape 1 (identité, maladie) saisie en rampe 3× ; étape 2 (protocole, variante, induction/entretien) à vitesse normale avec zoom sur l'aperçu des doses calculées ; étape 3 (surveillance, séances déjà réalisées) en rampe ; création.
- Sous-titres : **« Un dossier en trois étapes »** / *identité, maladie, protocole* → **« Le protocole propose, le médecin décide »** / *doses, induction, plan de surveillance ajustables* → **« La saisie rétrospective »** / *les séances déjà faites sont reprises sans rien perdre*.
- Fin : le dossier créé s'affiche avec son plan ; pause 1,5 s.

### 5 · Planning et feuille du jour (30 s)
- Planning de la semaine : fauteuils et créneaux, capacité, jours d'ouverture ; zoom 1,4× sur une journée pleine. Sous-titre : **« Les fauteuils, sans double réservation »** / *capacité, créneaux, jours d'ouverture*. (8 s)
- Calendrier du mois : survol, zoom léger. Sous-titre : **« Le mois en un écran »**. (5 s)
- Clic « Feuille du jour » : la feuille imprimable ; défilement lent, zoom 1,5× sur une ligne (dose recalculée sur le dernier poids, flacons, prémédication, prélèvements avant perfusion, colonnes à remplir). Sous-titre : **« La feuille de l'infirmier·ère »** / *dose recalculée, flacons, prélèvements, alertes · colonnes à remplir à la main*. (12 s)
- Retour, bascule « semaine ». Sous-titre : **« Ou la semaine entière »**. (5 s)

### 6 · Documents (55 s)
Tous les documents portent l'en-tête de l'établissement avec le logo et l'identité du patient sur chaque page.
1. **Carnet de suivi A4** (soignants) : ouverture, défilement en rampe (6 pages), arrêt sur le tableau des séances puis sur les courbes. Sous-titre : **« Le carnet des soignants, 6 pages »** / *statut, à faire, séances, contrôles, notes épinglées, courbes*. (12 s)
2. **Carnet patient bilingue** (livret A5, 8 pages) : couverture (zoom sur le nom de l'hôpital et le bilingue), page des séances, page des consignes (« avant chaque séance je coche… »), carte détachable « Je suis sous biothérapie » (zoom 1,6× sur l'arabe). Sous-titres : **« Le carnet de la famille, en français et en arabe »** / *8 pages, remis une seule fois, dates à venir laissées en blanc* → **« La carte “Je suis sous biothérapie” »** / *à détacher et garder sur soi*. (18 s)
3. **Planification complète** : séances et contrôles sur une même liste ; défilement court. Sous-titre : **« Séances et contrôles sur une même page »**. (7 s)
4. **Compte rendu de suivi** : modèle prérempli (« tolérance et sécurité », dernière dose), le médecin tape sa conclusion (rampe), aperçu. Sous-titre : **« Le compte rendu, prérempli et modifiable »** / *conclusion libre du médecin*. (10 s)
5. Bouton « Exporter » d'un document : fichier `.html` autonome. Sous-titre : **« Imprimable ou exportable, en couleur ou en noir et blanc »**. (5 s)
Pour toute saisie de texte médical, les phrases sont neutres et fictives.

### 7 · Rapport d'activité (25 s)
- Rapport sur 12 mois : séances IV et SC séparées, taux de réalisation, réactions, reports par catégorie, consommation par molécule, heures-fauteuil, file active ; zoom 1,5× sur le taux de réalisation puis sur la consommation. Sous-titre : **« L'activité de l'HDJ, chiffrée »** / *IV et SC, réalisation, réactions, reports, consommation, heures-fauteuil*. (13 s)
- Bascule **« version anonymisée »** : les noms deviennent des lettres ; zoom 1,6× sur l'annexe « patients désignés par une lettre ». Sous-titre : **« Une version anonymisée pour l'administration »** / *aucun nom, les mêmes chiffres*. (8 s)
- « Synthèse pour le rapport » : zoom léger. Sous-titre : **« Prête à coller dans le rapport annuel »**. (4 s)

### 8 · Sécurité et autonomie (20 s)
- Paramètres → « Sauvegarde automatique sur le disque » : dossier choisi, dernière copie datée ; zoom sur la liste des copies. Sous-titre : **« Sauvegardée à chaque modification »** / *copie du jour sur clé ou disque, 90 jours puis une par mois*. (7 s)
- « Sauvegarde des données » : export manuel. Sous-titre : **« Aucune donnée ne sort de l'hôpital »** / *un seul PC, sans Internet ni serveur*. (5 s)
- Équipe & codes : deux niveaux de droits ; journal des actions (une suppression conservée). Sous-titre : **« Qui a fait quoi »** / *journal des actions, suppressions conservées*. (8 s)

### 9 · Fin (15 s)
- Carton 1 (6 s) — « HDJ en quatre mots », quatre pastilles qui apparaissent en cascade : **Sûr** (doses au poids, cibles pédiatriques) · **Organisé** (fauteuils, contrôles, rappels) · **Documenté** (carnets, comptes rendus, rapport) · **Autonome** (local, sans Internet, sauvegardé).
- Carton 2 (9 s) — logo GST ; « HDJ — Gestion des biothérapies » ; **Youssef Moussaddek · Ahmed Traifi** ; « Encadrement : Pr Bensabahia » ; « Unité de Gastro-entérologie, Hépatologie et Nutrition Pédiatrique — Service de Pédiatrie 3 — Hôpital d'Enfants Abderrahim El Harouchi — CHU Ibn Rochd, Casablanca » ; petite ligne : « Démonstration réalisée avec des patients fictifs ». Fondu au vert.

---

## 3. Version courte (≈ 90 s) — montage du congrès

Mêmes règles de style, rythme plus soutenu (sous-titres de 2,5–3 s, rampes plus franches), **8 plans** :

| # | Plan | Durée | Sous-titre |
|---|---|---|---|
| 1 | Carton d'ouverture (logo, « HDJ », service) | 0:00 – 0:05 | — |
| 2 | Tableau de bord, zoom « Ma journée » puis « À traiter » | 0:05 – 0:15 | **« Tout ce qui se passe aujourd'hui »** / *séances, retards, contrôles, alertes* |
| 3 | Dossier patient : dose calculée au poids (zoom), séance réalisée en rampe 3×, TDM avec cible pédiatrique (zoom) | 0:15 – 0:42 | **« La dose se calcule au poids »** → **« Une séance en 30 secondes »** → **« Dosages avec cibles pédiatriques »** |
| 4 | Planning de la semaine, puis feuille du jour (zoom sur dose recalculée et prélèvements) | 0:42 – 0:57 | **« Les fauteuils, sans double réservation »** → **« La feuille de l'infirmier·ère »** |
| 5 | Carnet patient bilingue : couverture, consignes, carte (zoom arabe) | 0:57 – 1:09 | **« Le carnet de la famille, en français et en arabe »** |
| 6 | Rapport d'activité, bascule anonymisée (zoom) | 1:09 – 1:19 | **« L'activité chiffrée, version anonymisée »** |
| 7 | Paramètres : sauvegarde automatique | 1:19 – 1:24 | **« Local, sans Internet, sauvegardé »** |
| 8 | Carton de fin : quatre mots + auteurs + encadrant | 1:24 – 1:30 | — |

---

## 4. Fabrication (pour l'agent de production)

- **Capture** : Playwright + Chromium (`/opt/pw-browsers/chromium`), `viewport 1920×1080`, `colorScheme: 'light'`, polices chargées (`document.fonts.ready`) avant la première image. La base vitrine est importée en début de script (localStorage `ryze-hdj-v1`), **dans un profil jetable** ; l'application réelle n'est pas modifiée.
- **Images** : une capture JPEG (qualité 90) par image de film, **envoyée directement à ffmpeg** (`-f image2pipe -framerate 60 -i -`) pour ne rien écrire sur le disque ; encodage `libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart`. Produire d'abord un **rendu d'essai à 24 images/s** de chaque chapitre pour valider le cadrage et les durées, puis le rendu final à 60.
- **Calques injectés dans la page** (curseur, anneau de clic, sous-titre, pastille de chapitre, barre de progression, carton, voile de fondu, conteneur de zoom) : tous en `position: fixed`, `pointer-events: none`, ré-injectés après chaque navigation ; le zoom s'applique à l'application, jamais aux calques.
- **Temps** : chaque image = un pas déterministe ; les rampes de vitesse multiplient le pas de saisie/défilement ; attendre que la page soit stable (`requestAnimationFrame` × 2) avant chaque capture.
- **Minutage** : écrire à la fin un fichier `minutage.json` (début/fin de chaque chapitre et de chaque sous-titre) et le vérifier contre ce scénario (± 10 %).
- **Contrôle qualité avant livraison** :
  1. `ffprobe` : 1920×1080, 60 i/s, durées 4:15–4:45 et 1:25–1:35.
  2. Extraire une image toutes les 5 s (`ffmpeg -vf fps=0.2`) et vérifier : aucun « Ryze », aucun nom réel, sous-titres lisibles et non coupés, pas de curseur hors cadre, pas de page blanche, pas de texte anglais, cartons conformes.
  3. Vérifier que chaque sous-titre est resté ≥ 2,5 s.
- **Livrables** : `HDJ-demo-longue.mp4`, `HDJ-demo-courte.mp4`, `minutage.json`, et la planche de contrôle (images toutes les 5 s en mosaïque) dans le dossier de travail.
