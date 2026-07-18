import { db } from '../../firebase-config.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ApiClient } from '../../commun/services/ApiClient.js';
import { PlanningRepas } from '../models/PlanningRepas.js';

const base = (foyerId) => `/api/foyers/${foyerId}/planning`;

export const PlanningRepasService = {

  async obtenirOuCreerSemaine(foyerId, idSemaine) {
    const donnees = await ApiClient.get(`${base(foyerId)}/${idSemaine}`);
    return new PlanningRepas(donnees);
  },

  async mettreAJourCreneau(foyerId, idSemaine, jour, creneau, valeur) {
    await ApiClient.patch(`${base(foyerId)}/${idSemaine}/creneaux/${jour}/${creneau}`, valeur);
  },

  // Lecture temps réel conservée en direct sur Firestore (hybride) : plusieurs
  // membres du foyer éditent le même planning, la synchronisation doit être
  // instantanée. Toujours protégée par firestore.rules (lecture seule).
  ecouterSemaine(foyerId, idSemaine, callback) {
    return onSnapshot(doc(db, 'foyers', foyerId, 'planningRepas', idSemaine), (snap) => {
      callback(snap.exists()
        ? PlanningRepas.fromFirestore(snap.id, snap.data())
        : new PlanningRepas({ id: idSemaine }));
    });
  },
};
