// Copie assumée de public/coeur/models/Utilisateur.js (pas de monorepo/package
// partagé entre front et backend). Ne porte que l'identité et le rattachement au
// foyer : une donnée propre à un module (ex. profil nutritionnel) vit dans ce
// module, jamais ici.
export class Utilisateur {
  constructor({
    id, email, nomAffiche = '', photoUrl = '', foyerId = null,
  } = {}) {
    this.id = id;
    this.email = email;
    this.nomAffiche = nomAffiche;
    this.photoUrl = photoUrl;
    this.foyerId = foyerId;
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
    };
  }
}
