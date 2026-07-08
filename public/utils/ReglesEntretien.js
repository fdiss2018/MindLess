// Intervalles de référence utilisés pour calculer les rappels d'entretien.
// intervalleKm/intervalleMois à null = ce critère n'est pas pris en compte pour ce type.
export const REGLES_ENTRETIEN = [
  { type: 'vidange', label: 'Vidange', intervalleKm: 15000, intervalleMois: 12 },
  { type: 'controleTechnique', label: 'Contrôle technique', intervalleKm: null, intervalleMois: 24 },
  { type: 'pneus', label: 'Pneus', intervalleKm: 40000, intervalleMois: null },
  { type: 'freins', label: 'Plaquettes de frein', intervalleKm: 30000, intervalleMois: null },
  { type: 'revisionGenerale', label: 'Révision générale', intervalleKm: 20000, intervalleMois: 12 },
  { type: 'autre', label: 'Autre', intervalleKm: null, intervalleMois: null },
];

export function obtenirRegle(type) {
  return REGLES_ENTRETIEN.find(r => r.type === type);
}
