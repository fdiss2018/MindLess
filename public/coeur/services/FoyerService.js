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

  // Le client ne peut pas lire utilisateurs/{uid} directement (firestore.rules) : seul le backend
  // (SDK Admin) résout le nom affiché des membres. Retourne
  // [{ uid, nomAffiche, photoUrl, estAdministrateur, modules }] — nomAffiche à `null` si le compte
  // d'un membre est introuvable (cas limite).
  async listerMembres(foyerId) {
    return ApiClient.get(`/api/foyers/${foyerId}/membres`);
  },

  // Réservé à l'administrateur du foyer (403 sinon) — remplace la liste des modules ouverts au
  // membre `uid`.
  async definirModulesMembre(foyerId, uid, modules) {
    return ApiClient.put(`/api/foyers/${foyerId}/membres/${uid}/modules`, { modules });
  },

  // Lecture temps réel conservée en direct sur Firestore (hybride) : la liste
  // des membres doit se mettre à jour instantanément sur settings.html quand
  // quelqu'un rejoint le foyer, sans recharger la page. Toujours protégée par
  // firestore.rules (lecture seule, réservée aux membres).
  ecouterFoyer(foyerId, callback) {
    return onSnapshot(doc(db, 'foyers', foyerId), (snap) => {
      callback(snap.exists() ? Foyer.fromFirestore(snap.id, snap.data()) : null);
    });
  },
};
