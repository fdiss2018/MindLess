import { Router } from 'express';
import { UtilisateurRepository } from '../repositories/UtilisateurRepository.js';
import { FoyerRepository } from '../repositories/FoyerRepository.js';
import { requireUid } from '../middleware/requireUid.js';
import { estAdministrateur, modulesAccessibles } from '../domain/AccesModules.js';

export const sessionRouter = Router();

// Tout ce dont une page a besoin pour démarrer, en un seul appel (voir
// public/coeur/services/Session.js) : l'utilisateur, son foyer, et les modules
// qui lui sont ouverts. C'est le backend qui calcule les droits — le front ne
// fait qu'afficher ou rediriger d'après cette réponse, sans recalculer.
// `foyer` vaut null si l'utilisateur n'est rattaché à aucun foyer, ou à un
// foyer dont il n'est pas (ou plus) membre.
sessionRouter.get('/session', requireUid, async (req, res, next) => {
  try {
    const { utilisateur } = await UtilisateurRepository.obtenirOuCreer(req.uid, req.profilGoogle);
    const foyer = utilisateur.foyerId ? await FoyerRepository.obtenir(utilisateur.foyerId) : null;
    const estMembre = !!foyer && foyer.membres.includes(req.uid);

    res.json({
      utilisateur,
      foyer: estMembre ? { id: foyer.id, nom: foyer.nom } : null,
      estAdministrateur: estMembre && estAdministrateur(foyer, req.uid),
      modules: estMembre ? modulesAccessibles(foyer, req.uid) : [],
    });
  } catch (err) { next(err); }
});
