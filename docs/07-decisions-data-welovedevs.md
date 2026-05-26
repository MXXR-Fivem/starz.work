# Décisions Data / WeLoveDevs / Rate Limit — Why / How / Trade-off

---

## 1. Décision : Agrégation de données depuis WeLoveDevs

### Why

Au lancement d'une plateforme de recrutement, le principal obstacle est le manque de contenu. Sans offres d'emploi disponibles, les candidats n'ont aucune raison de s'inscrire. Sans candidats, les recruteurs n'ont pas d'incitation à publier. C'est le problème classique du "cold start" des marketplaces.

Pour contourner ce problème, nous avons identifié WeLoveDevs comme une source de données tierce pertinente :
- Spécialisée dans les offres tech (alignée avec notre positionnement).
- Partenaire Epitech (accès API disponible pour les projets scolaires).
- Volume suffisant pour alimenter la plateforme dès le lancement.

L'agrégation automatique depuis WeLoveDevs nous permet d'avoir plusieurs centaines d'offres dès le premier jour, sans dépendre de l'acquisition de recruteurs.

### How

Le service de synchronisation est implémenté dans `starz-backend/src/services/welovedevsSync.ts`.

**Flux de synchronisation :**

```
Démarrage serveur
  → startWeLoveDevsSyncCron() si WLD_SYNC_ENABLED=true
  → Cron toutes les 10 minutes (configurable WLD_SYNC_INTERVAL_MINUTES)

Par itération :
  → Fetch page 0 : GET /v1?page=0&size=100
  → Attente 1 200ms (respect rate limit)
  → Fetch page 1, attente 1 200ms...
  → ...jusqu'à ce qu'une page soit vide

Par offre reçue :
  → Vérifier si (source_name='welovedevs', external_id) existe déjà
  → Si oui : ignorer (idempotence)
  → Si non :
      → Créer ou récupérer la company
      → Insérer l'offre (title, description, location, salaire, contrat, remote)
      → Insérer offer_source (external_id, raw_payload JSON, source_url)
      → Normaliser et créer les skills + associations offer_skills
```

**Transformation des données :**

Les offres WeLoveDevs utilisent un format propriétaire. La transformation inclut :
- Mapping `contract_type` : CDI, CDD, Freelance, Alternance, Stage → ENUM MySQL.
- Mapping `remote_policy` : full_remote, partial_remote, on_site → ENUM MySQL.
- Extraction des compétences depuis les champs skills de l'API.
- Géocodage de la localisation textuelle (ville) vers lat/long via OpenStreetMap Nominatim.
- Extraction de la description depuis le HTML brut ou le JSON-LD si disponible.

### Trade-off

**Avantage :** Résout le cold start. Volumétrie immédiate. Automatisme (pas d'intervention humaine).

**Inconvénient :** Dépendance à une source externe (si WeLoveDevs change son API, la sync casse). Insert-only : les offres mises à jour côté WeLoveDevs ne sont pas resynchronisées. Qualité variable des données importées (descriptions HTML, localisations approximatives).

**Décision retenue :** L'agrégation WeLoveDevs est une solution de bootstrap. À terme, le volume d'offres publiées directement par les recruteurs Starz doit devenir dominant.

---

## 2. Décision : Respect du rate limit de l'API WeLoveDevs (1 req/sec)

### Why

L'API WeLoveDevs est une API partenaire qui impose un rate limit de 1 requête par seconde. Dépasser cette limite entraîne des erreurs 429 (Too Many Requests), ce qui interrompt la synchronisation et risque de bloquer l'accès à l'API (ban temporaire ou définitif de la clé API).

Respecter ce rate limit est une obligation contractuelle vis-à-vis du partenaire, et une nécessité technique pour garantir la fiabilité de la synchronisation.

### How

Deux mécanismes sont implémentés :

**1. Délai minimal entre requêtes (`WLD_API_MIN_DELAY_MS = 1 200ms`) :**

Après chaque appel à l'API WeLoveDevs, le service attend au minimum 1 200 ms avant le prochain appel. Le délai de 1 200ms (vs 1 000ms imposé) est une marge de sécurité qui absorbe les variations de latence réseau et les imprécisions de `setTimeout`.

```typescript
const elapsed = Date.now() - lastCallTimestamp;
const remaining = Math.max(0, MIN_DELAY_MS - elapsed);
if (remaining > 0) await sleep(remaining);
```

**2. Retry sur erreur 429 (`WLD_MAX_429_RETRIES = 6`) :**

Si malgré le délai une erreur 429 est retournée (congestion côté WeLoveDevs, décalage horloge serveur), le service ne s'arrête pas mais attend un délai exponentiel avant de réessayer.

```
Tentative 1 : attente 2 400ms (2 * MIN_DELAY)
Tentative 2 : attente 4 800ms
Tentative 3 : attente 9 600ms
...jusqu'à 6 tentatives
```

Si toutes les tentatives échouent, l'offre en question est ignorée et la synchronisation continue avec la suivante.

### Trade-off

**Avantage :** Synchronisation stable et respectueuse du partenaire. Pas d'interruption en cas de pic de charge côté WeLoveDevs.

**Inconvénient :** La synchronisation est lente : 100 offres par page × 1 200ms = 2 minutes minimum par page. Pour un corpus de 1 000 offres, la première synchronisation complète prend environ 12 minutes. C'est acceptable car la sync tourne en arrière-plan et ne bloque pas le service.

**Décision retenue :** Le délai de 1 200ms est un équilibre entre respect du rate limit et vitesse de synchronisation. Une approche plus agressive (1 000ms pile) serait risquée en conditions réelles.

---

## 3. Décision : Idempotence de la synchronisation

### Why

Le cron de synchronisation tourne toutes les 10 minutes. Sans mécanisme d'idempotence, chaque passage créerait des doublons pour toutes les offres déjà importées, ce qui rendrait rapidement la base de données inutilisable.

### How

La table `offer_sources` a une contrainte d'unicité composite sur `(source_name, external_id)` :

```sql
UNIQUE KEY uq_offer_source (source_name, external_id)
```

Avant d'insérer une nouvelle offre, le service vérifie :
```sql
SELECT id FROM offer_sources
WHERE source_name = 'welovedevs' AND external_id = ?
```

Si un résultat est trouvé, l'offre est ignorée (skip). Si non, elle est insérée.

La contrainte d'unicité SQL est aussi un filet de sécurité : même en cas de bug dans la vérification applicative, la base refuserait un doublon.

### Trade-off

**Avantage :** Synchronisations multiples sans effet de bord. Sécurité à deux niveaux (applicatif + SQL).

**Inconvénient :** Les offres modifiées côté WeLoveDevs (changement de salaire, de localisation, fermeture de poste) ne sont pas mises à jour dans Starz. Un candidat peut voir une offre expirée.

**Décision retenue :** Insert-only pour le MVP. La mise à jour d'offres importées nécessiterait de comparer le `raw_payload` entre deux versions, ce qui complexifie significativement le code. Un champ `expires_at` sur les offres permet de masquer les offres anciennes.

---

## 4. Décision : Conservation du `raw_payload` JSON

### Why

Les données brutes reçues de WeLoveDevs sont conservées dans le champ `raw_payload JSON` de la table `offer_sources`. Cette décision est motivée par plusieurs raisons :

- **Debugging :** En cas de bug dans la transformation des données, on peut retraiter le payload original sans refaire un appel API.
- **Évolutivité :** Si on veut extraire de nouveaux champs à l'avenir (technologies émergentes, nouvelles métadonnées), les données sont déjà là.
- **Traçabilité :** On peut toujours prouver l'origine exacte d'une offre en cas de litige ou de question sur la qualité des données.

### Trade-off

**Avantage :** Richesse des données, capacité de retraitement, traçabilité.

**Inconvénient :** Espace de stockage supplémentaire. Un payload WeLoveDevs peut faire plusieurs kilooctets. Sur 10 000 offres, cela représente quelques dizaines de Mo — négligeable pour le MVP.

---

## 5. Alternative rejetée : utilisation d'un service de scraping

### Description de l'alternative

Au lieu d'utiliser l'API officielle WeLoveDevs, nous aurions pu mettre en place un scraper web pour extraire les offres de plusieurs plateformes (Indeed, LinkedIn, Jobteaser, etc.) directement depuis leur HTML.

### Pourquoi nous l'avons rejeté

**Légalité et conformité :** Le scraping de plateformes sans accord explicite est contraire aux CGU de la plupart des sites. LinkedIn notamment a gagné plusieurs procès contre des scrapers. Cette approche expose le projet à des risques légaux.

**Fragilité technique :** Un scraper dépend de la structure HTML du site cible. Le moindre changement de template casse le scraper. La maintenance d'un scraper est coûteuse.

**Qualité des données :** Les données scrapées en HTML sont sales (balises, entités HTML, JavaScript rendu côté client). La transformation est complexe et les erreurs fréquentes.

**Accès officiel disponible :** WeLoveDevs propose une API officielle pour les partenaires Epitech. Il n'y a aucune raison de scraper quand un accès propre est disponible.

### Conclusion sur ce choix

L'API officielle WeLoveDevs est la seule source d'agrégation externe dans le MVP. Elle couvre le besoin de bootstrap en contenu tech sans risque légal ni fragilité technique.
