# Décisions Produit — Why / How / Trade-off

---

## 1. Décision : Plateforme dédiée au secteur tech uniquement

### Why (Pourquoi)

Le marché de l'emploi tech a des particularités qui justifient une plateforme dédiée :
- Les compétences techniques sont normalisées et peuvent être extraites automatiquement (React, Docker, Python, etc.).
- Les candidats tech ont des attentes spécifiques : remote, salaire affiché, stack technique visible.
- Une audience ciblée est plus utile aux recruteurs qu'une audience généraliste diluée.

Se limiter à la tech nous permet de construire un dictionnaire de compétences pertinent pour le matching IA, ce qui n'est pas faisable sur un scope généraliste (comment matcher un CV de comptable avec une offre de cuisinier ?).

### How (Comment)

- Le champ `contract_type` et les filtres d'offres sont adaptés aux normes du secteur.
- Le dictionnaire TECH_KEYWORDS contient des technologies, outils et pratiques courantes dans les offres tech.
- L'intégration WeLoveDevs (source 100% tech) est la première source d'offres.
- L'interface est sobre et orientée développeurs (pas de storytelling RH complexe dans le MVP).

### Trade-off

**Avantage :** Matching IA plus précis, audience qualifiée, intégration WeLoveDevs cohérente.

**Inconvénient :** Taille de marché réduite par rapport à un généraliste. On exclut des secteurs comme le marketing digital, le design ou le management, qui auraient pu apporter du volume.

**Décision retenue :** Rester focalisé sur la tech pour le MVP. L'extension à d'autres secteurs est possible en ajoutant de nouveaux dictionnaires de compétences et de nouvelles sources d'offres, sans remettre en cause l'architecture.

---

## 2. Décision : Deux types d'utilisateurs (candidat / recruteur)

### Why

La plateforme doit servir deux populations aux besoins opposés mais complémentaires. Séparer les rôles permet d'offrir des interfaces et des fonctionnalités adaptées à chacun sans surcharger l'expérience.

Un recruteur n'a pas besoin de voir les offres en mode candidat. Un candidat ne doit pas accéder aux outils de gestion de candidatures de l'entreprise.

### How

- Le champ `status` sur l'utilisateur distingue `en_recherche` et `recruteur`.
- Le statut `recruteur` est lié à une entreprise (`orga_id`) avec un rôle (`owner` ou `member`).
- Les routes de l'API `/company/*` sont protégées par un middleware vérifiant que l'utilisateur appartient à une entreprise.
- Le frontend affiche des menus de navigation différents selon le statut.

### Trade-off

**Avantage :** Expérience utilisateur adaptée, séparation claire des responsabilités dans le code.

**Inconvénient :** Un utilisateur ne peut pas être simultanément candidat et recruteur avec le même compte. Certains profils (freelances qui recrutent et cherchent des missions) pourraient être lésés.

**Décision retenue :** Pour le MVP, on assume cette limitation. La gestion d'un double statut représente une complexité produit et technique significative qui n'est pas prioritaire.

---

## 3. Décision : Modération des offres avant publication

### Why

Laisser n'importe quel recruteur publier librement n'importe quelle offre expose la plateforme à des contenus inappropriés, des offres frauduleuses ou du spam. Une modération préserve la qualité de l'expérience candidat, qui est notre principal atout.

### How

- Les offres créées par les recruteurs partent en statut `draft`.
- Elles passent par une revue admin qui les place en `approved` ou `rejected` (champ `moderation_status`).
- Seules les offres `published` + `approved` sont visibles dans le listing public.
- Les admins ont un espace dédié (`/staff/offers`) pour traiter la file de modération.
- Chaque décision est logguée dans `moderation_logs` avec la raison.

### Trade-off

**Avantage :** Qualité et confiance maintenues côté candidats. Traçabilité des décisions de modération.

**Inconvénient :** Friction pour les recruteurs (délai entre soumission et publication). Charge de travail pour les administrateurs à mesure que le volume d'offres augmente.

**Décision retenue :** Modération activée dans le MVP. À terme, on pourrait introduire un système de confiance (recruteurs vérifiés pré-approuvés) pour réduire la charge.

---

## 4. Décision : Score de matching affiché uniquement au candidat

### Why

Donner le score de matching au candidat lui permet de décider en connaissance de cause s'il postule. Donner ce score au recruteur créerait un risque de discrimination algorithmique : un recruteur qui rejette automatiquement les candidats sous un certain score, sans lire leur dossier, introduit un biais non souhaitable.

### How

- L'appel à `/ai/analyze` est fait côté frontend au chargement de la page de détail d'une offre, uniquement pour l'utilisateur connecté avec un CV.
- Le résultat est affiché dans l'interface candidat uniquement.
- Le score n'est pas stocké en base de données, ni accessible via les routes recruteur.

### Trade-off

**Avantage :** Évite les biais algorithmiques dans la décision des recruteurs. Responsabilise le candidat.

**Inconvénient :** Le recruteur ne bénéficie pas du matching pour pré-trier les candidatures. C'est une fonctionnalité qui pourrait être utile dans une version future, avec un cadre éthique défini.

**Décision retenue :** Score visible côté candidat uniquement dans le MVP.

---

## 5. Décision : Notifications internes (pas d'emails temps réel)

### Why

Les emails transactionnels en temps réel (nouvelle candidature, changement de statut) nécessitent un service SMTP fiable, des templates HTML, une gestion des bounces, et une conformité RGPD (opt-out). Pour le MVP, cette infrastructure représente un coût de développement non négligeable pour une valeur ajoutée différée.

Le système de notifications internes (table `notifications`, endpoint `GET /notifications`) est plus simple à implémenter et couvre les besoins essentiels de l'MVP.

### How

- Chaque événement métier (nouvelle candidature, changement de statut, invitation entreprise) crée une entrée dans la table `notifications`.
- Le frontend peut interroger `GET /notifications` et afficher un badge de notifications non lues.
- Les notifications sont marquées comme vues via `PATCH /notifications/seen`.
- Le service SMTP est configuré mais utilisé uniquement pour les flux critiques : vérification d'email et réinitialisation de mot de passe.

### Trade-off

**Avantage :** Simplicité d'implémentation, pas de dépendance à un service tiers pour les notifications opérationnelles.

**Inconvénient :** Le candidat doit revenir sur la plateforme pour voir ses mises à jour. Pas de push notification ni d'email pour les alertes de nouvelles offres.

**Décision retenue :** Notifications internes pour le MVP, emails transactionnels pour les cas critiques uniquement.
