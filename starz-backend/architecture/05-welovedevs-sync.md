# WeLoveDevs Sync

## Objectif

Importer automatiquement des offres depuis l'API WeLoveDevs pour alimenter la base, sans écraser les données déjà importées et potentiellement modifiées via le site.

## Configuration

- `WLD_SYNC_ENABLED`
- `WLD_API_URL`
- `WLD_API_KEY`
- `WLD_SYNC_INTERVAL_MINUTES`
- `WLD_SYNC_PAGE_SIZE`
- `WLD_SYNC_QUERY`

## Flow global

```mermaid
flowchart TD
    A[Server start] --> B[startWeLoveDevsSyncCron]
    B --> C{Sync enabled}
    C -- no --> D[Stop]
    C -- yes --> E[Run immediately]
    E --> F[Fetch /v1 page=0 size=n]
    F --> G{More pages}
    G -- yes --> H[Wait to respect 1 req/s]
    H --> I[Fetch next page]
    I --> G
    G -- no --> J[For each job]
    J --> K{offer_sources has external_id}
    K -- yes --> L[Skip]
    K -- no --> M[Create/find company]
    M --> N[Insert offer]
    N --> O[Insert offer_sources raw_payload]
    O --> P[Insert/find skills + offer_skills]
    P --> Q[Log fetched/inserted]
    Q --> R[Schedule next run every X minutes]
```

## Règles métier importantes

- source importée marquée dans `offer_sources` avec `source_name = welovedevs`
- idempotence par `external_id` (pas de double import)
- comportement insert-only: pas de mise à jour des offres déjà importées
- limitation API respectée: maximum 1 requête/seconde
