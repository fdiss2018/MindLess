import { ApiClient } from '../../commun/services/ApiClient.js';

export const NutritionService = {

  async obtenirBilanSemaine(foyerId, idSemaine) {
    return ApiClient.get(`/api/foyers/${foyerId}/nutrition/bilan?semaine=${idSemaine}`);
  },
};
