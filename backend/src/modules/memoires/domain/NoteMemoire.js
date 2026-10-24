// Copie assumée de public/modules/memoires/models/NoteMemoire.js (pas de monorepo/package partagé
// entre front et backend). Une note est dictée (ou tapée) : un souvenir, matière du chapitre, ou une
// instruction pour l'écrire (voir domain/SyntheseMemoires.js, TYPES_NOTE). `chapitreId` indique le
// chapitre dans lequel elle a déjà été utilisée (null = encore à synthétiser).
export class NoteMemoire {
  constructor({
    id, texte = '', type = 'souvenir', chapitreId = null, dateCreation,
  } = {}) {
    this.id = id;
    this.texte = texte;
    this.type = type; // 'souvenir' | 'instruction'
    this.chapitreId = chapitreId;
    this.dateCreation = dateCreation;
  }

  static fromFirestore(id, data) {
    return new NoteMemoire({ id, ...data });
  }

  toFirestore() {
    return {
      texte: this.texte,
      type: this.type,
      chapitreId: this.chapitreId,
      dateCreation: this.dateCreation,
    };
  }
}
