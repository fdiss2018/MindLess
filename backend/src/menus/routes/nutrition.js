import { Router } from 'express';
import { PlanningRepasRepository } from '../repositories/PlanningRepasRepository.js';
import { RecetteRepository } from '../repositories/RecetteRepository.js';
import { UtilisateurRepository } from '../../commun/repositories/UtilisateurRepository.js';
import { calculerPortionsConsommees, comparerBilanSemaine } from '../domain/AnalyseNutritionnelleSemaine.js';
import { resoudreProfil } from '../domain/ResoudreProfil.js';
import { obtenirObjectifsSemaine } from '../domain/ObjectifsNutritionnels.js';
import { getIdSemaine } from '../domain/DateSemaine.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';

// Monté sur /api/foyers/:foyerId/nutrition
export const nutritionRouter = Router({ mergeParams: true });

nutritionRouter.use(requireUid, requireMembreFoyer);

nutritionRouter.get('/bilan', async (req, res, next) => {
  try {
    const { foyerId } = req.params;
    const idSemaine = req.query.semaine || getIdSemaine(new Date());

    const planning = await PlanningRepasRepository.obtenirOuCreerSemaine(foyerId, idSemaine);
    const idsRecettes = Object.values(planning.jours)
      .flatMap((jour) => Object.values(jour))
      .map((creneau) => creneau.recetteId)
      .filter(Boolean);
    const recettesParId = await RecetteRepository.obtenirParIds(foyerId, idsRecettes);

    const portionsConsommees = calculerPortionsConsommees(planning, recettesParId);

    // req.foyer est déjà chargé par requireMembreFoyer — on y lit la liste des
    // membres plutôt que de refaire une lecture Firestore.
    const utilisateurs = await Promise.all(
      req.foyer.membres.map((uid) => UtilisateurRepository.obtenir(uid)),
    );

    const bilansParMembre = utilisateurs
      .filter((u) => u && u.profilNutritionnel)
      .map((u) => {
        const cleProfil = resoudreProfil(u.profilNutritionnel);
        const objectifs = obtenirObjectifsSemaine(cleProfil);
        return {
          uid: u.id,
          nomAffiche: u.nomAffiche,
          cleProfil,
          comparaison: comparerBilanSemaine(portionsConsommees, objectifs),
        };
      });

    res.json({
      idSemaine,
      repasNonEvalues: portionsConsommees.repasNonEvalues,
      portionsParGroupe: portionsConsommees.portionsParGroupe,
      bilansParMembre,
    });
  } catch (err) { next(err); }
});
