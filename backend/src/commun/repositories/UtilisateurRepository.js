import { db } from '../firebaseAdmin.js';
import { Utilisateur } from '../domain/Utilisateur.js';

const docRef = (uid) => db.collection('utilisateurs').doc(uid);

export const UtilisateurRepository = {
  async obtenir(uid) {
    const snap = await docRef(uid).get();
    return snap.exists ? Utilisateur.fromFirestore(snap.id, snap.data()) : null;
  },

  async creer(utilisateur) {
    await docRef(utilisateur.id).set(utilisateur.toFirestore());
    return utilisateur;
  },

  async mettreAJour(uid, donnees) {
    await docRef(uid).update(donnees);
  },
};
