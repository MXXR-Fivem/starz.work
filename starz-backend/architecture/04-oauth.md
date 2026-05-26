# OAuth

## Endpoints

- `GET /auth/oauth/:provider/url`
- `POST /auth/oauth/:provider`
- `POST /me/oauth/:provider`

`provider` accepté:

- `google`
- `github`
- `linkedin`

## Flow global

```mermaid
sequenceDiagram
    participant F as Front
    participant B as Backend
    participant P as OAuth Provider
    participant DB as MySQL

    F->>B: GET /auth/oauth/:provider/url?redirectUri=...&state=...
    B-->>F: url d'autorisation
    F->>P: redirect utilisateur
    P-->>F: callback ?code=...&state=...
    F->>B: POST /auth/oauth/:provider {code,redirectUri}
    B->>P: exchange code -> access token
    B->>P: fetch profile
    B->>DB: find/create user + auth_provider
    B->>DB: create session + refresh token
    B-->>F: user + accessToken + refreshToken
```

## Redirect URI et `state`

- Le backend valide strictement `redirectUri` contre `OAUTH_ALLOWED_REDIRECT_URIS`.
- En front, le callback standard est `https://starz.work/auth/callback/:provider`.
- Le même callback peut servir pour plusieurs intentions OAuth.
- `state` transporte le contexte front, par exemple `provider`, `mode` (`login` ou `link`) et `redirectTo`.
- Cette approche est utile pour GitHub, qui n'autorise qu'une seule callback URL par OAuth App.

## Flow de liaison d'un provider

```mermaid
sequenceDiagram
    participant F as Front
    participant B as Backend
    participant P as OAuth Provider
    participant DB as MySQL

    F->>B: GET /auth/oauth/:provider/url?redirectUri=...&state={"mode":"link"}
    B-->>F: url d'autorisation
    F->>P: redirect utilisateur
    P-->>F: callback /auth/callback/:provider?code=...&state=...
    F->>B: POST /me/oauth/:provider {code,redirectUri}
    B->>P: exchange code -> access token
    B->>P: fetch profile
    B->>DB: link auth_provider to current user
    B-->>F: user mis a jour
```

## Rôle du helper oauth

`src/helpers/oauth.ts` gère:

- construction des URL d'autorisation
- échange `code` -> `access_token`
- récupération profil provider
- normalisation profil (`providerId`, `email`, `firstName`, `lastName`)

## Variables d'environnement OAuth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `OAUTH_ALLOWED_REDIRECT_URIS`
