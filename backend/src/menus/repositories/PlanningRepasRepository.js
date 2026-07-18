import { db } from '../../commun/firebaseAdmin.js';
import { PlanningRepas } from '../domain/PlanningRepas.js';

const docRef = (foyerId, idSemaine) => db.collection('foyers').doc(foyerId)
  .collection('planningRepas').doc(idSemaine);

export const PlanningRepasRepository = {
  async obtenirOuCreerSemaine(foyerId, idSemaine) {
    const ref = docRef(foyerId, idSemaine);
    const snap = await ref.get();
    if (snap.exists) return PlanningRepas.fromFirestore(snap.id, snap.data());

    const planning = new PlanningRepas({ id: idSemaine, dateMaj: new Date().toISOString() });
    await ref.set(planning.toFirestore());
    return planning;
  },

  // Update atomique par chemin de champ (jours.<jour>.<creneau>) : corrige le
  // read-modify-write non transactionnel de l'ancien PlanningRepasService côté
  // client, qui pouvait perdre la modification d'un autre membre du foyer en
  // cas d'édition simultanée de deux créneaux différents.
  async mettreAJourCreneau(foyerId, idSemaine, jour, creneau, valeur) {
    await this.obtenirOuCreerSemaine(foyerId, idSemaine);
    await docRef(foyerId, idSemaine).update({
      [`jours.${jour}.${creneau}`]: valeur,
      dateMaj: new Date().toISOString(),
    });
  },
};
