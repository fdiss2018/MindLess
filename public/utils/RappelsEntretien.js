import { REGLES_ENTRETIEN } from './ReglesEntretien.js';

const SEUIL_KM_PROCHE = 1000;
const SEUIL_JOURS_PROCHE = 30;

function ajouterMois(dateIso, mois) {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + mois);
  return d;
}

function joursEntre(dateA, dateB) {
  const MS_PAR_JOUR = 1000 * 60 * 60 * 24;
  return Math.round((dateA.getTime() - dateB.getTime()) / MS_PAR_JOUR);
}

function dernierEntretienDuType(entretiens, type) {
  const correspondants = entretiens.filter(e => e.type === type);
  if (correspondants.length === 0) return null;
  return correspondants.reduce((plusRecent, courant) => (
    new Date(courant.date) > new Date(plusRecent.date) ? courant : plusRecent
  ));
}

function determinerStatut(kmRestants, joursRestants) {
  if ((kmRestants !== null && kmRestants <= 0) || (joursRestants !== null && joursRestants <= 0)) {
    return 'du';
  }
  if ((kmRestants !== null && kmRestants <= SEUIL_KM_PROCHE)
    || (joursRestants !== null && joursRestants <= SEUIL_JOURS_PROCHE)) {
    return 'proche';
  }
  return 'ok';
}

// Fonction pure : calcule le statut de rappel de chaque type d'entretien
// ayant au moins un intervalle défini (km et/ou mois), à partir de l'historique du véhicule.
export function calculerRappels(vehicule, entretiens, dateActuelle) {
  return REGLES_ENTRETIEN
    .filter(regle => regle.intervalleKm !== null || regle.intervalleMois !== null)
    .map((regle) => {
      const dernier = dernierEntretienDuType(entretiens, regle.type);

      if (!dernier) {
        return {
          type: regle.type, label: regle.label, statut: 'inconnu',
          kmRestants: null, joursRestants: null,
        };
      }

      const kmRestants = regle.intervalleKm !== null
        ? (dernier.kilometrage + regle.intervalleKm) - vehicule.kilometrageActuel
        : null;

      const joursRestants = regle.intervalleMois !== null
        ? joursEntre(ajouterMois(dernier.date, regle.intervalleMois), dateActuelle)
        : null;

      return {
        type: regle.type,
        label: regle.label,
        statut: determinerStatut(kmRestants, joursRestants),
        kmRestants,
        joursRestants,
      };
    });
}
