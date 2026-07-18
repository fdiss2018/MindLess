// Copie assumée de public/models/ListeCoursesItem.js (pas de monorepo/package
// partagé entre front et backend).
export class ListeCoursesItem {
  constructor({
    id, nom, quantite = 1, unite = '', categorie = '', coche = false,
    origine = 'manuel', recetteIds = [], dateAjout, dateMaj,
  } = {}) {
    this.id = id;
    this.nom = nom;
    this.quantite = quantite;
    this.unite = unite;
    this.categorie = categorie;
    this.coche = coche;
    this.origine = origine; // 'manuel' | 'recette' | 'mixte'
    this.recetteIds = recetteIds;
    this.dateAjout = dateAjout;
    this.dateMaj = dateMaj;
  }

  static fromFirestore(id, data) {
    return new ListeCoursesItem({ id, ...data });
  }

  toFirestore() {
    return {
      nom: this.nom,
      quantite: this.quantite,
      unite: this.unite,
      categorie: this.categorie,
      coche: this.coche,
      origine: this.origine,
      recetteIds: this.recetteIds,
      dateAjout: this.dateAjout,
      dateMaj: this.dateMaj,
    };
  }
}
