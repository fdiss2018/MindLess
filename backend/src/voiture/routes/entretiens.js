import { Router } from 'express';
import { EntretienRepository } from '../repositories/EntretienRepository.js';
import { Entretien } from '../domain/Entretien.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';

// Monté sur /api/foyers/:foyerId/vehicules/:vehiculeId/entretiens
export const entretiensRouter = Router({ mergeParams: true });

entretiensRouter.use(requireUid, requireMembreFoyer);

entretiensRouter.get('/', async (req, res, next) => {
  try {
    res.json(await EntretienRepository.lister(req.params.foyerId, req.params.vehiculeId));
  } catch (err) { next(err); }
});

entretiensRouter.post('/', async (req, res, next) => {
  try {
    const entretien = new Entretien({
      ...req.body, creePar: req.uid, dateCreation: new Date().toISOString(),
    });
    const id = await EntretienRepository.ajouter(
      req.params.foyerId,
      req.params.vehiculeId,
      entretien,
    );
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

entretiensRouter.put('/:entretienId', async (req, res, next) => {
  try {
    await EntretienRepository.modifier(
      req.params.foyerId,
      req.params.vehiculeId,
      req.params.entretienId,
      req.body,
    );
    res.status(204).end();
  } catch (err) { next(err); }
});

entretiensRouter.delete('/:entretienId', async (req, res, next) => {
  try {
    await EntretienRepository.supprimer(
      req.params.foyerId,
      req.params.vehiculeId,
      req.params.entretienId,
    );
    res.status(204).end();
  } catch (err) { next(err); }
});
