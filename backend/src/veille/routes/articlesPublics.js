import { Router } from 'express';
import { ArticleRepository } from '../repositories/ArticleRepository.js';
import { FoyerRepository } from '../../commun/repositories/FoyerRepository.js';
import { filtrerArticles } from '../domain/Article.js';

// Monté sur /api/public/foyers/:foyerId/articles — volontairement une route à part de
// routes/articles.js plutôt qu'un paramètre optionnel sur celle-ci, pour qu'aucune évolution
// future de la route authentifiée ne puisse accidentellement affaiblir son contrôle d'accès.
//
// Choix explicite et assumé de l'utilisateur (voir CLAUDE.md "Limite assumée") : vraiment publique,
// aucune authentification requise — ni token Firebase, ni STATIC_API_TOKEN. Quiconque connaît (ou
// devine) un foyerId peut lire les articles de ce foyer. `creePar` est exclu de la réponse (seul
// champ à caractère un peu personnel du modèle Article) ; tout le reste du contenu d'un article est
// déjà pensé pour être lu, donc sans risque particulier à exposer publiquement.
export const articlesPublicsRouter = Router({ mergeParams: true });

// Champs exposés publiquement — exclut explicitement `creePar` (voir commentaire ci-dessus).
const CHAMPS_PUBLICS = ['id', 'titre', 'categorie', 'contenu', 'contenuAudio', 'motsCles', 'source', 'dateCreation'];

function versReponsePublique(article) {
  const reponse = {};
  for (const champ of CHAMPS_PUBLICS) reponse[champ] = article[champ];
  return reponse;
}

articlesPublicsRouter.get('/', async (req, res, next) => {
  try {
    const foyer = await FoyerRepository.obtenir(req.params.foyerId);
    if (!foyer) return res.status(404).json({ erreur: 'Foyer introuvable.' });

    const { categorie, depuis, jusqua } = req.query;
    const articles = await ArticleRepository.lister(req.params.foyerId);
    res.json(filtrerArticles(articles, { categorie, depuis, jusqua }).map(versReponsePublique));
  } catch (err) { next(err); }
});
