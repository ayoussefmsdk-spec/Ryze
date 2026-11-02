# HDJ (Ryze) — dossier de contexte pour préparer une présentation

> À donner à une nouvelle conversation Claude (pièce jointe, ou connaissance d'un Projet Claude) pour qu'elle connaisse le projet sans tout réexpliquer.
> **Aucune donnée de patient dans ce document.** Les exemples cités viennent des patients fictifs de la démonstration.

---

## 1. En une phrase

**HDJ** (nom de code du logiciel : *Ryze*) est une **application web locale** de gestion des biothérapies pour l'hôpital de jour de gastro-entérologie pédiatrique : dossier patient, protocoles par cycles, doses calculées au poids, planning des fauteuils, séances et contrôles, dosages (TDM) avec cibles pédiatriques, et tous les documents imprimables (carnet de suivi, carnet patient bilingue français/arabe, compte rendu, rapport d'activité). Elle fonctionne **sur un seul PC, sans Internet ni serveur**.

## 2. Le contexte

- **Établissement** : Centre Hospitalier Universitaire Ibn Rochd — Casablanca ; Hôpital d'Enfants Abderrahim El Harouchi ; Service de Pédiatrie 3 ; Unité de Gastro-entérologie, Hépatologie et Nutrition Pédiatrique ; Hôpital de jour — Biothérapies. Logo utilisé : Groupement Sanitaire Territorial (GST) Casablanca-Settat.
- **Patients** : enfants et adolescents atteints de maladie inflammatoire chronique de l'intestin (maladie de Crohn, rectocolite hémorragique) traités par biothérapie (infliximab, adalimumab, védolizumab, ustékinumab…), en perfusion (IV) ou en injection sous-cutanée (SC), toujours réalisées à l'hôpital de jour.
- **Utilisateurs** : médecins (accès complet), infirmier·ères de l'HDJ et secrétariat (accès « HDJ »), avec un code personnel par personne.
- **Le problème de départ** (à adapter avec votre expérience) : suivi sur papier et tableurs dispersés ; calcul manuel des doses au poids ; risque d'oubli des contrôles (dosages résiduels, bilans) ; planning des fauteuils difficile ; carnets et comptes rendus rédigés à la main ; aucune statistique d'activité fiable.

## 3. Ce que fait l'application

**Dossier et traitement**
- Assistant de création de dossier en 3 étapes : identité, maladie (classification de Paris), protocole, variante, induction / entretien, plan de surveillance, séances déjà réalisées (saisie rétrospective).
- Protocoles par **cycles** (changement de molécule, optimisation, suspension, reprise, arrêt) avec historique complet.
- **Doses calculées au poids** (mg/kg, paliers de poids, dose fixe), flacons nécessaires, prémédication ; alerte quand le poids change de plus de 10 %.
- Séances : réalisée (dose, poids, lot, tolérance, constantes, examen clinique), manquée, reportée (avec catégorie : clinique, organisation, rupture de stock…), corrigée (trace « corrigée le … par … »).
- Contrôles et examens planifiés (bilans biologiques, calprotectine, imagerie, endoscopie, dosages), avec rappels et retards.
- **Dosages des biothérapies (TDM)** : cibles **pédiatriques** réglables (infliximab ≥ 5 µg/mL, ≥ 10 en cas d'atteinte périnéale ; adalimumab ≥ 7,5, ≥ 12 si périnéale), atteinte périnéale détectée dans le dossier, cible figée au moment du dosage ; sur papier, seul le constat et la remarque du médecin sont imprimés (jamais une conduite automatique).
- Bilan pré-biothérapie (infectieux, vaccinal, référence) avec « À retenir » : anomalies et examens en attente en tête, liste complète dessous.
- Notes d'équipe (épinglables), courbes (poids, **taille**, IMC, CRP, calprotectine, taux résiduel, hémoglobine…) avec zones de référence pédiatriques.

**Organisation**
- Planning HDJ : fauteuils, créneaux, capacité, jours d'ouverture, sans double réservation ; calendrier mensuel.
- **Feuille de planning imprimable** du jour ou de la semaine : patients, dose recalculée sur le dernier poids, flacons, prémédication, prélèvements à faire avant la perfusion, alertes, colonnes à remplir (poids du jour, lot, visa).
- Tableau de bord : séances du jour, retards, contrôles à faire, alertes (allergie, réaction antérieure, poids à mesurer, sauvegarde).

**Documents** (en-tête avec logo et identité de l'établissement, identité du patient sur chaque page, impression couleur sobre ou noir et blanc, export .html autonome)
- **Carnet de suivi A4** (soignants) : statut et sécurité, « à faire », prochaine séance, tableau des séances, contrôles, notes épinglées, courbes. *10 → 6 pages.*
- **Carnet patient bilingue français / arabe**, livret A5 de 8 pages remis une seule fois à la famille : couverture, 2 pages de séances, 2 pages d'examens, rendez-vous, consignes pédiatriques (« avant chaque séance je coche… », « à ne jamais faire »), urgences + carte détachable « Je suis sous biothérapie ». Dates et doses à venir laissées en blanc (remplies à la main). Version vierge imprimable.
- **Planification complète** (séances + contrôles), relevé des bilans, compte rendu de suivi éditable (« tolérance et sécurité », dernière dose, conclusion du médecin).
- **Rapport d'activité** : séances IV et SC séparées, taux de réalisation, réactions, reports, consommation par molécule, occupation en heures-fauteuil, file active, « à régulariser » ; **version anonymisée** pour l'administration. *Année : 5 → 2 pages.*

## 4. Comment c'est construit (pour la partie technique)

- **Application web locale** : HTML, CSS et JavaScript, sans framework ni dépendance externe ; ~1,1 Mo de code, ~7 700 lignes.
- Tourne dans **Microsoft Edge en mode application** (fenêtre dédiée, icône sur le Bureau, sans barre d'adresse) : aucun serveur, **aucune connexion Internet**, polices intégrées.
- Installation : copier un dossier dans `C:\HDJ`, lancer `Installer.bat` ; pas de droits administrateur ; mise à jour par `Mettre-a-jour.bat` sans toucher aux données.
- **Données** : sur le PC uniquement (stockage du navigateur dans un profil dédié) ; **sauvegarde automatique** sur clé USB ou disque après chaque modification (copie complète du jour, 90 jours puis une par mois) ; export manuel ; copie de sécurité automatique avant toute opération destructrice.
- **Sécurité** : code personnel par utilisateur, deux niveaux de droits, session propre à chaque fenêtre, journal des actions (suppressions conservées), aucune donnée transmise à l'extérieur, version anonymisée des statistiques.

## 5. Qualité et méthode

- Développé d'août à octobre 2026 (≈ 100 versions enregistrées), **piloté par le médecin** (chaque règle clinique et chaque document décidés par l'équipe), avec un **assistant de programmation par intelligence artificielle** (Claude Code) pour l'écriture du code, les vérifications et la documentation.
- **Audit complet du code** : 230 problèmes identifiés et corrigés ; relectures adversariales indépendantes à chaque étape (≈ 40 problèmes supplémentaires corrigés) ; audit de mise en service (sécurité des données, paquet Windows, performance) avec 3 points bloquants corrigés avant l'installation.
- **174 contrôles automatiques** de non-régression (5 suites : base et sauvegarde, dossier, documents, hors ligne, sécurité), relancés à chaque modification.
- Performance mesurée : chaque action < 0,2 s sur un PC lent avec la taille actuelle de la base.

## 6. Limites honnêtes et perspectives

- Un seul poste : pas de synchronisation entre plusieurs PC (passage par export / import).
- Stockage local limité à environ 5 Mo : suffisant pour plusieurs années pour ~100 patients ; un stockage étendu (IndexedDB) est prévu au-delà.
- Validation clinique et retour d'usage à mener ; textes arabes du carnet patient à faire relire.
- Pistes : z-scores de croissance (OMS), scores d'activité pédiatriques (PCDAI, PUCAI) suivis dans le temps, transition vers l'adulte, multi-postes en réseau, statistiques pour la recherche.
- Conformité : données de santé locales, aucune transmission, version anonymisée pour toute diffusion (loi 09-08).

## 7. Idées de plans de présentation

**Congrès (communication orale, 8–10 min, ~10 diapositives)**
1. Titre, auteurs, service.
2. Contexte : biothérapies en pédiatrie à l'HDJ, volume, enjeux (doses au poids, TDM, contrôles).
3. Problème : outils dispersés, risques d'erreur et d'oubli.
4. Objectif : un outil local, simple, sûr, sans Internet.
5. Méthode : conception pilotée par les soignants, développement assisté par IA, audits et tests.
6. Fonctionnalités clés (captures : tableau de bord, dossier, planning).
7. Documents (carnet patient bilingue, carnet A4, rapport anonymisé) : avant / après.
8. Résultats : gains (pages, temps, retards détectés), sécurité des données, premiers retours.
9. Limites et perspectives.
10. Conclusion + remerciements.

**Journée de présentation (20–30 min + démonstration en direct)**
- Même trame, plus une **démonstration** : créer un dossier fictif → planifier → marquer une séance faite → imprimer le carnet patient et la feuille du jour → rapport d'activité anonymisé.
- Une partie « comment l'installer dans un autre service » et une séance de questions.

**Captures d'écran** : utiliser la base de démonstration (patients fictifs) ; ne jamais montrer de vrais dossiers.

## 8. Ce que la nouvelle conversation devra vous demander

Durée exacte et format (oral, poster, e-poster), public (pédiatres, gastro-entérologues, pharmaciens, direction), langue, nombre de patients et de séances depuis la mise en service, temps gagné observé, anecdotes ou cas marquants (anonymisés), noms des auteurs et de l'encadrant, charte graphique imposée par le congrès.
