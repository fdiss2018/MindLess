import { describe, it, expect } from 'vitest';
import { genererItemsDepuisPlanning, fusionnerAvecListeExistante } from '../public/utils/GenerateurListeCourses.js';

function planningVide() {
  const jours = {};
  ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].forEach((jour) => {
    jours[jour] = { midi: { texte: null, recetteId: null }, soir: { texte: null, recetteId: null } };
  });
  return { jours };
}

const recettePates = {
  id: 'rec-pates',
  nom: 'Pâtes bolognaise',
  ingredients: [
    { nom: 'Pâtes', quantite: 500, unite: 'g' },
    { nom: 'Viande hachée', quantite: 400, unite: 'g' },
  ],
};

const recetteSalade = {
  id: 'rec-salade',
  nom: 'Salade de tomates',
  ingredients: [
    { nom: 'Tomates', quantite: 4, unite: 'pièce' },
    { nom: 'Pâtes', quantite: 100, unite: 'g' }, // même ingrédient/unité que la recette précédente
  ],
};

describe('genererItemsDepuisPlanning', () => {
  it('ignore les créneaux en texte libre et les créneaux vides', () => {
    const planning = planningVide();
    planning.jours.lundi.midi = { texte: 'Reste du frigo', recetteId: null };
    const items = genererItemsDepuisPlanning(planning, {});
    expect(items).toHaveLength(0);
  });

  it('agrège les ingrédients de plusieurs recettes sur la semaine, y compris doublons nom+unité', () => {
    const planning = planningVide();
    planning.jours.lundi.soir = { texte: null, recetteId: 'rec-pates' };
    planning.jours.mardi.midi = { texte: null, recetteId: 'rec-salade' };

    const recettesParId = { 'rec-pates': recettePates, 'rec-salade': recetteSalade };
    const items = genererItemsDepuisPlanning(planning, recettesParId);

    const pates = items.find(i => i.nom === 'Pâtes');
    expect(pates.quantite).toBe(600); // 500 + 100
    expect(pates.recetteIds.sort()).toEqual(['rec-pates', 'rec-salade']);

    const tomates = items.find(i => i.nom === 'Tomates');
    expect(tomates.quantite).toBe(4);
  });
});

describe('fusionnerAvecListeExistante', () => {
  it('crée un nouvel item quand rien ne correspond dans la liste existante', () => {
    const { itemsACreer, itemsAModifier } = fusionnerAvecListeExistante(
      [{ nom: 'Pâtes', unite: 'g', quantite: 500, recetteIds: ['rec-pates'] }],
      [],
    );
    expect(itemsACreer).toHaveLength(1);
    expect(itemsAModifier).toHaveLength(0);
    expect(itemsACreer[0].origine).toBe('recette');
  });

  it('ne touche jamais un item déjà coché', () => {
    const { itemsACreer, itemsAModifier } = fusionnerAvecListeExistante(
      [{ nom: 'Pâtes', unite: 'g', quantite: 500, recetteIds: ['rec-pates'] }],
      [{ id: '1', nom: 'Pâtes', unite: 'g', quantite: 200, coche: true, origine: 'manuel' }],
    );
    expect(itemsACreer).toHaveLength(0);
    expect(itemsAModifier).toHaveLength(0);
  });

  it('met à jour un item non coché d\'origine "recette" avec la nouvelle quantité totale', () => {
    const { itemsAModifier } = fusionnerAvecListeExistante(
      [{ nom: 'Pâtes', unite: 'g', quantite: 700, recetteIds: ['rec-pates', 'rec-salade'] }],
      [{ id: '1', nom: 'Pâtes', unite: 'g', quantite: 500, coche: false, origine: 'recette', recetteIds: ['rec-pates'] }],
    );
    expect(itemsAModifier).toHaveLength(1);
    expect(itemsAModifier[0]).toMatchObject({ id: '1', quantite: 700 });
  });

  it('additionne à un item "manuel" existant et le fait passer en "mixte" sans écraser la quantité saisie', () => {
    const { itemsAModifier } = fusionnerAvecListeExistante(
      [{ nom: 'Pâtes', unite: 'g', quantite: 500, recetteIds: ['rec-pates'] }],
      [{ id: '1', nom: 'Pâtes', unite: 'g', quantite: 200, coche: false, origine: 'manuel', recetteIds: [] }],
    );
    expect(itemsAModifier[0]).toMatchObject({ id: '1', quantite: 700, origine: 'mixte' });
    expect(itemsAModifier[0].recetteIds).toEqual(['rec-pates']);
  });

  it('ne supprime jamais un item existant qui ne correspond plus à aucune recette planifiée', () => {
    const { itemsACreer, itemsAModifier } = fusionnerAvecListeExistante(
      [],
      [{ id: '1', nom: 'Fromage', unite: 'g', quantite: 200, coche: false, origine: 'recette', recetteIds: ['rec-x'] }],
    );
    expect(itemsACreer).toHaveLength(0);
    expect(itemsAModifier).toHaveLength(0);
  });

  it('ne duplique pas les articles en générant deux fois de suite (idempotence sur une liste déjà à jour)', () => {
    const genere = [{ nom: 'Pâtes', unite: 'g', quantite: 500, recetteIds: ['rec-pates'] }];
    const premierePasse = fusionnerAvecListeExistante(genere, []);
    const itemExistant = { id: '1', nom: 'Pâtes', unite: 'g', ...premierePasse.itemsACreer[0] };
    const deuxiemePasse = fusionnerAvecListeExistante(genere, [itemExistant]);
    expect(deuxiemePasse.itemsACreer).toHaveLength(0);
    expect(deuxiemePasse.itemsAModifier).toHaveLength(1);
    expect(deuxiemePasse.itemsAModifier[0].quantite).toBe(500);
  });
});
