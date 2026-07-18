// Copie assumée de public/models/Recette.js (pas de monorepo/package partagé
// entre front et backend).
export class Recette {
  constructor({
    id, nom, portions = 4, ingredients = [], instructions = '', tags = [],
    creePar, dateCreation,
  } = {}) {
    this.id = id;
    this.nom = nom;
    this.portions = portions;
    this.ingredients = ingredients; // [{ nom, quantite, unite }]
    this.instructions = instructions;
    this.tags = tags;
    this.creePar = creePar;
    this.dateCreation = dateCreation;
  }

  static fromFirestore(id, data) {
    return new Recette({ id, ...data });
  }

  toFirestore() {
    return {
      nom: this.nom,
      portions: this.portions,
      ingredients: this.ingredients,
      instructions: this.instructions,
      tags: this.tags,
      creePar: this.creePar,
      dateCreation: this.dateCreation,
    };
  }
}
