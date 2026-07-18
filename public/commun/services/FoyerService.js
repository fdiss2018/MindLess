import { db } from '../../firebase-config.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { ApiClient } from './ApiClient.js';
import { Foyer } from '../models/Foyer.js';

export const FoyerService = {

  async creerFoyer(nom) {
    const donnees = await ApiClient.post('/api/foyers', { nom });
    return new Foyer(donnees);
  },

  async rejoindreFoyer(code) {
    const donnees = await ApiClient.post(`/api/foyers/${code.trim().toUpperCase()}/rejoindre`);
    return new Foyer(donnees);
  },

  // Lecture temps réel conservée en direct sur Firestore (hybride) : le nombre
  // de membres doit se mettre à jour instantanément sur foyer.html sans
  // recharger la page. Toujours protégée par firestore.rules (lecture seule,
  // réservée aux membres).
  ecouterFoyer(foyerId, callback) {
    return onSnapshot(doc(db, 'foyers', foyerId), (snap) => {
      callback(snap.exists() ? Foyer.fromFirestore(snap.id, snap.data()) : null);
    });
  },
};
