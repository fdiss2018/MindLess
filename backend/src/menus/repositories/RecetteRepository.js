import { db } from '../../commun/firebaseAdmin.js';
import { Recette } from '../domain/Recette.js';

const collectionRef = (foyerId) => db.collection('foyers').doc(foyerId).collection('recettes');

export const RecetteRepository = {
  async ajouter(foyerId, recette) {
    const ref = await collectionRef(foyerId).add(recette.toFirestore());
    return ref.id;
  },

  async modifier(foyerId, recetteId, donnees) {
    await collectionRef(foyerId).doc(recetteId).update(donnees);
  },

  async supprimer(foyerId, recetteId) {
    await collectionRef(foyerId).doc(recetteId).delete();
  },

  async obtenir(foyerId, recetteId) {
    const snap = await collectionRef(foyerId).doc(recetteId).get();
    return snap.exists ? Recette.fromFirestore(snap.id, snap.data()) : null;
  },

  async lister(foyerId) {
    const snap = await collectionRef(foyerId).get();
    return snap.docs.map((d) => Recette.fromFirestore(d.id, d.data()));
  },

  async obtenirParIds(foyerId, ids) {
    const idsUniques = [...new Set(ids)];
    const recettes = await Promise.all(idsUniques.map((id) => this.obtenir(foyerId, id)));
    const parId = {};
    recettes.forEach((r) => { if (r) parId[r.id] = r; });
    return parId;
  },
};
