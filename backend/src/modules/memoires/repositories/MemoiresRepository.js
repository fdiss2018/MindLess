import { db } from '../../../coeur/firebaseAdmin.js';
import { NoteMemoire } from '../domain/NoteMemoire.js';
import { ChapitreMemoire } from '../domain/ChapitreMemoire.js';
import { normaliserParametres } from '../domain/SyntheseMemoires.js';

// Les mémoires sont personnelles : tout est rangé sous l'uid du membre, dans son foyer.
//   foyers/{foyerId}/memoires/{uid}                         paramètres du membre
//   foyers/{foyerId}/memoires/{uid}/notes/{noteId}
//   foyers/{foyerId}/memoires/{uid}/chapitres/{chapitreId}
const racine = (foyerId, uid) => db.collection('foyers').doc(foyerId).collection('memoires').doc(uid);
const notesRef = (foyerId, uid) => racine(foyerId, uid).collection('notes');
const chapitresRef = (foyerId, uid) => racine(foyerId, uid).collection('chapitres');

export const MemoiresRepository = {
  async listerNotes(foyerId, uid) {
    const snap = await notesRef(foyerId, uid).orderBy('dateCreation').get();
    return snap.docs.map((d) => NoteMemoire.fromFirestore(d.id, d.data()));
  },

  async ajouterNote(foyerId, uid, note) {
    const ref = await notesRef(foyerId, uid).add(note.toFirestore());
    return ref.id;
  },

  async supprimerNote(foyerId, uid, noteId) {
    await notesRef(foyerId, uid).doc(noteId).delete();
  },

  async listerChapitres(foyerId, uid) {
    const snap = await chapitresRef(foyerId, uid).orderBy('dateCreation').get();
    return snap.docs.map((d) => ChapitreMemoire.fromFirestore(d.id, d.data()));
  },

  async obtenirParametres(foyerId, uid) {
    const snap = await racine(foyerId, uid).get();
    return normaliserParametres(snap.data());
  },

  async enregistrerParametres(foyerId, uid, parametres) {
    await racine(foyerId, uid).set(parametres, { merge: true });
  },

  // Écrit le chapitre et traite ses notes sources en un seul batch atomique : supprimées, ou
  // marquées comme synthétisées dans ce chapitre — jamais un chapitre sans que ses notes soient
  // traitées, ni l'inverse.
  async enregistrerSynthese(foyerId, uid, chapitre, supprimerNotes) {
    const batch = db.batch();
    const ref = chapitresRef(foyerId, uid).doc();
    batch.set(ref, chapitre.toFirestore());
    chapitre.noteIds.forEach((noteId) => {
      const refNote = notesRef(foyerId, uid).doc(noteId);
      if (supprimerNotes) batch.delete(refNote);
      else batch.update(refNote, { chapitreId: ref.id });
    });
    await batch.commit();
    chapitre.id = ref.id;
    return chapitre;
  },

  // Supprime un chapitre ; ses notes encore conservées redeviennent "à synthétiser" — permet de
  // refaire un chapitre qui ne convient pas.
  async supprimerChapitre(foyerId, uid, chapitreId) {
    const notesLiees = await notesRef(foyerId, uid).where('chapitreId', '==', chapitreId).get();
    const batch = db.batch();
    batch.delete(chapitresRef(foyerId, uid).doc(chapitreId));
    notesLiees.docs.forEach((d) => batch.update(d.ref, { chapitreId: null }));
    await batch.commit();
    return notesLiees.size;
  },
};
