// API publique du module menus : seul fichier de ce module qu'un AUTRE module a le droit
// d'importer (aujourd'hui : courses, pour générer la liste depuis le planning). Elle expose des
// données simples, jamais un repository ni une classe du domaine interne — menus reste libre de
// réorganiser son stockage sans casser ses consommateurs.
//
// L'appelant a déjà passé le contrôle d'accès de SON module : un membre qui a accès à courses mais
// pas à menus peut générer sa liste depuis le planning sans pour autant accéder au module menus.
import { PlanningRepasRepository } from './repositories/PlanningRepasRepository.js';
import { RecetteRepository } from './repositories/RecetteRepository.js';
import { agregerIngredientsSemaine } from './domain/IngredientsSemaine.js';

// Besoins en ingrédients des repas liés à une recette sur la semaine `idSemaine` ("2026-W28") :
// [{ nom, unite, quantite, recetteIds }].
export async function listerIngredientsSemaine(foyerId, idSemaine) {
  const planning = await PlanningRepasRepository.obtenirOuCreerSemaine(foyerId, idSemaine);
  const recettesParId = await RecetteRepository.obtenirParIds(foyerId, planning.idsRecettes());
  return agregerIngredientsSemaine(planning, recettesParId);
}
