import { ApiClient } from '../../commun/services/ApiClient.js';
import { Vehicule } from '../models/Vehicule.js';

export const VehiculeService = {

  async ajouterVehicule(foyerId, vehicule) {
    const { id } = await ApiClient.post(`/api/foyers/${foyerId}/vehicules`, vehicule.toFirestore());
    return id;
  },

  async modifierVehicule(foyerId, vehiculeId, donnees) {
    await ApiClient.put(`/api/foyers/${foyerId}/vehicules/${vehiculeId}`, donnees);
  },

  async supprimerVehicule(foyerId, vehiculeId) {
    await ApiClient.delete(`/api/foyers/${foyerId}/vehicules/${vehiculeId}`);
  },

  async obtenirVehicule(foyerId, vehiculeId) {
    try {
      const donnees = await ApiClient.get(`/api/foyers/${foyerId}/vehicules/${vehiculeId}`);
      return new Vehicule(donnees);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  },

  async listerVehicules(foyerId) {
    const items = await ApiClient.get(`/api/foyers/${foyerId}/vehicules`);
    return items.map((d) => new Vehicule(d));
  },
};
