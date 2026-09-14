import { ApiClient } from '../../commun/services/ApiClient.js';

const base = (foyerId) => `/api/foyers/${foyerId}/lignes-editoriales`;

export const LigneEditorialeService = {
  // Retourne un objet { [categorie]: texte } — toujours complet (une clé par catégorie), le
  // backend résout déjà la valeur par défaut pour les catégories jamais personnalisées.
  async obtenirLignesEditoriales(foyerId) {
    return ApiClient.get(base(foyerId));
  },

  // Réservé au créateur du foyer côté backend (403 sinon) — voir requireCreateurFoyer.
  async enregistrerLignesEditoriales(foyerId, lignes) {
    await ApiClient.put(base(foyerId), lignes);
  },
};
