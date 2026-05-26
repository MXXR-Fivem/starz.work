# Benchmark Concurrents — Starz.work

> Ce document présente l'analyse comparative des principales plateformes de recrutement tech existantes. Des captures d'ecran des interfaces sont incluses ci-dessous pour illustrer les points analyses.

---

## 1. Plateformes analysées


| Plateforme | Type | Cible | Modèle économique |
|---|---|---|---|
| **Jobteaser** | Agrégateur étudiant | Étudiants / jeunes diplômés | Freemium recruteur |
| **Welcome to the Jungle** | Plateforme employeur | Tous profils tech | Abonnement recruteur |
| **LinkedIn Jobs** | Réseau social pro + offres | Tous secteurs | Payant recruteur |
| **Indeed** | Agrégateur généraliste | Tous secteurs | CPC (pay-per-click) |
| **WeLoveDevs** | Plateforme dev | Développeurs uniquement | Abonnement + affiliation |

---

## 2. Analyse détaillée par plateforme

### 2.1 Jobteaser

**Positionnement :** Plateforme orientée recrutement étudiant et jeunes diplômés, présente dans les écoles (dont Epitech). Interface sobre et moderne.

**Points forts :**
- Très bonne intégration dans l'écosystème scolaire (partenariats grandes écoles)
- Interface candidat claire avec filtres efficaces
- Dashboard recruteur avec statistiques de vues

**Points faibles :**
- Audience limitée aux étudiants et jeunes diplômés (moins de 3 ans d'expérience)
- Pas de matching automatique CV vs offre
- Peu d'offres pour les profils tech expérimentés

**Ce que Starz apporte en plus :** Matching IA, audience élargie, agrégation multi-sources.
 <img width="1470" height="829" alt="Capture d’écran 2026-05-11 à 14 40 01" src="https://github.com/user-attachments/assets/ccdf5050-7b4c-4367-ae72-fa5bfb9f2bd6" />
 <img width="1470" height="827" alt="Capture d’écran 2026-05-11 à 14 40 52" src="https://github.com/user-attachments/assets/d4af536b-c5eb-4861-b0f0-9ca07464a127" />
---

### 2.2 Welcome to the Jungle

**Positionnement :** Plateforme employeur premium axée sur la culture d'entreprise et l'expérience candidat. Design très soigné, focus sur le storytelling RH.

**Points forts :**
- Expérience utilisateur de très haute qualité (UX primée)
- Profils entreprise riches (vidéos, photos, valeurs)
- Blog contenu RH et carrières très actif
- Filtres avancés (remote, taille entreprise, secteur)

**Points faibles :**
- Coût élevé pour les recruteurs (abonnement annuel plusieurs milliers d'euros)
- Pas de fonctionnalité de matching IA côté candidat
- Pas d'agrégation externe (offres uniquement publiées directement par les recruteurs)
- Suivi des candidatures basique

**Ce que Starz apporte en plus :** Accès abordable pour recruteurs, matching IA, agrégation WeLoveDevs.

<img width="1470" height="832" alt="Capture d’écran 2026-05-11 à 14 41 24" src="https://github.com/user-attachments/assets/62e88c02-c88f-479d-b569-d7819e4c9597" />

<img width="408" height="682" alt="Capture d’écran 2026-05-11 à 14 41 45" src="https://github.com/user-attachments/assets/a8dff738-deb4-4e0b-b5a6-2b478abbddff" />

---

### 2.3 LinkedIn Jobs

**Positionnement :** La plateforme de référence mondiale du recrutement, intégrée au réseau social professionnel numéro 1.

**Points forts :**
- Base de données massive (millions d'offres mondiales)
- Matching automatique (LinkedIn recommande des offres basé sur le profil)
- Postuler en 1 clic avec "Easy Apply"
- Visibilité du réseau (qui travaille dans l'entreprise)

**Points faibles :**
- Écosystème fermé (matching opaque, algorithme propriétaire non transparent)
- Score de matching non expliqué (le candidat ne sait pas pourquoi il matche)
- Interface surchargée, notifications intrusives
- Profil recruteur LinkedIn Recruiter extrêmement onéreux (plus de 10 000 euros par an)

**Ce que Starz apporte en plus :** Transparence du matching (keywords trouvés vs manquants), plateforme centrée sur la tech, coût recruteur abordable.

<img width="1306" height="830" alt="Capture d’écran 2026-05-11 à 14 42 08" src="https://github.com/user-attachments/assets/b9e466d0-88d1-46c5-afe7-b4dd59744f66" />

<img width="602" height="627" alt="Capture d’écran 2026-05-11 à 14 42 50" src="https://github.com/user-attachments/assets/e128955b-12ce-4314-90fb-f6923ab1ff8e" />

---

## 3. Tableau comparatif fonctionnel

| Fonctionnalité | Jobteaser | WTTJ | LinkedIn | Starz.work |
|---|:---:|:---:|:---:|:---:|
| Listing offres tech | oui | oui | oui | oui |
| Filtres avancés (remote, contrat, salaire) | oui | oui | oui | oui |
| Matching IA transparent | non | non | opaque | oui |
| Agrégation multi-sources | non | non | non | oui |
| OAuth (Google / GitHub / LinkedIn) | partiel | partiel | oui | oui |
| Suivi candidatures candidat | oui | oui | oui | oui |
| Gestion candidatures recruteur | oui | oui | oui | oui |
| Espace entreprise multi-utilisateurs | oui | oui | oui | oui |
| Upload CV + analyse automatique | non | non | partiel | oui |
| Score compatibilité détaillé et explicite | non | non | non | oui |
| Modération plateforme | oui | oui | oui | oui |
| Gratuit pour les recruteurs | non | non | non | oui (MVP) |
| API REST documentée | non | non | payant | oui (Swagger) |

---

## 4. Enseignements du benchmark

### Ce que nous avons retenu

**Le matching IA est un vrai différenciateur.** Aucune des plateformes analysées n'offre un score de compatibilité transparent et explicatif au candidat. LinkedIn calcule un matching, mais sans expliquer pourquoi. Starz.work affiche précisément les keywords trouvés et les keywords manquants, ce qui permet au candidat de comprendre et d'améliorer son profil.

**L'agrégation est sous-exploitée dans le segment tech.** Les plateformes spécialisées tech sont en général des espaces fermés où seules les offres déposées directement sont visibles. Starz.work agrège depuis WeLoveDevs pour apporter de la volumétrie dès le lancement sans attendre qu'une communauté de recruteurs se constitue.

**L'expérience candidat peut être simplifiée.** LinkedIn est surchargé de fonctionnalités hors recrutement. Jobteaser est limité aux jeunes diplômés. Il existe une place pour une plateforme tech simple, rapide et centrée sur l'essentiel.

### Ce que nous avons évité

**La complexification du profil entreprise :** WTTJ a investi lourdement dans le storytelling RH (vidéos, photos, culture). Cela représente un coût de production important et n'est pas prioritaire pour un MVP fonctionnel.

**L'algorithme opaque :** Nous n'utilisons pas de machine learning "boîte noire". Notre matching est basé sur des règles explicites (liste TECH_KEYWORDS prédéfinie, lemmatisation Spacy), lisibles et auditables par n'importe quel développeur de l'équipe.

**Le modèle "payer pour apparaître" :** Pas de système de sponsoring ou de mise en avant payante dans le MVP, pour maintenir la confiance des candidats dans la neutralité des résultats.
