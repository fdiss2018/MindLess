import { db } from '../../../coeur/firebaseAdmin.js';

// Profil nutritionnel d'un membre ({ sexe, anneeNaissance, niveauActivite, poidsKg }), donnée du
// module menus : stocké sous le foyer (foyers/{foyerId}/profilsNutritionnels/{uid}) comme toutes
// les données de module, et non plus sur utilisateurs/{uid} (cœur).
const docRef = (foyerId, uid) => db.collection('foyers').doc(foyerId)
  .collection('profilsNutritionnels').doc(uid);

export const ProfilNutritionnelRepository = {
  async obtenir(foyerId, uid) {
    const snap = await docRef(foyerId, uid).get();
    if (snap.exists) return snap.data();
    return this.migrerAncienEmplacement(foyerId, uid);
  },

  async enregistrer(foyerId, uid, profil) {
    await docRef(foyerId, uid).set(profil);
  },

  // Migration paresseuse (2026-10) : avant le cloisonnement cœur/modules, le profil vivait dans le
  // champ utilisateurs/{uid}.profilNutritionnel. Seule lecture d'une collection du cœur par ce
  // module : recopie le profil au nouvel emplacement à la première lecture, puis n'est plus
  // sollicitée. À supprimer une fois tous les profils existants relus au moins une fois.
  async migrerAncienEmplacement(foyerId, uid) {
    const ancien = (await db.collection('utilisateurs').doc(uid).get()).data()?.profilNutritionnel;
    if (!ancien) return null;
    await this.enregistrer(foyerId, uid, ancien);
    return ancien;
  },
};
