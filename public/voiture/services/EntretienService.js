import { ApiClient } from '../../commun/services/ApiClient.js';
import { Entretien } from '../models/Entretien.js';

const base = (foyerId, vehiculeId) => `/api/foyers/${foyerId}/vehicules/${vehiculeId}/entretiens`;

export const EntretienService = {

  async ajouterEntretien(foyerId, vehiculeId, entretien) {
    const { id } = await ApiClient.post(base(foyerId, vehiculeId), entretien.toFirestore());
    return id;
  },

  async modifierEntretien(foyerId, vehiculeId, entretienId, donnees) {
    await ApiClient.put(`${base(foyerId, vehiculeId)}/${entretienId}`, donnees);
  },

  async supprimerEntretien(foyerId, vehiculeId, entretienId) {
    await ApiClient.delete(`${base(foyerId, vehiculeId)}/${entretienId}`);
  },

  async listerEntretiens(foyerId, vehiculeId) {
    const items = await ApiClient.get(base(foyerId, vehiculeId));
    return items.map((d) => new Entretien(d));
  },
};
