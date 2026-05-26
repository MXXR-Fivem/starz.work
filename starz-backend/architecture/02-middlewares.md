# Middlewares

## Middlewares actifs

- `requestLogger.middleware.ts`: log HTTP via Morgan
- `validate.middleware.ts`: validation Zod de `body/query/params`
- `auth.middleware.ts`: vérifie JWT access + session active en base
- `notFound.middleware.ts`: réponse 404 standardisée
- `error.middleware.ts`: réponse d'erreur centralisée

```mermaid
flowchart TD
    A[Request] --> B[helmet]
    B --> C[cors]
    C --> D[json/urlencoded parser]
    D --> E[requestLogger]
    E --> F[module routes]
    F --> G[notFound]
    G --> H[error]
```

## Détail auth middleware

```mermaid
flowchart LR
    Req[Authorization Bearer] --> Parse[Parse token]
    Parse --> VerifyJWT[Verify JWT]
    VerifyJWT --> CheckType[tokenType == access]
    CheckType --> CheckClaims[userId + sessionId]
    CheckClaims --> CheckSession[(sessions table)]
    CheckSession --> OK[req.auth set]
    OK --> Next["next()"]
```

- une requête protégée n'est acceptée que si la session n'est pas révoquée et non expirée
