import { Router } from 'express';
import { FoyerRepository } from '../repositories/FoyerRepository.js';
import { requireUid } from '../middleware/requireUid.js';

export const foyersRouter = Router();

foyersRouter.use(requireUid);

foyersRouter.post('/', async (req, res, next) => {
  try {
    const foyer = await FoyerRepository.creer(req.body.nom, req.uid);
    res.status(201).json(foyer);
  } catch (err) { next(err); }
});

foyersRouter.post('/:id/rejoindre', async (req, res, next) => {
  try {
    const code = req.params.id.trim().toUpperCase();
    const foyer = await FoyerRepository.rejoindre(code, req.uid);
    res.json(foyer);
  } catch (err) { next(err); }
});
