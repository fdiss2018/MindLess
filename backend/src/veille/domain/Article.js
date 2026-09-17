// Copie assumée de public/veille/models/Article.js (pas de monorepo/package partagé
// entre front et backend).
import { categorieValide } from './Categories.js';

export class Article {
  constructor({
    id, titre, categorie, contenu, contenuAudio = null, motsCles = [], source = 'manuel', creePar,
    dateCreation,
  } = {}) {
    this.id = id;
    this.titre = titre;
    this.categorie = categorie;
    this.contenu = contenu; // version à lire à l'écran
    // Version réécrite pour l'oral (voir InterpreterArticleIA) — seule la génération IA la
    // fournit ; `null` pour les articles manuels/import .md/API, qui n'ont qu'un seul texte. Le
    // bouton "Écouter" (article-detail.html) lit contenuAudio en priorité, sinon retombe sur
    // contenu.
    this.contenuAudio = contenuAudio;
    this.motsCles = motsCles; // tags libres, saisis à la main ou proposés par la génération IA
    this.source = source; // 'manuel' | 'ia' | 'import_md' | 'api'
    this.creePar = creePar;
    this.dateCreation = dateCreation;
  }

  static fromFirestore(id, data) {
    return new Article({ id, ...data });
  }

  toFirestore() {
    return {
      titre: this.titre,
      categorie: this.categorie,
      contenu: this.contenu,
      contenuAudio: this.contenuAudio,
      motsCles: this.motsCles,
      source: this.source,
      creePar: this.creePar,
      dateCreation: this.dateCreation,
    };
  }
}

// Règle de validité commune aux 4 points d'entrée de création d'article — manuel
// (routes/articles.js POST /), génération IA (POST /generer, sur titre/contenu déjà validés par
// InterpreterArticleIA.validerArticleIA), import .md (POST /importer-md, après parserMarkdown) et
// API externe (POST /externe). Centralisée ici plutôt que dupliquée dans chaque route : ne
// persiste rien, ne lève pas d'exception — retourne un message d'erreur (à adapter/contextualiser
// par l'appelant si besoin, ex. le message spécifique au .md) ou `null` si les champs sont valides.
export function validerChampsArticle({ titre, categorie, contenu }) {
  if (!titre || typeof titre !== 'string' || !titre.trim()) return 'Le titre est requis.';
  if (!categorieValide(categorie)) return 'Catégorie invalide.';
  if (!contenu || typeof contenu !== 'string' || !contenu.trim()) return 'Le contenu est requis.';
  return null;
}

// Normalise les mots-clés reçus d'un point d'entrée de création d'article — accepte soit un
// tableau (manuel, API externe, sortie IA déjà normalisée par validerArticleIA), soit une chaîne
// séparée par des virgules (front-matter `.md`, voir ArticleMarkdown.js), et retourne toujours un
// tableau de chaînes non vides et sans espaces superflus.
export function normaliserMotsCles(motsCles) {
  if (Array.isArray(motsCles)) {
    return motsCles.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim());
  }
  if (typeof motsCles === 'string') {
    return motsCles.split(',').map((m) => m.trim()).filter(Boolean);
  }
  return [];
}

// Filtre une liste d'articles par catégorie et/ou plage de dates (toutes les options facultatives)
// — comparaison sur la partie date (YYYY-MM-DD) de dateCreation, alignée sur le format attendu des
// paramètres `depuis`/`jusqua` (des <input type="date">/query params, pas des horodatages
// complets). Utilisée par la route authentifiée (GET /articles) et par l'API publique en lecture
// seule (GET /api/public/foyers/:foyerId/articles) : même logique de filtre des deux côtés.
export function filtrerArticles(articles, { categorie, depuis, jusqua } = {}) {
  return articles.filter((article) => {
    if (categorie && article.categorie !== categorie) return false;
    if (depuis || jusqua) {
      const dateArticle = (article.dateCreation || '').slice(0, 10);
      // Un article sans dateCreation ne peut être positionné sur aucune plage : exclu dès qu'une
      // borne est demandée, plutôt que de le laisser passer silencieusement des deux côtés.
      if (!dateArticle) return false;
      if (depuis && dateArticle < depuis) return false;
      if (jusqua && dateArticle > jusqua) return false;
    }
    return true;
  });
}

// Résumé tronqué du contenu d'un article — utilisé pour donner à l'IA le contexte des articles
// déjà publiés sur une catégorie sans lui envoyer chaque article en entier (voir
// InterpreterArticleIA.construireRequeteArticleIA, routes/articles.js POST /generer). Coupe sur un
// espace pour éviter de tronquer un mot en plein milieu.
export function extraireResume(contenu, longueur = 300) {
  const texte = (contenu || '').trim();
  if (texte.length <= longueur) return texte;
  return `${texte.slice(0, texte.lastIndexOf(' ', longueur)).trim()}…`;
}
