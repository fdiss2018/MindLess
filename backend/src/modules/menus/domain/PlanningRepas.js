// Copie assumée de public/modules/menus/models/PlanningRepas.js (pas de monorepo/package
// partagé entre front et backend).
import { JOURS_SEMAINE, CRENEAUX_REPAS } from './DateSemaine.js';

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
    this.id = id;
    this.jours = jours || joursVides();
    this.dateMaj = dateMaj;
  }

  static fromFirestore(id, data) {
    return new PlanningRepas({ id, ...data });
  }

  // Identifiants des recettes liées à un créneau de la semaine (les créneaux en texte libre n'en
  // ont pas) — avec doublons si une recette revient plusieurs fois.
  idsRecettes() {
    return Object.values(this.jours)
      .flatMap((jour) => Object.values(jour))
      .map((creneau) => creneau.recetteId)
      .filter(Boolean);
  }

  toFirestore() {
    return {
      jours: this.jours,
      dateMaj: this.dateMaj,
    };
  }
}
