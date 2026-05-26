# Product Discovery — Starz.work

## 1. Contexte et tendances du marché

### 1.1 Le marché de l'emploi tech en France

Le secteur du recrutement digital connaît une transformation profonde depuis plusieurs années. En France, plus de **450 000 offres d'emploi dans la tech** sont publiées chaque année (source : APEC, 2023), réparties sur une multitude de plateformes : LinkedIn, Welcome to the Jungle, Jobteaser, Indeed, JobAdder, etc.

Cette dispersion crée un problème structurel : **les candidats doivent naviguer entre plusieurs plateformes** pour avoir une vue complète des opportunités disponibles, tandis que les recruteurs peinent à toucher tous les profils qualifiés.

### 1.2 Tendances identifiées

| Tendance | Description | Impact pour Starz |
|---|---|---|
| **Agrégation de contenu** | Les utilisateurs préfèrent un point d'entrée unique (comme Skyscanner pour le voyage) | Justifie le modèle agrégateur |
| **Matching automatisé** | L'IA est de plus en plus utilisée pour matcher candidats et offres | Valide l'intégration du service IA |
| **Transparence salariale** | Les candidats exigent les fourchettes de salaires | Intégré dans le modèle de données |
| **Remote et hybride** | 60% des candidats tech filtrent par politique de télétravail | Champ `remote_policy` présent |
| **Expérience candidat** | Le taux d'abandon des candidatures est élevé sur les plateformes complexes | Justifie une interface simplifiée |
| **Authentification sociale** | Les utilisateurs refusent de créer un nième compte | OAuth Google, GitHub, LinkedIn intégré |

### 1.3 Taille et dynamiques du marché

- Le marché français du recrutement en ligne est estimé à **plus de 2 milliards d'euros** (2023).
- Les plateformes spécialisées tech (Welcome to the Jungle, Jobteaser) captent une part croissante au détriment des généralistes (Indeed, Monster).
- L'intégration d'outils d'IA dans le recrutement est passée de 15% à 42% des plateformes entre 2020 et 2024.

---

## 2. Analyse des besoins utilisateurs

### 2.1 Identification des personas

Nous avons identifié deux personas principaux pour Starz.work :

#### Persona 1 — Le Candidat (statut `en_recherche`)

> *"Je cherche un emploi en développement web, mais je passe des heures chaque semaine à chercher sur LinkedIn, Welcome to the Jungle et Jobteaser séparément. Je ne sais jamais si mon CV correspond vraiment à ce qu'on me demande."*

**Profil :** Développeur ou profil tech, 22-35 ans, en reconversion ou en recherche active.

**Problèmes identifiés :**
- Dispersion des offres sur de multiples plateformes.
- Impossibilité d'évaluer rapidement si son profil correspond à une offre.
- Perte de temps à postuler à des offres mal ciblées.
- Difficulté à suivre ses candidatures et leur statut.

**Besoins :**
- Centralisation des offres en un seul endroit.
- Matching automatique CV ↔ offre pour prioriser les candidatures.
- Tableau de bord pour suivre ses candidatures.
- Sauvegarde d'offres en favoris pour y revenir plus tard.

#### Persona 2 — Le Recruteur (statut `recruteur`)

> *"Je publie des offres sur plusieurs plateformes et je reçois des candidatures peu qualifiées. Je voudrais toucher des candidats tech sans payer des fortunes à LinkedIn Recruiter."*

**Profil :** RH ou founder d'une startup tech, 28-45 ans.

**Problèmes identifiés :**
- Coût élevé des plateformes de recrutement généralistes.
- Beaucoup de candidatures hors-cible.
- Gestion des candidatures fragmentée (email, ATS séparé, etc.).

**Besoins :**
- Publier des offres simplement et rapidement.
- Gérer les candidatures depuis une interface centralisée.
- Inviter des collègues pour co-gérer le processus de recrutement.
- Accéder à une audience de profils tech qualifiés.

### 2.2 Synthèse des besoins

| Besoin | Candidat | Recruteur |
|---|:---:|:---:|
| Centralisation des offres | ✅ | |
| Matching IA CV ↔ offre | ✅ | |
| Suivi des candidatures | ✅ | ✅ |
| Gestion des équipes de recrutement | | ✅ |
| Interface simple (pas de friction) | ✅ | ✅ |
| Authentification sociale | ✅ | ✅ |
| Notifications temps réel | ✅ | ✅ |

---

## 3. Proposition de valeur

### 3.1 Pour les candidats

> **Starz.work agrège les meilleures offres tech du marché et t'indique en un clic si ton profil correspond, pour que tu postules moins mais mieux.**

- Une seule plateforme pour toutes les offres (WeLoveDevs + offres directes).
- Score de matching instantané entre le CV déposé et n'importe quelle offre.
- Interface épurée, authentification en un clic via Google, GitHub ou LinkedIn.
- Suivi centralisé de toutes ses candidatures et leur évolution.

### 3.2 Pour les recruteurs

> **Starz.work te donne accès à une communauté de candidats tech qualifiés, avec une gestion des candidatures intégrée, sans les frais des grandes plateformes.**

- Publication d'offres sans friction (draft → publié en quelques clics).
- Vue consolidée des candidatures par offre avec gestion des statuts.
- Espace entreprise multi-utilisateurs (owner + membres).
- Offres alimentées par l'agrégation WeLoveDevs pour augmenter la visibilité.

### 3.3 Positionnement

```
                  Spécialisé tech
                        |
          Jobteaser      |     Welcome to the Jungle
                         |
Généraliste ─────────────┼───────────────── Spécialisé tech
  (Indeed, Monster)      |
                         |       Starz.work
                         |    (agrégation + IA matching)
                  Grand public
```

Starz.work se positionne sur le segment **spécialisé tech** avec un différenciateur fort : le **matching IA automatique**, absent des plateformes concurrentes directes dans sa forme intégrée.

---

## 4. Hypothèses produit

| Hypothèse | Mesure de succès |
|---|---|
| Les candidats sont frustrés par la dispersion des offres | Taux de retour journalier > 30% |
| Le matching IA améliore la qualité des candidatures | Taux d'offres "accepted" supérieur à la moyenne du marché (≈ 5%) |
| L'agrégation WeLoveDevs attire des candidats | Nombre d'offres importées > 500 au lancement |
| L'authentification OAuth réduit le taux d'abandon | Taux de complétion d'inscription > 80% |
| Les recruteurs valorisent la gestion intégrée | Taux d'activation recruteur (au moins 1 offre publiée) > 40% |

---

## 5. Périmètre fonctionnel retenu (MVP)

Pour ce projet dans le cadre du module B-YEP-200, nous avons délibérément scopé le MVP aux fonctionnalités à plus fort impact :

**Inclus dans le MVP :**
- Authentification complète (email, OAuth multi-provider)
- Listing et détail d'offres avec recherche et filtres
- Agrégation automatique depuis WeLoveDevs
- Matching IA CV ↔ offre (score de compatibilité)
- Candidature avec lettre de motivation
- Suivi des candidatures (statuts)
- Espace recruteur (publication + gestion candidatures)
- Espace admin (modération)
- Notifications internes

**Hors périmètre MVP (futures itérations) :**
- Messagerie interne candidat ↔ recruteur
- Alertes email pour nouvelles offres matchées
- Profil public candidat visible des recruteurs
- Intégration d'autres sources (Indeed, LinkedIn Jobs)
- Application mobile
