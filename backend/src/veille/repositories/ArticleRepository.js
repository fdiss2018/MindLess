import { db } from '../../commun/firebaseAdmin.js';
import { Article } from '../domain/Article.js';

const collectionRef = (foyerId) => db.collection('foyers').doc(foyerId).collection('articles');

export const ArticleRepository = {
  // Point de passage unique des 4 façons de créer un article (manuel, génération IA, import .md,
  // API externe — voir routes/articles.js) : pose systématiquement `dateCreation`, seul `source`
  // varie selon l'appelant. La validation des champs (validerChampsArticle) reste à la charge de
  // la route appelante, qui peut vouloir un message d'erreur contextualisé (ex. import .md).
  async creer(foyerId, {
    titre, categorie, contenu, source, creePar,
  }) {
    const article = new Article({
      titre, categorie, contenu, source, creePar, dateCreation: new Date().toISOString(),
    });
    return this.ajouter(foyerId, article);
  },

  async ajouter(foyerId, article) {
    const ref = await collectionRef(foyerId).add(article.toFirestore());
    return ref.id;
  },

  async modifier(foyerId, articleId, donnees) {
    await collectionRef(foyerId).doc(articleId).update(donnees);
  },

  async supprimer(foyerId, articleId) {
    await collectionRef(foyerId).doc(articleId).delete();
  },

  async obtenir(foyerId, articleId) {
    const snap = await collectionRef(foyerId).doc(articleId).get();
    return snap.exists ? Article.fromFirestore(snap.id, snap.data()) : null;
  },

  // Pas de filtre par catégorie côté backend : la bibliothèque d'articles d'un foyer reste petite,
  // le filtre se fait côté client (voir veille.html) — même choix que RecetteRepository.lister,
  // et ça évite un index composite Firestore (equality + orderBy sur deux champs différents).
  async lister(foyerId) {
    const snap = await collectionRef(foyerId).orderBy('dateCreation', 'desc').get();
    return snap.docs.map((d) => Article.fromFirestore(d.id, d.data()));
  },
};
