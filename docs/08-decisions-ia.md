# Décisions Intelligence Artificielle — Why / How / Trade-off

---

## 1. Décision : Intégrer un service de matching IA CV vs offre

### Why

La recherche d'emploi souffre d'une asymétrie d'information : le candidat ne sait pas si son profil correspond aux attentes d'une offre avant de la lire en détail (et souvent même après). Il postule parfois à des dizaines d'offres sans retour, parce qu'il ne disposait pas d'un moyen rapide d'évaluer sa compatibilité.

L'objectif du service IA est de réduire cette asymétrie en fournissant au candidat un score objectif et explicatif avant qu'il décide de postuler.

Ce n'est pas de l'IA générative ni du deep learning — c'est du traitement automatique du langage naturel (NLP) appliqué à une tâche précise : extraire des mots-clés techniques d'un texte et mesurer leur présence dans un autre.

### How

Le service IA est une application FastAPI Python indépendante, exposée à l'adresse interne `http://ai-service:8000` dans l'environnement Docker.

**API exposée :**

```
POST /analyze
Content-Type: application/json

{
  "offer": "texte de l'offre",
  "cv": "texte du CV"
}
```

ou en multipart/form-data avec un fichier PDF pour le CV.

**Pipeline de traitement :**

```
Offre d'emploi (texte brut)
  → Détection lignes "Skills:" (format semi-structuré WeLoveDevs)
  → Extraction regex des TECH_KEYWORDS sur le texte complet
  → Support des expressions multi-mots (React Native, Docker Compose, CI/CD, etc.)
  → Lemmatisation Spacy (en_core_web_sm) pour normaliser les formes
  → Déduplication, pondération et limitation à 45 keywords maximum

CV candidat (texte brut ou PDF)
  → Extraction texte depuis PDF si nécessaire (pypdf)
  → Pour chaque keyword extrait de l'offre :
      → Recherche insensible à la casse avec word-boundary regex
      → Retour si trouvé

Calcul du score :
  → score = round((poids_keywords_trouvés / poids_keywords_offre) * 100)
  → classification : strong_match, partial_match ou weak_match

Résultat :
  → { score, match_level, keywords_offre, keywords_trouves, keywords_manquants, suggestions }
```

**Technologies utilisées :**
- **FastAPI** : framework Python async, documentation auto-générée (OpenAPI), performant.
- **Spacy (en_core_web_sm)** : modèle NLP anglais léger (~12 Mo) pour la lemmatisation. Transforme "developing" → "develop", "databases" → "database", etc.
- **pypdf** : extraction de texte depuis les CVs au format PDF.
- **Regex avec word-boundary** : `(?<![a-z0-9])react(?![a-z0-9])` évite les faux positifs (ex: "interactive" ne matche pas "react").

### Trade-off

**Avantage :** Résultat explicable (liste précise des keywords trouvés et manquants). Pas de black box. Rapide (< 100ms par analyse). Pas de dépendance à une API externe payante.

**Inconvénient :** Matching limité aux technologies prédéfinies dans TECH_KEYWORDS. Une offre qui mentionne une technologie absente du dictionnaire ne sera pas analysée correctement. Le dictionnaire doit être maintenu à jour manuellement.

**Décision retenue :** L'approche par dictionnaire pondéré est volontairement simple et transparente pour le MVP. Elle couvre les technologies courantes, reste explicable et produit aussi des suggestions actionnables pour le candidat.

---

## 2. Décision : Service IA isolé en Python (pas embarqué dans le backend Node.js)

### Why

L'écosystème NLP en Python (spacy, NLTK, transformers) est beaucoup plus mature et mieux supporté qu'en JavaScript. Les modèles spacy sont optimisés pour Python. Tenter de porter cette logique en Node.js (via compromise.js ou wink-nlp) aurait abouti à un résultat moins précis et moins maintenu.

La séparation en service distinct permet de :
- Choisir la technologie adaptée (Python) sans contraindre le reste du backend.
- Mettre à jour ou remplacer le modèle NLP sans toucher au backend.
- Faire évoluer le service IA (vers un LLM, par exemple) de manière transparente pour le reste du système.

### How

- Le service IA est containerisé dans son propre Docker (`Dockerfile.ai-service`).
- Il est accessible depuis le backend via le réseau Docker interne (`ai-service:8000`).
- Il n'est pas exposé directement à internet (pas de port public mappé en production).
- La route backend `POST /ai/analyze` joue le rôle de proxy : elle reçoit la requête du frontend, appelle le service IA, et retourne le résultat.

### Trade-off

**Avantage :** Découplage technologique. Le service IA peut évoluer indépendamment.

**Inconvénient :** Latence supplémentaire (appel HTTP inter-services). Complexité du déploiement (3 containers au lieu de 2). Si le service IA est indisponible, la fonctionnalité de matching est dégradée (mais le reste de la plateforme continue de fonctionner).

---

## 3. Décision : Dictionnaire TECH_KEYWORDS statique (pas de ML supervisé)

### Why

Plusieurs approches étaient envisageables pour le matching :

1. Machine learning supervisé (modèle entraîné sur des paires CV/offre labellisées).
2. Embeddings sémantiques (sentence-transformers, cosine similarity).
3. Dictionnaire statique de mots-clés techniques.

Nous avons choisi le dictionnaire statique pour les raisons suivantes :

**Données d'entraînement indisponibles :** Un modèle supervisé nécessite des milliers de paires (CV, offre, score) labellisées. Ces données n'existent pas au démarrage du projet.

**Explicabilité :** Un modèle ML retourne un score sans expliquer pourquoi. Notre dictionnaire retourne la liste exacte des keywords trouvés et manquants, ce qui est beaucoup plus utile pour le candidat.

**Maintenabilité :** Un dictionnaire statique peut être mis à jour par n'importe quel développeur en quelques minutes. Un modèle ML nécessite un pipeline de réentraînement.

**Performance :** Le matching par dictionnaire et regex s'exécute en quelques millisecondes. Les embeddings sémantiques (BERT, etc.) nécessitent plusieurs secondes et un GPU pour être vraiment performants.

### How

Le dictionnaire TECH_KEYWORDS contient des technologies, outils et pratiques courantes dans les offres tech françaises :

```python
TECH_KEYWORDS = {
    "react", "react native", "docker", "docker compose", "ci/cd",
    "python", "fastapi", "postgresql", "terraform", "kafka",
    "machine learning", "unit tests", ...
}
```

Un second dictionnaire COMMON_WORDS filtre les termes génériques non techniques ("developer", "team", "project", etc.) pour réduire les faux positifs.
Les keywords sont pondérés : langages/frameworks principaux ont un poids plus fort que les outils, eux-mêmes plus importants que les pratiques méthodologiques.

### Trade-off

**Avantage :** Transparent, maintenable, rapide, pas de données d'entraînement nécessaires.

**Inconvénient :** Couverture limitée aux termes prédéfinis. Des offres qui mentionnent une technologie récente absente du dictionnaire auront un score sous-estimé. Le dictionnaire doit être maintenu manuellement.

---

## 4. Alternative rejetée : utilisation d'un LLM via API (GPT, Claude)

### Description de l'alternative

Plutôt qu'un matching par dictionnaire, nous aurions pu appeler l'API OpenAI (GPT-4o) ou Anthropic (Claude) pour analyser sémantiquement le CV et l'offre et produire un score de compatibilité plus riche.

Un prompt typique :
```
Analyse la compatibilité entre ce CV et cette offre d'emploi.
Retourne un score de 0 à 100 et liste les compétences correspondantes
et manquantes.

CV : [...]
Offre : [...]
```

### Pourquoi nous l'avons rejeté

**Coût :** Chaque appel API coûte en tokens. Sur un volume de milliers d'analyses quotidiennes, le coût devient significatif (potentiellement plusieurs centaines d'euros par mois à l'échelle).

**Latence :** Un appel API LLM prend entre 2 et 10 secondes selon la charge. L'affichage du score sur la page détail d'une offre deviendrait perceptiblement lent pour l'utilisateur.

**Dépendance externe :** La fonctionnalité de matching serait dépendante de la disponibilité et de la politique tarifaire d'un fournisseur tiers. Un changement de pricing ou une panne d'OpenAI met le service hors ligne.

**Non-déterminisme :** Les LLMs ne produisent pas toujours le même résultat pour la même entrée. Deux analyses identiques peuvent donner des scores différents, ce qui nuit à la confiance de l'utilisateur.

**Explicabilité partielle :** Même si le LLM peut lister des compétences, la granularité et la cohérence de la liste varient selon les runs.

### Conclusion sur ce choix

Le dictionnaire statique avec spacy est la bonne approche pour le MVP : gratuit, rapide, explicable et maintenable. L'intégration d'un LLM pourrait être envisagée dans une version future pour enrichir l'analyse (soft skills, expérience, contextualisation) en complément du matching technique existant.
