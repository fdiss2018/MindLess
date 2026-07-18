import { db } from '../../commun/firebaseAdmin.js';
import { Entretien } from '../domain/Entretien.js';

const collectionRef = (foyerId, vehiculeId) => db.collection('foyers').doc(foyerId)
  .collection('vehicules').doc(vehiculeId).collection('entretiens');

export const EntretienRepository = {
  async ajouter(foyerId, vehiculeId, entretien) {
    const ref = await collectionRef(foyerId, vehiculeId).add(entretien.toFirestore());
    return ref.id;
  },

  async modifier(foyerId, vehiculeId, entretienId, donnees) {
    await collectionRef(foyerId, vehiculeId).doc(entretienId).update(donnees);
  },

  async supprimer(foyerId, vehiculeId, entretienId) {
    await collectionRef(foyerId, vehiculeId).doc(entretienId).delete();
  },

  async lister(foyerId, vehiculeId) {
    const snap = await collectionRef(foyerId, vehiculeId).orderBy('date', 'desc').get();
    return snap.docs.map((d) => Entretien.fromFirestore(d.id, d.data()));
  },
};
