// Copie assumée de public/modules/memoires/models/ChapitreMemoire.js (pas de monorepo/package
// partagé entre front et backend). Un chapitre est écrit par l'IA à partir de notes (`noteIds`) ;
// son numéro n'est pas stocké, il découle de l'ordre de création.
export class ChapitreMemoire {
  constructor({
    id, titre = '', contenu = '', noteIds = [], dateCreation,
  } = {}) {
    this.id = id;
    this.titre = titre;
    this.contenu = contenu; // paragraphes séparés par une ligne vide, texte brut (pas de Markdown)
    this.noteIds = noteIds;
    this.dateCreation = dateCreation;
  }

  static fromFirestore(id, data) {
    return new ChapitreMemoire({ id, ...data });
  }

  toFirestore() {
    return {
      titre: this.titre,
      contenu: this.contenu,
      noteIds: this.noteIds,
      dateCreation: this.dateCreation,
    };
  }
}
