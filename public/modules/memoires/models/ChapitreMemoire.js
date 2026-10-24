export class ChapitreMemoire {
  constructor({
    id, titre = '', contenu = '', noteIds = [], dateCreation,
  } = {}) {
    this.id = id;
    this.titre = titre;
    this.contenu = contenu; // texte brut, paragraphes séparés par une ligne vide
    this.noteIds = noteIds;
    this.dateCreation = dateCreation;
  }

  paragraphes() {
    return this.contenu.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  }
}
