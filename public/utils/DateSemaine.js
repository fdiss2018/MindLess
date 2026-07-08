export const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const CRENEAUX_REPAS = ['midi', 'soir'];

// Identifiant ISO-8601 d'une semaine ("2026-W28") à partir d'une date.
export function getIdSemaine(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const jourIso = d.getUTCDay() || 7; // lundi=1 ... dimanche=7
  d.setUTCDate(d.getUTCDate() + 4 - jourIso);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const numeroSemaine = Math.ceil((((d - debutAnnee) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(numeroSemaine).padStart(2, '0')}`;
}

function dateLundiDeSemaine(idSemaine) {
  const [anneeStr, semaineStr] = idSemaine.split('-W');
  const annee = Number(anneeStr);
  const semaine = Number(semaineStr);
  const approx = new Date(Date.UTC(annee, 0, 1 + (semaine - 1) * 7));
  const jourIso = approx.getUTCDay() || 7;
  approx.setUTCDate(approx.getUTCDate() + (jourIso <= 4 ? 1 - jourIso : 8 - jourIso));
  return approx;
}

// Les 7 dates (lundi à dimanche) correspondant à une semaine donnée.
export function getDatesSemaine(idSemaine) {
  const lundi = dateLundiDeSemaine(idSemaine);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi);
    d.setUTCDate(lundi.getUTCDate() + i);
    return d;
  });
}

export function semaineSuivante(idSemaine) {
  const lundi = dateLundiDeSemaine(idSemaine);
  lundi.setUTCDate(lundi.getUTCDate() + 7);
  return getIdSemaine(lundi);
}

export function semainePrecedente(idSemaine) {
  const lundi = dateLundiDeSemaine(idSemaine);
  lundi.setUTCDate(lundi.getUTCDate() - 7);
  return getIdSemaine(lundi);
}
