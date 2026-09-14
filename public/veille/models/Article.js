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
