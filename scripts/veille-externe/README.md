# Veille IA — solution palliative sans grounding

MindLess ne peut pas donner à l'IA un accès à une recherche web réelle (voir CLAUDE.md — le
grounding Google Search a été testé et écarté, bloqué par une limite actuelle de l'API Gemini).
En attendant que ça se débloque, ce dossier permet de produire des articles réellement à jour en
passant par l'appli Gemini (qui a la recherche web intégrée), puis de les pousser dans MindLess via
l'API externe déjà en place (`POST /api/foyers/:foyerId/articles/externe`).

## Mise en place (une fois)

1. Va sur [gemini.google.com](https://gemini.google.com), crée un nouveau Gem, et colle le contenu
   de [`prompt-gem-veille-ia.md`](prompt-gem-veille-ia.md) dans ses instructions.
2. `pip install requests` (seule dépendance du script).
3. Copie `config.example.json` en `config.json` (à côté de ce script — jamais committé, voir
   `.gitignore`) et renseigne :
   - `apiBaseUrl` : l'URL du backend (déjà pré-remplie pour la prod).
   - `foyerId` : le code de ton foyer (visible sur `foyer.html`).
   - `staticApiToken` : le secret de prod — `gcloud secrets versions access latest
     --secret=STATIC_API_TOKEN --project=mindless-c58d3` (voir README.md racine, section
     "API externe (veille)").
   - `uid` : ton uid Firebase — **doit être celui du créateur du foyer** (`requireCreateurFoyer`
     refuse sinon avec un 403). Récupérable via la Console Firebase (Authentication) ou
     `GET /api/utilisateurs/moi` avec un vrai token.

## Utilisation

1. Ouvre le Gem, demande un point sur l'IA (ex. "fais-moi un point sur les dernières annonces
   d'Anthropic" ou juste "actualités IA").
2. Le Gem répond avec un objet JSON strict (voir le prompt) — colle-le tel quel dans un nouveau
   fichier `.json` dans [`articles-a-importer/`](articles-a-importer/) (nom libre, ex.
   `2026-09-15-anthropic.json`).
3. Lance :
   ```bash
   python envoyer_article.py
   ```
   Traite tous les `.json` du dossier (ou passe un chemin de fichier précis en argument). Chaque
   fichier importé avec succès est déplacé dans `articles-a-importer/traites/` (horodaté) pour ne
   jamais être repoussé deux fois ; un fichier en échec (JSON invalide, champ manquant, erreur API)
   reste sur place pour être corrigé et relancé.

L'article apparaît dans MindLess avec `source: 'api'` (badge "Ajouté via API").

**Alternative sans le script** : le JSON produit par le Gem peut aussi être collé directement dans
un fichier et déposé via le bouton "📥 Importer un article (.md ou .json)" de `veille.html` — le
backend détecte le format automatiquement (voir `domain/ArticleMarkdown.parserFichierImport`). Dans
ce cas l'article est marqué `source: 'import_md'` plutôt que `'api'`, et n'importe quel membre du
foyer peut le faire (pas besoin d'être le créateur) — pratique pour ne pas avoir à configurer
`config.json` juste pour un import ponctuel.

## Limites assumées

- Pas d'automatisation de bout en bout : le passage par le Gem reste manuel (copier/coller) — c'est
  le prix à payer pour avoir un vrai accès web, que l'API Gemini ne fournit pas de façon fiable
  aujourd'hui pour ce projet (voir CLAUDE.md).
- Le Gem peut quand même se tromper ou mal citer une source : les articles `source: 'api'` restent
  à vérifier comme les articles `source: 'ia'`, même si le contenu est normalement mieux informé.
