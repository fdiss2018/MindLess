export class Foyer {
  constructor({
    id, nom, membres = [], creePar, dateCreation, modulesParMembre = {},
  } = {}) {
    this.id = id;
    this.nom = nom;
    this.membres = membres;
    this.creePar = creePar;
    this.dateCreation = dateCreation;
    this.modulesParMembre = modulesParMembre; // { [uid]: ['voiture', ...] } — voir coeur/utils/Modules.js
  }

  static fromFirestore(id, data) {
    return new Foyer({ id, ...data });
  }

  toFirestore() {
    return {
      nom: this.nom,
      membres: this.membres,
      creePar: this.creePar,
      dateCreation: this.dateCreation,
      modulesParMembre: this.modulesParMembre,
    };
  }
}
