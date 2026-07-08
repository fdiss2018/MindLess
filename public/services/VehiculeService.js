import { db } from '../firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { Vehicule } from '../models/Vehicule.js';

const collectionRef = (foyerId) => collection(db, 'foyers', foyerId, 'vehicules');

export const VehiculeService = {

  async ajouterVehicule(foyerId, vehicule) {
    const ref = await addDoc(collectionRef(foyerId), vehicule.toFirestore());
    return ref.id;
  },

  async modifierVehicule(foyerId, vehiculeId, donnees) {
    await updateDoc(doc(db, 'foyers', foyerId, 'vehicules', vehiculeId), donnees);
  },

  async supprimerVehicule(foyerId, vehiculeId) {
    await deleteDoc(doc(db, 'foyers', foyerId, 'vehicules', vehiculeId));
  },

  async obtenirVehicule(foyerId, vehiculeId) {
    const snap = await getDoc(doc(db, 'foyers', foyerId, 'vehicules', vehiculeId));
    return snap.exists() ? Vehicule.fromFirestore(snap.id, snap.data()) : null;
  },

  async listerVehicules(foyerId) {
    const snap = await getDocs(collectionRef(foyerId));
    return snap.docs.map(d => Vehicule.fromFirestore(d.id, d.data()));
  },

  ecouterVehicules(foyerId, callback) {
    return onSnapshot(collectionRef(foyerId), (snap) => {
      callback(snap.docs.map(d => Vehicule.fromFirestore(d.id, d.data())));
    });
  },
};
