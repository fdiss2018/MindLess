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
`FoyerService.ecouterFoyer` (cœur), `PlanningRepasService.ecouterSemaine` (menus),
`ListeCoursesService.ecouterListe` (courses).

Le backend accepte deux formes d'authentification (voir `backend/src/coeur/middleware/auth.js`) :
un vrai ID token Firebase, ou le secret `STATIC_API_TOKEN` (+ en-tête `X-Test-Uid`) pour tester une
route sans navigateur — voir README.md.

## Cœur et modules

MindLess est un **cœur** transverse (identité, foyer, session, droits d'accès, pages d'accueil /
Settings / Admin) sur lequel se branchent des **modules** fonctionnels : `voiture`, `courses`,
`menus`, `veille`, `memoires`. L'administrateur du foyer choisit, membre par membre, les modules que chacun
voit — pour qu'un membre ne soit pas submergé de fonctionnalités qui ne le concernent pas. Le cœur,
lui, est visible de tous.

Ce cloisonnement se lit directement dans l'arborescence, en miroir front/back :

```
backend/
  server.js                       composition : routes du cœur + une ligne par module
  src/coeur/                      identité, foyer, session, droits d'accès
    domain/ middleware/ repositories/ routes/
    monterModule.js               branche un module derrière le contrôle d'accès
  src/modules/<id>/
    module.js                     manifeste : { id, routes, routesPubliques? }
    api.js                        (optionnel) API publique offerte aux autres modules
    domain/ repositories/ routes/
  tests/coeur/  tests/modules/<id>/
public/
  *.html                          pages à plat, cœur et modules (voir plus bas)
  coeur/  services/ models/ utils/
  modules/<id>/  services/ models/ utils/  accueil.js, parametres.js (optionnels)
tests/coeur/  tests/modules/<id>/
```

À l'intérieur d'un module, même découpage qu'avant : **backend** `domain/` (classes/fonctions
pures), `repositories/` (accès Firestore via le SDK Admin), `routes/` (Express) ; **frontend**
`services/` (appels `ApiClient`, seul point d'accès au backend), `models/`, `utils/` (fonctions
pures, testables, n'importent jamais Firebase).

Les pages `.html` restent à la racine de `public/` (pas de sous-dossier par module) : sans
bundler, ce sont de simples `<a href="...">` et chemins relatifs entre pages, les déplacer n'aurait
aucun bénéfice et casserait tous les liens de navigation. Leur appartenance à un module est
déclarée dans leur script, par `ouvrirSession({ module: '<id>' })` (voir plus bas).

### Règles de dépendance

1. **Un module dépend du cœur, jamais l'inverse.** Le cœur ne connaît des modules que leurs
   identifiants (catalogue `coeur/domain/AccesModules.js`) ; seuls les points de composition les
   importent : `backend/server.js` (manifestes), `index.html` et `settings.html` (chargement
   dynamique de `modules/<id>/accueil.js` et `modules/<id>/parametres.js`, voir "Points
   d'extension").
2. **Un module n'importe jamais le code interne d'un autre module.** Côté backend, une dépendance
   entre modules passe uniquement par `modules/<fournisseur>/api.js`, qui expose des données
   simples (jamais un repository ni une classe du domaine) — seul cas aujourd'hui : `courses` →
   `menus/api.js` (`listerIngredientsSemaine`). Côté front, aucun import entre modules : une
   fonction pure utile à plusieurs modules remonte dans `public/coeur/utils/` (ex. `DateSemaine.js`,
   partagé par menus et courses).
3. **Chaque module possède ses données** Firestore, sous `foyers/{foyerId}/...` ; le cœur ne stocke
   rien de propre à un module (le profil nutritionnel a quitté `utilisateurs/{uid}` pour cette
   raison, voir `menus`).
4. **Un module ne pose jamais lui-même le contrôle d'accès** : le cœur l'applique au montage (backend)
   et à l'ouverture de page (front).

### Droits d'accès aux modules

Source de vérité unique : `backend/src/coeur/domain/AccesModules.js` (fonctions pures, testées) —
`IDS_MODULES` (catalogue), `estAdministrateur`, `etatModules`, `modulesAccessibles`,
`aAccesModule`, `normaliserModules`, et pour les essais `statutDemande`, `refusDemande`,
`creerDemande`, `appliquerChoixAdministrateur`, `confirmerModule`, `compterDemandesEnAttente`.

- L'**administrateur** du foyer est son créateur (`foyer.creePar`) : il a toujours accès à tous les
  modules, ses droits ne se modifient pas (il peut donc toujours rouvrir un module).
- Un membre a accès aux modules ouverts par l'administrateur (`foyer.modulesParMembre[uid]`) et à
  ceux qu'il a lui-même pris **à l'essai** (voir ci-dessous) — **refus par défaut** : un nouveau
  membre ne voit que le cœur (Settings) tant qu'aucun module ne lui est ouvert.
- L'administrateur gère les droits depuis Admin → **Accès aux modules** (`acces-modules.html`, une
  case par membre et par module, enregistrement immédiat) → `PUT
  /api/foyers/:foyerId/membres/:uid/modules` (`requireCreateurFoyer`).

**Modules à l'essai** : depuis Settings (carte « Mes modules »), un membre ajoute lui-même un module
(`POST /api/foyers/:foyerId/demandes-modules`, `{ module }`) : il y a accès **tout de suite**, pendant
`DUREE_ACCES_TEMPORAIRE_JOURS` = 21 jours, le temps que l'administrateur décide.
- Sur `acces-modules.html`, un module à l'essai apparaît **coché**, avec sa date de fin et un bouton
  « Confirmer » (`POST .../membres/:uid/modules/:idModule/confirmer`) qui le rend définitif. Le
  **décocher** le refuse. Cocher ou décocher une autre case ne le confirme jamais par mégarde
  (`appliquerChoixAdministrateur` : un essai coché reste un essai).
- Décocher un module **déjà ouvert** l'enregistre aussi comme refusé.
- Sans réponse, l'essai **expire** de lui-même : l'expiration (ms, `demande.expiration`) est comparée
  à l'heure courante à chaque lecture, sans tâche planifiée. Le membre peut aussi **arrêter** son essai
  (`DELETE .../demandes-modules/:idModule`), ce qui avance l'expiration à maintenant.
- Après un refus, une expiration ou un arrêt, le membre **ne peut pas relancer d'essai** lui-même
  (`refusDemande`) — sinon les essais s'enchaîneraient sans jamais passer par l'administrateur ;
  celui-ci peut toujours ouvrir le module (cocher, ou « Confirmer »), ce qui efface l'ancienne
  demande.
- L'administrateur voit le nombre d'essais à confirmer en badge sur ses tuiles Admin (`index.html`)
  et Accès aux modules (`admin.html`) — `demandesEnAttente` dans `GET /api/session`.

Le droit est appliqué à trois niveaux, qui tirent tous leur décision de ces mêmes règles :

- **Backend** — `coeur/monterModule.js` monte chaque route déclarée dans un manifeste derrière
  `requireUid` → `requireMembreFoyer` → `requireModule(id)` (403 sinon). Aucune route de module ne
  peut être exposée sans ce contrôle ; `authentifier` est appliqué une seule fois pour tout `/api`
  dans `server.js`.
- **Front** — chaque page démarre par `ouvrirSession(...)` (`public/coeur/services/Session.js`), qui
  lit `GET /api/session` (utilisateur, foyer, `estAdministrateur`, `modules`, `etatModules`,
  `demandesEnAttente` — calculés par le backend, jamais recalculés côté front) et renvoie vers
  l'accueil une page de module non ouverte
  (ou une page admin pour un non-administrateur). `index.html` n'affiche que les tuiles des modules
  ouverts.
- **`firestore.rules`** — `aAccesModule(foyerId, module)` traduit les mêmes règles (essais en cours
  compris, via `request.time` et `expiration`) pour les deux lectures temps réel de modules
  (`planningRepas` → menus, `listeCourses` → courses).

### Points d'extension du cœur

- **Manifeste backend** `modules/<id>/module.js` : `{ id, routes: { '<chemin>': router },
  routesPubliques?: {...} }`. `routes` est monté sur `/api/foyers/:foyerId/<chemin>` (routers en
  `mergeParams: true`, `req.foyer` déjà posé), `routesPubliques` sur
  `/api/public/foyers/:foyerId/<chemin>` **sans** authentification ni contrôle d'accès — réservé à
  un choix explicite et documenté (seul cas : API publique de veille).
- **Catalogue front** `public/coeur/utils/Modules.js` : libellé, icône et page d'entrée de chaque
  module (les identifiants sont une copie assumée du catalogue backend). `badgeAccueil: true` →
  le module fournit `modules/<id>/accueil.js` exportant `calculerBadge(foyerId)`, chargé
  dynamiquement par `index.html` seulement si le module est ouvert (voiture : rappels d'entretien).
  `parametres: true` → le module fournit `modules/<id>/parametres.js` exportant
  `afficherParametres(conteneur, session)`, qui construit et enregistre lui-même les réglages
  **personnels** du module ; `settings.html` lui donne une carte titrée du nom du module, seulement
  si le module est ouvert à l'utilisateur (memoires : suppression des notes, style des chapitres).
  Les réglages d'administration à l'échelle du foyer, eux, restent derrière Admin (ex. lignes
  éditoriales de veille).
- **Ouverture de page** `ouvrirSession({ module, administrateur, foyerRequis })` : `module` pour une
  page de module, `administrateur: true` pour une page réservée à l'administrateur, `foyerRequis:
  false` uniquement pour `settings.html` (création/jonction d'un foyer).

### Ajouter un module

1. Ajouter son identifiant à `IDS_MODULES` (`backend/src/coeur/domain/AccesModules.js`) et son
   entrée de présentation dans `public/coeur/utils/Modules.js`.
2. Backend : `backend/src/modules/<id>/{domain,repositories,routes}/` + `module.js`, puis une ligne
   dans `backend/server.js` (`monterModule` refuse au démarrage un module absent du catalogue).
   Routers en `Router({ mergeParams: true })`, sans middleware d'accès.
3. Front : `public/modules/<id>/{services,models,utils}/` ; pages `<id>*.html` à la racine de
   `public/`, chacune démarrant par `await ouvrirSession({ module: '<id>' })`. Réglages personnels
   de l'utilisateur : dans Settings via `parametres.js` (point d'extension `parametres`), pas sur
   les pages du module.
4. Données sous `foyers/{foyerId}/<collection>` ; dans `firestore.rules`, collection fermée
   (`allow read, write: if false`) ou, si une lecture temps réel est indispensable,
   `allow read: if aAccesModule(foyerId, '<id>')`.
5. Besoin d'un autre module ? Passer par son `api.js` (le créer s'il n'existe pas), jamais par ses
   fichiers internes.
6. Tests de la logique pure dans `backend/tests/modules/<id>/` et `tests/modules/<id>/`.
7. Documenter le module dans cette section de CLAUDE.md.

### `coeur` — identité, foyer, session, droits d'accès

- **Backend** : `domain/{Utilisateur,Foyer,CodeInvitation,AccesModules}.js`, `middleware/{auth,
  requireUid,requireMembreFoyer,requireCreateurFoyer,requireModule}.js`,
  `repositories/{UtilisateurRepository,FoyerRepository,GeminiClient}.js`, `routes/{whoami,session,
  utilisateurs,foyers}.js`, `monterModule.js`
- **Frontend** : `services/{AuthService,ApiClient,Session,UtilisateurService,FoyerService,
  LectureVocaleService}.js`, `models/{Utilisateur,Foyer}.js`, `utils/{Modules,DateSemaine}.js`
- **Pages** : `index.html` (accueil : tuiles des modules ouverts + Settings + Admin), `login.html`,
  `settings.html` (ex-"Mon foyer", visible de tous : foyer, membres et leurs modules, code
  d'invitation, « Mes modules » pour prendre un module à l'essai, puis une carte de réglages par
  module ouvert qui en déclare ; sert aussi à créer ou rejoindre un foyer), `admin.html`,
  `acces-modules.html`,
  `404.html`

Deux briques techniques du cœur sont partagées par plusieurs modules (règle de dépendance n°2) :
- `repositories/GeminiClient.js` (backend) — transport vers l'API Gemini : `GeminiClient.generer(
  requete)` envoie un corps `generateContent` déjà construit par le domaine du module appelant et
  renvoie `{ corpsJSON, groundingMetadata }` ; `fetch` natif (pas de SDK), clé en query param
  (`GEMINI_API_KEY`), délai de 45 s, retry sur `TIMEOUT`/`DEGENERE` uniquement. Pattern repris du
  repo frère `homeFit` (`backend/src/services/GeminiClient.js`). Utilisé par veille (articles) et
  memoires (chapitres).
- `services/LectureVocaleService.js` (front) — lecture à voix haute via l'API Web Speech du
  navigateur (`speechSynthesis`), gratuite et 100% côté client ; `lire(texte, { surFin, vitesse })`.
  Utilisé par veille et memoires.

`requireMembreFoyer` (middleware backend) est l'équivalent de `estMembreDuFoyer()` dans
`firestore.rules` : il vérifie que `req.uid` figure dans `foyer.membres` avant de laisser passer une
requête sur une sous-ressource du foyer, et pose `req.foyer` pour éviter une deuxième lecture aux
routes qui en ont besoin (ex. `requireModule`, `nutrition.js`).

`requireCreateurFoyer` (middleware backend, à exécuter après `requireMembreFoyer`) restreint une
route à l'administrateur (`estAdministrateur` : `foyer.creePar === req.uid`) — droits d'accès aux
modules, lignes éditoriales de veille, API externe de veille. MindLess n'a pas de système de rôles
au-delà de ces deux niveaux (administrateur / membre) et des modules ouverts : à l'intérieur d'un
module, tout membre qui y a accès a les mêmes droits que les autres.

`GET /api/session` (`routes/session.js`) donne en un appel tout ce dont une page a besoin pour
démarrer ; `GET /api/foyers/:foyerId/membres` (`routes/foyers.js`, ouvert à tout membre) résout le
nom affiché, le statut d'administrateur et les modules de chaque membre — le client ne pouvant pas
lire `utilisateurs/{uid}` (voir "Rejoindre un foyer").

Côté front, `public/admin.html` est le point d'entrée unique vers les réglages réservés à
l'administrateur — une tuile `nav-tuile` sur `index.html`, affichée seulement pour lui. Pas de
répertoire `admin/` par module : c'est une page d'accueil qui renvoie vers les réglages (aujourd'hui
`acces-modules.html`, réglage du cœur, et `veille-parametres.html`, page du module veille réservée à
l'administrateur via `ouvrirSession({ module: 'veille', administrateur: true })`) — un futur
réglage admin s'ajoute comme une tuile de plus ici.

### `voiture` — véhicules, entretiens, rappels

- **Backend** : `domain/{Vehicule,Entretien}.js`, CRUD complet dans `routes/{vehicules,
  entretiens}.js`
- **Frontend** : `services/{VehiculeService,EntretienService}.js`, `models/{Vehicule,Entretien}.js`,
  `utils/{ReglesEntretien,RappelsEntretien}.js`, `accueil.js`
- **Pages** : `voiture.html`, `vehicule-detail.html`, `vehicule-form.html`, `entretien-form.html`

`utils/ReglesEntretien.js` définit les intervalles de référence par type (`vidange` 15000km/12mois,
`controleTechnique` 24mois, `pneus` 40000km, `freins` 30000km, `revisionGenerale` 20000km/12mois,
`autre` sans intervalle). `utils/RappelsEntretien.calculerRappels(vehicule, entretiens, dateActuelle)`
est une fonction pure qui retrouve le dernier entretien de chaque type et calcule un statut
`inconnu` (pas d'historique) / `ok` / `proche` (< 1000km ou < 30 jours) / `du` (dépassé), sur le
critère km et/ou date selon ce que le type définit.

Le calcul des rappels reste **côté client**, au chargement (badge sur la tuile Voiture de
`index.html` via le point d'extension `accueil.js`, et détail par véhicule dans
`vehicule-detail.html`) — le backend ne fait que du CRUD sur véhicules/entretiens, il n'expose pas
de route de calcul de rappels. Des notifications push réelles nécessiteraient Firebase Cloud
Messaging + un déclencheur planifié côté backend — explicitement hors scope, voir roadmap.

### `courses` — liste de courses partagée

- **Backend** : `domain/{ListeCoursesItem,GenerateurListeCourses}.js`,
  `repositories/ListeCoursesRepository.js`, `routes/listeCourses.js`
- **Frontend** : `services/ListeCoursesService.js`, `models/ListeCoursesItem.js`
- **Pages** : `courses.html`

Anciennement une partie du module `menus`, séparé pour que l'administrateur puisse ouvrir la liste
de courses sans le planning des repas (et inversement).

**Génération depuis le planning** : entièrement orchestrée côté backend (`POST
/api/foyers/:foyerId/liste-courses/generer`, voir `routes/listeCourses.js`). Les besoins de la
semaine viennent du module menus, par son API publique (`menus/api.js`,
`listerIngredientsSemaine`) — un membre qui n'a accès qu'à courses peut donc générer sa liste
depuis le planning tenu par les autres, sans accéder au module menus. `domain/
GenerateurListeCourses.fusionnerAvecListeExistante(itemsGeneres, itemsExistants)` (pur) calcule
les écritures à faire sans jamais toucher un item déjà **coché**, en amenant un item `manuel` vers
`mixte` plutôt que de l'écraser, et sans jamais **supprimer** un item devenu inutile (nettoyage
manuel assumé, voir roadmap).

`courses.html` groupe le résultat par `categorie` et écoute la collection en temps réel
(`onSnapshot`) pour que les coches se synchronisent instantanément entre les membres du foyer.

### `menus` — recettes, planning, profil nutritionnel

- **Backend** : `domain/{Recette,PlanningRepas,IngredientsSemaine,ReferentielAlimentaire,
  ObjectifsNutritionnels,ResoudreProfil,AnalyseNutritionnelleSemaine,DateSemaine}.js`,
  `repositories/{RecetteRepository,PlanningRepasRepository,ProfilNutritionnelRepository}.js`,
  `routes/{recettes,planning,nutrition}.js`, `api.js` (API publique, consommée par courses)
- **Frontend** : `services/{RecetteService,PlanningRepasService,NutritionService}.js`,
  `models/{Recette,PlanningRepas}.js`
- **Pages** : `menus.html`, `recettes.html`, `recette-detail.html`, `recette-form.html`,
  `profil-nutritionnel.html`

Chaque créneau du planning (`jour` × `midi`/`soir`) supporte **soit** un texte libre (`texte`), **soit**
une recette liée (`recetteId`) — les deux modes cohabitent selon ce que l'utilisateur choisit sur
`menus.html`.

`domain/IngredientsSemaine.agregerIngredientsSemaine(planning, recettesParId)` (pur) agrège les
ingrédients de tous les créneaux liés à une recette (les créneaux texte libre sont ignorés), en
fusionnant par `nom` + `unite` normalisés (pas de conversion d'unité — `farine/g` et `farine/kg`
restent deux entrées distinctes) ; exposé aux autres modules par `api.js`.

**Recettes — filtres, import/export** : `recettes.html` filtre la bibliothèque côté client (titre,
ingrédient, tag exact via un `<select>` alimenté par les tags distincts du foyer) — pas de route
backend dédiée, tout tient dans la liste déjà chargée. L'export génère un fichier JSON (tableau de
`{nom, portions, ingredients, instructions, tags}`, sans `id`/`creePar`/`dateCreation`) téléchargé
côté client. L'import repasse par le backend (`POST
/api/foyers/:foyerId/recettes/importer`, body `{ recettes: [...] }`) plutôt que par des appels
`POST /recettes` répétés côté client : `creePar`/`dateCreation` sont posés une seule fois côté
serveur, et les entrées sans `nom` ou sans `ingredients` sont silencieusement ignorées (comptées à
part dans la réponse, `{ importees, ignorees }`) plutôt que de faire échouer tout l'import.

**Profil nutritionnel** (`profil-nutritionnel.html`) : chaque membre renseigne sexe, année de
naissance, niveau d'activité et poids (tous champs optionnels), via `GET`/`PUT
/api/foyers/:foyerId/nutrition/profil`. Donnée du module menus, stockée dans
`foyers/{foyerId}/profilsNutritionnels/{uid}` (`repositories/ProfilNutritionnelRepository.js`) et non
plus sur `utilisateurs/{uid}` (cœur) — une **migration paresseuse** recopie l'ancien champ
`utilisateurs/{uid}.profilNutritionnel` au nouvel emplacement à la première lecture (seule lecture
d'une collection du cœur par ce module, à supprimer une fois tous les profils relus).
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

### `veille` — articles d'actualité par catégorie

- **Backend** : `domain/{Categories,Article,ArticleMarkdown,InterpreterArticleIA}.js`,
  `repositories/{ArticleRepository,GenerationArticleIA,LigneEditorialeRepository}.js`, CRUD +
  génération IA + import dans `routes/articles.js`, API publique sans authentification dans
  `routes/articlesPublics.js`, lignes éditoriales dans `routes/lignesEditoriales.js`
- **Frontend** : `services/{ArticleService,LigneEditorialeService}.js`, `models/Article.js`,
  `utils/Categories.js` (lecture vocale : `coeur/services/LectureVocaleService.js`)
- **Pages** : `veille.html`, `article-detail.html`, `article-form.html`, `veille-parametres.html`
  (réservée à l'administrateur)

12 catégories fixes (`domain/Categories.js`, table de référence comme
`voiture/utils/ReglesEntretien.js`) : `politique`, `marseille`, `culture`, `sortir_marseille`,
`ecologie`, `ia`, `economie_finances`, `societe`, `international`, `economie_entreprises`,
`actualite_locale`, `mails` — celles marquées `accentTendances: true` (`ecologie`, `ia`,
`economie_entreprises`) infléchissent le prompt IA vers les tendances émergentes du sujet plutôt
qu'un résumé générique. `mails` (résumé personnel de boîte mail, voir `exemple/copilot_mails.prompt`)
n'a pas de ligne éditoriale par défaut dédiée — retombe sur le prompt générique — car elle n'est
alimentée que par import `.md`/`.json` depuis Copilot, jamais par la génération IA in-app.

Un article peut être créé de **4 façons** (`source: 'manuel'|'ia'|'import_md'|'api'`), toutes
centralisées sur **`ArticleRepository.creer(foyerId, {titre, categorie, contenu, source,
creePar})`** (`routes/articles.js`) : chaque point d'entrée ne fait que sa propre validation puis
appelle ce point de passage unique, qui pose `dateCreation` et persiste — évite de dupliquer la
construction de l'`Article` (et un bug/évolution à corriger 4 fois) dans chaque route. La règle de
validité des champs (`titre`/`categorie`/`contenu` non vides, catégorie parmi `CATEGORIES`) est
elle aussi centralisée dans `domain/Article.validerChampsArticle` (fonction pure, retourne un
message d'erreur ou `null` — chaque route peut contextualiser le message, ex. import `.md`).

- **Manuel** (`POST /api/foyers/:foyerId/articles`) : formulaire `article-form.html`, comme
  `recette-form.html`. Ouvert à tout membre du foyer.
- **Génération IA** (`POST .../articles/generer`) : `repositories/GenerationArticleIA.js` construit
  la requête (`domain/InterpreterArticleIA.js`) et l'envoie par le client Gemini du cœur
  (`coeur/repositories/GeminiClient.js`, voir `coeur`) — JSON demandé par instruction dans le prompt
  (pas de `responseSchema`, voir plus bas pourquoi). **Deux versions systématiquement
  générées** (voir
  `Article.contenuAudio`) : `contenu` (à lire à l'écran, plusieurs paragraphes) et `contenuAudio`
  (même information réécrite pour l'oral — phrases courtes, sans sigle non prononçable, sans
  symbole de mise en forme) ; seuls les articles `source: 'ia'` ont un `contenuAudio` distinct, les
  3 autres points d'entrée n'ont qu'un seul texte. **Grounding Google Search actif** (`tools:
  google_search`, `InterpreterArticleIA.js`) sur chaque génération, depuis que le projet GCP
  derrière `GEMINI_API_KEY` a la facturation Cloud activée — un premier essai sans facturation
  (2026-09) avait donné un 429 systématique sur le modèle Gemini 3.x en tier gratuit (le grounding
  n'y est simplement pas disponible gratuitement), pas un bug de ce repo ; voir README.md pour le
  coût (5 000 requêtes groundées gratuites/mois puis 14$/1000) et l'alerte de budget mise en place.
  **`responseSchema`/`responseMimeType` ont été retirés de la requête** : vérifié empiriquement
  (curl direct sur l'API, 2026-09) que leur présence empêche systématiquement le grounding de se
  déclencher sur `gemini-3.5-flash-lite` (0 recherche sur 7 essais avec schéma, contre un grounding
  réussi à chaque fois sur le même prompt sans schéma) — contredit la documentation Google qui
  présente cette combinaison comme supportée sur Gemini 3, mais confirmé non fonctionnel ici en
  pratique. Le JSON est donc demandé par instruction dans le prompt, avec le `JSON.parse` + retry
  `DEGENERE` déjà existant dans `coeur/repositories/GeminiClient.js` comme filet de sécurité.
  Le modèle décide lui-même, par appel, s'il déclenche réellement une recherche — ce n'est jamais
  garanti — donc le prompt garde une règle anti-hallucination conditionnelle : les formules datées
  ("cette semaine", "synthèse hebdomadaire"...) ne sont autorisées que si une recherche a
  effectivement confirmé le fait, sinon l'IA reste sur des repères de fond plutôt que des dépêches
  inventées. Les sources renvoyées par le grounding (`groundingMetadata`, extraites par
  `InterpreterArticleIA.extraireSourcesGrounding`) sont stockées dans `Article.sources` et affichées
  dans un bloc "Sources" sur `article-detail.html` quand le modèle a effectivement cherché ;
  `sources` n'est jamais modifiable via `PUT` (`CHAMPS_MODIFIABLES`, `routes/articles.js`), pour
  éviter qu'un membre fabrique de fausses citations sur un article manuel/importé. Fournir un
  `sujet` précis améliore nettement la spécificité du résultat par rapport à une catégorie seule.
  Les articles `source: 'ia'` sont marqués d'un badge "Généré par IA" côté front (`veille.html`,
  `article-detail.html`) plutôt que présentés comme du factuel vérifié — le grounding réduit le
  risque d'hallucination sans l'éliminer (recherche non garantie à chaque appel). Ouvert à tout
  membre du foyer.
- **Import fichier** (`POST .../articles/importer-md`) : un fichier à la fois, déposé depuis le
  bouton "Importer" de `veille.html` — `.md` (front-matter) **ou** `.json` (même forme que l'API
  externe ci-dessous), auto-détecté par `domain/ArticleMarkdown.parserFichierImport` (JSON si le
  texte commence par `{`, sinon Markdown) plutôt que par l'extension du fichier. Les deux formats
  convergent sur la même sortie `{titre, categorie, contenu, contenuAudio, motsCles}`, donc sur la
  même validation et la même création que les 3 autres points d'entrée — voir
  `exemple/article-journees-patrimoine.md` et `.json` pour un exemple complet identique dans les
  deux formats. Format `.md` (pas de dépendance YAML, parsing à la main) :
  ```
  ---
  titre: Mon article
  categorie: ia
  motsCles: mcp, claude, anthropic
  ---
  Corps de l'article, à lire à l'écran...

  --- AUDIO ---
  Même contenu réécrit pour être écouté (optionnel — absent, contenuAudio reste `null` et le
  bouton "Écouter" retombe sur le texte à lire, comme les articles manuels/API)...
  ```
  `motsCles` et le séparateur `--- AUDIO ---` (tirets flexibles, insensible à la casse) sont tous
  deux optionnels des deux côtés (front-matter ou clé JSON). Contrairement à l'import JSON en lot
  des recettes, une entrée invalide fait échouer tout l'import (400) plutôt que d'être
  silencieusement ignorée — un seul article par fichier. Ouvert à tout membre du foyer.
- **API externe** (`POST .../articles/externe`) : pensée pour un script/une automatisation en
  dehors de l'app (pas l'UI) — voir README.md "API externe (veille)" pour l'authentification
  (`STATIC_API_TOKEN` + `X-Test-Uid`) et un exemple `curl`. **Seul point d'entrée réservé au
  créateur du foyer** (`requireCreateurFoyer`, 403 sinon) — les 3 autres restent ouverts à tout
  membre. Articles marqués `source: 'api'`, badge "Ajouté via API" côté front.

**Filtre catégorie/date** : `GET /api/foyers/:foyerId/articles` accepte `?categorie=&depuis=&jusqua=`
(tous facultatifs, cumulables), via la fonction pure `domain/Article.filtrerArticles` — `depuis`/
`jusqua` sont des dates `AAAA-MM-JJ` comparées à `dateCreation`. `ArticleRepository.lister` continue
de tout renvoyer sans filtre Firestore (pas d'index composite à gérer) ; le filtre s'applique en
mémoire côté route, sur une bibliothèque par foyer qui reste petite (même raisonnement que l'absence
de lecture temps réel sur `articles`, voir plus bas).

**API publique en lecture** (`GET /api/public/foyers/:foyerId/articles`, `routes/articlesPublics.js`) :
route **volontairement sans authentification**, sous un préfixe `/api/public/` structurellement
séparé de `/api/foyers/...` (déclarée dans `routesPubliques` du manifeste `module.js`, donc montée
par le cœur sans `requireUid`/`requireMembreFoyer`/`requireModule` — `authentifier` y passe comme
sur tout `/api` mais ne bloque jamais en l'absence de token) plutôt qu'un
paramètre optionnel sur la route existante — pour qu'aucune évolution future de celle-ci ne puisse
affaiblir son contrôle d'accès par erreur. **Limite assumée, choisie en connaissance de cause** :
quiconque connaît (ou devine) un `foyerId` peut lire tous les articles de ce foyer, ce qui déroge au
modèle "tout est privé au foyer" appliqué partout ailleurs dans l'app — décision explicite de
l'utilisateur après avoir été prévenu du compromis. Mêmes filtres `?categorie=&depuis=&jusqua=` que
la route authentifiée (même fonction `filtrerArticles`) ; `creePar` est exclu de la réponse (seul
champ à caractère personnel du modèle), les autres champs sont renvoyés tels quels. Voir README.md
"API publique (veille)" pour un exemple `curl`.

**Lecture/écoute** : pas de suivi d'un statut "lu" (non demandé) — un article se consulte à l'écran
(`article-detail.html`) ou s'écoute via le bouton "🔊 Écouter", qui appelle l'API Web Speech du
navigateur (`speechSynthesis`, `coeur/services/LectureVocaleService.js`) — gratuite, 100% côté client,
aucune dépendance/coût backend, mais qualité de voix variable selon l'OS/navigateur et pas de
fichier audio téléchargeable. Le bouton lit `article.contenuAudio` en priorité, et ne retombe sur
`article.contenu` que pour les articles sans version audio dédiée (manuel/import `.md`/API).

**Rendu de `contenu`** (`article-detail.html` uniquement) : un article peut contenir plusieurs
paragraphes et plusieurs titres de chapitre, donc `contenu` est traité comme du **Markdown**, pas
du texte brut — rendu via `marked` (CDN, `<script>` classique chargé avant le module qui l'utilise)
puis assaini par `DOMPurify` (CDN) avant insertion en `innerHTML`, indispensable dès qu'on affiche
du HTML dérivé d'un contenu externe (IA, import, API). Les liens rendus reçoivent
`target="_blank" rel="noopener noreferrer"` en post-traitement (DOMPurify ne le fait pas
automatiquement). **`contenuAudio` n'est en revanche jamais rendu de cette façon** — il n'est
jamais affiché à l'écran, seulement lu par `LectureVocaleService`, et reste donc du texte brut
simple (un titre `##` ou un lien lu à voix haute n'aurait aucun sens). L'excerpt de `veille.html`
(liste) reste du texte tronqué brut — la syntaxe Markdown non rendue y est un compromis assumé pour
un aperçu court, seule la page de détail rend le Markdown en entier.

Pas de lecture temps réel (`onSnapshot`) sur `articles` : la bibliothèque d'un foyer reste petite,
`veille.html` filtre par catégorie/recherche côté client comme `recettes.html` filtre par tag.

**Lignes éditoriales (persona IA par catégorie)** : l'administrateur du foyer (`foyer.creePar`,
voir `requireCreateurFoyer` dans `coeur`) peut définir, depuis
`veille-parametres.html`, un prompt système par catégorie qui remplace le paragraphe générique
envoyé à Gemini (persona, angle éditorial, format de réponse attendu...). Stocké dans
`foyers/{foyerId}/veilleConfig/lignesEditoriales` — un unique document (pas une collection), une
clé par catégorie. `GET /api/foyers/:foyerId/lignes-editoriales` est accessible à tout membre du
foyer (nécessaire pour que la génération utilise la bonne ligne quel que soit le membre qui la
déclenche) et résout déjà les valeurs par défaut (`domain/Categories.LIGNES_EDITORIALES_PAR_DEFAUT`) ; `PUT`
est réservé au créateur du foyer (403 sinon). Quelle que soit la ligne éditoriale (par défaut ou
personnalisée), `InterpreterArticleIA` conserve toujours les règles de format JSON et la mise en
garde anti-hallucination — un admin ne peut pas désactiver cet avertissement via son prompt.
`culture` et `ia` ont chacune un persona par défaut complet écrit spécifiquement pour la génération
in-app ("Éclaireur Art Contemporain" / "Éclaireur IA", ce dernier taillé pour un profil
professionnel IT déjà utilisateur quotidien de Claude/Gemini). Les 7 autres catégories dotées d'un
prompt Gem (`ecologie`, `politique`, `economie_finances`, `societe`, `international`,
`economie_entreprises`, `actualite_locale` — voir plus bas) reprennent **telles quelles** le
contenu de leur fichier `exemple/gem_gemini_<categorie>.prompt` comme persona par défaut ; seules
`marseille` et `sortir_marseille` retombent encore sur le prompt générique. Ces 7 prompts Gem sont
écrits pour un modèle avec recherche web réelle ("tu as accès à la recherche Google en temps
réel...") — cohérent avec la génération in-app depuis l'activation du grounding ci-dessus (c'était
une incohérence documentée avant cette activation : le persona supposait une recherche que l'in-app
n'avait pas). Restent nettement plus longs/coûteux en tokens que les personas conçus spécifiquement
pour l'in-app (`culture`/`ia`), sans bénéfice de contenu proportionnel pour l'usage in-app (leurs
sections de structuration détaillée — statuts, chiffres clés... — ne sont pas exploitées par
`validerArticleIA`, qui n'extrait que titre/contenu/contenuAudio/motsCles) ; la version Gem
(recherche réelle, hors app) reste le canal recommandé pour ces catégories si le coût en tokens de
la génération in-app devient sensible.

**Continuité éditoriale** : chaque génération IA (`POST .../articles/generer`) relit les
`NB_ARTICLES_CONTEXTE` (5) derniers articles déjà publiés dans la même catégorie du foyer
(`ArticleRepository.lister` + filtre par `categorie`, déjà trié par `dateCreation` décroissant) et
les résume (`Article.extraireResume`, 300 caractères) pour les donner en contexte à
`InterpreterArticleIA.construireRequeteArticleIA` — le prompt demande alors explicitement de ne pas
répéter une information déjà couverte, de signaler ce qui a changé depuis, et permet de citer un
article précédent par son titre. Ce contexte reste un texte libre dans le prompt : rien ne garantit
que l'IA cite correctement un article (elle ne peut de toute façon référencer que par titre en
prose, jamais par lien). Le renvoi *cliquable* vers les articles liés est géré séparément, de façon
déterministe (pas par l'IA) : `article-detail.html` affiche un bloc "Voir aussi" listant les 5
articles les plus récents de la même catégorie (hors l'article courant).

### `memoires` — mémoires dictées, synthétisées en chapitres (tuile "Memory")

- **Backend** : `domain/{NoteMemoire,ChapitreMemoire,SyntheseMemoires}.js`,
  `repositories/MemoiresRepository.js`, `routes/memoires.js`
- **Frontend** : `services/{MemoiresService,DicteeVocaleService}.js`,
  `models/{NoteMemoire,ChapitreMemoire}.js`, `utils/TexteDicte.js`, `parametres.js` (réglages dans
  Settings) — lecture vocale : `coeur/services/LectureVocaleService.js`
- **Pages** : `memoires.html` (dicter, garder comme souvenir ou comme instruction, relire et écouter,
  synthétiser), `memoires-livre.html` (les chapitres, à lire ou écouter)

Pensé pour des personnes âgées, peu à l'aise avec un clavier : textes et boutons agrandis
(`body.module-memoires` dans `style.css`), un gros bouton micro, lecture à voix haute (débit
ralenti) de chaque note et de chaque chapitre.

**Mémoires personnelles** : contrairement aux autres modules (données partagées par le foyer), tout
est rangé sous l'uid du membre (`foyers/{foyerId}/memoires/{uid}/...`) et chaque route porte sur
`req.uid` — chacun n'accède qu'à ses propres mémoires, même si plusieurs membres du foyer ont le
module.

**Dictée** (`services/DicteeVocaleService.js`) : API Web Speech du navigateur (`SpeechRecognition`),
gratuite et côté client — Chrome/Edge (ordinateur, Android) et Safari ; absente de Firefox, où la
page propose le micro du clavier du téléphone à la place. Sur Chrome, l'audio est transcrit par les
serveurs de Google. Une session de reconnaissance par phrase, relancée automatiquement tant que
l'utilisateur n'a pas appuyé sur "J'ai fini" (le mode continu duplique les résultats sur Chrome
Android) ; arrêt automatique après 2 minutes sans parole. `utils/TexteDicte.js` (pur) met chaque
phrase reconnue en forme (majuscule, point final), la reconnaissance vocale ne ponctuant pas. Le
texte reste modifiable au clavier avant d'être gardé.

**Souvenirs et instructions** : une note dictée est gardée soit comme **souvenir** (matière du
chapitre), soit comme **instruction** (consigne pour écrire le prochain chapitre, ex. « parle
surtout de mon père ») — champ `type` de la note ; une note sans type (antérieure aux instructions)
est un souvenir. Les instructions en attente ont leur propre liste sur `memoires.html`. Un chapitre
ne s'écrit qu'à partir d'au moins un souvenir : des instructions seules ne suffisent pas (400).

**Réglages** (personnels, dans **Settings** via `parametres.js` — absents de Settings si le module
n'est pas ouvert à l'utilisateur) : `supprimerNotesApresSynthese` (**coché par défaut** : seul un
`false` explicite conserve les notes) et `styleSynthese`, complément de prompt libre (2 000
caractères au plus) qui définit le style des chapitres. `PUT .../memoires/parametres` remplace
l'ensemble des réglages.

**Synthèse** (`POST .../memoires/synthetiser`) : les souvenirs pas encore utilisés (au plus
`MAX_NOTES_PAR_CHAPITRE` = 50, les plus anciens d'abord) et les instructions en attente (au plus 20)
deviennent un nouveau chapitre, ajouté à la fin des mémoires. `domain/SyntheseMemoires.
construireRequeteChapitre` suit la trame **« prends toutes mes notes, fais-en la synthèse, applique
le style défini dans les paramètres et applique les instructions suivantes »** : style du membre
(sinon style par défaut simple et chaleureux), instructions en liste, titres des chapitres précédents
en contexte, puis les souvenirs — les instructions ne sont jamais mêlées aux souvenirs. Quels que
soient le style et les instructions, les règles de fond restent imposées : première personne,
**fidélité aux notes** (aucun fait, nom, date ou lieu inventé ; correction des erreurs de
transcription évidentes) — un style ou une instruction ne peut pas les lever, comme la mise en garde
anti-hallucination de la veille. Pas de grounding (souvenirs personnels), donc JSON imposé par
`responseSchema` — contrairement à la veille. `validerChapitreIA` refuse un titre ou un contenu
vide. Chapitre et notes (souvenirs et instructions utilisés) sont écrits en un seul batch : les
notes sont **supprimées** ou **rattachées au chapitre** (`chapitreId`, rangées dans "Déjà dans mes
mémoires") selon `supprimerNotesApresSynthese`. Supprimer un chapitre remet ses notes conservées
"à synthétiser" — moyen de refaire un chapitre, seulement si les notes ont été conservées. Le numéro
d'un chapitre n'est pas stocké : il découle de l'ordre de création.

## Modèle de données Firestore

MindLess est une application **familiale multi-utilisateurs** : toutes les données métier sont
partagées au niveau du **foyer**, pas de l'utilisateur (contrairement à un modèle mono-utilisateur
classique). Un `foyerId` **est** le code d'invitation partagé entre les membres — pas de collection
d'invitations séparée, pas de Cloud Function nécessaire.

```
── cœur ──────────────────────────────────────────────────────────────────────────────────────
utilisateurs/{uid}
  { email, nomAffiche, photoUrl, foyerId: string|null }
    # ancien champ profilNutritionnel encore présent sur les comptes existants : relu une fois puis
    # recopié par le module menus (migration paresseuse, voir ProfilNutritionnelRepository)

foyers/{foyerId}                       # foyerId = code d'invitation (6 caractères, ex. "A3F7K9")
  { nom, membres: [uid...], creePar, dateCreation,
    modulesParMembre: { [uid]: ['voiture'|'courses'|'menus'|'veille'|'memoires', ...] },
    demandesModules: { [uid]: { [module]: { statut: 'en_attente'|'refusee', dateDemande,
                                            expiration: ms, dateRefus? } } } }
    # creePar = administrateur, toujours accès à tout ; uid absent = aucun module (refus par défaut)
    # demandesModules : modules pris à l'essai par le membre (en_attente et expiration future =
    # accessible ; expiration passée = expiré) ou refusés — voir "Modules à l'essai"

── module voiture ─────────────────────────────────────────────────────────────────────────────

foyers/{foyerId}/vehicules/{vehiculeId}
  { nom, marque, modele, immatriculation, kilometrageActuel, dateMajKilometrage }

foyers/{foyerId}/vehicules/{vehiculeId}/entretiens/{entretienId}
  { type, date, kilometrage, cout, garage, notes }

── module menus ───────────────────────────────────────────────────────────────────────────────
foyers/{foyerId}/recettes/{recetteId}
  { nom, portions, ingredients: [{ nom, quantite, unite }], instructions, tags: [] }

foyers/{foyerId}/planningRepas/{idSemaine}          # idSemaine = "2026-W28" (ISO 8601)
  { jours: { lundi: { midi: {texte, recetteId}, soir: {...} }, ... dimanche }, dateMaj }

foyers/{foyerId}/profilsNutritionnels/{uid}
  { sexe, anneeNaissance, niveauActivite, poidsKg }  # tous optionnels (null)

── module courses ─────────────────────────────────────────────────────────────────────────────
foyers/{foyerId}/listeCourses/{itemId}              # collection plate = édition concurrente sans conflit
  { nom, quantite, unite, categorie, coche, origine: 'manuel'|'recette'|'mixte', recetteIds: [] }

── module veille ──────────────────────────────────────────────────────────────────────────────
foyers/{foyerId}/articles/{articleId}
  { titre, categorie, contenu, contenuAudio: string|null, motsCles: string[],
    sources: {uri, titre}[], source: 'manuel'|'ia'|'import_md'|'api', creePar, dateCreation }
    # contenuAudio non null seulement si source: 'ia' ; sources non vide seulement si source: 'ia'
    # ET que le grounding Google Search a effectivement cherché sur cette génération

foyers/{foyerId}/veilleConfig/lignesEditoriales    # document singleton, pas une collection
  { [categorie]: texte, ..., dateMaj }              # clé absente = valeur par défaut (voir Categories.js)

── module memoires (personnel : rangé sous l'uid du membre) ──────────────────────────────────
foyers/{foyerId}/memoires/{uid}
  { supprimerNotesApresSynthese: boolean,           # réglages du membre (Settings) ; absent = true
    styleSynthese: string }                         # complément de prompt, '' = style par défaut

foyers/{foyerId}/memoires/{uid}/notes/{noteId}
  { texte, type: 'souvenir'|'instruction',          # type absent = souvenir
    chapitreId: string|null, dateCreation }         # chapitreId null = encore à synthétiser

foyers/{foyerId}/memoires/{uid}/chapitres/{chapitreId}
  { titre, contenu, noteIds: [], dateCreation }     # contenu : paragraphes séparés par une ligne vide
```

### Rejoindre un foyer

Créer un foyer génère un code à 6 caractères (`coeur/domain/CodeInvitation.js`, alphabet sans
caractères ambigus) qui sert directement d'identifiant du document `foyers/{code}`. Créer et
rejoindre un foyer passent tous les deux par le backend (`POST /api/foyers`,
`POST /api/foyers/:id/rejoindre`, voir `coeur/repositories/FoyerRepository.js`) : c'est le SDK
Admin qui vérifie l'existence du code et ajoute l'`uid` à `membres` (`FieldValue.arrayUnion`), en
contournant `firestore.rules` — le client n'a plus besoin de lire un foyer avant d'en être membre.
Le créateur devient l'administrateur ; un membre qui rejoint n'a encore accès à aucun module.

`firestore.rules` interdit toute lecture/écriture directe sur `utilisateurs/{uid}` (`allow read,
write: if false`) ; un membre ne peut donc pas lire le nom affiché des autres directement depuis
Firestore. Le backend, via le SDK Admin, s'en charge : `GET /api/foyers/:foyerId/membres`
(`coeur/routes/foyers.js`, `requireMembreFoyer`) renvoie pour chaque membre son nom affiché, son
statut d'administrateur et ses modules — affichés à tous sur `settings.html`, et à l'administrateur
sur `acces-modules.html`.

**Sécurité Firestore** : `firestore.rules` n'autorise plus aucune écriture cliente (`allow write: if
false` partout). En lecture, seules trois zones restent accessibles, pour les 3 lectures temps réel
(`onSnapshot`) qui subsistent côté front : `foyers/{foyerId}` (tout membre, `estMembreDuFoyer()`),
`planningRepas/{document=**}` et `listeCourses/{document=**}` (membres ayant accès au module
correspondant, `aAccesModule(foyerId, 'menus'|'courses')`). `vehicules`, `recettes`,
`profilsNutritionnels`, `articles`, `veilleConfig` et `memoires` sont entièrement fermés en lecture
côté client
(`allow read, write: if false`) — leurs pages passent exclusivement par `ApiClient`, sans lecture
temps réel.

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
  en double des deux côtés (`DateSemaine.js`, catalogue des modules `AccesModules.js`/`Modules.js`
  pour les identifiants, modèles du domaine, et historiquement `CodeInvitation.js`/
  `GenerateurListeCourses.js` avant leur passage 100% backend) — assumé plutôt que mutualisé
  prématurément pour deux runtimes séparés
- Frontières cœur/modules : voir "Règles de dépendance" plus haut — en résumé, un module n'importe
  que le cœur (et, côté backend, l'`api.js` d'un autre module), et ne pose jamais lui-même son
  contrôle d'accès

## Tests automatisés

Voir [README.md](README.md) pour les commandes. Les répertoires `tests/` (racine) et `backend/tests/`
suivent la même séparation que le code : `coeur/` et `modules/<id>/`, en miroir de
`public/{coeur,modules/<id>}/utils/` et `backend/src/{coeur,modules/<id>}/domain/`. Seule la logique
pure y est couverte (dont les règles d'accès, `backend/tests/coeur/AccesModules.test.js`) ; les
`services/*.js` et `repositories/*.js` qui touchent Firestore se vérifient manuellement (émulateurs
Firestore/Auth, voir README.md).

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
- Découpage du code (front + back) par module fonctionnel (alors `commun`/`voiture`/`menus`) plutôt
  que par couche technique, pour absorber les futurs modules sans réorganisation

### ✅ Backend déployé + CI/CD
- `mindless-backend` sur Cloud Run (projet `mindless-c58d3`, région `europe-west1`), secrets
  `FIREBASE_SERVICE_ACCOUNT_JSON`/`STATIC_API_TOKEN` via Secret Manager — voir README.md pour la
  configuration GCP
- Frontend (Firebase Hosting) et backend connectés en prod via `public/api-config.js`
- Pipeline GitHub Actions (`.github/workflows/ci.yml` + `deploy.yml`, calqué sur le même principe
  que le repo homeFit) : tests obligatoires sur PR, déploiement automatique des deux côtés au merge
  sur `main`, `main` protégée (PR + checks verts requis) — voir la section "CI/CD" de README.md

### ✅ Étape 6 — Module veille (articles d'actualité)
- 6 catégories fixes (politique, Marseille, culture, sorties Marseille, écologie, IA), articles
  créés manuellement, générés par IA (Gemini) ou importés depuis un `.md` avec front-matter
- Lecture à l'écran ou écoute via synthèse vocale navigateur (Web Speech API)

### ✅ Étape 7 — Cœur et modules, accès par membre
- Séparation explicite du code en `coeur/` + `modules/<id>/`, front et back ; `courses` devient un
  module à part entière (séparé de `menus`) ; profil nutritionnel déplacé du cœur vers `menus`
- Droits d'accès aux modules par membre, gérés par l'administrateur (Admin → Accès aux modules),
  appliqués côté backend (montage des modules), front (`ouvrirSession`) et `firestore.rules`
- "Mon foyer" devient **Settings**, visible de tous, avec la liste des membres et leurs modules
  (endpoint `GET .../membres`, qui remplace `GET .../createur`)
- Modules **à l'essai** : chaque membre ajoute lui-même un module depuis Settings, avec un accès
  immédiat pendant 3 semaines, que l'administrateur confirme ou refuse (badge des essais à
  confirmer sur ses tuiles)

### 🔜 Étape 8 — Nouveaux modules fonctionnels
- ✅ `memoires` (tuile "Memory") : souvenirs dictés à la voix, relus ou écoutés, synthétisés par
  l'IA en chapitres de mémoires ; premier module ajouté avec la checklist "Ajouter un module", qui a
  fait remonter dans le cœur le client Gemini et la lecture vocale (partagés avec veille)
- Gestion des tâches, préparation vacances... — chacun suivant la checklist "Ajouter un module"
  plus haut
- Memory : modifier un chapitre à la main, partager ses mémoires avec la famille (lecture par les
  autres membres), export PDF/livre imprimable

### 🔜 Autres améliorations identifiées
- Notifications push pour les rappels d'entretien (Cloud Functions + Firebase Cloud Messaging)
- Conversion d'unités dans le générateur de liste de courses (ex. g ↔ kg)
- Intervalles d'entretien personnalisables par véhicule
- Étendre `ResoudreProfil`/`ObjectifsNutritionnels` à d'autres tranches d'âge (enfant, senior)
- Veille : pas de limite de coût/fréquence côté appli sur `POST .../articles/generer` — le
  grounding Google Search (voir ci-dessous) a un vrai coût marginal au-delà du quota gratuit
  mensuel, mitigé pour l'instant par une alerte de budget GCP (aucun code, voir README.md) plutôt
  qu'un compteur applicatif ; à revoir si l'usage dépasse largement le quota gratuit.
- ✅ Veille : grounding Google Search (`tools: google_search`) activé sur la génération in-app
  (2026-09). Un premier essai sans facturation Cloud activée avait donné un 429 systématique — pas
  un bug de ce repo, juste une limite du tier gratuit sur les modèles Gemini 3.x, où le grounding
  n'est simplement pas disponible sans facturation. Une fois la facturation activée sur le projet
  GCP derrière `GEMINI_API_KEY` (5 000 requêtes groundées gratuites/mois, puis 14$/1000 — voir
  README.md), le grounding fonctionne : le modèle décide par appel s'il déclenche une recherche, et
  les sources trouvées (`groundingMetadata`) sont désormais captées et affichées (`Article.sources`,
  bloc "Sources" sur `article-detail.html`). `scripts/veille-externe/` (Gem Gemini côté produit
  consommateur, recherche réelle garantie) reste une alternative valable pour les catégories aux
  personas les plus lourds, mais n'est plus strictement nécessaire pour avoir une génération in-app
  qui s'appuie sur une vraie recherche web.
- Veille : la solution palliative "Gem Gemini" ci-dessus, initialement pensée pour `ia` seule, a
  été généralisée à 7 catégories — un fichier `.prompt` par catégorie dans `exemple/`
  (`gem_gemini_<categorie>.prompt` : `ecologie`, `politique`, `economie_finances`, `societe`,
  `international`, `economie_entreprises`, `actualite_locale`), chacun à coller dans un Gem Gemini
  dédié. Chaque prompt respecte le même contrat JSON de sortie que `gem_gemini_ia.prompt` (`titre`,
  `categorie`, `contenu`, `contenuAudio`, `motsCles`, plus des champs de structuration additionnels
  ignorés à l'import) — seule la valeur `categorie` et le contenu thématique (domaines suivis,
  sources, structure d'analyse) changent d'un fichier à l'autre. Le contenu de chacun de ces 7
  fichiers sert aussi de persona par défaut pour la génération in-app de la catégorie
  correspondante (voir "Lignes éditoriales" plus haut — leur hypothèse de recherche web réelle est
  désormais cohérente avec l'in-app aussi, depuis l'activation du grounding ci-dessus).

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution
> significative du projet.
