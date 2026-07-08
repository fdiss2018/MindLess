import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { PlanningRepas } from '../models/PlanningRepas.js';

const docRef = (foyerId, idSemaine) => doc(db, 'foyers', foyerId, 'planningRepas', idSemaine);

export const PlanningRepasService = {

  async obtenirOuCreerSemaine(foyerId, idSemaine) {
    const ref = docRef(foyerId, idSemaine);
    const snap = await getDoc(ref);
    if (snap.exists()) return PlanningRepas.fromFirestore(snap.id, snap.data());

    const planning = new PlanningRepas({ id: idSemaine, dateMaj: new Date().toISOString() });
    await setDoc(ref, planning.toFirestore());
    return planning;
  },

  async mettreAJourCreneau(foyerId, idSemaine, jour, creneau, valeur) {
    const planning = await this.obtenirOuCreerSemaine(foyerId, idSemaine);
    planning.jours[jour][creneau] = valeur;
    planning.dateMaj = new Date().toISOString();
    await setDoc(docRef(foyerId, idSemaine), planning.toFirestore());
  },

  ecouterSemaine(foyerId, idSemaine, callback) {
    return onSnapshot(docRef(foyerId, idSemaine), (snap) => {
      callback(snap.exists()
        ? PlanningRepas.fromFirestore(snap.id, snap.data())
        : new PlanningRepas({ id: idSemaine }));
    });
  },
};
