import { Router } from 'express';
import { PlanningRepasRepository } from '../repositories/PlanningRepasRepository.js';
import { JOURS_SEMAINE, CRENEAUX_REPAS } from '../domain/DateSemaine.js';
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
    const { jour, creneau } = req.params;
    // Sans cette vérification, jour/creneau (pris tels quels dans un chemin de champ Firestore
    // "jours.<jour>.<creneau>") laisseraient n'importe quelle chaîne créer une clé arbitraire dans
    // le document, corrompant la structure fixe 7 jours × {midi,soir} que menus.html/
    // GenerateurListeCourses/AnalyseNutritionnelleSemaine supposent tous en itérant planning.jours.
    if (!JOURS_SEMAINE.includes(jour) || !CRENEAUX_REPAS.includes(creneau)) {
      return res.status(400).json({ erreur: 'Jour ou créneau invalide.' });
    }

    await PlanningRepasRepository.mettreAJourCreneau(
      req.params.foyerId,
      req.params.idSemaine,
      jour,
      creneau,
      { texte: req.body.texte ?? null, recetteId: req.body.recetteId ?? null },
    );
    res.status(204).end();
  } catch (err) { next(err); }
});
