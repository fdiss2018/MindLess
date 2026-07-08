import { db } from '../firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { Recette } from '../models/Recette.js';

const collectionRef = (foyerId) => collection(db, 'foyers', foyerId, 'recettes');

export const RecetteService = {

  async ajouterRecette(foyerId, recette) {
    const ref = await addDoc(collectionRef(foyerId), recette.toFirestore());
    return ref.id;
  },

  async modifierRecette(foyerId, recetteId, donnees) {
    await updateDoc(doc(db, 'foyers', foyerId, 'recettes', recetteId), donnees);
  },

  async supprimerRecette(foyerId, recetteId) {
    await deleteDoc(doc(db, 'foyers', foyerId, 'recettes', recetteId));
  },

  async obtenirRecette(foyerId, recetteId) {
    const snap = await getDoc(doc(db, 'foyers', foyerId, 'recettes', recetteId));
    return snap.exists() ? Recette.fromFirestore(snap.id, snap.data()) : null;
  },

  async listerRecettes(foyerId) {
    const snap = await getDocs(collectionRef(foyerId));
    return snap.docs.map(d => Recette.fromFirestore(d.id, d.data()));
  },

  async obtenirRecettesParIds(foyerId, ids) {
    const idsUniques = [...new Set(ids)];
    const recettes = await Promise.all(idsUniques.map(id => this.obtenirRecette(foyerId, id)));
    const parId = {};
    recettes.forEach((r) => { if (r) parId[r.id] = r; });
    return parId;
  },

  ecouterRecettes(foyerId, callback) {
    return onSnapshot(collectionRef(foyerId), (snap) => {
      callback(snap.docs.map(d => Recette.fromFirestore(d.id, d.data())));
    });
  },
};
