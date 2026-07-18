import { Router } from 'express';
import { VehiculeRepository } from '../repositories/VehiculeRepository.js';
import { Vehicule } from '../domain/Vehicule.js';
import { requireUid } from '../../commun/middleware/requireUid.js';
import { requireMembreFoyer } from '../../commun/middleware/requireMembreFoyer.js';

// Monté sur /api/foyers/:foyerId/vehicules — req.params.foyerId est déjà
// disponible ici (Express le renseigne depuis le chemin de montage).
export const vehiculesRouter = Router({ mergeParams: true });

vehiculesRouter.use(requireUid, requireMembreFoyer);

vehiculesRouter.get('/', async (req, res, next) => {
  try {
    res.json(await VehiculeRepository.lister(req.params.foyerId));
  } catch (err) { next(err); }
});

vehiculesRouter.post('/', async (req, res, next) => {
  try {
    const vehicule = new Vehicule({
      ...req.body, creePar: req.uid, dateCreation: new Date().toISOString(),
    });
    const id = await VehiculeRepository.ajouter(req.params.foyerId, vehicule);
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

vehiculesRouter.get('/:vehiculeId', async (req, res, next) => {
  try {
    const vehicule = await VehiculeRepository.obtenir(req.params.foyerId, req.params.vehiculeId);
    if (!vehicule) return res.status(404).json({ erreur: 'Véhicule introuvable.' });
    res.json(vehicule);
  } catch (err) { next(err); }
});

vehiculesRouter.put('/:vehiculeId', async (req, res, next) => {
  try {
    await VehiculeRepository.modifier(req.params.foyerId, req.params.vehiculeId, req.body);
    res.status(204).end();
  } catch (err) { next(err); }
});

vehiculesRouter.delete('/:vehiculeId', async (req, res, next) => {
  try {
    await VehiculeRepository.supprimer(req.params.foyerId, req.params.vehiculeId);
    res.status(204).end();
  } catch (err) { next(err); }
});
