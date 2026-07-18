# MindLess — Guide développeur

Comment lancer, tester et déployer tes corrections, côté frontend et côté backend.
Pour l'architecture, le modèle de données et le découpage en modules fonctionnels, voir
[CLAUDE.md](CLAUDE.md).

L'application a deux parties déployées **séparément** :

| Partie | Dossier | Techno | Hébergement |
|---|---|---|---|
| Frontend | `public/` | HTML/CSS/JS vanilla | Firebase Hosting — https://mindless-c58d3.web.app |
| Backend | `backend/` | Node.js + Express + firebase-admin | Cloud Run — https://mindless-backend-428494497216.europe-west1.run.app |

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

### Tester le flux complet (frontend + backend + vraies données)

1. Backend lancé (`npm run dev`), `.env` valide.
2. Frontend servi (émulateur Hosting, ou tout serveur statique pointant sur `public/`), avec
   `api-config.js` pointant sur ce backend.
3. Se connecter avec un vrai compte Google (voir avertissement émulateur Auth ci-dessus) et dérouler
   le parcours concerné (ex. modifier un créneau de menu → vérifier le bilan nutritionnel, générer
   la liste de courses depuis le planning...).

## Déployer ses corrections

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
