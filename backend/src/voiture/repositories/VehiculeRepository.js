import { db } from '../../commun/firebaseAdmin.js';
import { Vehicule } from '../domain/Vehicule.js';

const collectionRef = (foyerId) => db.collection('foyers').doc(foyerId).collection('vehicules');

export const VehiculeRepository = {
  async ajouter(foyerId, vehicule) {
    const ref = await collectionRef(foyerId).add(vehicule.toFirestore());
    return ref.id;
  },

  async modifier(foyerId, vehiculeId, donnees) {
    await collectionRef(foyerId).doc(vehiculeId).update(donnees);
  },

  async supprimer(foyerId, vehiculeId) {
    await collectionRef(foyerId).doc(vehiculeId).delete();
  },

  async obtenir(foyerId, vehiculeId) {
    const snap = await collectionRef(foyerId).doc(vehiculeId).get();
    return snap.exists ? Vehicule.fromFirestore(snap.id, snap.data()) : null;
  },

  async lister(foyerId) {
    const snap = await collectionRef(foyerId).get();
    return snap.docs.map((d) => Vehicule.fromFirestore(d.id, d.data()));
  },
};
