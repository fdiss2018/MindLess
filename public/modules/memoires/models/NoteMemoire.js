export class NoteMemoire {
  constructor({
    id, texte = '', chapitreId = null, dateCreation,
  } = {}) {
    this.id = id;
    this.texte = texte;
    this.chapitreId = chapitreId; // chapitre où la note a été synthétisée, null = encore à synthétiser
    this.dateCreation = dateCreation;
  }
}
