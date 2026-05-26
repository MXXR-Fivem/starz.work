# Schéma de base de données

Ce document décrit le modèle relationnel MySQL défini dans `database/init.sql`. Le schéma couvre les comptes, les rôles, les entreprises, les offres, l'ingestion WeLoveDevs, les candidatures, les notifications et la modération.

## Vue ERD

```mermaid
erDiagram
    ROLES ||--o{ USERS : assigns
    COMPANIES ||--o{ USERS : employs
    COMPANIES ||--o{ COMPANY_INVITATIONS : sends
    USERS ||--o{ COMPANY_INVITATIONS : invites

    USERS ||--o{ AUTH_PROVIDERS : authenticates_with
    USERS ||--o{ EMAIL_VERIFICATION_CODES : receives
    USERS ||--o{ SESSIONS : opens
    USERS ||--o{ REFRESH_TOKENS : owns
    SESSIONS ||--o{ REFRESH_TOKENS : rotates

    COMPANIES ||--o{ OFFERS : publishes
    USERS ||--o{ OFFERS : creates
    USERS ||--o{ OFFERS : updates
    OFFERS ||--o{ OFFER_SOURCES : imported_from
    OFFERS ||--o{ OFFER_SKILLS : requires
    SKILLS ||--o{ OFFER_SKILLS : tags

    USERS ||--o{ USER_SKILLS : has
    SKILLS ||--o{ USER_SKILLS : describes
    USERS ||--o{ FAVORITES : saves
    OFFERS ||--o{ FAVORITES : saved_as
    USERS ||--o{ APPLICATIONS : submits
    OFFERS ||--o{ APPLICATIONS : receives
    USERS ||--o{ NOTIFICATIONS : receives

    USERS ||--o{ MODERATION_LOGS : performs
    USERS ||--o{ MODERATION_LOGS : targets
    OFFERS ||--o{ MODERATION_LOGS : concerns

    ROLES {
        int id PK
        varchar name UK
        timestamp created_at
    }

    COMPANIES {
        int id PK
        varchar name UK
        varchar slug UK
        varchar website_url
        text description
        varchar logo_url
        timestamp created_at
        timestamp updated_at
    }

    USERS {
        int id PK
        int orga_id FK
        enum company_role
        int role_id FK
        varchar firstname
        varchar lastname
        varchar email UK
        varchar password_hash
        enum status
        datetime banned_at
        varchar cv_url
        boolean dark_mode
        timestamp created_at
        timestamp updated_at
    }

    COMPANY_INVITATIONS {
        bigint id PK
        int company_id FK
        varchar email
        int invited_by_user_id FK
        enum status
        datetime responded_at
        timestamp created_at
        timestamp updated_at
    }

    AUTH_PROVIDERS {
        int id PK
        int user_id FK
        enum provider_name
        varchar provider_id
        varchar email
        timestamp created_at
    }

    EMAIL_VERIFICATION_CODES {
        bigint id PK
        int user_id FK
        char code_hash
        datetime expires_at
        datetime used_at
        timestamp created_at
    }

    SESSIONS {
        bigint id PK
        int user_id FK
        char session_token UK
        varchar ip_address
        text user_agent
        boolean is_revoked
        datetime expires_at
        datetime last_seen_at
        timestamp created_at
    }

    REFRESH_TOKENS {
        bigint id PK
        int user_id FK
        bigint session_id FK
        char token_hash UK
        boolean is_revoked
        datetime expires_at
        timestamp created_at
    }

    OFFERS {
        bigint id PK
        int company_id FK
        varchar title
        mediumtext description
        text description_preview
        varchar location
        decimal latitude
        decimal longitude
        varchar contract_type
        varchar remote_policy
        enum status
        enum moderation_status
        boolean premium
        int views_count
        decimal salary_min
        decimal salary_max
        char salary_currency
        enum salary_period
        datetime source_posted_at
        datetime published_at
        datetime expires_at
        int created_by_user_id FK
        int updated_by_user_id FK
        timestamp created_at
        timestamp updated_at
    }

    OFFER_SOURCES {
        bigint id PK
        bigint offer_id FK
        enum source_name
        varchar external_id
        varchar source_url
        json raw_payload
        datetime fetched_at
        timestamp created_at
    }

    OFFER_SKILLS {
        bigint offer_id PK,FK
        int skill_id PK,FK
        timestamp created_at
    }

    SKILLS {
        int id PK
        varchar name UK
        varchar normalized_name UK
        timestamp created_at
    }

    USER_SKILLS {
        int user_id PK,FK
        int skill_id PK,FK
        timestamp created_at
    }

    FAVORITES {
        int user_id PK,FK
        bigint offer_id PK,FK
        timestamp created_at
    }

    APPLICATIONS {
        bigint id PK
        int user_id FK
        bigint offer_id FK
        enum status
        text cover_letter
        varchar resume_url
        datetime applied_at
        timestamp created_at
        timestamp updated_at
    }

    NOTIFICATIONS {
        bigint id PK
        int user_id FK
        enum event
        json event_data
        datetime seen_at
        timestamp created_at
    }

    MODERATION_LOGS {
        bigint id PK
        int admin_user_id FK
        int target_user_id FK
        bigint offer_id FK
        enum action_type
        text reason
        json metadata
        timestamp created_at
    }
```

## Zones fonctionnelles

### Identité et accès

Les tables `roles`, `users`, `auth_providers`, `sessions`, `refresh_tokens` et `email_verification_codes` structurent l'authentification.

- `roles` contient les rôles applicatifs minimum: `user` et `admin`.
- `users.role_id` impose le rôle via une clé étrangère.
- `sessions` permet de révoquer une session côté serveur.
- `refresh_tokens` stocke des jetons hachés et rattachés à une session.
- `auth_providers` permet de lier un compte local, Google, GitHub ou LinkedIn.

### Entreprises et recruteurs

Les recruteurs sont représentés par des utilisateurs liés à une entreprise via `users.orga_id`. Le champ `users.company_role` distingue les membres et les owners.

`company_invitations` garde les invitations envoyées par un utilisateur recruteur vers une adresse email, avec un statut `pending`, `accepted`, `declined` ou `cancelled`.

### Offres et ingestion externe

`offers` est la table centrale des annonces. Elle stocke les champs affichés dans le produit: titre, description, localisation, contrat, télétravail, salaire, statut de publication et statut de modération.

`offer_sources` trace l'origine de l'offre. Pour WeLoveDevs, la contrainte unique `(source_name, external_id)` rend la synchronisation idempotente et évite les doublons. Le champ `raw_payload` conserve la donnée brute pour audit, debug et retraitement.

### Compétences, favoris et candidatures

Les compétences sont normalisées dans `skills`, puis reliées aux offres par `offer_skills` et aux profils par `user_skills`.

`favorites` est une table de jointure entre utilisateurs et offres sauvegardées.

`applications` relie un candidat à une offre avec un statut métier: `submitted`, `viewed`, `accepted`, `rejected` ou `withdrawn`. La contrainte unique `(user_id, offer_id)` empêche plusieurs candidatures actives sur la même offre.

### Notifications et modération

`notifications` stocke les événements visibles côté utilisateur, comme les invitations entreprise ou les mises à jour de candidature.

`moderation_logs` conserve les actions administrateur: bannissement, débanissement, rejet d'offre, archivage ou restauration. Les liens optionnels vers `target_user_id` et `offer_id` permettent d'auditer les décisions sans perdre l'historique quand une cible est supprimée.

## Contraintes d'intégrité importantes

- `users.email` est unique.
- `roles.name`, `companies.name`, `companies.slug`, `skills.name` et `skills.normalized_name` sont uniques.
- `offer_sources` impose l'unicité `(source_name, external_id)` pour éviter les doublons d'ingestion.
- `applications` impose l'unicité `(user_id, offer_id)` pour éviter les candidatures dupliquées.
- `offers` contient une contrainte `CHECK` garantissant que `salary_min <= salary_max` quand les deux valeurs existent.
- Les suppressions en cascade sont utilisées pour les données dépendantes directes comme sessions, refresh tokens, skills d'offre, favoris, candidatures et notifications.
