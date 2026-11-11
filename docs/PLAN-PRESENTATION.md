# Programme du segment de présentation (journée des maladies digestives)

> Version 2, à valider avec la Pr Bensabahia.
> **Titre proposé :** *Du papier au numérique : conception d'un système informatisé pour améliorer l'observance, la planification et la sécurité des biothérapies chez l'enfant atteint de MICI*
> Orateur : Youssef Moussaddek. Support : quelques diapositives, puis la vidéo commentée.

## Minutage (15 min au total)

| Début | Partie | Durée |
|---|---|---|
| 0:00 | Présentation par la Pr Bensabahia | 1:00 |
| 1:00 | 1. Accroche et contexte | 1:30 |
| 2:30 | 2. Le problème | 2:00 |
| 4:30 | 3. L'objectif et les choix | 0:45 |
| 5:15 | 4. Comment nous l'avons construit | 0:45 |
| 6:00 | 5. Démonstration vidéo | 5:00 |
| 11:00 | 6. L'hébergement : problème et solution | 1:15 |
| 12:15 | 7. Conclusion | 0:45 |
| 13:00 | Questions | 2:00 |

---

## 1. Accroche et contexte (1 min 30)
**Accroche** (en choisir une) :
- *Fil rouge* : « Yassine, 13 ans, maladie de Crohn, infliximab toutes les 8 semaines. » C'est un patient fictif, celui qu'on retrouve dans la vidéo.
- *Question à la salle* : « Pour vos patients sous biothérapie, savez-vous aujourd'hui, sans ouvrir un dossier, lesquels ont un dosage en retard ? »

**Contexte** :
- Quatre molécules (infliximab, adalimumab, védolizumab, ustékinumab), en IV ou en SC, toujours administrées à l'hôpital de jour.
- Le rythme : une séance environ toutes les 8 semaines, des contrôles à 3, 6 et 12 mois. Chaque enfant a donc 6 à 7 séances par an plus ses contrôles, pendant des années. Pour [N] enfants, cela fait environ [N × 6,5] séances à planifier chaque année.
- Ce qui est propre à l'enfant :
  - la dose est recalculée au poids à chaque séance ;
  - il faut suivre la croissance et la puberté ;
  - les cibles de dosage sont pédiatriques (plus hautes en cas d'atteinte périnéale) ;
  - la famille doit être informée dans sa langue.

*Transition :* « Tout cela représente énormément d'informations, et jusqu'ici elles étaient sur papier. »

## 2. Le problème : l'information dispersée et en désordre (2 min)
**Au quotidien, quatre risques :**
1. **La dose** : calcul manuel au poids, flacons à compter.
2. **Les contrôles** : un dosage ou un bilan oublié, découvert le jour de la perfusion.
3. **Les effets indésirables** : réaction, allergie et prémédication ne suivent pas l'enfant d'une séance à l'autre.
4. **La planification** : fauteuils, créneaux, reports (infection, rupture de stock) gérés à la main.

**À long terme, le désordre freine l'amélioration des traitements :**
- On ne voit pas la réponse au traitement dans le temps : calprotectine, CRP, croissance, taux résiduels.
- On décide d'une optimisation ou d'un changement de molécule sans vue d'ensemble, et les motifs d'échec ne sont pas documentés.
- On n'a pas de chiffres (activité, consommation par molécule, échecs) pour justifier auprès de l'administration et de la pharmacie l'introduction de nouvelles molécules ou de nouveaux moyens.
- On n'a pas de données exploitables pour la recherche.

*Formule :* « Ce qui n'est pas noté ne peut pas être amélioré. »
*Transition :* « Il fallait passer du papier au numérique. »

## 3. L'objectif et les choix (45 s)
- **Objectif général** : réunir et structurer toute l'information de l'hôpital de jour dans un seul système.
- **Quatre objectifs**, qui répondent aux problèmes :
  - *observance* : séances et contrôles planifiés et rappelés ;
  - *sécurité* : dose au poids, alertes, effets indésirables tracés ;
  - *organisation* : planning des fauteuils, feuille du jour ;
  - *données* : historique des traitements et rapport d'activité, pour améliorer les traitements.
- **Choix** :
  - un outil dédié à l'hôpital de jour ;
  - simple, pour les médecins, les infirmier·ères et le secrétariat ;
  - autonome : un PC, sans Internet ;
  - bilingue pour les familles.

*Transition :* « Comment l'avons-nous construit ? »

## 4. Comment nous l'avons construit (45 s)
- Conçu par l'équipe : chaque règle clinique, chaque seuil et chaque document ont été décidés dans le service.
- Réalisé en trois mois environ, avec un assistant de programmation par intelligence artificielle (à dire en une phrase).
- Vérifié par un audit complet du code et 193 contrôles automatiques, sur une base de démonstration entièrement fictive.

*Formule :* « Le médecin décide, la machine calcule et n'oublie pas. »
*Transition :* « Le plus simple est de vous le montrer : une journée à l'hôpital de jour en quatre minutes. »

## 5. Démonstration vidéo (5 min)
La vidéo est commentée en direct. Ne pas lire les sous-titres : dire *pourquoi* c'est utile, et rappeler le risque correspondant (« souvenez-vous, le risque n° 1, la dose… »).
1. **Connexion** : un code par soignant, deux niveaux d'accès.
2. **Tableau de bord** : la journée, les retards et les alertes en un coup d'œil (observance).
3. **Dossier patient** :
   - dose au poids du jour, avec une alerte si l'écart dépasse 10 % (sécurité) ;
   - une séance saisie en trente secondes ;
   - dosages à cibles pédiatriques ;
   - courbes de suivi ;
   - allergie et réaction toujours visibles (effets indésirables).
4. **Nouveau dossier** : trois étapes ; le protocole propose, le médecin décide.
5. **Planning et feuille du jour** : fauteuils sans double réservation ; la feuille de l'infirmier·ère en un clic (organisation).
6. **Documents** : carnet des soignants, carnet de la famille en français et en arabe, compte rendu prérempli.
7. **Rapport d'activité** : activité, consommation par molécule, version anonymisée (données).
8. **Sécurité** : sauvegarde, journal des actions.

## 6. L'hébergement : problème et solution (1 min 15)
- **Le problème** : pas de serveur, pas d'équipe informatique pour l'installer et l'entretenir, et le coût d'un hébergement.
- **La solution** : une application locale, sur un PC déjà en place, avec une icône sur le bureau, qui fonctionne sans Internet.
- **Ce que cela garantit** :
  - aucune donnée ne sort de l'hôpital (loi 09-08) ;
  - une sauvegarde automatique à chaque modification et une copie datée chaque jour ;
  - des mises à jour qui ne touchent pas aux données ;
  - une version anonymisée pour toute diffusion.

*Formule :* « Un PC, un dossier, zéro serveur. »

## 7. Conclusion (45 s)
- Une diapositive de récapitulatif : **quatre problèmes → quatre réponses**.
- La suite : mesurer l'effet sur l'observance et la sécurité après 6 à 12 mois d'utilisation.
- Perspectives :
  - plusieurs postes en réseau ;
  - scores d'activité PCDAI et PUCAI ;
  - courbes de croissance OMS ;
  - transition vers l'adulte ;
  - d'autres services.
- Remerciements, puis le titre et les noms à l'écran.
