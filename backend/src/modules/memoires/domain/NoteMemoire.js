// Copie assumée de public/modules/memoires/models/NoteMemoire.js (pas de monorepo/package partagé
// entre front et backend). Une note est un souvenir dicté (ou tapé) ; `chapitreId` indique le
// chapitre dans lequel elle a déjà été synthétisée (null = encore à synthétiser).
export class NoteMemoire {
  constructor({
    id, texte = '', chapitreId = null, dateCreation,
  } = {}) {
    this.id = id;
    this.texte = texte;
    this.chapitreId = chapitreId;
    this.dateCreation = dateCreation;
  }

  static fromFirestore(id, data) {
    return new NoteMemoire({ id, ...data });
  }

  toFirestore() {
    return {
      texte: this.texte,
      chapitreId: this.chapitreId,
      dateCreation: this.dateCreation,
    };
  }
}
