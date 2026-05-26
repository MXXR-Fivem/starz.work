# Justification Innovation, Data et Dashboard — Starz.work

---

## 1. Problème utilisateur identifié

### 1.1 Le constat de départ

Le processus de recherche d'emploi dans la tech souffre de deux inefficacités majeures :

**Côté candidat :**
Les offres d'emploi sont dispersées sur de nombreuses plateformes (LinkedIn, Indeed, Welcome to the Jungle, WeLoveDevs, Jobteaser, etc.). Un candidat actif doit vérifier chaque plateforme séparément, sans aucune garantie que son profil correspond aux exigences de chaque offre. Il postule souvent à l'aveugle, ce qui génère un taux de réponse faible et une expérience frustrante.

**Côté recruteur :**
Publier sur plusieurs plateformes est coûteux en temps et en argent. La gestion des candidatures reste souvent morcelée entre les emails, des outils ATS séparés et les interfaces propriétaires de chaque plateforme. Il n'existe pas de solution abordable permettant à une petite équipe de gérer l'ensemble du cycle de recrutement en un seul endroit.

### 1.2 Hypothèse centrale

> Un candidat qui sait à l'avance que son profil correspond à une offre postulerart davantage et avec de meilleures chances de succès. Une plateforme qui agrège les offres et calcule automatiquement ce score de correspondance réduit le temps perdu des deux côtés.

### 1.3 Validation de l'hypothèse

| Signal | Source | Interprétation |
|---|---|---|
| 78% des candidats abandonnent une candidature si elle prend plus de 10 minutes | Talent Board, 2023 | Justifie la simplification du formulaire |
| Le matching algorithmique augmente les taux de réponse de 35% | LinkedIn Internal Data, 2022 | Valide l'investissement dans le service IA |
| Les plateformes d'emploi généralistes perdent des parts de marché au profit des spécialisées | APEC, 2023 | Valide le positionnement tech |
| WeLoveDevs publie plusieurs centaines d'offres tech par semaine | Observation directe | Valide l'agrégation comme source rapide de contenu |

---

## 2. Innovation : le matching IA transparent

### 2.1 Le problème du matching opaque

Les plateformes existantes qui proposent un matching (LinkedIn, Jobteaser) utilisent des algorithmes de recommandation propriétaires dont le fonctionnement n'est pas communiqué aux utilisateurs. Un candidat reçoit une recommandation sans comprendre pourquoi son profil est ou n'est pas compatible avec une offre.

Cette opacité a plusieurs effets négatifs :
- Le candidat ne peut pas améliorer son profil pour augmenter ses chances sur une offre spécifique.
- La confiance dans le système est réduite (biais algorithmiques suspectés).
- L'effet de matching se limite à une recommandation passive, pas à une aide active.

### 2.2 Notre approche : explicabilité du matching

Le service IA de Starz.work calcule un score de compatibilité entre un CV et une offre selon une méthode explicite et auditable.

**Algorithme :**

```
1. Extraction des keywords techniques de l'offre
   - Détection des lignes "Skills:" (format WeLoveDevs)
   - Application d'un dictionnaire pondéré de technologies, outils et pratiques prédéfinies (TECH_KEYWORDS)
   - Support des expressions multi-mots comme React Native, Docker Compose ou CI/CD
   - Lemmatisation via Spacy (en_core_web_sm) pour normaliser les formes
   - Maximum de 45 keywords retenus par offre

2. Détection de ces keywords dans le CV du candidat
   - Comparaison insensible à la casse avec boundaries de mots
   - Intersection entre keywords offre et keywords CV

3. Calcul du score
   - score = (poids des keywords trouvés / poids des keywords de l'offre) * 100
   - Classification du résultat en strong_match, partial_match ou weak_match
   - Résultat : score, liste des keywords de l'offre, keywords trouvés, keywords manquants et suggestions
```

**Exemple de résultat affiché au candidat :**
```
Score : 75/100

Compétences trouvées (6) : react, typescript, node, docker, git, javascript
Compétences manquantes (2) : kubernetes, redis
```

Ce retour explicite permet au candidat de :
- Comprendre pourquoi il matche à 75%.
- Ajouter "kubernetes" et "redis" à son CV s'il les maîtrise.
- Choisir en connaissance de cause de postuler ou non.

### 2.3 Caractère innovant par rapport aux concurrents

Aucune plateforme de recrutement grand public n'offre actuellement un score de matching **explicite et actionnable** au niveau du détail de chaque compétence technique. C'est le principal différenciateur de Starz.work.

---

## 3. Stratégie data : agrégation WeLoveDevs

### 3.1 Le problème du cold start

Une plateforme de mise en relation souffre du problème du "cold start" : sans offres, il n'y a pas de candidats ; sans candidats, les recruteurs n'ont pas d'intérêt à publier. Ce cercle vicieux est le principal obstacle au lancement d'une nouvelle plateforme de recrutement.

### 3.2 Notre solution : agrégation automatique

Pour contourner ce problème, Starz.work intègre une synchronisation automatique avec l'API WeLoveDevs, une plateforme spécialisée tech qui met à disposition ses offres via une API partenaire.

**Fonctionnement technique :**
- Un job planifié (cron) se lance toutes les 10 minutes (configurable).
- Il consomme l'API WeLoveDevs par page de 100 offres.
- Chaque offre est stockée avec sa source (`source_name = 'welovedevs'`, `external_id = id WLD`).
- Le système est idempotent : une offre déjà importée n'est pas dupliquée (clé unique sur `source_name + external_id`).
- Le `raw_payload` JSON de chaque offre est conservé pour traçabilité et debugging.

**Respect du rate limit WeLoveDevs (1 req/sec) :**

L'API WeLoveDevs impose une limite de 1 requête par seconde. Notre implémentation respecte cette contrainte via :
- Un délai minimum de 1 200 ms entre chaque appel (marge de sécurité de 200 ms).
- Un mécanisme de retry sur les erreurs 429 (Too Many Requests), avec jusqu'à 6 tentatives.
- Voir le document `06-decisions-data-welovedevs.md` pour la justification détaillée de ces choix.

**Volume attendu :** plusieurs centaines à quelques milliers d'offres tech disponibles dès le lancement, sans qu'aucun recruteur n'ait encore publié sur la plateforme.

### 3.3 Traçabilité des sources

Chaque offre est liée à sa source dans la table `offer_sources`. Cela permet de :
- Distinguer les offres publiées manuellement des offres agrégées.
- Retourner à la source originale si nécessaire (lien vers l'annonce WeLoveDevs).
- Préparer l'intégration de futures sources (Indeed, LinkedIn, etc.) sans refactoring majeur.

---

## 4. Dashboard et mesure du succès

### 4.1 Métriques produit définies

Pour mesurer si Starz.work atteint ses objectifs, nous avons défini les métriques suivantes.

**Métriques candidat :**

| Métrique | Description | Cible MVP |
|---|---|---|
| Taux d'inscription complète | Pourcentage d'utilisateurs qui finalisent leur inscription | > 75% |
| Taux d'activation candidat | Au moins 1 candidature soumise | > 30% des inscrits |
| Score moyen de matching | Score IA moyen au moment de la candidature | > 60 |
| Taux d'offres en favoris | Offres sauvegardées / offres vues | > 10% |
| Retour journalier | Utilisateurs actifs J+7 / inscrits | > 25% |

**Métriques recruteur :**

| Métrique | Description | Cible MVP |
|---|---|---|
| Taux d'activation recruteur | Au moins 1 offre publiée | > 40% |
| Temps de publication | De l'inscription à la première offre publiée | < 10 minutes |
| Taux de traitement des candidatures | Candidatures avec statut changé / total | > 60% |

**Métriques plateforme :**

| Métrique | Description | Cible MVP |
|---|---|---|
| Offres importées depuis WeLoveDevs | Volume total d'offres disponibles | > 500 |
| Uptime | Disponibilité du service | > 99% |
| Taux d'erreur API | Réponses 5xx / total requêtes | < 1% |

### 4.2 Espace d'administration

Un espace staff (`/staff/*`) permet aux administrateurs de la plateforme de :
- Visualiser les statistiques globales (users, offres, candidatures).
- Modérer les offres publiées (approuver / rejeter).
- Gérer les utilisateurs (bannissement, suppression).
- Consulter les logs de modération pour auditabilité.

Chaque action de modération est enregistrée dans la table `moderation_logs` avec l'identité de l'administrateur, la date, l'action et la raison, garantissant la traçabilité complète des décisions de modération.

### 4.3 Pertinence des données collectées

Les données collectées par la plateforme sont limitées au strict nécessaire pour le fonctionnement du service :
- Email et nom pour l'authentification et les notifications.
- CV pour le calcul du score de matching (stocké côté serveur, accessible uniquement par l'utilisateur et les recruteurs auxquels il postule).
- Historique des candidatures pour le tableau de bord utilisateur.
- Logs de sessions pour la sécurité (révocation possible de chaque session individuelle).

Aucune donnée de tracking comportemental (clics, temps passé sur les pages) n'est collectée dans le périmètre du MVP.
