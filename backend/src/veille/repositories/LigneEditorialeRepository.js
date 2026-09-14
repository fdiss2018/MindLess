import { db } from '../../commun/firebaseAdmin.js';

// Document singleton par foyer (pas une collection de plusieurs documents) : une seule ligne
// éditoriale personnalisée par catégorie, regroupées dans un unique document plutôt qu'un
// document par catégorie.
const docRef = (foyerId) => db.collection('foyers').doc(foyerId).collection('veilleConfig').doc('lignesEditoriales');

export const LigneEditorialeRepository = {
  // Ne renvoie que les catégories effectivement personnalisées par ce foyer — à la route
  // (lignesEditoriales.js) de compléter avec les valeurs par défaut (LIGNES_EDITORIALES_PAR_DEFAUT).
  async obtenir(foyerId) {
    const snap = await docRef(foyerId).get();
    return snap.exists ? snap.data() : {};
  },

  async enregistrer(foyerId, lignesEditoriales) {
    await docRef(foyerId).set({ ...lignesEditoriales, dateMaj: new Date().toISOString() });
  },
};
