import { ApiClient } from './ApiClient.js';
import { Utilisateur } from '../models/Utilisateur.js';

export const UtilisateurService = {

  async obtenirOuCreerUtilisateur() {
    const donnees = await ApiClient.get('/api/utilisateurs/moi');
    return new Utilisateur(donnees);
  },

  async mettreAJourFoyerId(foyerId) {
    await ApiClient.put('/api/utilisateurs/moi/foyer', { foyerId });
  },

  async mettreAJourProfilNutritionnel(profilNutritionnel) {
    await ApiClient.put('/api/utilisateurs/moi/profil-nutritionnel', profilNutritionnel);
  },
};
