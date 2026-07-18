# MindLess

Application anti-charge mentale : entretien voiture, courses et menus de la semaine, partagés en famille.

Pour les commandes de lancement, de test et de déploiement, voir [README.md](README.md). Ce fichier
décrit l'architecture, le modèle de données et les conventions.

## Stack technique

- **Frontend** : Vanilla HTML/CSS/JS (pas de framework, pas de bundler), hébergé sur Firebase Hosting
  (`public/` est la racine servie)
- **Backend** : Node.js + Express (`backend/`), déployé séparément du frontend (voir README.md) —
  seul point d'écriture vers Firestore, via le SDK Admin Firebase
- **Base de données** : Cloud Firestore, écrite exclusivement par le backend depuis la réécriture
  d'architecture — le client n'a plus qu'un accès en lecture, et uniquement là où le temps réel
  (`onSnapshot`) reste nécessaire (voir "Sécurité Firestore" plus bas)
- **Authentification** : Firebase Auth — **Google uniquement** (`signInWithPopup` +
  `GoogleAuthProvider`) côté client ; le backend vérifie l'ID token Firebase via `firebase-admin/auth`
- **SDK Firebase** : v12 chargé via CDN côté front (`https://www.gstatic.com/firebasejs/12.12.0/...`),
  `firebase-admin` côté backend
- **Modules ES** : les scripts front utilisent `type="module"` ; le backend est en ESM
  (`"type": "module"` dans `backend/package.json`)
- **Tests** : Vitest des deux côtés (dev uniquement — ne fait partie ni du déploiement Hosting ni du
  déploiement backend)

## Architecture — client / backend / Firestore

```
public/*.html ──ApiClient (Bearer <ID token Firebase>)──▶ backend/server.js ──SDK Admin──▶ Firestore
        │                                                                                      ▲
        └─────────────────── onSnapshot (lecture seule, 3 collections) ─────────────────────────┘
```

Toutes les écritures (créer un véhicule, ajouter une recette, cocher un article...) passent par
`ApiClient` → une route Express → un repository → Firestore. `firestore.rules` interdit désormais
toute écriture côté client (`allow write: if false` partout) — le SDK Admin du backend contourne ces
règles, c'est lui le seul écrivain.

Trois services front gardent une **lecture temps réel directe** sur Firestore (`onSnapshot`), en
plus de leurs appels à `ApiClient` pour les écritures — mode hybride nécessaire pour que les
changements d'un membre du foyer apparaissent instantanément chez les autres, sans polling :
`FoyerService.ecouterFoyer`, `PlanningRepasService.ecouterSemaine`, `ListeCoursesService.ecouterListe`.

Le backend accepte deux formes d'authentification (voir `backend/src/commun/middleware/auth.js`) :
un vrai ID token Firebase, ou le secret `STATIC_API_TOKEN` (+ en-tête `X-Test-Uid`) pour tester une
route sans navigateur — voir README.md.

## Modules fonctionnels

Le code (front **et** back) est découpé par domaine métier plutôt que par couche technique.
Chaque module regroupe, en miroir des deux côtés :

- **Backend** (`backend/src/<module>/`) : `domain/` (classes/fonctions pures), `repositories/`
  (accès Firestore via le SDK Admin), `routes/` (Express, montées dans `server.js`)
- **Frontend** (`public/<module>/`) : `services/` (appels `ApiClient`, seul point d'accès au
  backend), `models/`, `utils/` le cas échéant (fonctions pures, testables, n'importent jamais
  Firebase)

Les pages `.html` restent à la racine de `public/` (pas de sous-dossier par module) : sans
bundler, ce sont de simples `<a href="...">` et chemins relatifs entre pages, les déplacer n'aurait
aucun bénéfice et casserait tous les liens de navigation.

Modules actuels : `commun`, `voiture`, `menus`. Un futur module (tâches, préparation vacances...)
suit le même patron : créer `backend/src/<module>/` et `public/<module>/` avec la même structure
interne, et monter ses routes dans `backend/server.js`.

### `commun` — utilisateur, foyer, authentification

- **Backend** : `domain/{Utilisateur,Foyer,CodeInvitation}.js`, `middleware/{auth,requireUid,
  requireMembreFoyer}.js`, `repositories/{UtilisateurRepository,FoyerRepository}.js`,
  `routes/{whoami,utilisateurs,foyers}.js`
- **Frontend** : `services/{AuthService,ApiClient,UtilisateurService,FoyerService}.js`,
  `models/{Utilisateur,Foyer}.js`

`requireMembreFoyer` (middleware backend) est l'équivalent de `estMembreDuFoyer()` dans
`firestore.rules` : il vérifie que `req.uid` figure dans `foyer.membres` avant de laisser passer une
requête sur une sous-ressource du foyer, et pose `req.foyer` pour éviter une deuxième lecture aux
routes qui en ont besoin (ex. `nutrition.js`).

### `voiture` — véhicules, entretiens, rappels

- **Backend** : `domain/{Vehicule,Entretien}.js`, CRUD complet dans `routes/{vehicules,
  entretiens}.js`
- **Frontend** : `services/{VehiculeService,EntretienService}.js`, `models/{Vehicule,Entretien}.js`,
  `utils/{ReglesEntretien,RappelsEntretien}.js`

`utils/ReglesEntretien.js` définit les intervalles de référence par type (`vidange` 15000km/12mois,
`controleTechnique` 24mois, `pneus` 40000km, `freins` 30000km, `revisionGenerale` 20000km/12mois,
`autre` sans intervalle). `utils/RappelsEntretien.calculerRappels(vehicule, entretiens, dateActuelle)`
est une fonction pure qui retrouve le dernier entretien de chaque type et calcule un statut
`inconnu` (pas d'historique) / `ok` / `proche` (< 1000km ou < 30 jours) / `du` (dépassé), sur le
critère km et/ou date selon ce que le type définit.

Le calcul des rappels reste **côté client**, au chargement (badge sur la tuile Voiture de
`index.html` et détail par véhicule dans `vehicule-detail.html`) — le backend ne fait que du CRUD
sur véhicules/entretiens, il n'expose pas de route de calcul de rappels. Des notifications push
réelles nécessiteraient Firebase Cloud Messaging + un déclencheur planifié côté backend —
explicitement hors scope, voir roadmap.

### `menus` — recettes, planning, liste de courses, profil nutritionnel

- **Backend** : `domain/{Recette,PlanningRepas,ListeCoursesItem,GenerateurListeCourses,
  ReferentielAlimentaire,ObjectifsNutritionnels,ResoudreProfil,AnalyseNutritionnelleSemaine,
  DateSemaine}.js`, `repositories/{RecetteRepository,PlanningRepasRepository,
  ListeCoursesRepository}.js`, `routes/{recettes,planning,listeCourses,nutrition}.js`
- **Frontend** : `services/{RecetteService,PlanningRepasService,ListeCoursesService,
  NutritionService}.js`, `models/{Recette,PlanningRepas,ListeCoursesItem}.js`, `utils/DateSemaine.js`

Chaque créneau du planning (`jour` × `midi`/`soir`) supporte **soit** un texte libre (`texte`), **soit**
une recette liée (`recetteId`) — les deux modes cohabitent selon ce que l'utilisateur choisit sur
`menus.html`.

**Liste de courses** : la génération depuis le planning est désormais entièrement orchestrée côté
backend (`POST /api/foyers/:foyerId/liste-courses/generer`, voir `routes/listeCourses.js`) plutôt
que par plusieurs services enchaînés côté client. `domain/GenerateurListeCourses.js` (pur) fait le
lien planning → courses :
- `genererItemsDepuisPlanning(planning, recettesParId)` agrège les ingrédients de tous les créneaux
  liés à une recette (les créneaux texte libre sont ignorés), en fusionnant par `nom` + `unite`
  normalisés (pas de conversion d'unité — `farine/g` et `farine/kg` restent deux entrées distinctes).
- `fusionnerAvecListeExistante(itemsGeneres, itemsExistants)` calcule les écritures à faire sans
  jamais toucher un item déjà **coché**, en amenant un item `manuel` vers `mixte` plutôt que de
  l'écraser, et sans jamais **supprimer** un item devenu inutile (nettoyage manuel assumé, voir
  roadmap).

`courses.html` groupe le résultat par `categorie` et écoute la collection en temps réel
(`onSnapshot`) pour que les coches se synchronisent instantanément entre les membres du foyer.

**Profil nutritionnel** (`profil-nutritionnel.html`) : chaque membre renseigne sexe, année de
naissance, niveau d'activité et poids (`Utilisateur.profilNutritionnel`, tous champs optionnels).
`menus.html` affiche ensuite un bilan hebdomadaire par membre (`GET
/api/foyers/:foyerId/nutrition/bilan`, voir `routes/nutrition.js`) :
- `domain/ReferentielAlimentaire.classerIngredient(nom)` classe un ingrédient dans un des 6 groupes
  suivis (légumes, fruits, féculents, légumineuses, protéines animales, produits laitiers), ou
  `nonClasse` s'il est absent de la table — n'empêche pas le calcul du reste.
- `domain/ResoudreProfil.resoudreProfil(profilNutritionnel)` traduit le profil en clé de la table
  d'objectifs (`adulte_homme` / `adulte_femme` / `adulte_generique` si sexe absent/non reconnu) —
  une seule tranche d'âge pour l'instant (v1), voir le commentaire du fichier pour l'étendre.
  `domain/ObjectifsNutritionnels.js` porte cette table (portions/semaine par groupe et par profil).
- `domain/AnalyseNutritionnelleSemaine.js` agrège les portions réellement consommées à partir du
  planning + recettes de la semaine, et les compare aux objectifs — les repas en texte libre sont
  comptés à part (`repasNonEvalues`) plutôt que d'ignorer silencieusement le calcul.

Un profil non renseigné fait sortir le membre du bilan plutôt que de bloquer le calcul pour le foyer.

## Modèle de données Firestore

MindLess est une application **familiale multi-utilisateurs** : toutes les données métier sont
partagées au niveau du **foyer**, pas de l'utilisateur (contrairement à un modèle mono-utilisateur
classique). Un `foyerId` **est** le code d'invitation partagé entre les membres — pas de collection
d'invitations séparée, pas de Cloud Function nécessaire.

```
utilisateurs/{uid}
  { email, nomAffiche, photoUrl, foyerId: string|null, profilNutritionnel: object|null }

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

Créer un foyer génère un code à 6 caractères (`commun/domain/CodeInvitation.js`, alphabet sans
caractères ambigus) qui sert directement d'identifiant du document `foyers/{code}`. Créer et
rejoindre un foyer passent tous les deux par le backend (`POST /api/foyers`,
`POST /api/foyers/:id/rejoindre`, voir `commun/repositories/FoyerRepository.js`) : c'est le SDK
Admin qui vérifie l'existence du code et ajoute l'`uid` à `membres` (`FieldValue.arrayUnion`), en
contournant `firestore.rules` — le client n'a plus besoin de lire un foyer avant d'en être membre.

**Limite connue** : `firestore.rules` interdit toute lecture/écriture directe sur
`utilisateurs/{uid}` désormais (`allow read, write: if false`) ; un membre du foyer ne peut donc pas
voir le nom affiché des autres membres côté client, seulement leur nombre (`foyer.html` affiche "X
membres dans ce foyer", pas leurs noms). Ce n'est plus une limite d'architecture : le backend, via
le SDK Admin, résout déjà les noms des membres d'un foyer ailleurs (voir
`menus/routes/nutrition.js`, qui charge `req.foyer.membres` puis chaque `Utilisateur`) — il suffirait
d'exposer un endpoint dédié pour que `foyer.html` les affiche.

**Sécurité Firestore** : `firestore.rules` n'autorise plus aucune écriture cliente (`allow write: if
false` partout). En lecture, seules trois zones restent accessibles aux membres du foyer
(`estMembreDuFoyer()`), pour les 3 lectures temps réel (`onSnapshot`) qui subsistent côté front :
`foyers/{foyerId}`, `planningRepas/{document=**}`, `listeCourses/{document=**}`. `vehicules` et
`recettes` sont entièrement fermés en lecture côté client (`allow read, write: if false`) — leurs
pages passent exclusivement par `ApiClient`, sans lecture temps réel.

## Conventions de code

- Français pour les variables, commentaires et textes UI
- Pas de framework CSS externe (styles custom dans `style.css`), pas de router SPA — navigation par
  `<a href>` / `window.location.href` entre pages HTML indépendantes
- Pas de build step, ni front ni back : les fichiers sont déployés/exécutés tels quels (ESM natif)
- Chaque module Firestore a un unique fichier `services/*.js` (front) → `routes/*.js` (back) comme
  frontière d'accès — les pages ne manipulent jamais le SDK Firebase directement (sauf les 3 lectures
  temps réel documentées ci-dessus), et les routes backend ne manipulent jamais Firestore directement
  (toujours via un `repositories/*.js`)
- Les modules `utils/*.js` (front) et `domain/*.js` (back) ne doivent jamais importer Firebase — ils
  reçoivent leurs données en paramètres pour rester testables sans dépendance externe
- Pas de monorepo/package partagé entre front et backend : quelques fichiers existent volontairement
  en double des deux côtés (`DateSemaine.js`, et historiquement `CodeInvitation.js`/
  `GenerateurListeCourses.js` avant leur passage 100% backend) — assumé plutôt que mutualisé
  prématurément pour deux runtimes séparés

## Tests automatisés

Voir [README.md](README.md) pour les commandes. Les répertoires `tests/` (racine) et `backend/tests/`
sont eux-mêmes découpés en sous-dossiers par module (`commun/`, `voiture/`, `menus/`), en miroir de
`public/<module>/utils/` et `backend/src/<module>/domain/`. Seule la logique pure y est couverte ;
les `services/*.js` et `repositories/*.js` qui touchent Firestore se vérifient manuellement.

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

### ✅ Étape 5 — Backend + profil nutritionnel
- Bascule de toutes les écritures Firestore vers un backend Express (SDK Admin) ; le client passe en
  lecture restreinte (3 collections en temps réel, écriture nulle partout)
- Profil nutritionnel par membre + bilan hebdomadaire comparé aux objectifs par groupe alimentaire
- Découpage du code (front + back) par module fonctionnel (`commun`/`voiture`/`menus`) plutôt que
  par couche technique, pour absorber les futurs modules sans réorganisation

### ✅ Backend déployé
- `mindless-backend` sur Cloud Run (projet `mindless-c58d3`, région `europe-west1`), secret
  `FIREBASE_SERVICE_ACCOUNT_JSON` via Secret Manager — voir README.md pour la procédure de
  redéploiement et la configuration GCP
- Frontend (Firebase Hosting) et backend connectés en prod via `public/api-config.js`

### 🔜 Étape 6 — Nouveaux modules fonctionnels
- Gestion des tâches, préparation vacances... — chacun en `backend/src/<module>/` +
  `public/<module>/`, suivant le patron `commun`/`voiture`/`menus`
- Endpoint dédié pour afficher le nom des membres du foyer (voir "Limite connue" plus haut —
  le backend a déjà l'information)
- Pas encore de pipeline CI/CD (le déploiement des deux côtés est manuel, voir README.md)

### 🔜 Autres améliorations identifiées
- Notifications push pour les rappels d'entretien (Cloud Functions + Firebase Cloud Messaging)
- Conversion d'unités dans le générateur de liste de courses (ex. g ↔ kg)
- Intervalles d'entretien personnalisables par véhicule
- Étendre `ResoudreProfil`/`ObjectifsNutritionnels` à d'autres tranches d'âge (enfant, senior)

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution
> significative du projet.
