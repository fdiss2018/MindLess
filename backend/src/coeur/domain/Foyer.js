// Copie assumée de public/coeur/models/Foyer.js (pas de monorepo/package partagé
// entre front et backend).
export class Foyer {
  constructor({
    id, nom, membres = [], creePar, dateCreation, modulesParMembre = {}, demandesModules = {},
  } = {}) {
    this.id = id;
    this.nom = nom;
    this.membres = membres;
    this.creePar = creePar;
    this.dateCreation = dateCreation;
    // { [uid]: ['voiture', 'veille', ...] } — modules ouverts par l'administrateur à chaque membre
    // (voir domain/AccesModules.js). Absent sur les foyers créés avant l'introduction des droits.
    this.modulesParMembre = modulesParMembre;
    // { [uid]: { [module]: { statut, dateDemande, expiration, dateRefus? } } } — modules demandés par
    // les membres eux-mêmes (à l'essai, refusés ou expirés), voir domain/AccesModules.js.
    this.demandesModules = demandesModules;
  }

  static fromFirestore(id, data) {
    return new Foyer({ id, ...data });
  }

  toFirestore() {
    return {
      nom: this.nom,
      membres: this.membres,
      creePar: this.creePar,
      dateCreation: this.dateCreation,
      modulesParMembre: this.modulesParMembre,
      demandesModules: this.demandesModules,
    };
  }
}
