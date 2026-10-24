// Catalogue des modules fonctionnels et règles d'accès d'un membre du foyer — fonctions pures, seule
// source de vérité des droits côté backend (requireModule, /api/session, firestore.rules en est la
// traduction pour les 2 lectures temps réel de modules). Côté front, public/coeur/utils/Modules.js
// reprend les mêmes identifiants avec leur présentation (libellé, icône, page) : copie assumée,
// comme les autres fichiers dupliqués front/back.
//
// Règles :
// - l'administrateur du foyer (son créateur, foyer.creePar) a toujours accès à tous les modules —
//   il ne peut pas s'en retirer l'accès, ce qui lui garantit de pouvoir toujours rouvrir un module ;
// - un membre a accès aux modules que l'administrateur lui a ouverts (foyer.modulesParMembre[uid]) ;
// - un membre peut aussi demander lui-même un module (Settings) : il y a accès tout de suite, À
//   L'ESSAI, pendant DUREE_ACCES_TEMPORAIRE_JOURS, le temps que l'administrateur confirme (accès
//   définitif) ou décoche (refus) — foyer.demandesModules[uid][module] ;
// - sans confirmation, l'essai expire de lui-même (calculé à la lecture, aucune tâche planifiée) ;
//   le membre peut aussi l'arrêter plus tôt (expiration avancée à maintenant) ; après un refus ou
//   une expiration, il ne peut pas relancer d'essai : seul l'administrateur peut alors lui ouvrir
//   le module ;
// - aucune entrée = aucun module (refus par défaut : un nouveau membre ne voit que le cœur).
export const IDS_MODULES = ['voiture', 'courses', 'menus', 'veille', 'memoires'];

export const DUREE_ACCES_TEMPORAIRE_JOURS = 21;
const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

export function estAdministrateur(foyer, uid) {
  return !!foyer && !!uid && foyer.creePar === uid;
}

const estMembre = (foyer, uid) => !!foyer && !!uid && !!foyer.membres?.includes(uid);

// Ne garde que des identifiants connus du catalogue, sans doublon, dans l'ordre du catalogue —
// une saisie invalide (module supprimé, faute de frappe) est ignorée plutôt que stockée.
export function normaliserModules(ids) {
  if (!Array.isArray(ids)) return [];
  return IDS_MODULES.filter((id) => ids.includes(id));
}

// Une demande : { statut: 'en_attente' | 'refusee', dateDemande?: ISO, expiration?: ms, dateRefus?: ISO }.
// `expiration` est un nombre (millisecondes) pour pouvoir être comparé dans firestore.rules.
// Renvoie 'en_attente' (essai en cours), 'expiree', 'refusee', ou null (pas de demande).
export function statutDemande(demande, maintenant = new Date()) {
  if (!demande) return null;
  if (demande.statut === 'refusee') return 'refusee';
  if (demande.statut === 'en_attente') {
    return demande.expiration > maintenant.getTime() ? 'en_attente' : 'expiree';
  }
  return null;
}

// État de chaque module du catalogue pour un membre : 'ouvert' (définitif), 'temporaire' (à
// l'essai), 'refuse', 'expire' ou 'ferme' — avec dateDemande/expiration pour une demande.
export function etatModules(foyer, uid, maintenant = new Date()) {
  if (!estMembre(foyer, uid)) return IDS_MODULES.map((id) => ({ id, statut: 'ferme' }));
  const administrateur = estAdministrateur(foyer, uid);
  const confirmes = normaliserModules(foyer.modulesParMembre?.[uid]);
  const demandes = foyer.demandesModules?.[uid] || {};

  return IDS_MODULES.map((id) => {
    if (administrateur || confirmes.includes(id)) return { id, statut: 'ouvert' };
    const demande = demandes[id];
    const statut = { en_attente: 'temporaire', expiree: 'expire', refusee: 'refuse' }[statutDemande(demande, maintenant)];
    if (!statut) return { id, statut: 'ferme' };
    return {
      id, statut, dateDemande: demande.dateDemande ?? null, expiration: demande.expiration ?? null,
    };
  });
}

export function modulesAccessibles(foyer, uid, maintenant = new Date()) {
  return etatModules(foyer, uid, maintenant)
    .filter((etat) => etat.statut === 'ouvert' || etat.statut === 'temporaire')
    .map((etat) => etat.id);
}

export function aAccesModule(foyer, uid, idModule, maintenant = new Date()) {
  return modulesAccessibles(foyer, uid, maintenant).includes(idModule);
}

// Nombre d'essais en attente de confirmation dans le foyer (badge de l'administrateur).
export function compterDemandesEnAttente(foyer, maintenant = new Date()) {
  return (foyer?.membres || [])
    .filter((uid) => !estAdministrateur(foyer, uid))
    .flatMap((uid) => etatModules(foyer, uid, maintenant))
    .filter((etat) => etat.statut === 'temporaire')
    .length;
}

// Un membre demande un module : message d'erreur si la demande n'est pas recevable, sinon null.
export function refusDemande(foyer, uid, idModule, maintenant = new Date()) {
  if (!IDS_MODULES.includes(idModule)) return 'Module inconnu.';
  if (estAdministrateur(foyer, uid)) return "L'administrateur a déjà accès à tous les modules.";
  const { statut } = etatModules(foyer, uid, maintenant).find((etat) => etat.id === idModule);
  return {
    ouvert: 'Ce module t\'est déjà ouvert.',
    temporaire: 'Tu as déjà ce module à l\'essai.',
    refuse: "L'administrateur a refusé ce module : parles-en avec lui.",
    expire: "Ton essai s'est terminé sans confirmation : parles-en à l'administrateur.",
  }[statut] ?? null;
}

export function creerDemande(maintenant = new Date()) {
  return {
    statut: 'en_attente',
    dateDemande: maintenant.toISOString(),
    expiration: maintenant.getTime() + DUREE_ACCES_TEMPORAIRE_JOURS * MS_PAR_JOUR,
  };
}

// L'administrateur coche/décoche les modules d'un membre (liste complète des cases cochées) :
// - coché : accès définitif, sauf un module à l'essai qui reste à l'essai (la confirmation est une
//   action explicite, voir confirmerModule) — toucher une autre case ne confirme rien par mégarde ;
// - décoché alors qu'il était ouvert ou à l'essai : refusé (le membre ne peut plus le redemander).
// Renvoie les nouvelles valeurs à écrire : { modules: [...définitifs], demandes: { [id]: demande | null } }
// (null = demande effacée).
export function appliquerChoixAdministrateur(foyer, uid, modulesCoches, maintenant = new Date()) {
  const coches = normaliserModules(modulesCoches);
  const confirmes = normaliserModules(foyer.modulesParMembre?.[uid]);
  const demandes = foyer.demandesModules?.[uid] || {};
  const modules = [];
  const changements = {};

  IDS_MODULES.forEach((id) => {
    const aLEssai = statutDemande(demandes[id], maintenant) === 'en_attente';
    if (coches.includes(id)) {
      if (aLEssai) return;
      modules.push(id);
      if (demandes[id]) changements[id] = null;
    } else if (confirmes.includes(id) || aLEssai) {
      changements[id] = {
        statut: 'refusee', dateDemande: demandes[id]?.dateDemande ?? null, dateRefus: maintenant.toISOString(),
      };
    }
  });

  return { modules, demandes: changements };
}

// L'administrateur confirme un module (à l'essai, refusé ou expiré) : il devient définitif.
export function confirmerModule(foyer, uid, idModule) {
  const modules = normaliserModules([...(foyer.modulesParMembre?.[uid] || []), idModule]);
  const demandes = foyer.demandesModules?.[uid]?.[idModule] ? { [idModule]: null } : {};
  return { modules, demandes };
}
