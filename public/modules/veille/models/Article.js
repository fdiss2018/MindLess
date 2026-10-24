export class Article {
  constructor({
    id, titre, categorie, contenu, contenuAudio = null, motsCles = [], sources = [],
    source = 'manuel', creePar, dateCreation,
  } = {}) {
    this.id = id;
    this.titre = titre;
    this.categorie = categorie;
    this.contenu = contenu; // version à lire à l'écran
    // Version réécrite pour l'oral (génération IA uniquement) — null pour les articles
    // manuels/import .md/API. Le bouton "Écouter" (article-detail.html) la lit en priorité,
    // sinon retombe sur contenu.
    this.contenuAudio = contenuAudio;
    this.motsCles = motsCles; // tags libres, saisis à la main ou proposés par la génération IA
    // Sources du grounding Google Search ({uri, titre}[]) — uniquement pour source: 'ia', vide si
    // le modèle n'a pas déclenché de recherche sur cet appel.
    this.sources = sources;
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
      sources: this.sources,
      source: this.source,
      creePar: this.creePar,
      dateCreation: this.dateCreation,
    };
  }
}
