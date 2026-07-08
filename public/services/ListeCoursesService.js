import { db } from '../firebase-config.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ListeCoursesItem } from '../models/ListeCoursesItem.js';

const collectionRef = (foyerId) => collection(db, 'foyers', foyerId, 'listeCourses');

export const ListeCoursesService = {

  async ajouterItem(foyerId, item) {
    const ref = await addDoc(collectionRef(foyerId), item.toFirestore());
    return ref.id;
  },

  async basculerCoche(foyerId, itemId, coche) {
    await updateDoc(doc(db, 'foyers', foyerId, 'listeCourses', itemId), {
      coche, dateMaj: new Date().toISOString(),
    });
  },

  async modifierItem(foyerId, itemId, donnees) {
    await updateDoc(doc(db, 'foyers', foyerId, 'listeCourses', itemId), donnees);
  },

  async supprimerItem(foyerId, itemId) {
    await deleteDoc(doc(db, 'foyers', foyerId, 'listeCourses', itemId));
  },

  async listerItems(foyerId) {
    const snap = await getDocs(collectionRef(foyerId));
    return snap.docs.map(d => ListeCoursesItem.fromFirestore(d.id, d.data()));
  },

  ecouterListe(foyerId, callback) {
    return onSnapshot(collectionRef(foyerId), (snap) => {
      callback(snap.docs.map(d => ListeCoursesItem.fromFirestore(d.id, d.data())));
    });
  },

  // Écrit en une seule transaction les créations et modifications issues de la
  // génération de liste depuis le planning (voir utils/GenerateurListeCourses.js).
  async ecrireLot(foyerId, itemsACreer, itemsAModifier) {
    const batch = writeBatch(db);
    const maintenant = new Date().toISOString();

    itemsACreer.forEach((donnees) => {
      const item = new ListeCoursesItem({ ...donnees, dateAjout: maintenant, dateMaj: maintenant });
      batch.set(doc(collectionRef(foyerId)), item.toFirestore());
    });

    itemsAModifier.forEach(({ id, ...donnees }) => {
      batch.update(doc(db, 'foyers', foyerId, 'listeCourses', id), { ...donnees, dateMaj: maintenant });
    });

    await batch.commit();
  },
};
