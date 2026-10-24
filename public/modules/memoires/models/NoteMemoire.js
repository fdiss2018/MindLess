export class NoteMemoire {
  constructor({
    id, texte = '', type = 'souvenir', chapitreId = null, dateCreation,
  } = {}) {
    this.id = id;
    this.texte = texte;
    this.type = type; // 'souvenir' (matière du chapitre) | 'instruction' (consigne pour l'écrire)
    this.chapitreId = chapitreId; // chapitre où la note a été utilisée, null = encore à synthétiser
    this.dateCreation = dateCreation;
  }

  estInstruction() {
    return this.type === 'instruction';
  }
}
