import { Router } from 'express';
import { RecetteRepository } from '../repositories/RecetteRepository.js';
import { Recette } from '../domain/Recette.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';

// Monté sur /api/foyers/:foyerId/recettes
export const recettesRouter = Router({ mergeParams: true });

recettesRouter.use(requireUid, requireMembreFoyer);

recettesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await RecetteRepository.lister(req.params.foyerId));
  } catch (err) { next(err); }
});

recettesRouter.post('/', async (req, res, next) => {
  try {
    const recette = new Recette({
      ...req.body, creePar: req.uid, dateCreation: new Date().toISOString(),
    });
    const id = await RecetteRepository.ajouter(req.params.foyerId, recette);
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

recettesRouter.get('/:recetteId', async (req, res, next) => {
  try {
    const recette = await RecetteRepository.obtenir(req.params.foyerId, req.params.recetteId);
    if (!recette) return res.status(404).json({ erreur: 'Recette introuvable.' });
    res.json(recette);
  } catch (err) { next(err); }
});

recettesRouter.put('/:recetteId', async (req, res, next) => {
  try {
    await RecetteRepository.modifier(req.params.foyerId, req.params.recetteId, req.body);
    res.status(204).end();
  } catch (err) { next(err); }
});

recettesRouter.delete('/:recetteId', async (req, res, next) => {
  try {
    await RecetteRepository.supprimer(req.params.foyerId, req.params.recetteId);
    res.status(204).end();
  } catch (err) { next(err); }
});
