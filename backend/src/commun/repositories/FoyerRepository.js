import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin.js';
import { Foyer } from '../domain/Foyer.js';
import { genererCodeInvitation } from '../domain/CodeInvitation.js';

const MAX_TENTATIVES_CODE = 5;

const docRef = (foyerId) => db.collection('foyers').doc(foyerId);

export const FoyerRepository = {
  async obtenir(foyerId) {
    const snap = await docRef(foyerId).get();
    return snap.exists ? Foyer.fromFirestore(snap.id, snap.data()) : null;
  },

  async creer(nom, uid) {
    for (let tentative = 0; tentative < MAX_TENTATIVES_CODE; tentative++) {
      const code = genererCodeInvitation();
      const ref = docRef(code);
      const snap = await ref.get();
      if (snap.exists) continue; // collision improbable, on retire un autre code

      const foyer = new Foyer({
        id: code,
        nom,
        membres: [uid],
        creePar: uid,
        dateCreation: new Date().toISOString(),
      });
      await ref.set(foyer.toFirestore());
      return foyer;
    }
    throw new Error("Impossible de générer un code d'invitation, réessayez.");
  },

  async rejoindre(foyerId, uid) {
    const ref = docRef(foyerId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Aucun foyer ne correspond à ce code.');

    await ref.update({ membres: FieldValue.arrayUnion(uid) });
    const misAJour = await ref.get();
    return Foyer.fromFirestore(misAJour.id, misAJour.data());
  },

  async estMembre(foyerId, uid) {
    const foyer = await this.obtenir(foyerId);
    return !!foyer && foyer.membres.includes(uid);
  },
};
