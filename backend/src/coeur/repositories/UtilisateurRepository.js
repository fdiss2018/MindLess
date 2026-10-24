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

  // Get-or-create à partir des informations du token Firebase (email/nom/photo,
  // voir middleware/auth.js) plutôt que d'un objet utilisateur Google passé par
  // le front. `cree` indique si le compte vient d'être créé.
  async obtenirOuCreer(uid, profilGoogle) {
    const existant = await this.obtenir(uid);
    if (existant) return { utilisateur: existant, cree: false };

    const utilisateur = new Utilisateur({
      id: uid,
      email: profilGoogle?.email || '',
      nomAffiche: profilGoogle?.nomAffiche || '',
      photoUrl: profilGoogle?.photoUrl || '',
      foyerId: null,
    });
    await this.creer(utilisateur);
    return { utilisateur, cree: true };
  },

  async mettreAJour(uid, donnees) {
    await docRef(uid).update(donnees);
  },
};
