import { ApiClient } from '../../commun/services/ApiClient.js';
import { Article } from '../models/Article.js';

const base = (foyerId) => `/api/foyers/${foyerId}/articles`;

export const ArticleService = {

  async ajouterArticle(foyerId, article) {
    const { id } = await ApiClient.post(base(foyerId), article.toFirestore());
    return id;
  },

  async modifierArticle(foyerId, articleId, donnees) {
    await ApiClient.put(`${base(foyerId)}/${articleId}`, donnees);
  },

  async supprimerArticle(foyerId, articleId) {
    await ApiClient.delete(`${base(foyerId)}/${articleId}`);
  },

  async obtenirArticle(foyerId, articleId) {
    try {
      const donnees = await ApiClient.get(`${base(foyerId)}/${articleId}`);
      return new Article(donnees);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  async listerArticles(foyerId) {
    const items = await ApiClient.get(base(foyerId));
    return items.map((d) => new Article(d));
  },

  async genererArticleIA(foyerId, { categorie, sujet }) {
    return ApiClient.post(`${base(foyerId)}/generer`, { categorie, sujet });
  },

  // Le fichier peut être un .md (front-matter) ou un .json (même forme que l'API externe) — la
  // détection se fait côté backend (domain/ArticleMarkdown.parserFichierImport), pas ici : ce
  // service se contente de transmettre le texte brut du fichier tel quel.
  async importerArticleFichier(foyerId, contenuFichier) {
    return ApiClient.post(`${base(foyerId)}/importer-md`, { contenu: contenuFichier });
  },
};
