import { db } from '../firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, orderBy, query,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { Entretien } from '../models/Entretien.js';

const collectionRef = (foyerId, vehiculeId) =>
  collection(db, 'foyers', foyerId, 'vehicules', vehiculeId, 'entretiens');

export const EntretienService = {

  async ajouterEntretien(foyerId, vehiculeId, entretien) {
    const ref = await addDoc(collectionRef(foyerId, vehiculeId), entretien.toFirestore());
    return ref.id;
  },

  async modifierEntretien(foyerId, vehiculeId, entretienId, donnees) {
    await updateDoc(doc(db, 'foyers', foyerId, 'vehicules', vehiculeId, 'entretiens', entretienId), donnees);
  },

  async supprimerEntretien(foyerId, vehiculeId, entretienId) {
    await deleteDoc(doc(db, 'foyers', foyerId, 'vehicules', vehiculeId, 'entretiens', entretienId));
  },

  async listerEntretiens(foyerId, vehiculeId) {
    const q = query(collectionRef(foyerId, vehiculeId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => Entretien.fromFirestore(d.id, d.data()));
  },

  ecouterEntretiens(foyerId, vehiculeId, callback) {
    const q = query(collectionRef(foyerId, vehiculeId), orderBy('date', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => Entretien.fromFirestore(d.id, d.data())));
    });
  },
};
