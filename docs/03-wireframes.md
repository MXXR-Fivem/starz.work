# Wireframes et Maquettes — Starz.work

> Ce document présente les wireframes fonctionnels des vues principales de l'application. Ces maquettes ont été réalisées avant le développement pour aligner l'équipe sur l'expérience utilisateur cible.

---

## 1. Flux utilisateur global

```
                    [Page d'accueil]
                          |
             +------------+------------+
             |                         |
       [Inscription]             [Connexion]
             |                         |
        (email ou OAuth)          (email ou OAuth)
             |                         |
             +------------+------------+
                          |
                    [Listing offres]
                          |
              +-----------+-----------+
              |                       |
        [Détail offre]          [Mon profil]
              |
    +---------+---------+
    |                   |
[Postuler]         [Score IA]
    |
[Mes candidatures]
```

---

## 2. Page d'accueil
<img width="863" height="485" alt="Capture d’écran 2026-05-11 à 14 46 13" src="https://github.com/user-attachments/assets/a42a9054-466e-4a8d-aeb1-9ba62b2e22c2" />

---

## 3. Page listing des offres

<img width="833" height="470" alt="Capture d’écran 2026-05-11 à 14 46 40" src="https://github.com/user-attachments/assets/64c06df8-d5c4-47dd-b06b-c46d3ba62c4f" />

---

## 4. Page détail d'une offre

<img width="938" height="528" alt="Capture d’écran 2026-05-11 à 14 47 19" src="https://github.com/user-attachments/assets/7ed172fe-841b-4d7d-8871-f3ffdcad289d" />
---


## 5. Tableau de bord candidat — Mes candidatures
<img width="648" height="364" alt="Capture d’écran 2026-05-11 à 14 49 35" src="https://github.com/user-attachments/assets/ea896ecb-ce6d-4179-9267-6c4c44355485" />

---

## 6. Page profil candidat

<img width="1105" height="620" alt="Capture d’écran 2026-05-11 à 14 49 59" src="https://github.com/user-attachments/assets/63f85407-b620-4d79-898f-2b9586678058" />

---

## 7. Interface recruteur — Gestion des candidatures
<img width="684" height="384" alt="Capture d’écran 2026-05-11 à 14 50 48" src="https://github.com/user-attachments/assets/47cdbeda-2ebe-4d0e-b5a9-5ee6b1ee8fc5" />

---

## 8. Notes sur les choix d'interface

**Priorité à la lisibilité :** Nous avons choisi une mise en page en deux colonnes (filtres + résultats) classique sur le listing, car les études UX montrent que les utilisateurs habitués aux plateformes d'emploi (LinkedIn, Indeed) retrouvent immédiatement leurs repères.

**Score IA en sidebar :** Le score de matching est affiché en zone latérale sur la page détail, non intrusive mais accessible. Le candidat peut ignorer le score s'il ne l'intéresse pas, ou s'en servir pour prioriser ses candidatures.

**Statuts candidature explicites :** Les statuts (`recu`, `vu`, `accepte`, `rejete`, `retire`) sont volontairement en langage simple et non en codes techniques, pour réduire l'anxiété des candidats en attente de retour.

**Formulaire de candidature minimaliste :** Un seul champ obligatoire (le CV, déjà en base), la lettre de motivation est optionnelle. L'objectif est de maximiser le taux de candidature complétée.
