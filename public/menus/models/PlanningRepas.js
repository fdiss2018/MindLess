import { JOURS_SEMAINE, CRENEAUX_REPAS } from '../utils/DateSemaine.js';

function creneauVide() {
  return { texte: null, recetteId: null };
}

function joursVides() {
  const jours = {};
  JOURS_SEMAINE.forEach((jour) => {
    jours[jour] = {};
    CRENEAUX_REPAS.forEach((creneau) => { jours[jour][creneau] = creneauVide(); });
  });
  return jours;
}

export class PlanningRepas {
  constructor({ id, jours = null, dateMaj = null } = {}) {
    this.id = id; // identifiant de semaine ISO, ex. "2026-W28"
    this.jours = jours || joursVides();
    this.dateMaj = dateMaj;
  }

  static fromFirestore(id, data) {
    return new PlanningRepas({ id, ...data });
  }

  toFirestore() {
    return {
      jours: this.jours,
      dateMaj: this.dateMaj,
    };
  }
}
