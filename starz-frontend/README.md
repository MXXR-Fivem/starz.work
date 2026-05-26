# Starz Frontend

Interface web Next.js de la plateforme Starz. Elle permet de rechercher des offres, consulter le detail d'une offre, candidater, gerer son profil, acceder a l'espace recruteur et utiliser l'administration.

## Stack

- Next.js 16 avec App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Axios pour les appels API
- MUI, PrimeReact et React Aria Components pour certains composants UI
- ESLint et TypeScript pour les controles de qualite

## Architecture

Le code applicatif est dans `src/`.

```txt
src/
  app/                    # routes Next.js
  components/
    assets/               # logos, icones
    features/             # blocs metier admin/recruteur
    layout/               # layout partage
    schemas/              # types/schemas API
    ui/                   # composants d'interface
  features/               # appels API par domaine
  lib/                    # client Axios, session, constantes
  styles/                 # styles globaux
  proxy.ts                # protection de routes cote Next.js
```

Routes principales :

- `/` : accueil
- `/offers` et `/offers/[id]` : recherche et detail des offres
- `/applications` : candidatures
- `/profile` : profil utilisateur
- `/hire` : espace recruteur
- `/admin` : administration
- `/auth/*` : login, confirmation email, reset password, callbacks OAuth

## Demarrage Local

Le plus simple est de lancer toute la stack locale depuis la racine du repo :

```bash
cp starz-backend/.env.example starz-backend/.env
cp starz-frontend/.env.example starz-frontend/.env
docker compose -f deploy/localhost/docker-compose.yml up --build
```

Services exposes :

- Frontend : `http://localhost:3000`
- Backend : `http://localhost:3001`
- Service IA : `http://localhost:8080`
- phpMyAdmin : `http://localhost:8081`

Pour developper uniquement le frontend hors Docker :

```bash
cd starz-frontend
npm install
cp .env.example .env
npm run dev
```

Variables utiles :

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_API_URL=http://localhost:8080
```

## Production

Build Next.js classique :

```bash
cd starz-frontend
npm install
npm run build
npm run start
```

L'image Docker de production est definie par `deploy/online/Dockerfile.frontend`.

```bash
cp deploy/online/.env.example deploy/online/.env
cp starz-backend/.env.example starz-backend/.env
cp starz-frontend/.env.example starz-frontend/.env
docker compose --env-file deploy/online/.env -f deploy/online/docker-compose.yml up --build -d
```

En production, `NEXT_PUBLIC_API_URL` et `NEXT_PUBLIC_AI_API_URL` restent dans `starz-frontend/.env`. Ces variables publiques sont lues par Next.js pendant le build Docker.

## Commandes Utiles

Depuis `starz-frontend` :

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

`npm run build` compile l'application Next.js. `npm run start` sert la build de production.
