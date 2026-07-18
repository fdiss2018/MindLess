// Cibles hebdomadaires en nombre de portions par groupe alimentaire, par
// profil. Table pure : ajouter une tranche d'âge (enfant, senior) revient à
// ajouter une entrée ici, sans toucher au reste du calcul (voir ResoudreProfil
// et AnalyseNutritionnelleSemaine).
export const OBJECTIFS_PAR_PROFIL = {
  adulte_homme: {
    legumes: 21, fruits: 14, feculents: 21, legumineuses: 2, proteinesAnimales: 10, produitsLaitiers: 14,
  },
  adulte_femme: {
    legumes: 21, fruits: 14, feculents: 14, legumineuses: 2, proteinesAnimales: 7, produitsLaitiers: 14,
  },
  // Utilisé quand le sexe n'est pas renseigné ou pas reconnu — moyenne des
  // deux profils adultes sur les groupes qui varient (féculents, protéines).
  adulte_generique: {
    legumes: 21, fruits: 14, feculents: 18, legumineuses: 2, proteinesAnimales: 9, produitsLaitiers: 14,
  },
};

export function obtenirObjectifsSemaine(cleProfil) {
  return OBJECTIFS_PAR_PROFIL[cleProfil] || OBJECTIFS_PAR_PROFIL.adulte_generique;
}
