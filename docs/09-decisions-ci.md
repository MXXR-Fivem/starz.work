# Décisions CI/CD — Why / How / Trade-off

---

## 1. Décision : Mise en place d'une pipeline CI avec GitHub Actions

### Why

Sans intégration continue, chaque développeur travaille sur sa branche sans garantie que son code compile, passe les tests et respecte les conventions de l'équipe. Les problèmes sont découverts lors des merges, souvent trop tard et dans un état difficile à déboguer.

GitHub Actions est la solution CI native de GitHub, disponible sans configuration d'infrastructure supplémentaire. Le dépôt est déjà hébergé sur GitHub, ce qui rend l'intégration immédiate.

**Objectifs de la CI :**
- Garantir que le code TypeScript compile sans erreur.
- Vérifier le respect des conventions de code (ESLint, Prettier).
- Exécuter les tests automatiquement à chaque push.
- Détecter les vulnérabilités de dépendances (npm audit).
- Bloquer les merges sur `main` si la CI échoue.

### How

La pipeline est définie dans `.github/workflows/deploy.yml` et se déclenche sur chaque push et pull request vers `main`.

**Jobs parallèles :**

```yaml
jobs:
  backend:     # Node.js 24 — build, lint, tests
  frontend:    # Node.js 24 — typecheck, lint, build Next.js
```

**Job backend — étapes détaillées :**

```
1. Checkout du code
2. Setup Node.js 24 (cache npm)
3. npm ci — installation reproductible des dépendances
4. npm run build — compilation TypeScript (détection erreurs de type)
5. npm run lint — ESLint (règles qualité code)
6. npm test — tests unitaires + smoke tests (sans DB)
7. npm run test:db — tests d'intégration avec MySQL 8.4 réel
8. npm run audit — vérification vulnérabilités CVE
```

**Service MySQL pour les tests d'intégration :**

```yaml
services:
  mysql:
    image: mysql:8.4
    env:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: job_aggregator_test
      MYSQL_USER: app
      MYSQL_PASSWORD: app
    ports:
      - 33307:3306
    options: --health-cmd="mysqladmin ping" --health-interval=5s --health-retries=5
```

Les tests d'intégration DB (`test:db`) s'exécutent contre une vraie instance MySQL, sans mock. Cela garantit que les requêtes SQL fonctionnent réellement.

**Job frontend — étapes détaillées :**

```
1. Checkout du code
2. Setup Node.js 24 (cache npm)
3. npm ci
4. npm run typecheck — vérification TypeScript strict
5. npm run lint — ESLint Next.js
6. npm run build — build de production Next.js (détection erreurs SSR, imports manquants)
```

### Trade-off

**Avantage :** Filet de sécurité automatique. Chaque PR bénéficie d'une vérification complète avant merge. Détection précoce des régressions.

**Inconvénient :** Durée d'exécution : le job backend (tests d'intégration DB inclus) prend environ 2 à 4 minutes. Le job frontend (Next.js build) prend 1 à 2 minutes. Un développeur doit attendre la CI avant de merger.

**Décision retenue :** Les deux jobs tournent en parallèle pour minimiser le temps total. Le coût en temps est acceptable au regard de la sécurité apportée.

---

## 2. Décision : Séparation tests unitaires / smoke / intégration DB

### Why

Tous les tests ne sont pas équivalents en termes de vitesse et de prérequis :

- Les **tests unitaires** testent des fonctions pures (helpers, utilitaires) sans aucune dépendance externe. Ils s'exécutent en millisecondes.
- Les **smoke tests** vérifient que les routes HTTP répondent avec le bon statut, sans toucher la base de données. Ils s'exécutent en quelques secondes.
- Les **tests d'intégration DB** testent des parcours métier complets contre une vraie base MySQL. Ils nécessitent un service Docker et prennent plusieurs dizaines de secondes.

Cette séparation permet de lancer rapidement les tests légers en développement local (`npm test`) et de réserver les tests d'intégration lourds à la CI.

### How

```bash
npm test           # unit + smoke (rapide, sans DB, en dev local)
npm run test:unit  # uniquement les tests unitaires
npm run test:smoke # uniquement les smoke tests
npm run test:db    # uniquement les tests d'intégration DB (nécessite MySQL)
```

**Organisation des fichiers de tests :**

```
tests/
  unit/                   # Tests unitaires (helpers, parseurs, etc.)
    string.test.ts
    date.test.ts
    upload.test.ts
  integration/            # Smoke tests (routes HTTP avec Supertest)
    auth.smoke.test.ts
    offers.smoke.test.ts
  integration-db/         # Tests métier complets avec MySQL
    auth.db.test.ts
    offers.db.test.ts
    applications.db.test.ts
```

### Trade-off

**Avantage :** Feedback rapide en développement (npm test < 5s). Tests complets en CI.

**Inconvénient :** Trois commandes différentes à connaître. Les tests d'intégration DB nécessitent un setup préalable (`npm run test:db:prepare`) en local.

---

## 3. Décision : Tests d'intégration avec vraie base de données (pas de mocks)

### Why

Mocker la base de données dans les tests d'intégration est une pratique risquée : le mock peut se comporter différemment de la vraie base (types de colonnes, contraintes, comportement des indexes FULLTEXT, etc.). Des tests qui passent avec un mock peuvent échouer en production.

Nous avons fait le choix de tester contre une vraie instance MySQL, aussi bien en CI (MySQL 8.4 dans un service GitHub Actions) qu'en local (MySQL Docker via `scripts/prepare-test-db.ts`).

### How

Le script `prepare-test-db.ts` automatise la préparation de l'environnement de test :
1. Démarrage du container MySQL Docker si nécessaire.
2. Création de la base `job_aggregator_test`.
3. Exécution de `database/init.sql` (schéma complet).
4. Exécution de `database/seeds/test.sql` (données de test : utilisateurs, entreprise, offres).

Les tests utilisent des fixtures reproductibles (seeds), ce qui garantit que chaque run repart dans un état connu.

### Trade-off

**Avantage :** Tests fiables, proches des conditions de production. Détection des problèmes SQL réels (requêtes lentes, contraintes violated, etc.).

**Inconvénient :** Dépendance à Docker en développement local. Temps d'exécution plus long. Nécessite une isolation des données entre les tests (ordre d'exécution, nettoyage).

---

## 4. Décision : ESLint + Prettier pour l'uniformité du code

### Why

Avec plusieurs développeurs sur le même projet, les styles de code divergent rapidement (indentation, quotes, point-virgules, ordre des imports). Les revues de code se transforment en débats stylistiques plutôt qu'en analyse fonctionnelle.

ESLint détecte les problèmes de qualité (variables non utilisées, code mort, patterns dangereux). Prettier formate automatiquement le code pour éliminer toute discussion stylistique.

### How

- `.eslintrc` ou `eslint.config.mjs` définit les règles : TypeScript strict, imports, etc.
- Prettier est configuré pour formatage automatique (2 espaces, double quotes, etc.).
- `npm run lint` s'exécute en CI et bloque le merge si des violations sont détectées.
- En développement local, les éditeurs peuvent intégrer ESLint et Prettier via des extensions (VS Code, JetBrains).

### Trade-off

**Avantage :** Code homogène dans toute la base de code. Revues de code centrées sur la logique, pas le style.

**Inconvénient :** Courbe d'apprentissage pour les développeurs non familiers avec ESLint. Certaines règles peuvent sembler contraignantes (ex: interdiction de `any` en TypeScript strict).

**Décision retenue :** ESLint + Prettier sont des standards de l'industrie JavaScript/TypeScript. Leur adoption est non négociable pour un projet professionnel.
