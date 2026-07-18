// Copie assumée de public/models/Utilisateur.js (pas de monorepo/package
// partagé entre front et backend).
export class Utilisateur {
  constructor({
    id, email, nomAffiche = '', photoUrl = '', foyerId = null, profilNutritionnel = null,
  } = {}) {
    this.id = id;
    this.email = email;
    this.nomAffiche = nomAffiche;
    this.photoUrl = photoUrl;
    this.foyerId = foyerId;
    this.profilNutritionnel = profilNutritionnel;
  }

  static fromFirestore(id, data) {
    return new Utilisateur({ id, ...data });
  }

  toFirestore() {
    return {
      email: this.email,
      nomAffiche: this.nomAffiche,
      photoUrl: this.photoUrl,
      foyerId: this.foyerId,
      profilNutritionnel: this.profilNutritionnel,
    };
  }
}
