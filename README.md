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

Ouvrir `app/index.html` dans un navigateur suffit : aucune dépendance, aucun serveur. Les modifications sont conservées dans le navigateur (localStorage) ; le bouton « Réinitialiser » des Paramètres régénère le jeu de démonstration.

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
