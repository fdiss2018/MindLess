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

// Liste blanche des champs modifiables — sans ça, req.body passé tel quel à Firestore
// laisserait n'importe quel membre réécrire creePar/dateCreation.
const CHAMPS_MODIFIABLES = ['nom', 'marque', 'modele', 'immatriculation', 'kilometrageActuel', 'dateMajKilometrage'];

vehiculesRouter.put('/:vehiculeId', async (req, res, next) => {
  try {
    const donnees = {};
    for (const champ of CHAMPS_MODIFIABLES) {
      if (champ in req.body) donnees[champ] = req.body[champ];
    }
    await VehiculeRepository.modifier(req.params.foyerId, req.params.vehiculeId, donnees);
    res.status(204).end();
  } catch (err) { next(err); }
});

vehiculesRouter.delete('/:vehiculeId', async (req, res, next) => {
  try {
    await VehiculeRepository.supprimer(req.params.foyerId, req.params.vehiculeId);
    res.status(204).end();
  } catch (err) { next(err); }
});
