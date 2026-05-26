# Starz Backend

API REST Express/TypeScript de la plateforme Starz. Elle gere l'authentification, les profils, les offres, les candidatures, l'espace entreprise, l'administration, les notifications et les fichiers prives.

## Stack

- Node.js 22
- Express 5
- TypeScript
- MySQL 8 avec `mysql2`
- Zod pour la validation des entrees
- JWT + refresh token cookie pour l'authentification
- Swagger UI pour la documentation OpenAPI
- Jest + Supertest pour les tests

## Architecture

Le code applicatif est dans `src/`.

```txt
src/
  app.ts                    # configuration Express
  server.ts                 # demarrage HTTP
  config/                   # env, database, swagger
  helpers/                  # fonctions partagees
  middlewares/              # auth, validation, erreurs, rate limit
  modules/
    <module>/
      <module>.routes.ts
      <module>.schemas.ts
      <module>.controller.ts
      <module>.service.ts
```

Les modules principaux sont `auth`, `me`, `offers`, `applications`, `company`, `notifications`, `staff` et `health`.

La base est initialisee avec `../database/init.sql`. Les migrations SQL dans `../database/migrations/` sont appliquees automatiquement au demarrage, sauf si `DB_AUTO_MIGRATIONS=false`.

## Demarrage Local

Le plus simple est de lancer toute la stack locale depuis la racine du repo :

```bash
cp starz-backend/.env.example starz-backend/.env
cp starz-frontend/.env.example starz-frontend/.env
docker compose -f deploy/localhost/docker-compose.yml up --build
```

Services exposes :

- API : `http://localhost:3001`
- Documentation OpenAPI : `http://localhost:3001/docs`
- Healthcheck : `http://localhost:3001/health`
- phpMyAdmin : `http://localhost:8081`

Le compose local lance MySQL, le backend, le frontend, phpMyAdmin et le service IA. Les variables MySQL ont des valeurs par defaut (`app/app`, base `job_aggregator`) et peuvent etre surchargees dans l'environnement.

Pour developper uniquement le backend hors Docker :

```bash
cd starz-backend
npm install
cp .env.example .env
npm run dev
```

Dans ce mode, une base MySQL doit deja etre accessible avec les variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` et `DB_NAME`.

## Production

Le compose de production est dans `deploy/online/docker-compose.yml`. Les variables sont separees par responsabilite :

- `deploy/online/.env` : ports hote et configuration MySQL du compose
- `starz-backend/.env` : configuration runtime du backend
- `starz-frontend/.env` : configuration runtime/build du frontend

```bash
cp deploy/online/.env.example deploy/online/.env
cp starz-backend/.env.example starz-backend/.env
cp starz-frontend/.env.example starz-frontend/.env
docker compose --env-file deploy/online/.env -f deploy/online/docker-compose.yml up --build -d
```

Avant le demarrage production, renseigner au minimum dans `starz-backend/.env` :

- `NODE_ENV=production`
- `JWT_SECRET` avec une valeur forte
- `CORS_ALLOWED_ORIGINS`
- les variables SMTP/OAuth si les fonctionnalites associees sont utilisees

Les variables DB du backend sont forcees par le compose pour pointer vers le service MySQL interne. Le service backend ecoute sur `127.0.0.1:${BACKEND_HOST_PORT:-3001}` et conserve les uploads dans le volume Docker `backend_uploads`.

## Commandes Utiles

Depuis `starz-backend` :

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:db
npm run audit
```

`npm test` lance les tests rapides sans vraie base. `npm run test:db` prepare une base de test MySQL puis execute les tests d'integration DB.

## Documentation API

- Source OpenAPI : `src/docs/openapi/openapi.yml`
- Collection Insomnia : `Insomnia.yaml`

OpenAPI est la reference des contrats HTTP. Insomnia sert surtout au test manuel pendant le developpement.
