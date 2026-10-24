// Catalogue des modules fonctionnels et règles d'accès d'un membre du foyer — fonctions pures, seule
// source de vérité des droits côté backend (requireModule, /api/session, firestore.rules en est la
// traduction pour les 2 lectures temps réel de modules). Côté front, public/coeur/utils/Modules.js
// reprend les mêmes identifiants avec leur présentation (libellé, icône, page) : copie assumée,
// comme les autres fichiers dupliqués front/back.
//
// Règles :
// - l'administrateur du foyer (son créateur, foyer.creePar) a toujours accès à tous les modules —
//   il ne peut pas s'en retirer l'accès, ce qui lui garantit de pouvoir toujours rouvrir un module ;
// - tout autre membre n'a accès qu'aux modules listés pour lui dans foyer.modulesParMembre[uid] ;
//   aucune entrée = aucun module (refus par défaut : un nouveau membre ne voit que le cœur, Settings,
//   jusqu'à ce que l'administrateur lui ouvre des modules).
export const IDS_MODULES = ['voiture', 'courses', 'menus', 'veille'];

export function estAdministrateur(foyer, uid) {
  return !!foyer && !!uid && foyer.creePar === uid;
}

// Ne garde que des identifiants connus du catalogue, sans doublon, dans l'ordre du catalogue —
// une saisie invalide (module supprimé, faute de frappe) est ignorée plutôt que stockée.
export function normaliserModules(ids) {
  if (!Array.isArray(ids)) return [];
  return IDS_MODULES.filter((id) => ids.includes(id));
}

export function modulesAccessibles(foyer, uid) {
  if (!foyer || !uid || !foyer.membres?.includes(uid)) return [];
  if (estAdministrateur(foyer, uid)) return [...IDS_MODULES];
  return normaliserModules(foyer.modulesParMembre?.[uid]);
}

export function aAccesModule(foyer, uid, idModule) {
  return modulesAccessibles(foyer, uid).includes(idModule);
}
