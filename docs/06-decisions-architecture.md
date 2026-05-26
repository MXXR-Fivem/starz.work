# Décisions Architecture — Why / How / Trade-off

---

## 1. Décision : Architecture microservices légère (3 services distincts)

### Why

Le projet est composé de trois domaines fonctionnels clairement séparés :

1. **L'API backend** (gestion des utilisateurs, offres, candidatures, entreprises) — domaine métier central.
2. **Le frontend** (interface utilisateur) — rendu web, séparé pour permettre une évolution indépendante.
3. **Le service IA** (analyse NLP, scoring CV/offre) — domaine technique spécialisé, en Python, qui ne doit pas coupler ses dépendances (spacy, pypdf) au backend Node.js.

Séparer ces trois services permet à chaque équipe de travailler indépendamment sur son périmètre, avec des technologies adaptées à chaque cas d'usage.

### How

- **Backend :** Node.js + TypeScript + Express.js — écosystème JavaScript homogène avec le frontend, typage fort, large communauté.
- **Frontend :** Next.js (React) — rendu hybride SSR/SSG, App Router, déploiement edge possible.
- **AI Service :** FastAPI (Python) — écosystème NLP mature (spacy, pypdf, transformers), API REST légère.

Les trois services communiquent via HTTP :
- Frontend → Backend : appels REST authentifiés (JWT dans Authorization header).
- Backend → AI Service : appel interne `POST /analyze` (réseau Docker interne, non exposé publiquement).

### Trade-off

**Avantage :** Chaque service est déployable, scalable et maintenu indépendamment. Le service IA peut être remplacé par un modèle plus performant sans toucher au backend. Le frontend peut être rewrite sans modifier l'API.

**Inconvénient :** Trois services à maintenir au lieu d'un monolithe. Overhead de configuration (Docker Compose, réseaux, healthchecks). Complexité accrue pour les tests d'intégration end-to-end.

**Décision retenue :** L'architecture 3 services est justifiée par la nature hétérogène des technologies (JavaScript vs Python). Le monolithe aurait été sous-optimal : embarquer spacy dans un processus Node.js n'est pas standard et complexifierait le build.

---

## 2. Décision : Architecture modulaire du backend (pattern Module)

### Why

Un backend Express.js sans structure dégénère rapidement en "spaghetti code" lorsque le nombre de routes augmente. Nous avons opté pour une architecture modulaire inspirée de NestJS mais sans sa complexité (decorators, DI container).

Chaque fonctionnalité métier est encapsulée dans un module autonome avec sa propre couche routes / controller / service / schema.

### How

Structure d'un module :
```
src/modules/<module>/
  <module>.routes.ts    — déclaration des endpoints Express + middlewares
  <module>.controller.ts — logique HTTP (req → res), délègue au service
  <module>.service.ts    — logique métier + accès base de données
  <module>.schemas.ts    — schémas de validation Zod (input/output)
```

Le flux d'une requête :
```
Requête HTTP
  → Route (Express)
  → Middleware validate (Zod)
  → Middleware auth (JWT)
  → Controller
  → Service
  → MySQL (requête SQL directe avec mysql2/promise)
  → Réponse standardisée { success, message, data }
```

### Trade-off

**Avantage :** Code organisé et navigable. Chaque module est testable indépendamment. Séparation claire des responsabilités.

**Inconvénient :** Plus de fichiers qu'un backend flat (un fichier par module × 4 couches × 8 modules = ~32 fichiers). Pas d'ORM, les requêtes SQL sont écrites manuellement, ce qui demande plus de rigueur.

**Décision retenue :** Pas d'ORM (voir alternative rejetée ci-dessous). SQL direct avec mysql2 reste lisible pour l'équipe et offre un contrôle total sur les requêtes.

---

## 3. Décision : MySQL 8 comme base de données relationnelle

### Why

Les données de Starz.work sont fortement relationnelles : un utilisateur appartient à une entreprise, une offre a des skills, une candidature lie un utilisateur à une offre, etc. Une base relationnelle est naturellement adaptée pour modéliser ces relations avec des clés étrangères et garantir l'intégrité référentielle.

MySQL 8 est choisi pour :
- Sa maturité et sa stabilité en production.
- Le support des indexes FULLTEXT pour la recherche textuelle sur les offres.
- La disponibilité d'une image Docker officielle `mysql:8.0`.
- La familiarité de l'équipe avec le SQL.

### How

- Schéma complet dans `database/init.sql` (versionné en git).
- Connexion via pool mysql2/promise (10 connexions par défaut, configurable).
- Indexes composites sur les colonnes les plus filtrées : `(status, moderation_status, expires_at, premium, published_at)` pour le listing des offres.
- Index FULLTEXT sur `(title, description, description_preview)` pour la recherche.
- Transactions SQL via un helper `withTransaction()` pour les opérations multi-tables.

### Trade-off

**Avantage :** Intégrité des données garantie par les contraintes SQL. Requêtes optimisées possibles. Pas de sur-abstraction ORM.

**Inconvénient :** Schema rigid — toute modification nécessite une migration SQL. Pas de migrations automatiques dans le MVP (init.sql complet).

**Décision retenue :** MySQL 8 pour le MVP. L'absence d'un outil de migrations (Flyway, Liquibase, ou Knex migrations) est une limite à adresser avant une mise en production.

---

## 4. Décision : Authentification JWT avec sessions en base de données

### Why

Un JWT "stateless" classique (sans vérification en base) est simple mais présente un problème de sécurité : impossible de révoquer un token avant son expiration. Si un utilisateur se déconnecte ou est banni, son token reste valide jusqu'à expiration.

Nous avons choisi un modèle hybride :
- Les **access tokens** (JWT) ont une durée de vie courte (15 minutes).
- Les **refresh tokens** sont stockés (hashés) en base de données, dans une table `sessions`, et peuvent être révoqués à tout moment.
- À chaque requête authentifiée, l'existence et la validité de la session sont vérifiées en base.

### How

```
Connexion :
  → Création session en DB (table sessions)
  → Génération access token JWT (15min)
  → Génération refresh token, hash stocké en DB (30 jours)
  → Refresh token envoyé en cookie httpOnly

Requête authentifiée :
  → Vérification signature JWT
  → Vérification session non révoquée en DB
  → Injection req.auth = { userId, sessionId }

Déconnexion :
  → Révocation session en DB (is_revoked = true)

Refresh :
  → Vérification hash refresh token en DB
  → Rotation : nouveau refresh token + révocation ancien
  → Nouveau access token JWT
```

### Trade-off

**Avantage :** Révocation possible à tout moment. Gestion multi-sessions (plusieurs appareils). Suivi IP/User-Agent pour détection d'activité suspecte.

**Inconvénient :** Une requête DB supplémentaire par requête authentifiée (vérification session). Légère latence ajoutée par rapport à un JWT purement stateless.

**Décision retenue :** Le coût d'une requête DB est acceptable (pool de connexions, requête par clé primaire, < 1ms en général). La sécurité prime sur la performance à l'échelle du MVP.

---

## 5. Alternative rejetée : utilisation d'un ORM (Prisma ou TypeORM)

### Description de l'alternative

Prisma et TypeORM sont les deux ORM TypeScript les plus populaires pour Node.js. Ils permettent de définir le schéma en TypeScript, de générer les requêtes SQL automatiquement, et de gérer les migrations de schema via des outils CLI.

### Pourquoi nous l'avons rejeté

**Couche d'abstraction vs contrôle :**
Les ORM génèrent parfois des requêtes SQL sous-optimales. Avec Prisma par exemple, les relations N+1 doivent être anticipées avec des `include` imbriqués. Le listing des offres, qui implique des jointures avec plusieurs tables (skills, company, offer_sources), requiert un contrôle fin des requêtes SQL pour les performances.

**Complexité du setup :**
Prisma impose un workflow de migrations (prisma migrate dev, prisma migrate deploy) qui ajoute de la complexité pour une équipe qui maîtrise déjà le SQL. TypeORM est réputé pour ses bugs subtils avec les types TypeScript avancés.

**Transparence pédagogique :**
Dans le cadre d'un projet académique, écrire les requêtes SQL directement permet à chaque membre de l'équipe de comprendre exactement ce qui se passe en base de données, sans boîte noire.

**Notre compromis :**
Le helper `withTransaction()` et les services mutualisent la logique d'accès à la base. Zod valide les inputs avant toute requête. mysql2/promise offre un typage suffisant pour l'usage qu'on en fait.

### Conclusion sur ce choix

Le SQL direct avec mysql2 est plus verbeux mais plus transparent et plus performant pour notre cas d'usage. Nous perdons la génération automatique de migrations, ce qui est une dette technique à adresser avant un déploiement en production.
