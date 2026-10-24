// Contribution du module voiture à la page d'accueil (point d'extension `badgeAccueil`, voir
// coeur/utils/Modules.js) : nombre de rappels d'entretien dus ou proches, tous véhicules confondus.
// Chargé dynamiquement par index.html, et seulement si le module est ouvert à l'utilisateur.
import { VehiculeService } from './services/VehiculeService.js';
import { EntretienService } from './services/EntretienService.js';
import { calculerRappels } from './utils/RappelsEntretien.js';

export async function calculerBadge(foyerId) {
  const vehicules = await VehiculeService.listerVehicules(foyerId);
  let total = 0;
  for (const vehicule of vehicules) {
    const entretiens = await EntretienService.listerEntretiens(foyerId, vehicule.id);
    const rappels = calculerRappels(vehicule, entretiens, new Date());
    total += rappels.filter((r) => r.statut === 'du' || r.statut === 'proche').length;
  }
  return total;
}
