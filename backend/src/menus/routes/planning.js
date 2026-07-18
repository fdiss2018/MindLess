import { Router } from 'express';
import { PlanningRepasRepository } from '../repositories/PlanningRepasRepository.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';

// Monté sur /api/foyers/:foyerId/planning
export const planningRouter = Router({ mergeParams: true });

planningRouter.use(requireUid, requireMembreFoyer);

planningRouter.get('/:idSemaine', async (req, res, next) => {
  try {
    const planning = await PlanningRepasRepository.obtenirOuCreerSemaine(
      req.params.foyerId,
      req.params.idSemaine,
    );
    res.json(planning);
  } catch (err) { next(err); }
});

planningRouter.patch('/:idSemaine/creneaux/:jour/:creneau', async (req, res, next) => {
  try {
    await PlanningRepasRepository.mettreAJourCreneau(
      req.params.foyerId,
      req.params.idSemaine,
      req.params.jour,
      req.params.creneau,
      req.body,
    );
    res.status(204).end();
  } catch (err) { next(err); }
});
