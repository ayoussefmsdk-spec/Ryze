# Tests de non-régression — Ryze / HDJ

Suites automatiques qui pilotent l’application réelle (`app/index.html`, ouverte en `file://`) dans Chromium avec Playwright : écrans, actions, documents imprimés (PDF) et exports. Elles ne modifient jamais `app/` et ne laissent aucune trace dans le dépôt.

## Lancer

```bash
bash tests/run.sh             # toutes les suites (≈ 40 s)
bash tests/run.sh 03          # seulement les suites dont le nom contient « 03 »
bash tests/run.sh hors-ligne  # idem avec « hors-ligne »
node tests/02-dossier.js      # une suite seule, sortie détaillée
```

Une ligne par suite : `nom | N OK | M FAIL | erreurs JS : K | durée`, puis le détail des contrôles en échec. Code de sortie **1** si un contrôle échoue, si une erreur JavaScript survient dans la page (exception ou `console.error`) ou si une suite s’arrête anormalement ; **0** si tout est vert.

Journaux (`*.log`), PDF produits, fichiers exportés et textes des documents (`03-documents-textes.txt`) : `tests/out/`, ignoré par git (ou le dossier indiqué par `RYZE_TESTS_OUT`).

## Prérequis

- **Node.js** 18 ou plus.
- **Playwright** : installé globalement (`npm install -g playwright`) ; `run.sh` le trouve avec `npm root -g` si `NODE_PATH` n’est pas défini.
- **Chromium** : `/opt/pw-browsers/chromium` s’il existe, sinon celui de Playwright (`npx playwright install chromium`), ou le chemin donné par `CHROMIUM_PATH`.
- **pdftotext** (poppler-utils), recommandé : lit le texte de chaque page des PDF (identité du patient sur chaque page, textes interdits). Sans lui, ces contrôles se rabattent sur le document affiché.

Variables utiles : `RYZE_VERBEUX=1` affiche aussi les contrôles réussis ; `RYZE_APP_DIR=/chemin/app` teste une autre copie de l’application (paquet HDJ décompressé, par exemple) ; `RYZE_DELAI_SUITE` (secondes, 240 par défaut) borne la durée d’une suite.

## Ce que couvre chaque suite

| Suite | Contrôles |
|---|---|
| `01-base.js` | chargement sans erreur JS ; connexion, code refusé, code en minuscules ; droits IDE (HDJ001) et médecin (MED001) ; sauvegarde dans `localStorage` et rechargement ; migration idempotente (deux chargements = mêmes réglages, dossiers, protocoles) ; export de la base (fichier JSON complet, texte à copier) ; import « ajouter les dossiers absents » et « remplacer toute la base » par texte collé (aller-retour sans perte), texte invalide refusé ; « Démarrer avec une base vide » depuis l’écran de connexion et depuis Paramètres (nouveau code affiché, codes de démonstration refusés) ; identité de l’établissement et logo (`etablissement.js`) ; application **sans** `etablissement.js` (requête bloquée : aucune erreur, identité générique, titre et icône Ryze, téléphones factices jamais imprimés) |
| `02-dossier.js` | assistant « Nouveau dossier » en IV (infliximab au poids) et en SC (adalimumab) ; séances générées (induction, entretien, doses, flacons, créneaux) ; séance réalisée (dose recalculée sur le poids du jour, poids, lot) ; patient non venu, report avec et sans date ; séance ajoutée en mg/kg ; notes (ajout, épinglage visible en synthèse, modification tracée, suppression) ; contrôle marqué fait ; dosage infliximab et cibles pédiatriques (≥ 5 µg/mL, ≥ 10 µg/mL si atteinte périnéale) ; suspension et reprise ; changement de protocole puis suppression du cycle ; trace « Corrigée le … » après « Modifier », imprimée dans les documents ; documents des deux dossiers créés sans textes interdits |
| `03-documents.js` | sur 4 dossiers de la démonstration choisis par leurs caractéristiques (IV, SC, 2 cycles, suspendu) : carnet A4 (en-tête et logo, identité sur chaque page du PDF, « Statut et sécurité », « À faire », aucune conduite à tenir automatique après un dosage, courbes avec la taille, notes épinglées) ; historique des séances, relevé des bilans (colonnes Poids / Taille / IMC, « À retenir ») et planification imprimée ; compte rendu ; carnet patient FR/AR (exactement 8 pages A5, aucune date ni dose à venir, « informez l’hôpital de jour », page 8 en 9 pt au moins, aucune note médicale ; dossier ancien de 45 séances : 30 dernières et 10 lignes vides, toujours 8 pages) ; carnet patient vierge (lignes à remplir, rien enregistré) ; rapport d’activité nominatif et anonymisé ; feuilles de planning jour (A4 portrait) et semaine (A4 paysage) ; fichier `.html` exporté (polices et logo intégrés, rouvert hors ligne avec la même pagination ; export des 10 types de document) ; impression couleur et noir et blanc (même nombre de pages) ; aucun « (s) », « 05 XX », « undefined », « NaN » sur l’ensemble des documents (écran et PDF) |
| `04-hors-ligne.js` | réseau coupé (`context.route` + `setOffline`) : chargement, polices locales (latin, mono, arabe), logo intégré, toutes les pages et tous les onglets, documents et PDF, export d’un document et de la base, document exporté rouvert, sauvegarde locale et sauvegarde sur disque (dossier simulé : `ryze-base.json` + copie datée) ; aucune requête réseau ; code de l’application sans appel réseau ni adresse Internet |
| `05-securite.js` | sécurité des données (dossier de sauvegarde simulé) : base illisible (connexion refusée, base vide et réinitialisation refusées, disque jamais écrit, « base neuve » seulement après téléchargement, copie `ryze-avant-base-neuve-…`, copie `.bak` signalée ensuite) ; copie `.bak` identique supprimée ; alerte « base volumineuse » ; copie de sécurité `ryze-avant-<opération>-AAAA-MM-JJ-HHMM.json` (disque ou téléchargement) avant réinitialisation, base vide et « Remplacer toute la base » (journalisé) ; `ryze-base.json` plus récent jamais écrasé (protection gardée, levée par un import avec copie `ryze-avant-ecrasement-…`) ; chaîne JSON réutilisée pour le disque ; indicateur `KEY.err` et bandeau au lancement suivant ; import d’éléments non-objets refusé, `null` filtrés au chargement ; utilisateur propre à l’onglet ; garde multi-onglets (conflit, horloge reculée, assistant) sans faux succès ; clé `KEY.m` sans relecture complète ; rotation mensuelle des copies datées ; erreur disque et réactivation visibles par l’IDE ; cible de dosage figée ; cycle supprimé archivé ; « Modifier le dossier » contrôlé et journalisé |

## Règles

- **Jamais de données réelles.** Les tests n’utilisent que le jeu de démonstration fictif (`R.seed`, codes MED001, CHEF01, HDJ001) et des dossiers d’essai créés à la volée sous le nom « ESSAI … ». N’ajoutez jamais un nom, un numéro de dossier ou un document de patient réel dans `tests/`, ni dans `tests/out/`.
- Chaque suite est **indépendante** : elle ouvre son propre navigateur et repart d’une démonstration neuve (`localStorage` vidé).
- Les documents se vérifient par leur **contenu** (texte, colonnes, nombre et format des pages du PDF), pas par leur apparence au pixel près.
- Un contrôle qui révèle un **bug connu de l’application** s’écrit `H.aCorriger(nom, condition, détail, 'fichier:ligne')` : il est signalé « À CORRIGER » sans faire échouer la suite tant que le bug n’est pas corrigé, puis compte comme OK (avec un rappel de retirer la marque) une fois corrigé.
- Aucun bug connu à ce jour (l’ancien contrôle « À CORRIGER » de `02-dossier`, note « Dossier créé — … séance(s) d’induction », est devenu un contrôle normal).
- Nouvelle suite : `tests/NN-nom.js` sur le modèle des existantes (`const H = require('./lib').suite('NN-nom'); H.executer(async () => { … H.t(nom, condition, détail) … })`), 15 à 40 contrôles rapides ; `run.sh` la prend automatiquement.
