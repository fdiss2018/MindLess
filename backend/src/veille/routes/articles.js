import { Router } from 'express';
import { ArticleRepository } from '../repositories/ArticleRepository.js';
import { GeminiClient } from '../repositories/GeminiClient.js';
import { LigneEditorialeRepository } from '../repositories/LigneEditorialeRepository.js';
import { validerChampsArticle, extraireResume } from '../domain/Article.js';
import { parserMarkdown } from '../domain/ArticleMarkdown.js';
import { categorieValide, LIGNES_EDITORIALES_PAR_DEFAUT } from '../domain/Categories.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';
import { requireCreateurFoyer } from '../../commun/middleware/requireCreateurFoyer.js';

// Monté sur /api/foyers/:foyerId/articles
//
// 4 points d'entrée créent un article, tous centralisés sur ArticleRepository.creer (seuls
// `source` et la validation en amont changent) — voir CLAUDE.md section "veille" pour le détail :
//   - POST /               manuel, depuis article-form.html, ouvert à tout membre du foyer
//   - POST /generer        génération IA (Gemini), ouvert à tout membre du foyer
//   - POST /importer-md    import d'un fichier .md avec front-matter, ouvert à tout membre du foyer
//   - POST /externe        API REST pour un outil externe (script, automatisation...), réservé au
//                          créateur du foyer (requireCreateurFoyer) — voir README.md "API externe
//                          (veille)" pour l'authentification (STATIC_API_TOKEN + X-Test-Uid) et un
//                          exemple curl.
// Nombre d'articles précédents (même catégorie) donnés en contexte à l'IA pour assurer une
// continuité (voir InterpreterArticleIA.construireRequeteArticleIA) — un compromis entre
// suffisamment d'historique et la taille du prompt envoyé à chaque génération.
const NB_ARTICLES_CONTEXTE = 5;

export const articlesRouter = Router({ mergeParams: true });

articlesRouter.use(requireUid, requireMembreFoyer);

articlesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await ArticleRepository.lister(req.params.foyerId));
  } catch (err) { next(err); }
});

articlesRouter.post('/', async (req, res, next) => {
  try {
    const { titre, categorie, contenu } = req.body;
    const erreur = validerChampsArticle({ titre, categorie, contenu });
    if (erreur) return res.status(400).json({ erreur });

    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre, categorie, contenu, source: 'manuel', creePar: req.uid,
    });
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

// Génération IA (Gemini, voir repositories/GeminiClient.js). Le contenu généré n'est jamais
// garanti factuellement exact (pas d'accès à une source d'actualité en temps réel) : source: 'ia'
// permet au front d'afficher un badge d'avertissement plutôt que de laisser croire à du factuel
// vérifié. Pas de validerChampsArticle ici : titre/contenu viennent de
// InterpreterArticleIA.validerArticleIA (déjà garantis non vides) — seule la catégorie doit être
// vérifiée avant d'appeler Gemini, pour échouer vite plutôt que de payer un appel pour rien.
articlesRouter.post('/generer', async (req, res, next) => {
  try {
    const { categorie, sujet } = req.body;
    if (!categorieValide(categorie)) {
      return res.status(400).json({ erreur: 'Catégorie invalide.' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ erreur: 'Génération IA non configurée (GEMINI_API_KEY manquante).' });
    }

    const lignesPersonnalisees = await LigneEditorialeRepository.obtenir(req.params.foyerId);
    const ligneEditoriale = lignesPersonnalisees[categorie] ?? LIGNES_EDITORIALES_PAR_DEFAUT[categorie];

    // Contexte de continuité : les derniers articles déjà publiés sur cette catégorie (déjà triés
    // par dateCreation décroissante par ArticleRepository.lister), résumés pour ne pas gonfler le
    // prompt avec le contenu intégral de chacun.
    const tousLesArticles = await ArticleRepository.lister(req.params.foyerId);
    const articlesPrecedents = tousLesArticles
      .filter((a) => a.categorie === categorie)
      .slice(0, NB_ARTICLES_CONTEXTE)
      .map((a) => ({ titre: a.titre, dateCreation: a.dateCreation, extrait: extraireResume(a.contenu) }));

    const { titre, contenu } = await GeminiClient.genererArticleParIA({
      categorie, sujet, ligneEditoriale, articlesPrecedents,
    });
    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre, categorie, contenu, source: 'ia', creePar: req.uid,
    });
    res.status(201).json({ id, titre, contenu });
  } catch (err) { next(err); }
});

// Import depuis un fichier .md avec front-matter (voir domain/ArticleMarkdown.js) — un seul
// article par import, contrairement à l'import en lot des recettes. Même règle de validité que
// les autres points d'entrée (validerChampsArticle), avec un message d'erreur contextualisé au
// format .md plutôt que le message générique.
articlesRouter.post('/importer-md', async (req, res, next) => {
  try {
    const { titre, categorie, contenu } = parserMarkdown(req.body.contenu);
    if (validerChampsArticle({ titre, categorie, contenu })) {
      return res.status(400).json({
        erreur: "Fichier .md invalide : le front-matter doit renseigner 'titre' et 'categorie' (valeur valide), suivi du contenu de l'article.",
      });
    }

    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre, categorie, contenu, source: 'import_md', creePar: req.uid,
    });
    res.status(201).json({ id, titre, categorie });
  } catch (err) { next(err); }
});

// API REST externe — pensée pour un script/une automatisation en dehors de l'app (pas l'UI), donc
// réservée au créateur du foyer (requireCreateurFoyer) plutôt qu'ouverte à tout membre comme les 3
// points d'entrée ci-dessus. Authentification : STATIC_API_TOKEN + X-Test-Uid (voir README.md).
articlesRouter.post('/externe', requireCreateurFoyer, async (req, res, next) => {
  try {
    const { titre, categorie, contenu } = req.body;
    const erreur = validerChampsArticle({ titre, categorie, contenu });
    if (erreur) return res.status(400).json({ erreur });

    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre, categorie, contenu, source: 'api', creePar: req.uid,
    });
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

articlesRouter.get('/:articleId', async (req, res, next) => {
  try {
    const article = await ArticleRepository.obtenir(req.params.foyerId, req.params.articleId);
    if (!article) return res.status(404).json({ erreur: 'Article introuvable.' });
    res.json(article);
  } catch (err) { next(err); }
});

articlesRouter.put('/:articleId', async (req, res, next) => {
  try {
    await ArticleRepository.modifier(req.params.foyerId, req.params.articleId, req.body);
    res.status(204).end();
  } catch (err) { next(err); }
});

articlesRouter.delete('/:articleId', async (req, res, next) => {
  try {
    await ArticleRepository.supprimer(req.params.foyerId, req.params.articleId);
    res.status(204).end();
  } catch (err) { next(err); }
});
