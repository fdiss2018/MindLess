import { Router } from 'express';
import { ListeCoursesRepository } from '../repositories/ListeCoursesRepository.js';
import { PlanningRepasRepository } from '../repositories/PlanningRepasRepository.js';
import { RecetteRepository } from '../repositories/RecetteRepository.js';
import { ListeCoursesItem } from '../domain/ListeCoursesItem.js';
import {
  genererItemsDepuisPlanning, fusionnerAvecListeExistante,
} from '../domain/GenerateurListeCourses.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';

// Monté sur /api/foyers/:foyerId/liste-courses
export const listeCoursesRouter = Router({ mergeParams: true });

listeCoursesRouter.use(requireUid, requireMembreFoyer);

listeCoursesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await ListeCoursesRepository.lister(req.params.foyerId));
  } catch (err) { next(err); }
});

listeCoursesRouter.post('/', async (req, res, next) => {
  try {
    const maintenant = new Date().toISOString();
    const item = new ListeCoursesItem({ ...req.body, dateAjout: maintenant, dateMaj: maintenant });
    const id = await ListeCoursesRepository.ajouter(req.params.foyerId, item);
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

// Orchestre planning + recettes + GenerateurListeCourses + écriture batch —
// remplace l'orchestration multi-services faite auparavant côté client dans
// courses.html.
listeCoursesRouter.post('/generer', async (req, res, next) => {
  try {
    const { foyerId } = req.params;
    const { idSemaine } = req.body;

    const planning = await PlanningRepasRepository.obtenirOuCreerSemaine(foyerId, idSemaine);
    const idsRecettes = Object.values(planning.jours)
      .flatMap((jour) => Object.values(jour))
      .map((creneau) => creneau.recetteId)
      .filter(Boolean);

    const recettesParId = await RecetteRepository.obtenirParIds(foyerId, idsRecettes);
    const itemsGeneres = genererItemsDepuisPlanning(planning, recettesParId);
    const itemsExistants = await ListeCoursesRepository.lister(foyerId);
    const { itemsACreer, itemsAModifier } = fusionnerAvecListeExistante(itemsGeneres, itemsExistants);

    await ListeCoursesRepository.ecrireLot(foyerId, itemsACreer, itemsAModifier);
    res.json({ crees: itemsACreer.length, modifies: itemsAModifier.length });
  } catch (err) { next(err); }
});

listeCoursesRouter.patch('/:itemId/coche', async (req, res, next) => {
  try {
    await ListeCoursesRepository.basculerCoche(req.params.foyerId, req.params.itemId, req.body.coche);
    res.status(204).end();
  } catch (err) { next(err); }
});

listeCoursesRouter.patch('/:itemId', async (req, res, next) => {
  try {
    await ListeCoursesRepository.modifier(req.params.foyerId, req.params.itemId, req.body);
    res.status(204).end();
  } catch (err) { next(err); }
});

listeCoursesRouter.delete('/:itemId', async (req, res, next) => {
  try {
    await ListeCoursesRepository.supprimer(req.params.foyerId, req.params.itemId);
    res.status(204).end();
  } catch (err) { next(err); }
});
