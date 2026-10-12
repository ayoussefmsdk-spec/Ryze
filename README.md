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

Le dossier `pc/` contient de quoi installer l'application comme un logiciel du service, sous le nom **HDJ** et avec le logo du CHU comme icône, sans serveur ni Internet ni droits administrateur :

```
pc/
  HDJ.bat            lance HDJ dans une fenêtre d'application (moteur d'Edge ou de Chrome, mode --app,
                     1280 × 860), profil et données dans le sous-dossier « donnees » ; reprend toujours
                     le navigateur déjà utilisé avec ces données (donnees\navigateur.txt), sinon Edge, sinon Chrome
  Installer.bat      crée le raccourci « HDJ » (icône hdj.ico, cible HDJ.bat) sur le Bureau et dans le menu
                     Démarrer, débloque les fichiers du paquet, note l'emplacement du dossier
                     (%LOCALAPPDATA%\HDJ\chemin.txt) ; avertit si le dossier est sur une clé USB, le réseau ou OneDrive
  Mettre-a-jour.bat  lancé depuis un nouveau paquet décompressé : remplace le dossier app du HDJ installé
                     (l'ancien est gardé en app-ancien-AAAAMMJJ), sans jamais toucher au dossier donnees
  hdj.ico, hdj.png   icône multi-taille (256, 64, 48, 32, 16 px) tirée du logo du CHU
  LISEZMOI.txt       mode d'emploi : installation, usage, sauvegardes, mise à jour, problèmes fréquents
```

Paquet à copier sur le PC : un dossier `HDJ\` contenant `app\` (tout le dossier, `etablissement.js` et `fonts\` compris) et le contenu de `pc/`. Le copier dans `C:\HDJ`, lancer `Installer.bat`, puis ouvrir HDJ par l'icône du Bureau (importer la base depuis Paramètres, ou démarrer avec une base vide). Avec `etablissement.js`, la fenêtre s'intitule « HDJ — Hôpital de jour · Biothérapies » et prend le logo du CHU comme icône (`R.appliquerIdentiteFenetre`, core.js) ; sans lui (démonstration publique), titre et icône Ryze inchangés. Les fichiers `.bat` sont en ASCII et en CRLF, `LISEZMOI.txt` en UTF-8 avec BOM et CRLF (voir `.gitattributes`). La **sauvegarde automatique sur le disque** (Paramètres) écrit la base dans un dossier choisi après chaque modification (`ryze-base.json` + une copie datée par jour) ; les documents exportés embarquent les polices et s'impriment hors ligne.

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

## Sources cliniques

Posologies : RCP EMA / résumés des caractéristiques du produit (Remicade, Remsima SC, Humira, Entyvio, Stelara, Simponi, Skyrizi, Omvoh, Tremfya, Xeljanz, Rinvoq). Bilan pré-thérapeutique : check-list GETAID 2021, ECCO 2021/2025. Cibles thérapeutiques : STRIDE-II (2021). Dosages pharmacologiques : AGA 2017 et consensus 2021. Vaccination : GETAID 2025, HAS. Gestion de stock : formules PUI classiques (CMM, stock de sécurité, point de commande, couverture).

Les patients, lots, effectifs et coordonnées du jeu de démonstration sont fictifs.
