// Copie assumée de public/models/Vehicule.js (pas de monorepo/package partagé
// entre front et backend).
export class Vehicule {
  constructor({
    id, nom, marque = '', modele = '', immatriculation = '',
    kilometrageActuel = 0, dateMajKilometrage = null,
    creePar, dateCreation,
  } = {}) {
    this.id = id;
    this.nom = nom;
    this.marque = marque;
    this.modele = modele;
    this.immatriculation = immatriculation;
    this.kilometrageActuel = kilometrageActuel;
    this.dateMajKilometrage = dateMajKilometrage;
    this.creePar = creePar;
    this.dateCreation = dateCreation;
  }

  static fromFirestore(id, data) {
    return new Vehicule({ id, ...data });
  }

  toFirestore() {
    return {
      nom: this.nom,
      marque: this.marque,
      modele: this.modele,
      immatriculation: this.immatriculation,
      kilometrageActuel: this.kilometrageActuel,
      dateMajKilometrage: this.dateMajKilometrage,
      creePar: this.creePar,
      dateCreation: this.dateCreation,
    };
  }
}
