# Base de démonstration « vitrine » (HDJ biothérapies pédiatriques)

Base **entièrement fictive** pour la vidéo de présentation : enfants et adolescents inventés, prénoms et noms marocains courants, aucun patient réel. Elle couvre ce que l'application sait faire, sur environ 15 mois d'activité qui se terminent **le jour de la construction**.

| Fichier | Rôle |
|---|---|
| `vitrine.json` | export complet au format de l'application (version de base 12) |
| `construire-vitrine.js` | reconstruit la base avec les vraies fonctions de l'application, puis lance la vérification |
| `verifier-vitrine.js` | vérifie un fichier vitrine : import, pages, documents PDF, export et réimport |

## Charger la vitrine

1. Ouvrir l'application. La démonstration habituelle convient comme point de départ : code `MED001`.
2. Aller dans **Paramètres → Importer un fichier**, choisir `demo/vitrine.json`, cocher **« Remplacer toute la base »**, puis confirmer.
3. Se reconnecter avec l'un des codes ci-dessous.

| Code | Personne | Accès |
|---|---|---|
| `AAA111` | Dr Y. MOUSSADDEK, gastro-entérologue pédiatre | complet |
| `BBB222` | Dr A. TRAIFI | complet |
| `CCC333` | Pr BENSABAHIA, chef de service | complet |
| `IDE444` | Samira OUAHBI, IDE | hôpital de jour |
| `IDE555` | Hanane ZEMMOURI, IDE | hôpital de jour |
| `SEC666` | Meryem SQALLI, secrétaire | hôpital de jour |

Réglages de la base :
- téléphone de l'HDJ : 05 22 48 20 20 ;
- urgences : 05 22 29 46 30 ;
- chef de service : Pr BENSABAHIA ;
- 4 fauteuils, 8 séances au plus par jour, de 08:00 à 16:00 ;
- impression en couleur ;
- identité de l'établissement reprise d'`etablissement.js`, sans modification.

**Les dates suivent la date de construction.** Avec le fichier construit le lundi 9 novembre 2026 :
- « aujourd'hui », c'est le 9/11/2026 ;
- la semaine en cours va du 9 au 13/11 ;
- la semaine suivante va du 16 au 20/11.

Pour une vidéo tournée un autre jour, il faut **reconstruire la base** (voir plus bas).

## Les 10 dossiers vitrine

Les âges sont calculés au 9/11/2026. Les dates de cet exemple valent pour une construction faite ce jour-là.

| # | Patient | Âge | Maladie (Paris) | Traitement | Ce que le dossier illustre | Où le voir |
|---|---|---|---|---|---|---|
| 1 | **Yassine BENNANI** | 13 ans | MC A1b L3 B1 G0 | Infliximab IV 5 mg/kg toutes les 8 semaines depuis le 1/09/2025 | Dossier modèle : 9 séances faites (lots, tolérance, constantes, examen clinique, Tanner 2 puis 3). Bilans normalisés, dosages dans la cible (≥ 5), coloscopie à 1 an : « cicatrisation complète ». Calprotectine 1 240 → 45, CRP 34 → < 3. Séance du jour à 08:00 et dosage avant la perfusion. | Synthèse, Bilans & résultats (courbes), carnet A4, carnet patient |
| 2 | **Rayan EL IDRISSI** | 15 ans | MC A1b L3 B3**p** G0 (fistule, séton) | Infliximab, optimisé à 10 mg/kg | Atteinte périnéale, donc cible ≥ 10. Dosage du 5/02/2026 à 6,2 µg/mL, **sous la cible**, avec la remarque « Optimisation à 10 mg/kg décidée en staff ». Posologie modifiée par l'application le jour même, à partir de la séance n° 5. Dosages suivants à 13,7 µg/mL, dans la cible. Fistule tracée aux examens des séances. | Bilans (taux résiduel), Traitement & historique, carnet A4 |
| 3 | **Salma ALAOUI** | 12 ans | MC A1b L1 B1 | Adalimumab SC à l'HDJ : 160/80 mg puis 40 mg toutes les 2 semaines | Injections sous-cutanées à l'HDJ. Dosage de 9,9 µg/mL, dans la cible (≥ 7,5), anticorps non détectés. Éducation à l'auto-injection. Injection prévue mercredi. | Planning (SC), Bilans, Notes |
| 4 | **Mehdi TAZI** | 14 ans | MC A1b L3 L4a B1 | Infliximab, puis ustékinumab depuis le 22/06/2026 | **Changement de molécule (2 cycles).** Perte de réponse : calprotectine 980 µg/g, CRP 18 mg/L, alors que le taux résiduel est dans la cible (6,1 µg/mL) et les anticorps sont négatifs. Motif tracé. Induction IV en paliers, puis SC 90 mg. **Injection SC aujourd'hui** et consultation à 14:00. | Traitement & historique (cycles), courbes, carnet A4 |
| 5 | **Lina BERRADA** | 10 ans | RCH E4 S1 | Infliximab | **Suspension en cours** depuis le 6/11 : « Pneumopathie fébrile sous amoxicilline — perfusion différée, reprise après avis du médecin référent ». Séances passées en « reportée ». Consultation de réévaluation jeudi. | Tableau de bord (« À traiter »), Synthèse, planning |
| 6 | **Omar CHRAIBI** | 11 ans | MC A1b L2 B1 | Infliximab | **Réaction à la perfusion** le 26/05/2026 (prurit, flush, débit réduit), puis **prémédication systématique** fixée par l'application, avec sa note. Allergie au latex et **note épinglée « Allergie au latex : gants nitrile »**. | Séances (détail S30), Notes, carnet A4 |
| 7 | **Nour FASSI** | 16 ans | RCH E3 S0 | Infliximab | Adolescente : alerte de transition vers le service adulte. **Séance manquée** (patient non venu) le 27/07/2026, replanifiée et faite le 30/07. **Note épinglée « Mère joignable uniquement l'après-midi »**. Bilan biologique **en retard**. | Tableau de bord, Planification, Notes, carnets |
| 8 | **Adam KETTANI** | 8 ans | MC A1a L3 B1 G1 | Infliximab en **induction** | J0 fait le 28/10/2026, **S2 prévue mercredi**. Bilan pré-biothérapie complet, avec **QuantiFERON douteux** et avis pneumo-pédiatrique en note, **sérologie VZV en attente** et retard de croissance. | Bilans & résultats (pré-biothérapie), Notes |
| 9 | **Hiba LAHLOU** | 9 ans | MC A1a L3 L4a B1 G1 | Adalimumab antérieur (01–09/2025) **arrêté**, puis infliximab | **Traitement antérieur saisi avec ses séances** (doses pédiatriques), arrêté pour perte de réponse et cassure staturale. **Courbe de taille** : cassure (125 → 125,5 cm en 3 mois), puis rattrapage jusqu'à environ 131 cm. **Entéro-IRM annulée, à reprogrammer.** Endoscopie prévue. | Traitement & historique (cycle antérieur), Bilans (courbe de taille), Planification |
| 10 | **Aya SEBTI** | 14 ans | RCH E4 S1 | Vedolizumab IV 300 mg | **Séance reportée pour rupture de stock** (3 → 10/06/2026). **Séance corrigée après coup** : lot corrigé le 31/07, trace « corrigée le … par … ». **Calprotectine en retard.** | Planification (détail des séances), carnet A4, tableau de bord |

Contenu commun aux dix dossiers :
- poids et taille relevés à chaque séance, avec une croissance visible sur 14 mois ;
- stade de Tanner ;
- bilan pré-biothérapie ;
- CRP, calprotectine, hémoglobine, albumine, transaminases, ferritine et vitamine D, qui s'améliorent sous traitement ;
- notes datées de médecins, d'IDE et de la secrétaire ;
- rendez-vous : consultations, endoscopies, IRM, éducation, biologie.

## Les 21 dossiers « file active »

Ce sont des figurants fictifs, de 6 à 16 ans, sous infliximab ou vedolizumab. Certains ont un intervalle raccourci à 6 semaines, d'autres sont intensifiés à 10 mg/kg toutes les 4 semaines. Plusieurs sont en induction.

Ils existent pour **remplir le planning**. Avec 10 patients seulement, on ne peut pas obtenir 3 à 5 séances par jour.

Le planning obtenu :
- **semaine en cours : 4 / 3 / 4 / 3 / 3 séances**, sur 3 fauteuils, avec 2 injections SC (Mehdi lundi, Salma mercredi) ;
- **aujourd'hui : 4 patients** (Yassine, Mehdi, Anas, Kenza) ;
- **semaine suivante : 3 / 3 / 3 / 2 / 2 séances**.

## Rapport d'activité

Chiffres pour une construction faite le 9/11/2026 :

| Période | Séances IV faites | Séances SC faites | Réactions | Reports | Non venus |
|---|---|---|---|---|---|
| 12 mois (10/11/2025 – 9/11/2026) | 116 | 10 | 1 | 2 | 1 |
| Année 2026 | 105 | 10 | 1 | 2 | 1 |

Sur les 12 mois :
- taux de réalisation : 99 % ;
- 148 contrôles faits ;
- file active : 31 patients ;
- 25 premières séances ;
- 1 relais de molécule ;
- 1 suspension.

Le rapport du mois en cours est encore court au 9 du mois : 4 séances faites, les autres sont à venir. Pour la vidéo, le **mois précédent**, l'**année** ou une période personnalisée de 12 mois rendent mieux.

## Reconstruire et vérifier

```bash
export NODE_PATH=$(npm root -g)
node demo/construire-vitrine.js          # construit demo/vitrine.json puis le vérifie (environ 1 minute)
node demo/verifier-vitrine.js            # vérification seule ; PDF et captures dans $VITRINE_OUT
```

Méthode de construction :
1. Chromium (Playwright), horloge de la page avancée jour après jour sur environ 15 mois.
2. Démonstration, puis « Démarrer avec une base vide ».
3. Codes de l'équipe et paramètres.
4. Dossiers créés par l'assistant, à leur date.
5. Actions réelles, faites à leur date :
   - séances marquées faites par les IDE ;
   - contrôles marqués faits par le médecin référent ;
   - reports, patient non venu, correction, réaction ;
   - modification de posologie, changement de protocole, suspension ;
   - notes et rendez-vous.
6. Rechargement avec l'horloge réelle, puis « Exporter la base ».

Seules quelques valeurs du brouillon de l'assistant (identité, cible du plan de surveillance) sont écrites directement dans son état, comme le ferait la saisie. Les noms et les codes de l'équipe sont aussi posés directement : l'application ne permet pas de choisir un code ni de renommer.

La vérification passe 767 contrôles, sans échec ni erreur JavaScript :
- import en remplacement, puis connexion `AAA111` ;
- toutes les pages, et tous les onglets des 31 dossiers ;
- détail de chaque séance et de chaque contrôle, courbes ;
- documents en PDF : carnet A4, carnet patient (8 pages A5, sans débordement), planification, relevé des bilans, séances, compte rendu, rapport du mois, de l'année et sur 12 mois (nominatif et anonymisé, sans nom dans la version anonymisée), feuille du jour et de la semaine ;
- aucun « (s) », « undefined » ou « NaN » dans les documents ;
- aucun des noms à exclure (liste fournie uniquement par la variable d'environnement `HDJ_NOMS_INTERDITS`, jamais écrite dans le dépôt) ;
- export, puis import « remplacer », puis export : contenu identique.

## Limites connues

- L'écran de l'application affiche encore des « (s) » : « traitement(s) suspendu(s) », « réalisée(s) », « Résultat(s) anormal(aux) »… C'est un libellé de l'application, pas un problème de données. Les documents imprimés n'en contiennent pas.
- Le carnet A4 imprime « grossesse éventuelle » dans les vérifications avant séance pour **toutes** les filles, y compris Hiba (9 ans) et Lina (10 ans). Le carnet patient de Nour (16 ans) ne mentionne pas la grossesse.
- La liste des prémédications de la fenêtre de séance n'a que des doses adultes (« Paracétamol 1 g + dexchlorphéniramine 5 mg IV »). Pour Omar, une note d'équipe précise donc les doses au poids.
- Les injections SC n'ont pas d'heure : elles apparaissent comme « SC » dans « Ma journée ».
