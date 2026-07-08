# MindLess

Application anti-charge mentale : entretien voiture, courses et menus de la semaine, partagés en famille.

## Stack technique

- **Frontend** : Vanilla HTML/CSS/JS (pas de framework, pas de bundler)
- **Hébergement** : Firebase Hosting (`public/` est la racine servie)
- **Base de données** : Cloud Firestore
- **Authentification** : Firebase Auth — **Google uniquement** (`signInWithPopup` + `GoogleAuthProvider`)
- **SDK Firebase** : v12 chargé via CDN (`https://www.gstatic.com/firebasejs/12.12.0/...`)
- **Modules ES** : les scripts utilisent `type="module"`
- **Tests** : Vitest (dev uniquement — ne fait pas partie du déploiement Firebase)

## Structure des fichiers

```
public/
├── index.html                  # Accueil : tuiles catégories (Voiture / Courses / Menus / Mon foyer)
├── login.html                  # Connexion Google uniquement
├── foyer.html                  # Créer/rejoindre un foyer, voir le code d'invitation + nombre de membres
├── 404.html
├── style.css                   # Styles globaux (thème sombre/turquoise, sans framework CSS)
├── firebase-config.example.js  # Modèle de config Firebase (à copier en firebase-config.js, gitignoré)
│
├── voiture.html                 # Liste des véhicules + résumé des rappels d'entretien
├── vehicule-form.html           # Créer/éditer un véhicule
├── vehicule-detail.html         # Rappels + historique d'entretien d'un véhicule
├── entretien-form.html          # Ajouter/éditer un entretien
│
├── menus.html                   # Planning de la semaine (grille 7 jours x midi/soir), texte libre OU recette liée
├── recettes.html                # Bibliothèque de recettes du foyer
├── recette-form.html            # Créer/éditer une recette (ingrédients dynamiques)
├── recette-detail.html          # Vue lecture d'une recette
│
├── courses.html                 # Liste de courses partagée (temps réel), génération depuis le planning
│
├── models/
│   ├── Utilisateur.js            # Profil { email, nomAffiche, photoUrl, foyerId }
│   ├── Foyer.js                  # { nom, membres[], creePar, dateCreation }
│   ├── Vehicule.js
│   ├── Entretien.js
│   ├── Recette.js                # ingredients[] embarqués { nom, quantite, unite }
│   ├── PlanningRepas.js           # doc id = semaine ISO ("2026-W28"), jours.{jour}.{creneau} = { texte, recetteId }
│   └── ListeCoursesItem.js        # { nom, quantite, unite, categorie, coche, origine, recetteIds }
│
├── services/                      # seul point d'accès Firestore par collection
│   ├── AuthService.js              # Google sign-in uniquement
│   ├── UtilisateurService.js       # obtenirOuCreerUtilisateur, mettreAJourFoyerId
│   ├── FoyerService.js             # creerFoyer, rejoindreFoyer, ecouterFoyer
│   ├── VehiculeService.js
│   ├── EntretienService.js         # scoped à (foyerId, vehiculeId)
│   ├── RecetteService.js
│   ├── PlanningRepasService.js     # obtenirOuCreerSemaine, mettreAJourCreneau
│   └── ListeCoursesService.js      # ecouterListe (temps réel), ecrireLot (batch depuis génération)
│
└── utils/                          # purs, n'importent jamais Firebase, testables
    ├── RappelsEntretien.js          # calculerRappels(vehicule, entretiens, dateActuelle)
    ├── ReglesEntretien.js           # intervalles km/mois par type d'entretien
    ├── GenerateurListeCourses.js    # genererItemsDepuisPlanning + fusionnerAvecListeExistante
    ├── DateSemaine.js               # getIdSemaine, getDatesSemaine, semaineSuivante/Precedente
    └── CodeInvitation.js            # genererCodeInvitation()

tests/
├── RappelsEntretien.test.js
├── GenerateurListeCourses.test.js
├── DateSemaine.test.js
└── CodeInvitation.test.js
```

## Modèle de données Firestore

MindLess est une application **familiale multi-utilisateurs** : toutes les données métier sont
partagées au niveau du **foyer**, pas de l'utilisateur (contrairement à un modèle mono-utilisateur
classique). Un `foyerId` **est** le code d'invitation partagé entre les membres — pas de collection
d'invitations séparée, pas de Cloud Function nécessaire.

```
utilisateurs/{uid}
  { email, nomAffiche, photoUrl, foyerId: string|null }

foyers/{foyerId}                       # foyerId = code d'invitation (6 caractères, ex. "A3F7K9")
  { nom, membres: [uid...], creePar, dateCreation }

foyers/{foyerId}/vehicules/{vehiculeId}
  { nom, marque, modele, immatriculation, kilometrageActuel, dateMajKilometrage }

foyers/{foyerId}/vehicules/{vehiculeId}/entretiens/{entretienId}
  { type, date, kilometrage, cout, garage, notes }

foyers/{foyerId}/recettes/{recetteId}
  { nom, portions, ingredients: [{ nom, quantite, unite }], instructions, tags: [] }

foyers/{foyerId}/planningRepas/{idSemaine}          # idSemaine = "2026-W28" (ISO 8601)
  { jours: { lundi: { midi: {texte, recetteId}, soir: {...} }, ... dimanche }, dateMaj }

foyers/{foyerId}/listeCourses/{itemId}              # collection plate = édition concurrente sans conflit
  { nom, quantite, unite, categorie, coche, origine: 'manuel'|'recette'|'mixte', recetteIds: [] }
```

### Rejoindre un foyer

Créer un foyer génère un code à 6 caractères (`utils/CodeInvitation.js`, alphabet sans caractères
ambigus) qui sert directement d'identifiant du document `foyers/{code}`. Rejoindre un foyer consiste
à ajouter son propre `uid` au tableau `membres` avec ce code — la règle Firestore `estAdhesionValide()`
n'autorise qu'un non-membre à s'ajouter lui-même, rien d'autre (voir `firestore.rules`).

**Limite connue** : la règle `utilisateurs/{uid}` ne permet à chacun de lire que son propre profil ;
un membre du foyer ne peut donc pas voir le nom affiché des autres membres, seulement leur nombre
(`foyer.html` affiche "X membres dans ce foyer", pas leurs noms).

**Note de sécurité** : le document `foyers/{foyerId}` (nom, liste de `membres`, `creePar`,
`dateCreation`) est lisible par **tout utilisateur connecté**, pas seulement les membres — c'est
nécessaire pour qu'un utilisateur puisse vérifier qu'un code d'invitation existe avant de rejoindre
(il n'est pas encore membre à ce moment-là). Seules les sous-collections (véhicules, recettes,
planning, courses) restent strictement réservées aux membres du foyer via `estMembreDuFoyer()`.

## Modules métier

### Voiture — rappels d'entretien

`utils/ReglesEntretien.js` définit les intervalles de référence par type (`vidange` 15000km/12mois,
`controleTechnique` 24mois, `pneus` 40000km, `freins` 30000km, `revisionGenerale` 20000km/12mois,
`autre` sans intervalle). `utils/RappelsEntretien.calculerRappels(vehicule, entretiens, dateActuelle)`
est une fonction pure qui retrouve le dernier entretien de chaque type et calcule un statut
`inconnu` (pas d'historique) / `ok` / `proche` (< 1000km ou < 30 jours) / `du` (dépassé), sur le
critère km et/ou date selon ce que le type définit.

Comme l'application est statique (pas de backend/cron), les rappels sont **calculés côté client au
chargement** : badge sur la tuile Voiture de l'accueil (`index.html`) et détail par véhicule
(`vehicule-detail.html`). Les notifications push réelles nécessiteraient Firebase Cloud Functions +
Cloud Messaging — explicitement hors scope, voir roadmap.

### Menus + recettes + liste de courses

Chaque créneau du planning (`jour` × `midi`/`soir`) supporte **soit** un texte libre (`texte`), **soit**
une recette liée (`recetteId`) — les deux modes cohabitent dans l'appli selon ce que l'utilisateur
choisit sur `menus.html`.

`utils/GenerateurListeCourses.js` (pur, sans Firebase) fait le lien entre planning et liste de
courses :
- `genererItemsDepuisPlanning(planning, recettesParId)` agrège les ingrédients de tous les créneaux
  liés à une recette (les créneaux texte libre sont ignorés), en fusionnant par `nom` + `unite`
  normalisés (pas de conversion d'unité — `farine/g` et `farine/kg` restent deux entrées distinctes).
- `fusionnerAvecListeExistante(itemsGeneres, itemsExistants)` calcule les écritures à faire sans
  jamais toucher un item déjà **coché**, en amenant un item `manuel` vers `mixte` plutôt que de
  l'écraser, et sans jamais **supprimer** un item devenu inutile (nettoyage manuel assumé, voir
  roadmap).

`courses.html` groupe le résultat par `categorie` et écoute la collection en temps réel
(`onSnapshot`) pour que les coches se synchronisent instantanément entre les membres du foyer.

## Conventions de code

- Français pour les variables, commentaires et textes UI
- Pas de framework CSS externe (styles custom dans `style.css`), pas de router SPA — navigation par
  `<a href>` / `window.location.href` entre pages HTML indépendantes
- Pas de build step : les fichiers sont déployés tels quels
- Chaque module Firestore a un unique fichier `services/*.js` comme frontière d'accès — les pages ne
  manipulent jamais le SDK Firebase directement
- Les modules `utils/*.js` ne doivent jamais importer Firebase — ils reçoivent leurs données en
  paramètres pour rester testables sans dépendance externe

## Tests automatisés

```bash
npm test          # mode watch (développement)
npm run test:run  # one-shot (CI)
```

Seule la logique pure de `utils/` est testée par Vitest (`RappelsEntretien`, `GenerateurListeCourses`,
`DateSemaine`, `CodeInvitation`) ; les `services/*.js` qui touchent Firestore sont vérifiés
manuellement via l'émulateur Firebase, comme documenté dans "Configuration initiale".

## Configuration initiale (à faire avant le premier lancement)

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activer **Firestore Database** et **Authentication** (fournisseur **Google**)
3. Copier `public/firebase-config.example.js` en `public/firebase-config.js` et renseigner la config
   du projet
4. `firebase use --add` pour lier le projet local au projet Firebase créé (met à jour `.firebaserc`)
5. Développement local : `firebase emulators:start --only auth,firestore,hosting` — voir
   `firebase.json` pour les ports. Le popup Google réel ne fonctionne pas entièrement dans
   l'émulateur Auth ; un passage sur le vrai projet est nécessaire pour valider ce flux de bout en
   bout.
6. Déploiement : `firebase deploy`

## Roadmap

### ✅ Étape 1 — Socle
- Authentification Google, création/jonction de foyer par code d'invitation, règles Firestore
  d'appartenance au foyer

### ✅ Étape 2 — Voiture
- Carnet d'entretien par véhicule, calcul de rappels (km/date) et badges de statut

### ✅ Étape 3 — Menus et recettes
- Bibliothèque de recettes, planning hebdomadaire mixte (texte libre / recette liée)

### ✅ Étape 4 — Liste de courses
- Liste partagée en temps réel, génération automatique depuis le planning avec fusion non
  destructive

### 🔜 Étape 5 — Fonctionnalités transverses
- Notifications push pour les rappels d'entretien (Cloud Functions + Firebase Cloud Messaging)
- Conversion d'unités dans le générateur de liste de courses (ex. g ↔ kg)
- Intervalles d'entretien personnalisables par véhicule
- Afficher le nom des membres du foyer (nécessite d'assouplir la règle `utilisateurs/{uid}` ou de
  dupliquer le nom affiché dans `foyers/{foyerId}`)

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution
> significative du projet.
