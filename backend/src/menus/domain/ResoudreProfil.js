// Traduit le profil nutritionnel d'un utilisateur (sexe, année de naissance...)
// en clé de la table ObjectifsNutritionnels. Un profil absent, ou un champ
// manquant/non reconnu, retombe sur "adulte_generique" plutôt que de bloquer
// le calcul — voir public/models/Utilisateur.js pour la forme de
// profilNutritionnel.
//
// V1 : une seule tranche d'âge (adulte). Ajouter une tranche plus tard revient
// à enrichir resoudreTrancheAge() sans toucher resoudreSexe() ni l'appelant.
function resoudreTrancheAge() {
  return 'adulte';
}

function resoudreSexe(sexe) {
  return sexe === 'homme' || sexe === 'femme' ? sexe : 'generique';
}

export function resoudreProfil(profilNutritionnel) {
  const trancheAge = resoudreTrancheAge(profilNutritionnel?.anneeNaissance);
  const sexe = resoudreSexe(profilNutritionnel?.sexe);
  return `${trancheAge}_${sexe}`;
}
