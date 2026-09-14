// Copie assumée de public/veille/models/Article.js (pas de monorepo/package partagé
// entre front et backend).
import { categorieValide } from './Categories.js';

export class Article {
  constructor({
    id, titre, categorie, contenu, source = 'manuel', creePar, dateCreation,
  } = {}) {
    this.id = id;
    this.titre = titre;
    this.categorie = categorie;
    this.contenu = contenu;
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

// Résumé tronqué du contenu d'un article — utilisé pour donner à l'IA le contexte des articles
// déjà publiés sur une catégorie sans lui envoyer chaque article en entier (voir
// InterpreterArticleIA.construireRequeteArticleIA, routes/articles.js POST /generer). Coupe sur un
// espace pour éviter de tronquer un mot en plein milieu.
export function extraireResume(contenu, longueur = 300) {
  const texte = (contenu || '').trim();
  if (texte.length <= longueur) return texte;
  return `${texte.slice(0, texte.lastIndexOf(' ', longueur)).trim()}…`;
}
