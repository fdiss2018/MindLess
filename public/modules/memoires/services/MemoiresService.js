import { ApiClient } from '../../../coeur/services/ApiClient.js';
import { NoteMemoire } from '../models/NoteMemoire.js';
import { ChapitreMemoire } from '../models/ChapitreMemoire.js';

// Toutes ces routes portent sur les mémoires de l'utilisateur connecté (voir
// backend/src/modules/memoires/routes/memoires.js).
const base = (foyerId) => `/api/foyers/${foyerId}/memoires`;

export const MemoiresService = {

  async listerNotes(foyerId) {
    const notes = await ApiClient.get(`${base(foyerId)}/notes`);
    return notes.map((n) => new NoteMemoire(n));
  },

  // type : 'souvenir' (matière du chapitre) ou 'instruction' (consigne pour l'écrire).
  async ajouterNote(foyerId, texte, type = 'souvenir') {
    const { id } = await ApiClient.post(`${base(foyerId)}/notes`, { texte, type });
    return id;
  },

  async supprimerNote(foyerId, noteId) {
    await ApiClient.delete(`${base(foyerId)}/notes/${noteId}`);
  },

  async listerChapitres(foyerId) {
    const chapitres = await ApiClient.get(`${base(foyerId)}/chapitres`);
    return chapitres.map((c) => new ChapitreMemoire(c));
  },

  async supprimerChapitre(foyerId, chapitreId) {
    return ApiClient.delete(`${base(foyerId)}/chapitres/${chapitreId}`);
  },

  async obtenirParametres(foyerId) {
    return ApiClient.get(`${base(foyerId)}/parametres`);
  },

  async enregistrerParametres(foyerId, parametres) {
    return ApiClient.put(`${base(foyerId)}/parametres`, parametres);
  },

  // Écrit un nouveau chapitre à partir des souvenirs pas encore utilisés, dans le style des
  // paramètres et selon les instructions en attente (IA, côté backend).
  // Retourne { chapitre, numero, notesSupprimees, souvenirsRestants }.
  async synthetiser(foyerId) {
    const resultat = await ApiClient.post(`${base(foyerId)}/synthetiser`);
    return { ...resultat, chapitre: new ChapitreMemoire(resultat.chapitre) };
  },
};
