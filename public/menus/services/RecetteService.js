import { ApiClient } from '../../commun/services/ApiClient.js';
import { Recette } from '../models/Recette.js';

const base = (foyerId) => `/api/foyers/${foyerId}/recettes`;

export const RecetteService = {

  async ajouterRecette(foyerId, recette) {
    const { id } = await ApiClient.post(base(foyerId), recette.toFirestore());
    return id;
  },

  async modifierRecette(foyerId, recetteId, donnees) {
    await ApiClient.put(`${base(foyerId)}/${recetteId}`, donnees);
  },

  async supprimerRecette(foyerId, recetteId) {
    await ApiClient.delete(`${base(foyerId)}/${recetteId}`);
  },

  async obtenirRecette(foyerId, recetteId) {
    try {
      const donnees = await ApiClient.get(`${base(foyerId)}/${recetteId}`);
      return new Recette(donnees);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  async listerRecettes(foyerId) {
    const items = await ApiClient.get(base(foyerId));
    return items.map((d) => new Recette(d));
  },
};
