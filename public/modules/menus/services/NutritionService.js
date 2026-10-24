import { ApiClient } from '../../../coeur/services/ApiClient.js';

const base = (foyerId) => `/api/foyers/${foyerId}/nutrition`;

export const NutritionService = {

  async obtenirBilanSemaine(foyerId, idSemaine) {
    return ApiClient.get(`${base(foyerId)}/bilan?semaine=${idSemaine}`);
  },

  // Profil de l'utilisateur connecté : { sexe, anneeNaissance, niveauActivite, poidsKg } | null.
  async obtenirProfil(foyerId) {
    return ApiClient.get(`${base(foyerId)}/profil`);
  },

  async enregistrerProfil(foyerId, profil) {
    await ApiClient.put(`${base(foyerId)}/profil`, profil);
  },
};
