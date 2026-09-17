# MindLess — Guide développeur

Comment lancer, tester et déployer tes corrections, côté frontend et côté backend.
Pour l'architecture, le modèle de données et le découpage en modules fonctionnels, voir
[CLAUDE.md](CLAUDE.md).

L'application a deux parties déployées **séparément** :

| Partie | Dossier | Techno | Hébergement |
|---|---|---|---|
| Frontend | `public/` | HTML/CSS/JS vanilla | Firebase Hosting — https://mindless-c58d3.web.app |
| Backend | `backend/` | Node.js + Express + firebase-admin | Cloud Run — https://mindless-backend-428494497216.europe-west1.run.app |

## CI/CD

Les déploiements se font désormais **automatiquement via GitHub Actions**
(`.github/workflows/ci.yml` et `deploy.yml`) — les commandes `gcloud`/`firebase` manuelles plus bas
dans ce document restent documentées pour le dépannage ou l'itération locale, mais ne sont plus le
chemin normal de mise en prod.

- **Sur une pull request vers `main`** (`ci.yml`) : deux jobs indépendants lancent `npm run
  test:run` (frontend et backend). `main` est protégée — impossible de merger sans PR ni sans ces
  deux checks au vert.
- **Au merge sur `main`** (`deploy.yml`) : deux jobs indépendants déploient en parallèle.
  - `deploy-frontend` génère `public/firebase-config.js` et `public/api-config.js` depuis des
    secrets GitHub (ces fichiers restent gitignorés, jamais commités), déploie Hosting + règles
    Firestore, puis vérifie que la prod ne pointe jamais vers `localhost`. Ce même garde-fou
    (`scripts/check-api-config.js`) protège aussi un `firebase deploy` manuel via le hook
    `predeploy` de `firebase.json`.
  - `deploy-backend` s'authentifie auprès de GCP et relance `gcloud run deploy` avec les mêmes
    secrets/variables qu'en local (voir "Backend (Cloud Run)" plus bas pour le détail des flags).

**Secrets GitHub** (Settings > Secrets and variables > Actions) :

| Secret | Contenu |
|---|---|
| `GCP_SA_KEY` | Clé JSON du compte de service `mindless-ci-deployer` (déploie le backend) |
| `FIREBASE_SERVICE_ACCOUNT_DEPLOY` | Clé JSON du compte de service `mindless-firebase-deploy` (déploie Hosting + règles Firestore) |
| `FIREBASE_CONFIG_JS` | Contenu complet de `public/firebase-config.js` |
| `PROD_API_BASE_URL` | URL du service Cloud Run de prod |
| `CORS_ALLOWED_ORIGIN` | Origines autorisées, séparées par des virgules |

`FIREBASE_SERVICE_ACCOUNT_JSON`, `STATIC_API_TOKEN` et `GEMINI_API_KEY` (valeurs sensibles côté
backend) ne sont **pas** des secrets GitHub — ils vivent uniquement dans Google Secret Manager,
référencés par `--set-secrets` dans le job `deploy-backend`. Pour récupérer/faire tourner
`STATIC_API_TOKEN` :

```bash
gcloud secrets versions access latest --secret=STATIC_API_TOKEN --project=mindless-c58d3
```

## Prérequis (une fois par poste)

1. Un projet Firebase avec **Firestore** et **Authentication (Google)** activés
   ([console.firebase.google.com](https://console.firebase.google.com)).
2. `firebase use --add` à la racine pour lier le projet local (met à jour `.firebaserc`).
3. `public/firebase-config.js` : copier `public/firebase-config.example.js` et renseigner la config
   du projet Firebase (clé web, appId...).
4. `public/api-config.js` : copier `public/api-config.example.js` et renseigner `API_BASE_URL`
   (`http://localhost:3000` en local, l'URL du backend déployé en prod).
5. `backend/.env` : copier `backend/.env.example` et renseigner :
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — Console Firebase > Paramètres du projet > Comptes de
     service > Générer une nouvelle clé privée, collé sur une seule ligne.
   - `STATIC_API_TOKEN` — un secret généré une fois (`openssl rand -hex 32`), voir "Tester le
     backend sans navigateur" ci-dessous.
   - `GEMINI_API_KEY` / `GEMINI_MODEL` — clé API Gemini (aistudio.google.com/apikey), utilisée par
     le module veille pour générer des articles (voir CLAUDE.md). Optionnel si tu ne testes pas
     `POST .../articles/generer` : la route répond alors 500 plutôt que de planter le serveur.
   - `CORS_ALLOWED_ORIGIN` — origines autorisées, séparées par des virgules (ex.
     `http://localhost:5000` pour l'émulateur Hosting).
6. `cd backend && npm install`, puis `npm install` à la racine.

Ces 3 fichiers (`firebase-config.js`, `api-config.js`, `.env`) sont gitignorés — chaque poste et
chaque environnement (local/prod) a les siens.

## Lancer en local

**Backend** (terminal 1) :

```bash
cd backend
npm run dev     # node --watch server.js — relance automatiquement, port 3000 par défaut
```

**Frontend** (terminal 2) :

```bash
firebase emulators:start --only auth,firestore,hosting
```

Ouvre `http://localhost:5000` (port Hosting défini dans `firebase.json`). `public/api-config.js`
doit pointer sur `http://localhost:3000` pour que le frontend appelle ton backend local.

⚠️ Le popup de connexion Google réel ne fonctionne pas complètement dans l'émulateur Auth — pour
valider un flux de bout en bout avec un vrai login, pointe temporairement vers le vrai projet
Firebase (retire `--only ... auth` ou change de config) plutôt que l'émulateur.

## Tester ses corrections

### Tests automatisés (logique métier pure)

```bash
npm run test:run          # à la racine : lance tous les tests (utils/ front + domain/ backend)
cd backend && npm run test:run   # équivalent, restreint au backend
```

`npm test` (sans `:run`) lance Vitest en mode watch. Seule la logique pure (`utils/` côté front,
`domain/` côté backend) est couverte par des tests automatisés — les `services/*.js` et
`repositories/*.js` qui touchent Firestore se vérifient manuellement (émulateur ou appel réel, voir
ci-dessous).

### Tester le backend seul, sans navigateur (Postman/curl)

Le middleware `commun/middleware/auth.js` accepte, en plus d'un vrai ID token Firebase, le secret
`STATIC_API_TOKEN` défini dans `backend/.env` — pratique pour tester une route sans repasser par un
login Google à chaque fois. Ajoute `X-Test-Uid` pour te placer dans le contexte d'un utilisateur
donné :

```bash
curl http://localhost:3000/api/utilisateurs/moi \
  -H "Authorization: Bearer <STATIC_API_TOKEN>" \
  -H "X-Test-Uid: uid-de-test"
```

### API externe (veille) — ajouter un article depuis un script

`POST /api/foyers/:foyerId/articles/externe` est un 4e point d'entrée de création d'article (en
plus du formulaire manuel, de la génération IA et de l'import `.md` — voir CLAUDE.md section
"veille"), pensé pour un script ou une automatisation en dehors de l'app plutôt que pour l'UI.
Toute la logique de création (validation des champs, `dateCreation`...) est centralisée dans
`ArticleRepository.creer` — les 4 points d'entrée y passent tous, seul `source` change.

**Auth** : même mécanisme que ci-dessus (`STATIC_API_TOKEN` + `X-Test-Uid`), mais réservé au
créateur du foyer (`requireCreateurFoyer`) — `X-Test-Uid` doit être **ton** uid (celui du foyer
que tu cibles), pas n'importe quel membre, sinon la route répond 403. Trouve ton uid via la
Console Firebase (Authentication) ou `GET /api/utilisateurs/moi` avec un vrai ID token.

```bash
curl -X POST http://localhost:3000/api/foyers/<FOYER_ID>/articles/externe \
  -H "Authorization: Bearer <STATIC_API_TOKEN>" \
  -H "X-Test-Uid: <TON_UID>" \
  -H "Content-Type: application/json" \
  -d '{"titre": "Mon article", "categorie": "ia", "contenu": "Corps de l'\''article..."}'
```

Réponse `201 { "id": "..." }` ; `400` si `titre`/`categorie`/`contenu` invalides, `403` si
`X-Test-Uid` n'est pas le créateur du foyer, `404` si `:foyerId` n'existe pas. Catégories valides :
voir `backend/src/veille/domain/Categories.js` (`politique`, `marseille`, `culture`,
`sortir_marseille`, `ecologie`, `ia`, `economie_finances`, `societe`, `international`,
`economie_entreprises`, `actualite_locale`).

### API publique (veille) — lire les articles d'un foyer sans authentification

`GET /api/public/foyers/:foyerId/articles` est une route **volontairement publique, sans aucune
authentification** (ni ID token Firebase, ni `STATIC_API_TOKEN`) — choix explicite assumé pour ce
foyer, voir CLAUDE.md section "veille" ("Limite assumée"). Elle vit sous un préfixe `/api/public/`
distinct de `/api/foyers/...` pour rester structurellement séparée des routes authentifiées.

Filtres optionnels en query string, cumulables :

```bash
curl "http://localhost:3000/api/public/foyers/<FOYER_ID>/articles?categorie=ia&depuis=2026-09-01&jusqua=2026-09-30"
```

- `categorie` : une des catégories valides (voir ci-dessus), correspondance exacte.
- `depuis` / `jusqua` : bornes de date `AAAA-MM-JJ` (incluses), comparées à la date de création de
  l'article.

Réponse `200`, tableau JSON (vide si aucun article ne correspond) ; `404` si `:foyerId` n'existe
pas. Chaque article expose `id, titre, categorie, contenu, contenuAudio, motsCles, source,
dateCreation` — **`creePar` est délibérément exclu** de cette réponse (seul champ à caractère
personnel du modèle).

Les mêmes filtres (`categorie`/`depuis`/`jusqua`) sont aussi disponibles sur la route authentifiée
`GET /api/foyers/:foyerId/articles`, pour rester cohérent entre les deux (même fonction de filtre
partagée, `domain/Article.filtrerArticles`).

### Tester le flux complet (frontend + backend + vraies données)

1. Backend lancé (`npm run dev`), `.env` valide.
2. Frontend servi (émulateur Hosting, ou tout serveur statique pointant sur `public/`), avec
   `api-config.js` pointant sur ce backend.
3. Se connecter avec un vrai compte Google (voir avertissement émulateur Auth ci-dessus) et dérouler
   le parcours concerné (ex. modifier un créneau de menu → vérifier le bilan nutritionnel, générer
   la liste de courses depuis le planning...).

## Déployer ses corrections

⚠️ En temps normal, tu n'as rien à faire ici — merger sur `main` déploie automatiquement les deux
côtés (voir "CI/CD" plus haut). Ce qui suit sert au dépannage ou à tester un déploiement en dehors
de la CI (ex. diagnostiquer une erreur avant de la reproduire en CI).

### Frontend (Firebase Hosting + règles Firestore)

```bash
firebase deploy --only hosting,firestore:rules
```

Avant de déployer, vérifie que `public/firebase-config.js` et surtout `public/api-config.js`
pointent vers les valeurs de **production** (pas `localhost`) — ces fichiers sont gitignorés donc
rien ne t'empêche de déployer avec une config locale par erreur.

### Backend (Cloud Run)

Le service `mindless-backend` est déployé sur [Cloud Run](https://cloud.google.com/run), projet
`mindless-c58d3`, région `europe-west1`. Pas de `Dockerfile` dans ce repo — Cloud Run construit
l'image avec les buildpacks Cloud Native à partir de `backend/package.json` (`npm start`).

**Pour redéployer une correction** (une fois la configuration ci-dessous déjà en place) :

```bash
gcloud run deploy mindless-backend \
  --source backend \
  --region europe-west1 \
  --project mindless-c58d3
```

Pas besoin de répéter `--allow-unauthenticated` ni `--set-secrets`/`--set-env-vars` : Cloud Run
conserve la configuration de la révision précédente (secrets, variables d'env, accès public) tant
qu'on ne la change pas explicitement.

**Configuration déjà en place sur le projet** (à refaire seulement sur un nouveau projet GCP, pas à
chaque déploiement) :
1. Facturation activée sur le projet (Console GCP > Facturation).
2. API activées : `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project=mindless-c58d3`
3. Secret `FIREBASE_SERVICE_ACCOUNT_JSON` créé dans Secret Manager à partir d'une clé du compte de
   service `firebase-adminsdk-fbsvc@mindless-c58d3.iam.gserviceaccount.com` (Console Firebase >
   Paramètres du projet > Comptes de service > Générer une nouvelle clé privée, ou
   `gcloud iam service-accounts keys create`), puis :
   ```bash
   gcloud secrets create FIREBASE_SERVICE_ACCOUNT_JSON --data-file=<fichier-cle.json> --project=mindless-c58d3
   ```
   Supprime le fichier de clé local juste après — il ne doit plus exister que dans Secret Manager.
4. Le compte de service par défaut de Cloud Run (`428494497216-compute@developer.gserviceaccount.com`)
   autorisé à lire ce secret :
   ```bash
   gcloud secrets add-iam-policy-binding FIREBASE_SERVICE_ACCOUNT_JSON \
     --member="serviceAccount:428494497216-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor" --project=mindless-c58d3
   ```
5. Premier déploiement, avec le secret et les variables d'environnement de prod (`--set-secrets` et
   `--env-vars-file` — les commas dans `CORS_ALLOWED_ORIGIN` cassent `--set-env-vars`, préférer un
   fichier YAML) :
   ```bash
   gcloud run deploy mindless-backend --source backend --region europe-west1 \
     --allow-unauthenticated --project mindless-c58d3 \
     --set-secrets FIREBASE_SERVICE_ACCOUNT_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest \
     --env-vars-file env-vars.yaml   # CORS_ALLOWED_ORIGIN + STATIC_API_TOKEN de prod
   ```

Si l'URL du service change (nouveau nom de service, nouvelle région...), mets à jour
`public/api-config.js` avec la nouvelle URL puis redéploie le frontend (étape précédente) — le
frontend et le backend ne se redéploient jamais ensemble automatiquement, il faut refaire les deux
dans cet ordre après un changement d'URL backend.

**Vérifier un déploiement** : `curl <URL>/api/whoami` doit répondre `{"uid":null}` (HTTP 200) ; avec
`-H "Authorization: Bearer <STATIC_API_TOKEN>" -H "X-Test-Uid: xxx"`, il doit répondre
`{"uid":"xxx"}` — voir "Tester le backend seul" plus haut.

## Où trouver quoi

| Besoin | Fichier |
|---|---|
| Architecture, modèle de données, modules fonctionnels | [CLAUDE.md](CLAUDE.md) |
| Variables d'environnement backend | `backend/.env.example` |
| Config Firebase / URL backend côté front | `public/firebase-config.example.js`, `public/api-config.example.js` |
| Règles d'accès Firestore | `firestore.rules` |
| Solution palliative veille IA (Gem Gemini + script Python, en attendant le grounding) | `scripts/veille-externe/README.md` |
