import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { Utilisateur } from '../models/Utilisateur.js';

const collectionRef = (uid) => doc(db, 'utilisateurs', uid);

export const UtilisateurService = {

  async obtenirOuCreerUtilisateur(userGoogle) {
    const ref = collectionRef(userGoogle.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return Utilisateur.fromFirestore(snap.id, snap.data());

    const utilisateur = new Utilisateur({
      id: userGoogle.uid,
      email: userGoogle.email,
      nomAffiche: userGoogle.displayName || userGoogle.email,
      photoUrl: userGoogle.photoURL || '',
      foyerId: null,
    });
    await setDoc(ref, utilisateur.toFirestore());
    return utilisateur;
  },

  async mettreAJourFoyerId(uid, foyerId) {
    await updateDoc(collectionRef(uid), { foyerId });
  },

  ecouterUtilisateur(uid, callback) {
    return onSnapshot(collectionRef(uid), (snap) => {
      callback(snap.exists() ? Utilisateur.fromFirestore(snap.id, snap.data()) : null);
    });
  },
};
