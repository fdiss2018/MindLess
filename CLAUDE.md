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

Modules actuels : `commun`, `voiture`, `menus`, `veille`. Un futur module (tâches, préparation
vacances...)
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

`requireCreateurFoyer` (middleware backend, à exécuter après `requireMembreFoyer`) restreint une
route au créateur du foyer (`foyer.creePar === req.uid`) — premier cas d'usage : lignes éditoriales
de veille (voir plus bas). MindLess n'a pas de système de rôles : c'est la seule distinction de
droits entre membres d'un même foyer, tout le reste (recettes, planning, véhicules...) reste
accessible à parts égales à tous les membres.

Côté front, `public/admin.html` est le point d'entrée unique vers les réglages réservés au créateur
du foyer (même contrôle d'accès que `veille-parametres.html` : lecture de `foyer.creePar` via
`FoyerService.ecouterFoyer`, message "réservé au créateur du foyer" sinon) — une tuile `nav-tuile`
dédiée sur `index.html`, masquée par défaut et affichée seulement pour le créateur. Pas de
répertoire `admin/` par module : c'est une page d'accueil qui renvoie vers les réglages de chaque
module (aujourd'hui `veille-parametres.html`, seul réglage admin existant) plutôt qu'un module à
part entière — un futur réglage admin (autre module) s'ajoute comme une tuile de plus ici, pas
comme une nouvelle route API.

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

### `veille` — articles d'actualité par catégorie

- **Backend** : `domain/{Categories,Article,ArticleMarkdown,InterpreterArticleIA}.js`,
  `repositories/{ArticleRepository,GeminiClient,LigneEditorialeRepository}.js`, CRUD + génération
  IA + import dans `routes/articles.js`, API publique sans authentification dans
  `routes/articlesPublics.js`, lignes éditoriales dans `routes/lignesEditoriales.js`
- **Frontend** : `services/{ArticleService,LectureVocaleService,LigneEditorialeService}.js`,
  `models/Article.js`, `utils/Categories.js`, page `veille-parametres.html`

11 catégories fixes (`domain/Categories.js`, table de référence comme
`voiture/utils/ReglesEntretien.js`) : `politique`, `marseille`, `culture`, `sortir_marseille`,
`ecologie`, `ia`, `economie_finances`, `societe`, `international`, `economie_entreprises`,
`actualite_locale` — celles marquées `accentTendances: true` (`ecologie`, `ia`,
`economie_entreprises`) infléchissent le prompt IA vers les tendances émergentes du sujet plutôt
qu'un résumé générique.

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
- **Génération IA** (`POST .../articles/generer`) : appelle l'API Gemini via
  `repositories/GeminiClient.js`, qui reprend le pattern déjà en place dans le repo frère `homeFit`
  (`backend/src/services/GeminiClient.js`) — `fetch` natif (pas de SDK), clé en query param
  (`GEMINI_API_KEY`), `responseSchema` structuré pour extraire `{titre, contenu, contenuAudio}`,
  retry sur `TIMEOUT`/`DEGENERE` uniquement. **Deux versions systématiquement générées** (voir
  `Article.contenuAudio`) : `contenu` (à lire à l'écran, plusieurs paragraphes) et `contenuAudio`
  (même information réécrite pour l'oral — phrases courtes, sans sigle non prononçable, sans
  symbole de mise en forme) ; seuls les articles `source: 'ia'` ont un `contenuAudio` distinct, les
  3 autres points d'entrée n'ont qu'un seul texte. **Limite assumée et déjà éprouvée** : un LLM
  sans recherche web ne peut pas rapporter de vraies actualités datées — le grounding Google Search
  (`tools: google_search`) a été testé et écarté (429 systématique sur le modèle courant en tier
  gratuit, limite actuellement documentée côté Google, pas un bug de ce repo). Le prompt interdit
  donc explicitement toute formule laissant croire à une actualité datée ("cette semaine",
  "synthèse hebdomadaire"...) et assume produire des repères de fond plutôt que des dépêches ;
  fournir un `sujet` précis améliore nettement la spécificité du résultat par rapport à une
  catégorie seule. Les articles `source: 'ia'` sont marqués d'un badge "Généré par IA" côté front
  (`veille.html`, `article-detail.html`) plutôt que présentés comme du factuel vérifié. Ouvert à
  tout membre du foyer.
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
séparé de `/api/foyers/...` (montée sans le middleware `authentifier` dans `server.js`) plutôt qu'un
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
navigateur (`speechSynthesis`, `services/LectureVocaleService.js`) — gratuite, 100% côté client,
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

**Lignes éditoriales (persona IA par catégorie)** : le créateur du foyer (`foyer.creePar`, seule
distinction de droits de l'app — voir `requireCreateurFoyer` dans `commun`) peut définir, depuis
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
`marseille` et `sortir_marseille` retombent encore sur le prompt générique. **Limite assumée** :
ces 7 prompts Gem sont écrits pour un modèle avec recherche web réelle ("tu as accès à la recherche
Google en temps réel...") alors que la génération in-app n'en a aucune — la mise en garde
anti-hallucination fixe d'`InterpreterArticleIA` (ci-dessus) reste toujours appliquée après ce
persona et empêche techniquement toute affirmation d'actualité datée non vérifiable, mais le
persona lui-même contient des instructions contradictoires avec cette réalité (il se pense capable
de rechercher activement) et est nettement plus long/coûteux en tokens que les personas conçus
spécifiquement pour l'in-app (`culture`/`ia`). Assumé pour l'instant : la version Gem (recherche
réelle, hors app) reste le canal recommandé pour ces catégories ; la génération in-app avec ce
persona reste utilisable mais moins optimisée qu'un persona dédié.

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

foyers/{foyerId}/articles/{articleId}
  { titre, categorie, contenu, contenuAudio: string|null, source: 'manuel'|'ia'|'import_md'|'api',
    creePar, dateCreation }                             # contenuAudio non null seulement si source: 'ia'

foyers/{foyerId}/veilleConfig/lignesEditoriales    # document singleton, pas une collection
  { [categorie]: texte, ..., dateMaj }              # clé absente = valeur par défaut (voir Categories.js)
```

### Rejoindre un foyer

Créer un foyer génère un code à 6 caractères (`commun/domain/CodeInvitation.js`, alphabet sans
caractères ambigus) qui sert directement d'identifiant du document `foyers/{code}`. Créer et
rejoindre un foyer passent tous les deux par le backend (`POST /api/foyers`,
`POST /api/foyers/:id/rejoindre`, voir `commun/repositories/FoyerRepository.js`) : c'est le SDK
Admin qui vérifie l'existence du code et ajoute l'`uid` à `membres` (`FieldValue.arrayUnion`), en
contournant `firestore.rules` — le client n'a plus besoin de lire un foyer avant d'en être membre.

**Limite connue (partiellement résolue)** : `firestore.rules` interdit toute lecture/écriture
directe sur `utilisateurs/{uid}` (`allow read, write: if false`) ; un membre du foyer ne peut donc
pas lire le nom affiché des autres membres directement depuis Firestore. Le backend, via le SDK
Admin, contourne cette limite : `GET /api/foyers/:foyerId/createur` (`commun/routes/foyers.js`,
`requireMembreFoyer`) résout le nom affiché du créateur du foyer (`UtilisateurRepository.obtenir`)
et l'expose à `foyer.html` ("Créé par ..."/"Créé par toi"). Même pattern déjà utilisé ailleurs pour
tous les membres, pas seulement le créateur (voir `menus/routes/nutrition.js`, qui charge
`req.foyer.membres` puis chaque `Utilisateur`) — reste à généraliser en un endpoint "membres" pour
que `foyer.html` affiche aussi les noms des autres membres, pas seulement leur nombre.

**Sécurité Firestore** : `firestore.rules` n'autorise plus aucune écriture cliente (`allow write: if
false` partout). En lecture, seules trois zones restent accessibles aux membres du foyer
(`estMembreDuFoyer()`), pour les 3 lectures temps réel (`onSnapshot`) qui subsistent côté front :
`foyers/{foyerId}`, `planningRepas/{document=**}`, `listeCourses/{document=**}`. `vehicules`,
`recettes`, `articles` et `veilleConfig` sont entièrement fermés en lecture côté client (`allow
read, write: if false`) — leurs pages passent exclusivement par `ApiClient`, sans lecture temps réel.

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

### 🔜 Étape 7 — Nouveaux modules fonctionnels
- Gestion des tâches, préparation vacances... — chacun en `backend/src/<module>/` +
  `public/<module>/`, suivant le patron `commun`/`voiture`/`menus`/`veille`
- Généraliser `GET .../createur` (qui ne résout que le nom du créateur) à un endpoint "membres" pour
  que `foyer.html` affiche le nom de tous les membres, pas seulement leur nombre (voir "Limite
  connue" plus haut)

### 🔜 Autres améliorations identifiées
- Notifications push pour les rappels d'entretien (Cloud Functions + Firebase Cloud Messaging)
- Conversion d'unités dans le générateur de liste de courses (ex. g ↔ kg)
- Intervalles d'entretien personnalisables par véhicule
- Étendre `ResoudreProfil`/`ObjectifsNutritionnels` à d'autres tranches d'âge (enfant, senior)
- Veille : pas de limite de coût/fréquence sur `POST .../articles/generer` (appel Gemini payant
  au-delà du quota gratuit) — à ajouter si l'usage le justifie
- Veille : aucune source d'actualité réelle (recherche web/agrégateur de news) — la génération IA
  reste un modèle de langage sans accès temps réel, voir la limite documentée plus haut. Le
  grounding Gemini (`tools: google_search`) a été essayé (2026-09) et écarté : 429 systématique en
  tier gratuit sur `gemini-flash-lite-latest` (résolu en `gemini-3.5-flash-lite`), problème
  documenté côté Google (forums développeurs), pas un souci de configuration ici — à retester si
  Google stabilise ça, ou si la facturation est activée (sans garantie que ça suffise). En
  attendant, `scripts/veille-externe/` documente une solution palliative manuelle : un Gem Gemini
  (recherche web réelle, côté produit consommateur) produit un JSON au format attendu, poussé vers
  `POST .../articles/externe` via `envoyer_article.py`.
- Veille : la solution palliative "Gem Gemini" ci-dessus, initialement pensée pour `ia` seule, a
  été généralisée à 7 catégories — un fichier `.prompt` par catégorie dans `exemple/`
  (`gem_gemini_<categorie>.prompt` : `ecologie`, `politique`, `economie_finances`, `societe`,
  `international`, `economie_entreprises`, `actualite_locale`), chacun à coller dans un Gem Gemini
  dédié. Chaque prompt respecte le même contrat JSON de sortie que `gem_gemini_ia.prompt` (`titre`,
  `categorie`, `contenu`, `contenuAudio`, `motsCles`, plus des champs de structuration additionnels
  ignorés à l'import) — seule la valeur `categorie` et le contenu thématique (domaines suivis,
  sources, structure d'analyse) changent d'un fichier à l'autre. Le contenu de chacun de ces 7
  fichiers sert aussi de persona par défaut pour la génération in-app de la catégorie
  correspondante (voir "Lignes éditoriales" plus haut, avec la limite assumée que cela implique).

---

> Ce fichier est destiné à guider Claude Code. Il doit être mis à jour à chaque évolution
> significative du projet.
