# Routes / Controller / Service / Schema

## Roles

- `auth.routes.ts`: déclare les endpoints et attache middlewares + validation
- `auth.schemas.ts`: définit les schémas Zod des entrées
- `auth.controller.ts`: lit la requête validée, appelle le service, construit la réponse HTTP
- `auth.service.ts`: logique métier + accès base + sécurité + intégrations

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Route
    participant V as Zod Validation
    participant Ctrl as Controller
    participant S as Service
    participant DB as MySQL

    C->>R: HTTP request
    R->>V: validate body/query/params
    V-->>R: data validée
    R->>Ctrl: handler(req,res,next)
    Ctrl->>S: appel métier
    S->>DB: queries
    DB-->>S: rows/result
    S-->>Ctrl: résultat métier
    Ctrl-->>C: JSON success/error
```

## Convention de réponse

- succès:
  - `success: true`
  - `message`
  - `data` si nécessaire
- erreur:
  - `success: false`
  - `message`
  - `errors` pour validation
