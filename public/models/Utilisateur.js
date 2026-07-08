export class Utilisateur {
  constructor({ id, email, nomAffiche = '', photoUrl = '', foyerId = null } = {}) {
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
