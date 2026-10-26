# Ryze — Suivi biothérapique en hôpital de jour

Prototype d'application hospitalière pour la gestion des biothérapies en hôpital de jour (service de gastro-entérologie, MICI) et génération du **Carnet de suivi biothérapique** du patient.

## Contenu

```
app/
  index.html   coquille + feuille de style (thèmes clair/sombre, impression A4)
  data.js      référentiels cliniques (protocoles, bilan pré-thérapeutique, surveillance,
               articles de stock), générateur de cycles, jeu de démonstration fictif
  core.js      état, droits par rôle, navigation, tableau de bord, graphique
  pages.js     patients, fiche patient (cures, surveillance, bilan, notes), planning HDJ,
               protocoles, activité & rapports, équipe & accès, paramètres
  wizard.js    assistant « Nouveau dossier » (5 étapes) et carnet imprimable
```

Ouvrir `app/index.html` dans un navigateur suffit : aucune dépendance, aucun serveur, aucun accès Internet (polices incluses dans `app/fonts/`). Les modifications sont conservées dans le navigateur (localStorage) ; le bouton « Réinitialiser » des Paramètres régénère le jeu de démonstration.

## Installation sur un poste de travail (Windows) — paquet « HDJ »

Le dossier `pc/` contient de quoi installer l'application comme un logiciel du service, sous le nom **HDJ** et avec l'emblème du Groupement Sanitaire Territorial Casablanca-Settat comme icône, sans serveur ni Internet ni droits administrateur :

```
pc/
  HDJ.bat            lance HDJ dans une fenêtre d'application (moteur d'Edge ou de Chrome, mode --app,
                     --start-maximized, --lang=fr pour les champs de date), profil et données dans le
                     sous-dossier « donnees » ; adresse file:/// encodée en ASCII par PowerShell (chemin
                     avec accent accepté, repli sur une simple conversion) ; reprend toujours le navigateur
                     déjà utilisé avec ces données (donnees\navigateur.txt, jamais réécrit lors d'un repli),
                     sinon Edge, sinon Chrome ; messages d'erreur dans une boîte de dialogue au premier plan
  Installer.bat      crée le raccourci « HDJ » (icône hdj.ico, cible HDJ.bat) sur le Bureau et dans le menu
                     Démarrer, débloque les fichiers du paquet, note l'emplacement du dossier
                     (%LOCALAPPDATA%\HDJ\chemin.txt) ; avertit si le dossier est sur une clé USB, le réseau
                     (UNC), OneDrive, dans Téléchargements ou le dossier temporaire (pas d'avertissement si
                     PowerShell est restreint) ; à lancer une fois par compte Windows
  Mettre-a-jour.bat  lancé depuis un nouveau paquet décompressé : remplace le dossier app du HDJ installé
                     (l'ancien est gardé en app-ancien-AAAAMMJJ), sans jamais toucher au dossier donnees
  hdj.ico, hdj.png   icône multi-taille (256, 64, 48, 32, 16 px) tirée de l'emblème du GST Casablanca-Settat
  LISEZMOI.txt       mode d'emploi : installation, usage, sauvegardes, mise à jour, problèmes fréquents
```

Paquet à copier sur le PC : un dossier `HDJ\` contenant `app\` (tout le dossier, `etablissement.js` et `fonts\` compris) et le contenu de `pc/`. Le copier dans `C:\HDJ` (chemin sans accent conseillé, zip débloqué dans ses Propriétés avant « Extraire tout »), lancer `Installer.bat`, puis ouvrir HDJ par l'icône du Bureau (importer la base depuis Paramètres, ou démarrer avec une base vide). Impression : décocher une fois « En-têtes et pieds de page » (Plus de paramètres) et garder les marges par défaut ; Edge 87 minimum, Edge 131 ou plus récent conseillé (numéros de page et identité du patient sur les pages suivantes, boîtes de marge `@page`). Avec `etablissement.js`, la fenêtre s'intitule « HDJ — Hôpital de jour · Biothérapies » et prend l'emblème du GST comme icône (`R.appliquerIdentiteFenetre`, core.js) ; sans lui (démonstration publique), titre et icône Ryze inchangés. Les fichiers `.bat` sont en ASCII et en CRLF, `LISEZMOI.txt` en UTF-8 avec BOM et CRLF (voir `.gitattributes`). La **sauvegarde automatique sur le disque** (Paramètres) écrit la base dans un dossier choisi après chaque modification (`ryze-base.json` + une copie datée par jour) ; les documents exportés embarquent les polices et s'impriment hors ligne.

## Modules

| Module | Rôle |
|---|---|
| Tableau de bord | patients suivis, séances de la semaine, contrôles et rendez-vous, retards, séances/mois |
| Patients | recherche, filtres, dossier : planification unifiée (séances et contrôles marqués réalisés avec notes), changement de protocole avec historique par cycle, modification de posologie tracée, bilan pré-thérapeutique, notes |
| Nouveau dossier | identité → bilan → protocole par cycles (induction / entretien, doses au poids, arrondi au flacon) → plan de surveillance → récapitulatif |
| Planning HDJ | calendrier mensuel navigable, journée détaillée, semaine ; capacité paramétrable (fauteuils, séances max/jour, horaires, jours) ; refus des surréservations et proposition du prochain créneau |
| Protocoles | 14 protocoles MICI (infliximab IV/SC, adalimumab, vedolizumab IV/SC, ustekinumab, golimumab, risankizumab MC/RCH, mirikizumab, guselkumab, upadacitinib MC/RCH, tofacitinib), éditables avec variantes de posologie |
| Équipe & codes | codes d'accès personnels, deux niveaux (accès complet, accès hôpital de jour) |
| Carnet | document A4 : identité et traitement, historique des cycles, planification unifiée (séances + contrôles) ou tableaux séparés selon l'option du dossier, conduite à tenir |

## Tests

```bash
bash tests/run.sh          # toutes les suites (≈ 25 s) ; bash tests/run.sh 03 pour une partie
```

Suites de non-régression dans `tests/` (Playwright + Chromium, application ouverte en `file://`) : `01-base` (connexion, droits, sauvegarde, export / import, base vide, migration, identité de l'établissement), `02-dossier` (assistant IV / SC, séances, notes, contrôles et cibles de dosage, suspension, changement de protocole, corrections tracées), `03-documents` (carnets, impressions, compte rendu, carnet patient 8 pages A5, rapport, planning, exports, couleur / noir et blanc), `04-hors-ligne` (tout sans réseau). Une ligne de résultat par suite, code de sortie 1 au moindre échec ; PDF et journaux dans `tests/out/` (ignoré par git). Prérequis, détail des contrôles et règle « jamais de données réelles » : [`tests/README.md`](tests/README.md).

## Sources cliniques

Posologies : RCP EMA / résumés des caractéristiques du produit (Remicade, Remsima SC, Humira, Entyvio, Stelara, Simponi, Skyrizi, Omvoh, Tremfya, Xeljanz, Rinvoq). Bilan pré-thérapeutique : check-list GETAID 2021, ECCO 2021/2025. Cibles thérapeutiques : STRIDE-II (2021). Dosages pharmacologiques : AGA 2017 et consensus 2021. Vaccination : GETAID 2025, HAS. Gestion de stock : formules PUI classiques (CMM, stock de sécurité, point de commande, couverture).

Les patients, lots, effectifs et coordonnées du jeu de démonstration sont fictifs.
