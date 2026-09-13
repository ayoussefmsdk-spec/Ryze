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
               protocoles, stock & pharmacie, équipe & accès, paramètres
  wizard.js    assistant « Nouveau dossier » (5 étapes) et carnet imprimable
```

Ouvrir `app/index.html` dans un navigateur suffit : aucune dépendance, aucun serveur. Les modifications sont conservées dans le navigateur (localStorage) ; le bouton « Réinitialiser » des Paramètres régénère le jeu de démonstration.

## Modules

| Module | Rôle |
|---|---|
| Tableau de bord | patients suivis, cures de la semaine, rendez-vous, alertes stock, surveillances en retard, cures/mois |
| Patients | recherche, filtres, fiche complète : cures (enregistrement, report, validation pharmaceutique, optimisation), surveillance datée, bilan pré-thérapeutique, notes |
| Nouveau dossier | identité → bilan → protocole par cycles (induction / entretien, doses au poids, arrondi au flacon) → plan de surveillance → récapitulatif |
| Planning HDJ | semaine par fauteuil : cures IV, dispensations SC, rendez-vous |
| Protocoles | 13 protocoles MICI (infliximab IV/SC, adalimumab, vedolizumab IV/SC, ustekinumab, golimumab, risankizumab MC/RCH, mirikizumab, guselkumab, upadacitinib, tofacitinib), éditables |
| Stock & pharmacie | lots et péremptions (FEFO), CMM, couverture, besoin prévisionnel calculé depuis le planning, proposition de commande, mouvements |
| Équipe & accès | comptes, rôles (médecin, pharmacien, IDE, secrétaire, administrateur), matrice des droits, journal |
| Carnet | document A4 en 4 pages : identité et traitement, tableau des cures, calendrier de surveillance, conduite à tenir |

## Sources cliniques

Posologies : RCP EMA / résumés des caractéristiques du produit (Remicade, Remsima SC, Humira, Entyvio, Stelara, Simponi, Skyrizi, Omvoh, Tremfya, Xeljanz, Rinvoq). Bilan pré-thérapeutique : check-list GETAID 2021, ECCO 2021/2025. Cibles thérapeutiques : STRIDE-II (2021). Dosages pharmacologiques : AGA 2017 et consensus 2021. Vaccination : GETAID 2025, HAS. Gestion de stock : formules PUI classiques (CMM, stock de sécurité, point de commande, couverture).

Les patients, lots, effectifs et coordonnées du jeu de démonstration sont fictifs.
