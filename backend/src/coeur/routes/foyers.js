import { Router } from 'express';
import { FoyerRepository } from '../repositories/FoyerRepository.js';
import { UtilisateurRepository } from '../repositories/UtilisateurRepository.js';
import { requireUid } from '../middleware/requireUid.js';
import { requireMembreFoyer } from '../middleware/requireMembreFoyer.js';
import { requireCreateurFoyer } from '../middleware/requireCreateurFoyer.js';
import { estAdministrateur, modulesAccessibles, normaliserModules } from '../domain/AccesModules.js';

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

// Membres du foyer avec leur nom affiché et les modules qui leur sont ouverts — le client ne peut
// pas lire utilisateurs/{uid} directement (firestore.rules), seul le backend via le SDK Admin le
// peut. Ouvert à tout membre (Settings affiche la liste à chacun), la modification des droits
// restant réservée à l'administrateur (route suivante).
// Note : `:foyerId` (et non `:id` comme les routes ci-dessus) car requireMembreFoyer lit
// req.params.foyerId.
foyersRouter.get('/:foyerId/membres', requireMembreFoyer, async (req, res, next) => {
  try {
    const utilisateurs = await Promise.all(
      req.foyer.membres.map((uid) => UtilisateurRepository.obtenir(uid)),
    );
    res.json(req.foyer.membres.map((uid, i) => ({
      uid,
      nomAffiche: utilisateurs[i]?.nomAffiche || null,
      photoUrl: utilisateurs[i]?.photoUrl || null,
      estAdministrateur: estAdministrateur(req.foyer, uid),
      modules: modulesAccessibles(req.foyer, uid),
    })));
  } catch (err) { next(err); }
});

// Remplace la liste des modules ouverts à un membre. Body : { modules: ['voiture', ...] } —
// identifiants inconnus ignorés (normaliserModules). Les droits de l'administrateur ne se modifient
// pas : il a toujours accès à tout (voir domain/AccesModules.js).
foyersRouter.put('/:foyerId/membres/:uid/modules', requireMembreFoyer, requireCreateurFoyer, async (req, res, next) => {
  try {
    const { uid } = req.params;
    if (!req.foyer.membres.includes(uid)) {
      return res.status(404).json({ erreur: "Ce membre n'appartient pas au foyer." });
    }
    if (estAdministrateur(req.foyer, uid)) {
      return res.status(400).json({ erreur: "L'administrateur du foyer a toujours accès à tous les modules." });
    }

    const modules = normaliserModules(req.body.modules);
    await FoyerRepository.definirModulesMembre(req.foyer.id, uid, modules);
    res.json({ uid, modules });
  } catch (err) { next(err); }
});
