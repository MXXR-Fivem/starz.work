# Tests Backend

Les tests servent a verifier rapidement que le backend reste utilisable quand le code evolue.

L'objectif actuel est simple :

- tester les helpers critiques avec des tests unitaires ;
- verifier que les routes repondent avec des smoke tests ;
- preparer des tests d'integration plus complets avec une base MySQL Docker.

## Vue D'ensemble

```mermaid
flowchart TD
    A[Changement de code] --> B[npm run typecheck]
    B --> C[npm run lint]
    C --> D[npm test]
    D --> E{Typecheck, lint et tests OK ?}
    E -->|Oui| F[Code pret pour review ou merge]
    E -->|Non| G[Corriger le probleme]
    G --> B
```

## Types De Tests

```mermaid
flowchart LR
    A[Tests Backend] --> B[Tests unitaires]
    A --> C[Smoke tests routes]
    A --> D[Tests integration DB]

    B --> B1[Helpers sanitize, parse, normalize]
    B --> B2[Rapides, sans serveur, sans DB]

    C --> C1[Supertest sur Express]
    C --> C2[Verifie les statuts HTTP]
    C --> C3[Verifie la forme minimale des reponses]

    D --> D1[MySQL Docker]
    D --> D2[init.sql puis seed test.sql]
    D --> D3[Parcours metier complets]
```

## Tests Unitaires

Les tests unitaires testent une fonction isolee.

Exemples actuels :

- `normalizeEmail`
- `sanitizeOptionalText`
- `parsePositiveInteger`
- `booleanLikeSchema`
- helpers de dates
- helpers d'upload
- normalisation WeLoveDevs

Ils ne demarrent pas l'API et ne touchent pas la base.

```mermaid
sequenceDiagram
    participant Test as Test Jest
    participant Helper as Fonction helper

    Test->>Helper: Appel avec une entree connue
    Helper-->>Test: Retourne une sortie normalisee
    Test->>Test: Compare avec le resultat attendu
```

## Smoke Tests De Routes

Les smoke tests verifient que les routes principales repondent.

Ils ne remplacent pas les vrais tests metier. Leur role est de detecter vite :

- une route cassee ;
- un middleware qui bloque mal ;
- une erreur serveur inattendue ;
- un changement de status HTTP non voulu.

```mermaid
sequenceDiagram
    participant Jest
    participant Supertest
    participant API as App Express

    Jest->>Supertest: GET /health
    Supertest->>API: Requete HTTP interne
    API-->>Supertest: 200 + body JSON
    Supertest-->>Jest: Reponse
    Jest->>Jest: Verifie status et success
```

## Integration Avec Base De Test

Pour tester les vrais parcours metier, on utilise une base MySQL dediee aux tests.

Le principe :

1. lancer MySQL avec Docker ;
2. executer `npm run test:db` ;
3. le script prepare `job_aggregator_test` ;
4. il charge `database/init.sql` puis `database/seeds/test.sql` ;
5. Jest lance les tests dans `tests/integration-db`.

```mermaid
flowchart TD
    A[CI] --> B[Lance MySQL Docker]
    B --> C[npm run test:db]
    C --> D[Prepare job_aggregator_test]
    D --> E[Charge init.sql + test.sql]
    E --> F[Tests parcours metier]
    F --> G[Arret et nettoyage DB]
```

## Parcours DB Actuel

Le premier parcours DB verifie :

- login utilisateur ;
- login recruteur ;
- acces a `/me` avec un token ;
- lecture des offres publiques ;
- candidature utilisateur a une offre ;
- consultation de la candidature cote entreprise ;
- passage automatique en `viewed` quand le recruteur ouvre la candidature ;
- acceptation de la candidature ;
- creation d'une notification utilisateur.

## Commandes

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:smoke
npm test
npm run test:db
npm run audit
```
