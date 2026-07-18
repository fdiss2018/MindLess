import { db } from '../../firebase-config.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ApiClient } from '../../commun/services/ApiClient.js';
import { ListeCoursesItem } from '../models/ListeCoursesItem.js';

const base = (foyerId) => `/api/foyers/${foyerId}/liste-courses`;

export const ListeCoursesService = {

  async ajouterItem(foyerId, item) {
    const { id } = await ApiClient.post(base(foyerId), item.toFirestore());
    return id;
  },

  async basculerCoche(foyerId, itemId, coche) {
    await ApiClient.patch(`${base(foyerId)}/${itemId}/coche`, { coche });
  },

  async modifierItem(foyerId, itemId, donnees) {
    await ApiClient.patch(`${base(foyerId)}/${itemId}`, donnees);
  },

  async supprimerItem(foyerId, itemId) {
    await ApiClient.delete(`${base(foyerId)}/${itemId}`);
  },

  async listerItems(foyerId) {
    const items = await ApiClient.get(base(foyerId));
    return items.map((d) => new ListeCoursesItem(d));
  },

  // Orchestration planning + recettes + fusion + écriture, entièrement côté
  // backend désormais (voir backend/src/routes/listeCourses.js).
  async genererDepuisPlanning(foyerId, idSemaine) {
    return ApiClient.post(`${base(foyerId)}/generer`, { idSemaine });
  },

  // Lecture temps réel conservée en direct sur Firestore (hybride) : les coches
  // doivent se synchroniser instantanément entre les membres du foyer.
  // Toujours protégée par firestore.rules (lecture seule).
  ecouterListe(foyerId, callback) {
    return onSnapshot(collection(db, 'foyers', foyerId, 'listeCourses'), (snap) => {
      callback(snap.docs.map((d) => ListeCoursesItem.fromFirestore(d.id, d.data())));
    });
  },
};
