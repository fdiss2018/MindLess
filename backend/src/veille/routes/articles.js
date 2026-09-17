import { Router } from 'express';
import { ArticleRepository } from '../repositories/ArticleRepository.js';
import { GeminiClient } from '../repositories/GeminiClient.js';
import { LigneEditorialeRepository } from '../repositories/LigneEditorialeRepository.js';
import { validerChampsArticle, extraireResume, normaliserMotsCles } from '../domain/Article.js';
import { parserFichierImport } from '../domain/ArticleMarkdown.js';
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
    const {
      titre, categorie, contenu, motsCles,
    } = req.body;
    const erreur = validerChampsArticle({ titre, categorie, contenu });
    if (erreur) return res.status(400).json({ erreur });

    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre, categorie, contenu, motsCles: normaliserMotsCles(motsCles), source: 'manuel', creePar: req.uid,
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

    // Les deux lectures ci-dessous sont indépendantes (l'une porte sur veilleConfig, l'autre sur
    // articles) : lancées en parallèle plutôt qu'en série pour ne pas payer deux allers-retours
    // Firestore l'un après l'autre à chaque génération.
    const [lignesPersonnalisees, tousLesArticles] = await Promise.all([
      LigneEditorialeRepository.obtenir(req.params.foyerId),
      ArticleRepository.lister(req.params.foyerId),
    ]);
    const ligneEditoriale = lignesPersonnalisees[categorie] ?? LIGNES_EDITORIALES_PAR_DEFAUT[categorie];

    // Contexte de continuité : les derniers articles déjà publiés sur cette catégorie (déjà triés
    // par dateCreation décroissante par ArticleRepository.lister), résumés pour ne pas gonfler le
    // prompt avec le contenu intégral de chacun.
    const articlesPrecedents = tousLesArticles
      .filter((a) => a.categorie === categorie)
      .slice(0, NB_ARTICLES_CONTEXTE)
      .map((a) => ({ titre: a.titre, dateCreation: a.dateCreation, extrait: extraireResume(a.contenu) }));

    const {
      titre, contenu, contenuAudio, motsCles,
    } = await GeminiClient.genererArticleParIA({
      categorie, sujet, ligneEditoriale, articlesPrecedents,
    });
    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre, categorie, contenu, contenuAudio, motsCles, source: 'ia', creePar: req.uid,
    });
    res.status(201).json({
      id, titre, contenu, contenuAudio, motsCles,
    });
  } catch (err) { next(err); }
});

// Import depuis un fichier déposé sur veille.html — .md (front-matter) ou .json (même forme que
// l'API externe ci-dessous et que scripts/veille-externe/envoyer_article.py), détecté par
// domain/ArticleMarkdown.parserFichierImport. Un seul article par import, contrairement à
// l'import en lot des recettes. Même règle de validité que les autres points d'entrée
// (validerChampsArticle), avec un message d'erreur générique aux deux formats.
articlesRouter.post('/importer-md', async (req, res, next) => {
  try {
    const {
      titre, categorie, contenu, contenuAudio, motsCles,
    } = parserFichierImport(req.body.contenu);
    if (validerChampsArticle({ titre, categorie, contenu })) {
      return res.status(400).json({
        erreur: "Fichier invalide : 'titre' et 'categorie' (valeur valide) doivent être renseignés, suivis du contenu de l'article (front-matter .md ou champs JSON).",
      });
    }

    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre, categorie, contenu, contenuAudio, motsCles: normaliserMotsCles(motsCles), source: 'import_md', creePar: req.uid,
    });
    res.status(201).json({ id, titre, categorie });
  } catch (err) { next(err); }
});

// API REST externe — pensée pour un script/une automatisation en dehors de l'app (pas l'UI), donc
// réservée au créateur du foyer (requireCreateurFoyer) plutôt qu'ouverte à tout membre comme les 3
// points d'entrée ci-dessus. Authentification : STATIC_API_TOKEN + X-Test-Uid (voir README.md).
// Accepte optionnellement contenuAudio et motsCles, pour un article produit par un outil externe
// (ex. un Gem Gemini avec recherche web) qui fournit déjà les deux versions et des mots-clés.
articlesRouter.post('/externe', requireCreateurFoyer, async (req, res, next) => {
  try {
    const {
      titre, categorie, contenu, contenuAudio, motsCles,
    } = req.body;
    const erreur = validerChampsArticle({ titre, categorie, contenu });
    if (erreur) return res.status(400).json({ erreur });

    const id = await ArticleRepository.creer(req.params.foyerId, {
      titre,
      categorie,
      contenu,
      contenuAudio: contenuAudio || null,
      motsCles: normaliserMotsCles(motsCles),
      source: 'api',
      creePar: req.uid,
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

// Liste blanche des champs modifiables — sans ça, req.body passé tel quel à Firestore laisserait
// n'importe quel membre réécrire `creePar` (usurper la paternité d'un article, et donc contourner
// la restriction "seul le créateur peut supprimer" ci-dessous) ou `source`/`dateCreation`.
const CHAMPS_MODIFIABLES = ['titre', 'categorie', 'contenu', 'contenuAudio', 'motsCles'];

articlesRouter.put('/:articleId', async (req, res, next) => {
  try {
    const donnees = {};
    for (const champ of CHAMPS_MODIFIABLES) {
      if (champ in req.body) donnees[champ] = req.body[champ];
    }
    if (typeof donnees.categorie === 'string' && !categorieValide(donnees.categorie)) {
      return res.status(400).json({ erreur: 'Catégorie invalide.' });
    }
    if ('motsCles' in donnees) donnees.motsCles = normaliserMotsCles(donnees.motsCles);

    await ArticleRepository.modifier(req.params.foyerId, req.params.articleId, donnees);
    res.status(204).end();
  } catch (err) { next(err); }
});

// Réservé au créateur de CET article (article.creePar), pas au créateur du foyer — une distinction
// différente de requireCreateurFoyer (qui porte sur foyer.creePar, voir commun/middleware). Chaque
// auteur ne supprime que ce qu'il a lui-même créé/généré/importé ; les autres membres du foyer
// gardent le droit de créer et modifier des articles, juste pas de supprimer ceux des autres.
articlesRouter.delete('/:articleId', async (req, res, next) => {
  try {
    const article = await ArticleRepository.obtenir(req.params.foyerId, req.params.articleId);
    if (!article) return res.status(404).json({ erreur: 'Article introuvable.' });
    if (article.creePar !== req.uid) {
      return res.status(403).json({ erreur: 'Seul le créateur de cet article peut le supprimer.' });
    }

    await ArticleRepository.supprimer(req.params.foyerId, req.params.articleId);
    res.status(204).end();
  } catch (err) { next(err); }
});
