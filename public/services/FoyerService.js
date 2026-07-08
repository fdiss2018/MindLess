import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { Foyer } from '../models/Foyer.js';
import { genererCodeInvitation } from '../utils/CodeInvitation.js';

const MAX_TENTATIVES_CODE = 5;

export const FoyerService = {

  async creerFoyer(nom, uid) {
    for (let tentative = 0; tentative < MAX_TENTATIVES_CODE; tentative++) {
      const code = genererCodeInvitation();
      const ref = doc(db, 'foyers', code);
      const snap = await getDoc(ref);
      if (snap.exists()) continue; // collision improbable, on retire un autre code

      const foyer = new Foyer({
        id: code,
        nom,
        membres: [uid],
        creePar: uid,
        dateCreation: new Date().toISOString(),
      });
      await setDoc(ref, foyer.toFirestore());
      return foyer;
    }
    throw new Error("Impossible de générer un code d'invitation, réessayez.");
  },

  async rejoindreFoyer(code, uid) {
    const codeNormalise = code.trim().toUpperCase();
    const ref = doc(db, 'foyers', codeNormalise);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Aucun foyer ne correspond à ce code.");

    await updateDoc(ref, { membres: arrayUnion(uid) });
    const misAJour = await getDoc(ref);
    return Foyer.fromFirestore(misAJour.id, misAJour.data());
  },

  async obtenirFoyer(foyerId) {
    const snap = await getDoc(doc(db, 'foyers', foyerId));
    return snap.exists() ? Foyer.fromFirestore(snap.id, snap.data()) : null;
  },

  ecouterFoyer(foyerId, callback) {
    return onSnapshot(doc(db, 'foyers', foyerId), (snap) => {
      callback(snap.exists() ? Foyer.fromFirestore(snap.id, snap.data()) : null);
    });
  },
};
