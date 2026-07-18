import { db } from '../../commun/firebaseAdmin.js';
import { ListeCoursesItem } from '../domain/ListeCoursesItem.js';

const collectionRef = (foyerId) => db.collection('foyers').doc(foyerId).collection('listeCourses');

export const ListeCoursesRepository = {
  async ajouter(foyerId, item) {
    const ref = await collectionRef(foyerId).add(item.toFirestore());
    return ref.id;
  },

  async basculerCoche(foyerId, itemId, coche) {
    await collectionRef(foyerId).doc(itemId).update({ coche, dateMaj: new Date().toISOString() });
  },

  async modifier(foyerId, itemId, donnees) {
    await collectionRef(foyerId).doc(itemId).update(donnees);
  },

  async supprimer(foyerId, itemId) {
    await collectionRef(foyerId).doc(itemId).delete();
  },

  async lister(foyerId) {
    const snap = await collectionRef(foyerId).get();
    return snap.docs.map((d) => ListeCoursesItem.fromFirestore(d.id, d.data()));
  },

  // Écrit en un seul batch atomique les créations et modifications issues de la
  // génération de liste depuis le planning (voir domain/GenerateurListeCourses.js).
  async ecrireLot(foyerId, itemsACreer, itemsAModifier) {
    const batch = db.batch();
    const maintenant = new Date().toISOString();

    itemsACreer.forEach((donnees) => {
      const item = new ListeCoursesItem({ ...donnees, dateAjout: maintenant, dateMaj: maintenant });
      batch.set(collectionRef(foyerId).doc(), item.toFirestore());
    });

    itemsAModifier.forEach(({ id, ...donnees }) => {
      batch.update(collectionRef(foyerId).doc(id), { ...donnees, dateMaj: maintenant });
    });

    await batch.commit();
  },
};
